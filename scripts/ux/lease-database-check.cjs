// Disposable PostgreSQL acceptance checks. Never use production credentials.
// npm install --prefix /tmp/lease-pglite-check @electric-sql/pglite
// UX_PGLITE_DEPS=/tmp/lease-pglite-check node scripts/ux/lease-database-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const nativeUrl = process.env.UX_NATIVE_DATABASE_URL;
let db, nativePool;
if (nativeUrl) {
    let target;
    try { target = new URL(nativeUrl); }
    catch { throw Error('Invalid acceptance database URL.'); }
    if (!['postgres:','postgresql:'].includes(target.protocol) ||
        !['localhost','127.0.0.1','[::1]'].includes(target.hostname) ||
        !/^\/lease_acceptance_[a-z0-9_]+$/.test(target.pathname) || target.search || target.hash) {
        throw Error('Native tests require a loopback URL for a NEW lease_acceptance_* database, with no query parameters.');
    }
    const { Pool } = require('pg');
    nativePool = new Pool({connectionString:nativeUrl,max:8,connectionTimeoutMillis:5000,
        options:'-c timezone=UTC -c lock_timeout=10000 -c statement_timeout=30000'});
    db = {query:(...args)=>nativePool.query(...args),exec:sql=>nativePool.query(sql),close:()=>nativePool.end()};
} else {
    if (!process.env.UX_PGLITE_DEPS) throw Error('Set UX_PGLITE_DEPS or UX_NATIVE_DATABASE_URL for an isolated acceptance database.');
    const deps = createRequire(path.resolve(process.env.UX_PGLITE_DEPS, 'package.json'));
    const { PGlite } = deps('@electric-sql/pglite');
    const { btree_gist } = deps('@electric-sql/pglite/contrib/btree_gist');
    db = new PGlite({ extensions: { btree_gist } });
}
// PGlite has one session. Sequential checks only; no concurrency claims.
// Keep whole transactions isolated when browser background requests overlap.
let connectionTail = Promise.resolve();
const pool = nativePool || {
    async connect() {
        const previous = connectionTail;
        let unlock;
        connectionTail = new Promise(resolve => { unlock = resolve; });
        await previous;
        return { query: (sql, values) => db.query(sql, values), release: unlock };
    },
    async query(sql, values) {
        const client = await this.connect();
        try { return await client.query(sql, values); }
        finally { client.release(); }
    },
};
require.cache[require.resolve('../../config/db')] = { exports: pool };
const leases = require('../../services/leaseService');
const invoices = require('../../services/invoiceService');
const payments = require('../../services/paymentService');
const receipts = require('../../services/receiptService');
const admin = { id: 1, role: 'admin', public_id: 'user_acceptance_admin' };
const reason = 'Existing tenant registered during accountant workflow acceptance testing.';
const check = (label, value) => { assert.ok(value, label); console.log(`PASS: ${label}`); };
async function main(afterChecks) {
    if(nativePool) {
        const empty=await db.query(`SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'`);
        assert.equal(empty.rows[0].count,0,'Native acceptance database must be empty; no existing objects will be changed.');
        const version=(await db.query('SHOW server_version_num')).rows[0].server_version_num;
        assert.ok(Number(version)>=180000&&Number(version)<190000,'Native acceptance requires PostgreSQL 18.');
    }
    console.log((await db.query('SELECT version()')).rows[0].version);
    await db.exec(fs.readFileSync(path.join(root, 'database/schema.sql'), 'utf8'));
    // Legacy users alterations predate the numbered migrations in this repo.
    // Supply only the additional columns referenced by current migrations/services.
    await db.exec('ALTER TABLE users ADD COLUMN deleted_at timestamptz, ADD COLUMN profile_image_url text');
    const migrationDir = path.join(root, 'database/migrations');
    const migrations = fs.readdirSync(migrationDir).filter(n => n.endsWith('.sql')).sort();
    for (const file of migrations) {
        try { await db.exec(fs.readFileSync(path.join(migrationDir, file), 'utf8')); }
        catch (error) { throw Error(`Migration ${file}: ${error.message}`, { cause: error }); }
    }
    console.log(`Applied ${migrations.length} repository migrations.`);
    await db.exec(`BEGIN;
      INSERT INTO users(id,public_id,full_name,email,password,role,is_verified) VALUES
       (1,'user_acceptance_admin','Test Admin','admin@example.invalid','not-a-login-password','admin',true),
       (2,'user_acceptance_staff','Test Staff','staff@example.invalid','not-a-login-password','user',true);
      INSERT INTO owners(id,public_id,owner_type,display_name,country,status,created_by)
       VALUES(1,'owner_acceptance','individual','Test Owner','Tanzania','active',1);
      INSERT INTO properties(id,public_id,property_code,property_name,property_type,usage_category,region,country,operational_status,is_multi_unit,created_by)
       VALUES(1,'property_acceptance','ACCEPTANCE','Test Property','house','residential','Dar es Salaam','Tanzania','inactive',true,1);
      INSERT INTO property_owners(public_id,property_id,owner_id,ownership_percentage,is_primary_contact,effective_from,created_by)
       VALUES('ownership_acceptance',1,1,100,true,CURRENT_DATE-365,1);
      UPDATE properties SET operational_status='active' WHERE id=1;
      INSERT INTO units(id,public_id,property_id,unit_code,unit_type,operational_status,created_by)
       VALUES(1,'unit_acceptance',1,'A1','room','available',1);
      INSERT INTO tenants(id,public_id,tenant_type,display_name,status,created_by)
       VALUES(1,'tenant_acceptance','individual','Test Tenant','active',1);
      INSERT INTO owner_tenants(public_id,owner_id,tenant_id,created_by)
       VALUES('owner_tenant_acceptance',1,1,1);
      INSERT INTO owner_users(public_id,owner_id,user_id,can_manage_properties,can_manage_finances)
       VALUES('owner_user_acceptance',1,2,true,true);
      COMMIT;`);
    const dates = (await db.query(`SELECT (CURRENT_DATE-12)::text AS start, (CURRENT_DATE+90)::text AS finish,
      (CURRENT_DATE+17)::text AS period_end, CURRENT_DATE::text AS today,
      (CURRENT_TIMESTAMP-interval '1 minute')::text AS signed`)).rows[0];
    const leaseData = { owner_public_id:'owner_acceptance',property_public_id:'property_acceptance',unit_public_id:'unit_acceptance',
      tenant_public_id:'tenant_acceptance',start_date:dates.start,end_date:dates.finish,rent_amount:200000,notes:'Original contract notes' };
    const draft = await leases.createDraftLease({leaseData, authenticatedUser:admin});
    check('past-date lease draft created', draft.lease?.status === 'draft');
    const leasePublicId = draft.lease.public_id;
    const signed = {signed_at:dates.signed};
    assert.deepEqual(await leases.scheduleLease({leasePublicId,scheduleData:signed,authenticatedUser:admin}),{pastStartDate:true});
    check('ordinary scheduling rejects past dates', true);
    const scheduleData = {...signed,register_existing_tenancy:true,registration_reason:reason};
    assert.deepEqual(await leases.scheduleLease({leasePublicId,scheduleData,authenticatedUser:{id:2,role:'user'}}),{existingTenancyForbidden:true});
    check('staff with property access cannot register past tenancy',true);
    const confirmed = await leases.scheduleLease({leasePublicId,scheduleData,authenticatedUser:admin});
    check('admin registers existing tenancy',confirmed.lease?.status==='scheduled');
    const row = (await db.query('SELECT start_date::text,scheduled_at::date::text AS registration_date,scheduled_by::text AS scheduled_by,notes FROM leases WHERE public_id=$1',[leasePublicId])).rows[0];
    assert.equal(row.start_date,dates.start,'Original start date must remain unchanged.');
    assert.equal(row.registration_date,dates.today,'Registration must use the current database date.');
    assert.equal(row.scheduled_by,String(admin.id),'Registration must retain the authenticated actor.');
    assert.ok(row.notes.includes(reason),'Registration reason must be recorded.');
    assert.ok(row.notes.startsWith('Original contract notes'),'Original contract notes must be preserved.');
    check('original dates and contract notes preserved with current actor/reason',true);
    await assert.rejects(db.query('UPDATE leases SET notes=$1 WHERE public_id=$2',['altered',leasePublicId]));
    check('scheduled contract notes immutable',true);
    assert.deepEqual(await leases.scheduleLease({leasePublicId,scheduleData,authenticatedUser:admin}),{notDraft:true});
    const activated = await leases.activateLease({leasePublicId,authenticatedUser:admin});
    check('registered tenancy activates',activated.lease?.status==='active');
    check('activation marks room occupied',(await db.query('SELECT operational_status FROM units WHERE id=1')).rows[0].operational_status==='occupied');
    const conflict = await leases.createDraftLease({leaseData,authenticatedUser:admin});
    await assert.rejects(leases.scheduleLease({leasePublicId:conflict.lease.public_id,scheduleData,authenticatedUser:admin}));
    check('overlap rejected and second lease rolled back to draft',(await db.query('SELECT status FROM leases WHERE public_id=$1',[conflict.lease.public_id])).rows[0].status==='draft');
    check('registration creates no invoices or payments',(await db.query('SELECT (SELECT count(*) FROM rent_invoices)::int AS invoices,(SELECT count(*) FROM rent_payments)::int AS payments')).rows.every(r=>r.invoices===0&&r.payments===0));
    const invoiceData={lease_public_id:leasePublicId,billing_period_start:dates.start,billing_period_end:dates.period_end,due_date:dates.today};
    const invoice = await invoices.createDraftRentInvoice({invoiceData,authenticatedUser:admin});
    check('invoice created for exact lease',Boolean(invoice.invoice?.public_id));
    const invoicePublicId=invoice.invoice.public_id;
    const item=await invoices.addDraftRentInvoiceItem({invoicePublicId,itemData:{item_type:'rent',description:'Acceptance rent',quantity:1,unit_amount:200000},authenticatedUser:admin});
    check('invoice rent item added',Boolean(item.item?.public_id));
    const issued=await invoices.issueRentInvoice({invoicePublicId,authenticatedUser:admin});
    check('invoice issued',issued.invoice?.status==='issued');
    assert.deepEqual(await invoices.createDraftRentInvoice({invoiceData,authenticatedUser:admin}),{billingPeriodConflict:true});
    check('overlapping invoice rejected',true);
    const nextPeriod=(await db.query(`SELECT (CURRENT_DATE+18)::text AS start,(CURRENT_DATE+45)::text AS finish`)).rows[0];
    const secondInvoice=await invoices.createDraftRentInvoice({invoiceData:{...invoiceData,billing_period_start:nextPeriod.start,billing_period_end:nextPeriod.finish,due_date:nextPeriod.start},authenticatedUser:admin});
    assert.ok(secondInvoice.invoice?.public_id);
    await assert.rejects(db.query('UPDATE rent_invoices SET billing_period_start=$1,billing_period_end=$2 WHERE public_id=$3',
      [dates.start,dates.period_end,secondInvoice.invoice.public_id]),{code:'23P01'});
    check('database exclusion constraint independently blocks overlapping invoice periods',true);
    const payment=await payments.recordRentPayment({invoicePublicId,paymentData:{amount:'50000',payment_method:'cash',paid_at:new Date().toISOString()},authenticatedUser:admin});
    check('partial payment updates exact invoice and balance',payment.invoice?.status==='partially_paid' && Number(payment.invoice.paid_amount)===50000 && Number(payment.invoice.balance_amount)===150000);
    const receipt=await receipts.getReceipt({receiptNumber:payment.payment.receipt_number,authenticatedUser:admin});
    check('receipt matches recorded payment',receipt.receipt?.receipt_number===payment.payment.receipt_number && Number(receipt.receipt.payment.amount)===50000);
    const outsider=await receipts.getReceipt({receiptNumber:payment.payment.receipt_number,authenticatedUser:{id:999,role:'user'}});
    assert.deepEqual(outsider,{forbidden:true});
    check('unauthorized receipt access rejected',true);
    process.env.RECEIPT_QR_SECRET='acceptance-only-secret-never-for-production-12345';
    process.env.APP_BASE_URL='http://localhost';
    const pdf=await require('../../services/receiptPdfService').generateReceiptPdf(receipt.receipt);
    check('receipt PDF generated',Buffer.isBuffer(pdf)&&pdf.subarray(0,5).toString()==='%PDF-');
    // Exercise the production routers, validators, auth middleware and controllers.
    // Supertest serves only this in-process app; no Render or external calls.
    const express=require('express');
    const request=require('supertest');
    const jwt=require('jsonwebtoken');
    process.env.JWT_SECRET='acceptance-only-jwt-secret-not-for-production';
    const app=express();
    app.use(express.json());
    app.use('/api/leases',require('../../routes/leaseRoutes'));
    app.use('/api/invoices',require('../../routes/invoiceRoutes'));
    app.use('/api/receipts',require('../../routes/receiptRoutes'));
    app.use((error,req,res,next)=>res.status(error.statusCode||500).json({message:error.message}));
    const token=id=>jwt.sign({public_id:id},process.env.JWT_SECRET,{expiresIn:'5m'});
    const auth=token(admin.public_id);
    const staffAuth=token('user_acceptance_staff');
    async function api(method,url,body,status,authorization=auth) {
        let req=request(app)[method](url);
        if(authorization)req=req.set('Authorization',`Bearer ${authorization}`);
        if(body!==undefined)req=req.send(body);
        const response=await req;
        assert.equal(response.status,status,`${method.toUpperCase()} ${url}: ${JSON.stringify(response.body)}`);
        return response;
    }
    await db.query(`INSERT INTO units(id,public_id,property_id,unit_code,unit_type,operational_status,created_by)
      VALUES(2,'unit_acceptance_api',1,'A2','room','available',1)`);
    await api('get','/api/leases',undefined,401,null);
    check('API requires authentication',true);
    const apiDraft=await api('post','/api/leases',{...leaseData,unit_public_id:'unit_acceptance_api'},201);
    const apiLease=apiDraft.body.data.lease.public_id;
    await api('patch',`/api/leases/${apiLease}/schedule`,{...scheduleData,signed_at:new Date(dates.signed).toISOString()},403,staffAuth);
    await api('patch',`/api/leases/${apiLease}/schedule`,{...scheduleData,signed_at:new Date(dates.signed).toISOString()},200);
    await api('patch',`/api/leases/${apiLease}/activate`,{},200);
    const leaseDetail=(await api('get',`/api/leases/${apiLease}`,undefined,200)).body.data.lease;
    assert.equal(leaseDetail.start_date,dates.start);
    assert.equal(leaseDetail.end_date,dates.finish);
    check('API creates, confirms and starts existing tenancy with role checks',true);
    const apiInvoice=(await api('post','/api/invoices',{...invoiceData,lease_public_id:apiLease},201)).body.data.invoice.public_id;
    const invoiceDetail=(await api('get',`/api/invoices/${apiInvoice}`,undefined,200)).body.data.invoice;
    assert.equal(invoiceDetail.billing_period_start,dates.start);
    assert.equal(invoiceDetail.billing_period_end,dates.period_end);
    assert.equal(invoiceDetail.due_date,dates.today);
    await api('post',`/api/invoices/${apiInvoice}/items`,{item_type:'rent',description:'API acceptance rent',quantity:1,unit_amount:200000},201);
    await api('patch',`/api/invoices/${apiInvoice}/issue`,{},200);
    await api('post','/api/invoices',{...invoiceData,lease_public_id:apiLease},409);
    const apiPayment=(await api('post',`/api/invoices/${apiInvoice}/payments`,{amount:50000,payment_method:'cash',paid_at:new Date().toISOString()},201)).body.data;
    check('API partial payment response matches UI handoff',apiPayment.payment.receipt_number&&apiPayment.invoice.status==='partially_paid'&&Number(apiPayment.invoice.balance_amount)===150000);
    const apiReceipt=await api('get',`/api/receipts/${apiPayment.payment.receipt_number}`,undefined,200);
    check('API receipt response matches recorded payment',apiReceipt.body.data.receipt.receipt_number===apiPayment.payment.receipt_number);
    const apiPdf=await api('get',`/api/receipts/${apiPayment.payment.receipt_number}/pdf`,undefined,200);
    check('API serves receipt PDF',apiPdf.headers['content-type'].includes('application/pdf')&&Buffer.isBuffer(apiPdf.body)&&apiPdf.body.subarray(0,5).toString()==='%PDF-');
    await api('post',`/api/invoices/${apiInvoice}/payments`,{amount:150001,payment_method:'cash',paid_at:new Date().toISOString()},409);
    const settled=(await api('post',`/api/invoices/${apiInvoice}/payments`,{amount:150000,payment_method:'cash',paid_at:new Date().toISOString()},201)).body.data;
    check('API full settlement reaches paid and zero balance',settled.invoice.status==='paid'&&Number(settled.invoice.balance_amount)===0);
    await api('post',`/api/invoices/${apiInvoice}/payments`,{amount:1,payment_method:'cash',paid_at:new Date().toISOString()},409);
    check('API blocks overpayment and additional payments on paid invoice',true);
    const saved=(await db.query(`SELECT count(*)::int AS count FROM rent_payment_allocations a
      JOIN rent_invoices i ON i.id=a.invoice_id WHERE i.public_id=$1`,[apiInvoice])).rows[0];
    check('rejected payments leave no extra allocation',saved.count===2);
    if(nativePool) {
        // Independent native pool connections exercise real lock/constraint races.
        await db.query(`INSERT INTO units(id,public_id,property_id,unit_code,unit_type,operational_status,created_by)
          VALUES(5000,'unit_acceptance_race',1,'RACE','room','available',1)`);
        const first=await leases.createDraftLease({leaseData:{...leaseData,unit_public_id:'unit_acceptance_race'},authenticatedUser:admin});
        const second=await leases.createDraftLease({leaseData:{...leaseData,unit_public_id:'unit_acceptance_race'},authenticatedUser:admin});
        const scheduled=await Promise.allSettled([first,second].map(record=>leases.scheduleLease({leasePublicId:record.lease.public_id,scheduleData,authenticatedUser:admin})));
        const success=scheduled.filter(result=>result.status==='fulfilled'&&result.value.lease?.status==='scheduled');
        assert.equal(success.length,1);
        const remaining=scheduled.find(result=>!success.includes(result));
        assert.ok(remaining.status==='rejected'&&['23P01','23514','40P01'].includes(remaining.reason.code),'Competing registration must fail with an integrity/locking conflict.');
        const raceLease=success[0].value.lease.public_id;
        const states=(await db.query('SELECT status,count(*)::int AS count FROM leases WHERE unit_id=5000 GROUP BY status')).rows;
        check('native concurrent registration allows one scheduled lease and rolls the other back',states.some(r=>r.status==='draft'&&r.count===1)&&states.some(r=>r.status==='scheduled'&&r.count===1));
        const invoiceRace=await Promise.allSettled([1,2].map(()=>invoices.createDraftRentInvoice({invoiceData:{...invoiceData,lease_public_id:raceLease},authenticatedUser:admin})));
        const invoiceSuccess=invoiceRace.filter(result=>result.status==='fulfilled'&&result.value.invoice?.public_id);
        assert.equal(invoiceSuccess.length,1);
        const invoiceRejected=invoiceRace.find(result=>!invoiceSuccess.includes(result));
        assert.ok(invoiceRejected.status==='fulfilled'?invoiceRejected.value.billingPeriodConflict:invoiceRejected.reason.code==='23P01');
        check('native concurrent invoice requests create one invoice',true);
        const raceInvoice=invoiceSuccess[0].value.invoice.public_id;
        await invoices.addDraftRentInvoiceItem({invoicePublicId:raceInvoice,itemData:{item_type:'rent',description:'Concurrent payment test',quantity:1,unit_amount:200000},authenticatedUser:admin});
        await invoices.issueRentInvoice({invoicePublicId:raceInvoice,authenticatedUser:admin});
        const paymentRace=await Promise.allSettled([1,2].map(()=>payments.recordRentPayment({invoicePublicId:raceInvoice,paymentData:{amount:150000,payment_method:'cash',paid_at:new Date().toISOString()},authenticatedUser:admin})));
        assert.equal(paymentRace.filter(result=>result.status==='fulfilled'&&result.value.payment?.public_id).length,1);
        const balance=(await db.query(`SELECT paid_amount,balance_amount,(SELECT count(*)::int FROM rent_payment_allocations a WHERE a.invoice_id=i.id) AS allocations
          FROM rent_invoices i WHERE public_id=$1`,[raceInvoice])).rows[0];
        check('native concurrent payments cannot exceed invoice balance',Number(balance.paid_amount)===150000&&Number(balance.balance_amount)===50000&&balance.allocations===1);
    }
    if(afterChecks) await afterChecks({db,pool,app,auth,dates});
}
const run = async afterChecks => {
    try { await main(afterChecks); }
    finally { await db.close(); }
};
module.exports = { run };
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});

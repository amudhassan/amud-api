// Mounted only by the guarded preview launcher, never app.js.
const express=require('express');
const {authMiddleware}=require('../../middleware/authMiddleware');
const {estimate,validDate,OWNER,NS}=require('./legacy-rental-monitor.cjs');
const {calculateBalance}=require('./legacy-rental-balance.cjs');
module.exports=function monitoringRouter(pool){
    const router=express.Router();router.use(authMiddleware);
    const fail=(res,status,message)=>res.status(status).json({message});
    router.use(async(req,res,next)=>{try{
        const owner=(await pool.query('SELECT id FROM owners WHERE public_id=$1 AND deleted_at IS NULL',[OWNER])).rows[0];
        if(!owner)return fail(res,404,'Import the owner profiles first.');
        if(req.user.role!=='admin'){
            const allowed=(await pool.query('SELECT 1 FROM owner_users WHERE owner_id=$1 AND user_id=$2 AND revoked_at IS NULL AND can_manage_finances=true',[owner.id,req.user.id])).rows[0];
            if(!allowed)return fail(res,403,'Owner finance access is required.');
        }
        const installed=(await pool.query("SELECT to_regclass('preview_rental_monitor_batches') AS name")).rows[0].name;
        if(!installed)return fail(res,404,'Run the preview monitoring import first.');
        req.monitorOwnerId=owner.id;next();
    }catch(error){next(error);}});
    router.get('/',async(req,res,next)=>{try{
        const asOf=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dar_es_Salaam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        const payments=(await pool.query('SELECT source FROM preview_rental_monitor_payments WHERE namespace=$1 ORDER BY source->>\'date_created\',source_id',[NS])).rows.map(r=>r.source);
        const grouped=new Map();for(const p of payments){if(!grouped.has(p.tenant_id))grouped.set(p.tenant_id,[]);grouped.get(p.tenant_id).push(p);}
        const importedLinks=(await pool.query("SELECT to_regclass('preview_legacy_financial_payment_links') AS name")).rows[0].name;
        const importFlag=importedLinks?'EXISTS(SELECT 1 FROM preview_legacy_financial_payment_links x WHERE x.payment_id=rp.id)':'FALSE';
        const current=(await pool.query(`SELECT t.public_id AS tenant_public_id,rp.receipt_number,rp.amount,rp.status,rp.paid_at,rp.transaction_reference,${importFlag} AS imported_from_csv
            FROM rent_payments rp JOIN tenants t ON t.id=rp.tenant_id WHERE rp.owner_id=$1 ORDER BY rp.paid_at DESC`,[req.monitorOwnerId])).rows;
        const invoices=(await pool.query(`SELECT t.public_id AS tenant_public_id,i.invoice_number,i.billing_period_start::text,i.billing_period_end::text,i.status,i.total_amount,i.balance_amount
            FROM rent_invoices i JOIN tenants t ON t.id=i.tenant_id WHERE i.owner_id=$1 ORDER BY i.billing_period_end DESC`,[req.monitorOwnerId])).rows;
        const rows=(await pool.query('SELECT source_id,tenant_public_id,source,review,version FROM preview_rental_monitor_rows WHERE namespace=$1',[NS])).rows.map(r=>{
            const history=grouped.get(r.source_id)||[];
            const currentPayments=current.filter(p=>p.tenant_public_id===r.tenant_public_id);
            const potentiallyRepeated=currentPayments.filter(p=>!p.imported_from_csv && p.status==='completed' && history.some(h=>
                (p.transaction_reference && p.transaction_reference===h.invoice) ||
                (Number(p.amount)===Number(h.amount) && new Date(p.paid_at).toISOString().slice(0,10)===h.date_created.slice(0,10))));
            const newPaid=currentPayments.filter(p=>!p.imported_from_csv && p.status==='completed' && !potentiallyRepeated.includes(p) && new Date(p.paid_at).toISOString().slice(0,10)<=asOf).reduce((sum,p)=>sum+Math.round(Number(p.amount)*100),0)/100;
            return {...r,history,estimate:estimate(r.source,history,asOf),account:calculateBalance(r.source,history,asOf,newPaid),duplicate_review:potentiallyRepeated.map(p=>p.receipt_number),current_payments:currentPayments,current_invoices:invoices.filter(i=>i.tenant_public_id===r.tenant_public_id)};
        });
        const ids=new Set(rows.map(r=>r.source_id));const activeRows=rows.filter(r=>r.source.status==='1');
        const activeIds=new Set(activeRows.map(r=>r.source_id));const activePayments=payments.filter(p=>activeIds.has(p.tenant_id));
        const batch=(await pool.query('SELECT summary,imported_at FROM preview_rental_monitor_batches WHERE namespace=$1',[NS])).rows[0];
        batch.summary={...batch.summary,tenants:activeRows.length,payments:activePayments.length,total_payment_amount:activePayments.reduce((a,p)=>a+Math.round(Number(p.amount)*100),0)/100};
        res.json({data:{as_of:asOf,rows:activeRows,orphan_payments:payments.filter(p=>!ids.has(p.tenant_id)),batch}});
    }catch(error){next(error);}});
    router.put('/:id/review',async(req,res,next)=>{
        const {paid_through=null,evidence,version}=req.body||{};
        if(!/^\d{1,12}$/.test(req.params.id)||!Number.isInteger(version)||version<0||typeof evidence!=='string'||evidence.trim().length<10||evidence.length>2000||!(paid_through===null||validDate(paid_through)))return fail(res,400,'Provide a valid paid-through date (or null), evidence of 10–2000 characters, and current version.');
        const client=await pool.connect();try{
            await client.query('BEGIN');const row=(await client.query('SELECT * FROM preview_rental_monitor_rows WHERE namespace=$1 AND source_id=$2 FOR UPDATE',[NS,req.params.id])).rows[0];
            if(!row){await client.query('ROLLBACK');return fail(res,404,'Legacy tenant record not found.');}
            if(paid_through && (!row.tenant_public_id || !row.source.unit || !validDate(row.source.date_in))) {await client.query('ROLLBACK');return fail(res,400,'Resolve the missing tenant profile, unit or date-in before confirming a period.');}
            if(row.version!==version){await client.query('ROLLBACK');return fail(res,409,'Another reviewer updated this record. Reload before saving.');}
            const review={paid_through,evidence:evidence.trim(),reviewed_by:req.user.public_id,reviewed_at:new Date().toISOString()};
            await client.query('INSERT INTO preview_rental_monitor_audit(namespace,source_id,previous_review,new_review,actor_id) VALUES($1,$2,$3::jsonb,$4::jsonb,$5)',[NS,req.params.id,JSON.stringify(row.review),JSON.stringify(review),req.user.id]);
            await client.query('UPDATE preview_rental_monitor_rows SET review=$3::jsonb,version=version+1 WHERE namespace=$1 AND source_id=$2',[NS,req.params.id,JSON.stringify(review)]);
            await client.query('COMMIT');res.json({data:{review,version:version+1}});
        }catch(error){await client.query('ROLLBACK');next(error);}finally{client.release();}
    });return router;
};

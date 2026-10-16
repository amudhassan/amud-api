// Preview-only historical monitoring. Does not create leases, invoices or receipts.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseCsv, loadSource } = require('./legacy-rental-preview-import.cjs');
const OWNER = 'owner_mkutasidu_legacy';
const NS = 'mkutasidu_legacy_v1';
const check = (yes,message) => { if(!yes) throw Error(message); };
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
function loadMonitoring(directory) {
    const base=loadSource(directory), raw=fs.readFileSync(path.join(directory,'payments.csv'));
    check(raw.length<5_000_000,'Payment file is too large.');
    const records=parseCsv(new TextDecoder('utf-8',{fatal:true}).decode(raw));
    const columns=['id','tenant_id','amount','invoice','date_created','created_at'];
    check(JSON.stringify(records.shift())===JSON.stringify(columns),'Unexpected payment columns.');
    check(records.length<=10000,'Too many payment records.');
    const ids=new Set();
    const payments=records.map(values=>{
        check(values.length===columns.length,'Invalid payment field count.');
        const p=Object.fromEntries(columns.map((k,i)=>[k,values[i]]));
        check(/^[1-9]\d{0,11}$/.test(p.id)&&!ids.has(p.id),'Invalid/duplicate payment ID.');ids.add(p.id);
        check(/^[1-9]\d{0,11}$/.test(p.tenant_id),'Invalid payment tenant ID.');
        check(/^\d+(\.\d{1,2})?$/.test(p.amount)&&Number(p.amount)>0&&Number(p.amount)<=1e12,'Invalid payment amount.');
        for(const k of ['date_created','created_at'])check(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(p[k])&&validDate(p[k].slice(0,10))&&Number(p[k].slice(11,13))<24&&Number(p[k].slice(14,16))<60&&Number(p[k].slice(17))<60,'Invalid payment timestamp.');
        check(values.every(v=>!v.includes('\0')&&v.length<1000),'Invalid payment text.');
        return p;
    });
    const houses=new Map(base.tables['houses.csv'].map(h=>[h.id,h]));
    const categories=new Map(base.tables['categories.csv'].map(c=>[c.id,c.name]));
    const rows=base.tables['tenants.csv'].map(t=>{
        const h=houses.get(t.house_id);
        return { ...t, name:[t.firstname,t.middlename,t.lastname].filter(Boolean).join(' ').trim(),
            property:h?categories.get(h.category_id):'', unit:h?.house_no||'', monthly_rent:h?Number(h.price):null,
            property_public_id:h?`property_mkut_${h.category_id}`:null, unit_public_id:h?`unit_mkut_${h.id}`:null };
    });
    const sourceHash=crypto.createHash('sha256').update(base.sourceHash).update(raw).digest('hex');
    return {baseHash:base.sourceHash,sourceHash,rows,payments};
}
async function importMonitoring({pool,source,apply=false}) {
    const client=await pool.connect();
    try {
        await client.query(apply?'BEGIN':'BEGIN READ ONLY');
        const actor=(await client.query("SELECT id FROM users WHERE public_id='user_acceptance_admin' AND email='admin@example.invalid' AND role='admin' AND deleted_at IS NULL")).rows[0];
        const marker=(await client.query("SELECT id FROM properties WHERE public_id='property_acceptance'")).rows[0];
        check(actor&&marker,'Monitoring import requires the synthetic preview fixture.');
        if(apply)await client.query('SELECT pg_advisory_xact_lock(183575,1715)');
        check((await client.query("SELECT to_regclass('preview_legacy_import_batches') AS name")).rows[0].name,'Import the profiles first.');
        const batch=(await client.query('SELECT * FROM preview_legacy_import_batches WHERE namespace=$1 AND owner_public_id=$2',[NS,OWNER])).rows[0];
        check(batch&&batch.source_sha256===source.baseHash,'Source does not match the existing profile import.');
        const exists=(await client.query("SELECT to_regclass('preview_rental_monitor_batches') AS name")).rows[0].name;
        const prior=exists?(await client.query('SELECT * FROM preview_rental_monitor_batches WHERE namespace=$1',[NS])).rows[0]:null;
        if(prior){check(prior.source_sha256===source.sourceHash,'Monitoring source changed; existing history and reviews will not be overwritten.');await client.query('ROLLBACK');return {mode:'already-imported',...prior.summary};}
        const profiles=(await client.query('SELECT public_id FROM tenants WHERE public_id=ANY($1::text[]) AND deleted_at IS NULL',[source.rows.filter(t=>t.name).map(t=>`tenant_mkut_${t.id}`)])).rows;
        check(profiles.length===source.rows.filter(t=>t.name).length,'An imported tenant profile is missing/deleted; review before importing.');
        const summary={tenants:source.rows.length,payments:source.payments.length,orphan_payments:source.payments.filter(p=>!source.rows.some(t=>t.id===p.tenant_id)).length,total_payment_amount:source.payments.reduce((a,p)=>a+Math.round(Number(p.amount)*100),0)/100};
        if(!apply){await client.query('ROLLBACK');return {mode:'dry-run',...summary};}
        const schema=`CREATE TABLE IF NOT EXISTS preview_rental_monitor_batches(namespace text PRIMARY KEY REFERENCES preview_legacy_import_batches(namespace),source_sha256 text NOT NULL,summary jsonb NOT NULL,imported_by bigint REFERENCES users(id),imported_at timestamptz NOT NULL DEFAULT now());
            CREATE TABLE IF NOT EXISTS preview_rental_monitor_rows(namespace text REFERENCES preview_rental_monitor_batches(namespace),source_id text,tenant_public_id varchar(40) REFERENCES tenants(public_id),source jsonb NOT NULL,review jsonb NOT NULL DEFAULT '{}',version integer NOT NULL DEFAULT 0,PRIMARY KEY(namespace,source_id));
            CREATE TABLE IF NOT EXISTS preview_rental_monitor_payments(namespace text REFERENCES preview_rental_monitor_batches(namespace),source_id text,tenant_source_id text NOT NULL,source jsonb NOT NULL,PRIMARY KEY(namespace,source_id));
            CREATE TABLE IF NOT EXISTS preview_rental_monitor_audit(id bigserial PRIMARY KEY,namespace text,source_id text,previous_review jsonb NOT NULL,new_review jsonb NOT NULL,actor_id bigint NOT NULL REFERENCES users(id),changed_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(namespace,source_id) REFERENCES preview_rental_monitor_rows(namespace,source_id));`;
        for(const statement of schema.split(";").filter(s=>s.trim()))await client.query(statement);
        await client.query('INSERT INTO preview_rental_monitor_batches(namespace,source_sha256,summary,imported_by) VALUES($1,$2,$3::jsonb,$4)',[NS,source.sourceHash,JSON.stringify(summary),actor.id]);
        for(const row of source.rows)await client.query('INSERT INTO preview_rental_monitor_rows(namespace,source_id,tenant_public_id,source) VALUES($1,$2,$3,$4::jsonb)',[NS,row.id,row.name?`tenant_mkut_${row.id}`:null,JSON.stringify(row)]);
        for(const p of source.payments)await client.query('INSERT INTO preview_rental_monitor_payments(namespace,source_id,tenant_source_id,source) VALUES($1,$2,$3,$4::jsonb)',[NS,p.id,p.tenant_id,JSON.stringify(p)]);
        // Only the known synthetic preview staff user gets the imported owner's finance relationship.
        await client.query(`INSERT INTO owner_users(public_id,owner_id,user_id,relationship_role,can_manage_finances)
            SELECT 'owner_user_mkut_preview',o.id,u.id,'accountant',true FROM owners o CROSS JOIN users u
            WHERE o.public_id=$1 AND o.deleted_at IS NULL AND u.public_id='user_acceptance_staff' AND u.email='staff@example.invalid' AND u.deleted_at IS NULL
            AND NOT EXISTS(SELECT 1 FROM owner_users ou WHERE ou.owner_id=o.id AND ou.user_id=u.id AND ou.revoked_at IS NULL)`,[OWNER]);
        await client.query('COMMIT');return {mode:'imported',...summary};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
function estimate(row,payments,asOf) {
    const total=payments.reduce((a,p)=>a+Math.round(Number(p.amount)*100),0)/100;
    const invalid=!validDate(row.date_in)||row.date_in>asOf||!row.monthly_rent||!row.unit||!payments.length||payments.some(p=>p.date_created.slice(0,10)<row.date_in);
    if(invalid)return {total,status:'needs_review',end:null,months:null,remainder:null,days_after_end:null};
    const months=Math.floor(total/row.monthly_rent), remainder=Math.round((total-months*row.monthly_rent)*100)/100;
    const start=new Date(row.date_in+'T00:00:00Z'),targetMonth=start.getUTCMonth()+months;
    const last=new Date(Date.UTC(start.getUTCFullYear(),targetMonth+1,0)).getUTCDate();
    const end=new Date(Date.UTC(start.getUTCFullYear(),targetMonth,Math.min(start.getUTCDate(),last))-86400000).toISOString().slice(0,10);
    return {total,months,remainder,end,days_after_end:Math.max(0,Math.floor((Date.parse(asOf+'T00:00:00Z')-Date.parse(end+'T00:00:00Z'))/86400000)),status:remainder?'partial_month':end<asOf?'estimated_expired':'estimated_current'};
}
module.exports={loadMonitoring,importMonitoring,estimate,validDate,OWNER,NS};
if(require.main===module){(async()=>{
    const args=process.argv.slice(2);check(args.length===3&&args[0]==='--source-dir'&&['--dry-run','--apply'].includes(args[2]),'Use --source-dir DIRECTORY --dry-run or --apply.');
    check(process.env.UX_NATIVE_DATABASE_URL,'Set the existing local preview database URL.');
    const {withDatabase}=require('./lease-database-check.cjs');const source=loadMonitoring(path.resolve(args[1]));
    await withDatabase(async({pool})=>console.log(JSON.stringify(await importMonitoring({pool,source,apply:args[2]==='--apply'}),null,2)));
})().catch(error=>{console.error(error.message);process.exitCode=1;});}

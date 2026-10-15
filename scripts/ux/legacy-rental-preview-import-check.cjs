// Synthetic test source by default; optional --source-dir tests private CSVs
// without copying or printing their contents into the repository.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {run} = require('./lease-database-check.cjs');
const {parseCsv,loadSource,buildPlan,importPlan} = require('./legacy-rental-preview-import.cjs');

async function checkImport({db,pool,auth}) {
    assert.deepEqual(parseCsv('\uFEFFa,b\r\n"left,right","line1\nline2"\r\n"say ""yes""",x'),
        [['a','b'],['left,right','line1\nline2'],['say "yes"','x']]);
    assert.throws(()=>parseCsv('a\n"unclosed'));
    assert.throws(()=>parseCsv('a\n"closed"junk'));
    const option=process.argv.indexOf('--source-dir');
    let directory=option>=0?path.resolve(process.argv[option+1]):fs.mkdtempSync(path.join(os.tmpdir(),'rental-import-'));
    try {
        if(option<0) {
            fs.writeFileSync(path.join(directory,'categories.csv'),'id,name\n23,Example block\n');
            fs.writeFileSync(path.join(directory,'houses.csv'),'id,house_no,category_id,description,price\n22,001,23,EXAMPLE ROOM,150000.0\n');
            fs.writeFileSync(path.join(directory,'tenants.csv'),'id,firstname,middlename,lastname,email,contact,house_id,status,date_in\n42,Example,Test,Tenant,,0712345678,22,1,2025-08-29\n128,,,,,,0,1,0000-00-00\n');
        }
        const source=loadSource(directory);
        for(const target of ['postgresql://postgres@db.example.invalid/lease_acceptance_test','postgresql://postgres@127.0.0.1:5433/production']) {
            const refused=spawnSync(process.execPath,[path.join(__dirname,'legacy-rental-preview-import.cjs'),'--source-dir',directory,'--dry-run'],{
                env:{...process.env,UX_NATIVE_DATABASE_URL:target},encoding:'utf8',timeout:10000
            });
            assert.equal(refused.status,1);
            assert.match(refused.stderr,/Native tests require a loopback URL/);
        }
        console.log('PASS: CLI refuses remote hosts and production database names before connecting');
        const unresolved=buildPlan(source);
        assert.equal(unresolved.summary.ready_to_apply,false);
        assert.ok(unresolved.summary.held_tenant_ids.includes('128'));
        const plan=buildPlan(source,{region:'Synthetic test region'});
        const equivalent=buildPlan(source,{regions:Object.fromEntries(plan.properties.map(item=>[item.source.id,'Synthetic test region']))});
        assert.equal(plan.planHash,equivalent.planHash);
        const existingCounts=async()=>{
            const tables=['owners','properties','property_owners','units','tenants','owner_tenants','leases','rent_invoices','rent_payments','notifications'];
            const result={};
            for(const table of tables) result[table]=(await db.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count;
            return result;
        };
        const before=await existingCounts();
        const dryRun=await importPlan({pool,plan});
        assert.equal(dryRun.mode,'dry-run');
        assert.deepEqual(await existingCounts(),before);
        assert.equal((await db.query("SELECT to_regclass('preview_legacy_import_batches') AS name")).rows[0].name,null);
        await assert.rejects(importPlan({pool,plan:unresolved,apply:true}),/Region is required/);
        assert.deepEqual(await existingCounts(),before);
        console.log('PASS: strict CSV parsing, exact source IDs, missing-name hold and read-only dry-run');

        // Fixture IDs predate normal sequence allocation; match the preview launcher's alignment.
        for(const table of ['owners','properties','units','tenants']) await db.query(`SELECT setval(pg_get_serial_sequence('${table}','id'),(SELECT max(id) FROM ${table}))`);
        await db.exec(`CREATE FUNCTION acceptance_import_failure() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF NEW.public_id LIKE 'tenant_mkut_%' THEN RAISE EXCEPTION 'Synthetic import failure'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER acceptance_import_failure BEFORE INSERT ON tenants FOR EACH ROW EXECUTE FUNCTION acceptance_import_failure();`);
        await assert.rejects(importPlan({pool,plan,apply:true}),/Synthetic import failure/);
        assert.deepEqual(await existingCounts(),before);
        assert.equal((await db.query("SELECT to_regclass('preview_legacy_import_batches') AS name")).rows[0].name,null);
        await db.exec('DROP TRIGGER acceptance_import_failure ON tenants; DROP FUNCTION acceptance_import_failure();');
        console.log('PASS: injected failure rolls back owner, properties, units, tenants and journal');

        const result=await importPlan({pool,plan,apply:true});
        assert.equal(result.mode,'imported');
        const after=await existingCounts();
        assert.equal(after.owners-before.owners,1);
        assert.equal(after.properties-before.properties,plan.properties.length);
        assert.equal(after.property_owners-before.property_owners,plan.properties.length);
        assert.equal(after.units-before.units,plan.units.length);
        assert.equal(after.tenants-before.tenants,plan.tenants.length);
        assert.equal(after.owner_tenants-before.owner_tenants,plan.tenants.length);
        for(const table of ['leases','rent_invoices','rent_payments','notifications'])assert.equal(after[table],before[table]);
        const imported=await db.query(`SELECT t.public_id,t.status,t.phone_number,ot.notes,o.display_name FROM tenants t
            JOIN owner_tenants ot ON ot.tenant_id=t.id JOIN owners o ON o.id=ot.owner_id
            WHERE o.public_id='owner_mkutasidu_legacy'`);
        assert.equal(imported.rows.length,plan.tenants.length);
        for(const row of imported.rows) {
            const expected=plan.tenants.find(item=>item.public_id===row.public_id);
            assert.equal(row.status,'prospective');
            assert.equal(row.phone_number,expected.phone);
            assert.ok(row.notes.includes(JSON.stringify(expected.source)));
            assert.equal(row.display_name,'MKUTASIDU ENTERPRISES LIMITED');
        }
        for(const item of plan.units) {
            const saved=(await db.query(`SELECT u.unit_code,u.operational_status,p.public_id AS property_id,p.operational_status AS property_status
                FROM units u JOIN properties p ON p.id=u.property_id WHERE u.public_id=$1`,[item.public_id])).rows[0];
            assert.equal(saved.unit_code,item.source.house_no.trim());
            assert.equal(saved.property_id,`property_mkut_${item.source.category_id}`);
            assert.equal(saved.operational_status,'inactive');assert.equal(saved.property_status,'inactive');
        }
        assert.equal((await importPlan({pool,plan,apply:true})).mode,'already-imported');
        assert.deepEqual(await existingCounts(),after);
        await assert.rejects(importPlan({pool,plan:{...plan,sourceHash:'changed'},apply:true}),/changed after import/);
        assert.deepEqual(await existingCounts(),after);
        console.log(`PASS: exact owner/property/unit mapping; ${plan.tenants.length} distinct prospective profiles; original metadata retained; no leases, billing or notification creation`);
        console.log('PASS: repeat import is a no-op and changed source is rejected');

        const express=require('express'), request=require('supertest');
        const app=express();
        app.use('/api/owners',require('../../routes/ownerRoutes'));
        app.use('/api/properties',require('../../routes/propertyRoutes'));
        app.use('/api/tenants',require('../../routes/tenantRoutes'));
        app.use((error,req,res,next)=>res.status(error.statusCode||500).json({message:error.message}));
        const get=async url=>{
            const response=await request(app).get(url).set('Authorization',`Bearer ${auth}`);
            assert.equal(response.status,200,`Read-only preview API check failed: ${url}`);
            return response.body;
        };
        assert.equal((await get('/api/owners/owner_mkutasidu_legacy')).data.display_name,'MKUTASIDU ENTERPRISES LIMITED');
        assert.equal((await get('/api/properties?owner_public_id=owner_mkutasidu_legacy&limit=100')).data.properties.length,plan.properties.length);
        const tenantList=(await get('/api/tenants?owner_public_id=owner_mkutasidu_legacy&limit=100')).data;
        assert.equal(tenantList.tenants.length,plan.tenants.length);
        for(const item of plan.properties) {
            const body=await get(`/api/properties/${item.public_id}/units?limit=100`);
            assert.equal(body.data.units.length,plan.units.filter(unit=>unit.source.category_id===item.source.id).length);
        }
        console.log('PASS: existing authenticated preview APIs expose the owner, all properties, units and tenant profiles');

        await db.query("UPDATE users SET email='different@example.invalid' WHERE public_id='user_acceptance_admin'");
        await assert.rejects(importPlan({pool,plan,apply:true}),/not the guarded/);
        await db.query("UPDATE users SET email='admin@example.invalid' WHERE public_id='user_acceptance_admin'");
        console.log('PASS: importer refuses a database without the preview identity marker');
    } finally {if(option<0)fs.rmSync(directory,{recursive:true,force:true});}
}
module.exports={checkImport};
if(require.main===module)run(checkImport).catch(error=>{console.error(error.message);process.exitCode=1;});

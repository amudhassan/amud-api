// Correct imported administrative ownership dates in the guarded local preview.
// Record creation timestamps and all rental/financial records remain unchanged.
const assert = require('node:assert/strict');

async function correctOwnershipDate({pool, namespace, effectiveFrom, apply=false}) {
    assert.match(namespace || '', /^[a-z0-9_]{1,100}$/, 'Invalid import namespace.');
    const parsed = new Date(`${effectiveFrom}T00:00:00Z`);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom || '') && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===effectiveFrom, 'Use a real YYYY-MM-DD effective date.');
    const client=await pool.connect();
    try {
        await client.query(apply?'BEGIN':'BEGIN READ ONLY');
        const actor=(await client.query(`SELECT id FROM users WHERE public_id='user_acceptance_admin'
            AND email='admin@example.invalid' AND role='admin' AND deleted_at IS NULL`)).rows[0];
        const fixture=(await client.query("SELECT id FROM properties WHERE public_id='property_acceptance' AND deleted_at IS NULL")).rows[0];
        assert.ok(actor && fixture,'Refused: preview identity markers are missing.');
        const today=(await client.query('SELECT CURRENT_DATE::text AS today')).rows[0].today;
        assert.ok(effectiveFrom<=today,'Ownership correction cannot use a future date.');
        if(apply)await client.query('SELECT pg_advisory_xact_lock(183575,1715)');
        const batch=(await client.query(`SELECT b.owner_public_id,b.summary FROM preview_legacy_import_batches b
            JOIN owners o ON o.public_id=b.owner_public_id AND o.deleted_at IS NULL WHERE b.namespace=$1`,[namespace])).rows[0];
        assert.ok(batch,'The expected completed preview import was not found.');
        const rows=(await client.query(`SELECT po.id,po.public_id,p.public_id AS property_public_id,
            po.effective_from::text AS effective_from,po.created_at::date::text AS created_date
            FROM property_owners po JOIN owners o ON o.id=po.owner_id JOIN properties p ON p.id=po.property_id
            WHERE o.public_id=$1 AND po.effective_to IS NULL AND p.deleted_at IS NULL
            ORDER BY p.public_id ${apply?'FOR UPDATE OF po,p':''}`,[batch.owner_public_id])).rows;
        assert.equal(rows.length,batch.summary.properties,'Property count differs from the completed import; review required.');
        for(const row of rows) {
            assert.ok(row.public_id.startsWith('ownership_mkut_') && row.property_public_id===`property_mkut_${row.public_id.slice('ownership_mkut_'.length)}`,'Ownership mapping differs from the imported batch.');
            assert.ok(row.effective_from===effectiveFrom || row.effective_from===row.created_date,'An ownership date was already edited; review rather than overwrite it.');
            assert.ok(effectiveFrom<=row.effective_from,'This correction only permits an earlier confirmed effective date.');
        }
        const conflict=await client.query(`SELECT l.public_id FROM leases l JOIN owners o ON o.id=l.owner_id
            WHERE o.public_id=$1 AND l.start_date<$2::date AND l.status<>'cancelled' LIMIT 1`,[batch.owner_public_id,effectiveFrom]);
        assert.equal(conflict.rows.length,0,'An existing lease predates this ownership date; review required.');
        const changes=rows.filter(row=>row.effective_from!==effectiveFrom);
        if(apply && changes.length) {
            await client.query(`CREATE TABLE IF NOT EXISTS preview_ownership_date_changes (
                id bigserial PRIMARY KEY, namespace text NOT NULL REFERENCES preview_legacy_import_batches(namespace),
                ownership_public_id varchar(40) NOT NULL REFERENCES property_owners(public_id),
                previous_effective_from date NOT NULL, corrected_effective_from date NOT NULL,
                corrected_by bigint NOT NULL REFERENCES users(id), corrected_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
            for(const row of changes) {
                await client.query(`INSERT INTO preview_ownership_date_changes
                    (namespace,ownership_public_id,previous_effective_from,corrected_effective_from,corrected_by)
                    VALUES($1,$2,$3,$4,$5)`,[namespace,row.public_id,row.effective_from,effectiveFrom,actor.id]);
                const update=await client.query(`UPDATE property_owners SET effective_from=$1::date,updated_at=CURRENT_TIMESTAMP
                    WHERE id=$2 AND effective_from=$3::date`,[effectiveFrom,row.id,row.effective_from]);
                assert.equal(update.rowCount,1,'Ownership changed concurrently; rolled back.');
            }
            await client.query('SET CONSTRAINTS ALL IMMEDIATE');
        }
        await client.query(apply?'COMMIT':'ROLLBACK');
        return {mode:apply?(changes.length?'corrected':'already-correct'):'dry-run',properties:rows.length,
            effective_from:effectiveFrom,changed:apply?changes.length:0,would_change:changes.length,
            created_at_preserved:true};
    } catch(error) { await client.query('ROLLBACK'); throw error; }
    finally {client.release();}
}
module.exports={correctOwnershipDate};
if(require.main===module)(async()=>{
    const args=process.argv.slice(2), options={};
    for(let i=0;i<args.length;i++) {
        const key=args[i];
        assert.ok(['--namespace','--effective-from','--apply','--dry-run'].includes(key),'Unknown argument.');
        assert.ok(!Object.hasOwn(options,key),'Repeated argument.');
        if(key==='--apply'||key==='--dry-run')options[key]=true;
        else {assert.ok(args[i+1]&&!args[i+1].startsWith('--'),'Argument value is required.');options[key]=args[++i];}
    }
    assert.ok(!(options['--apply']&&options['--dry-run']),'Choose one mode.');
    assert.ok(process.env.UX_NATIVE_DATABASE_URL,'Set the existing local preview connection.');
    const {withDatabase}=require('./lease-database-check.cjs');
    await withDatabase(async({pool})=>console.log(JSON.stringify(await correctOwnershipDate({pool,
        namespace:options['--namespace'],effectiveFrom:options['--effective-from'],apply:Boolean(options['--apply'])}),null,2)));
})().catch(error=>{console.error(error.message);process.exitCode=1;});

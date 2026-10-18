// Preview only: archive unmatched testing payments, remove them from live monitoring,
// and enforce tenant-source identity at the database boundary.
const {OWNER,NS}=require('./legacy-rental-monitor.cjs');
async function cleanMonitoring({pool,apply=false}) {
 const c=await pool.connect();
 try {
  await c.query(apply?'BEGIN':'BEGIN READ ONLY');
  const actor=(await c.query("SELECT id FROM users WHERE public_id='user_acceptance_admin' AND email='admin@example.invalid' AND role='admin' AND deleted_at IS NULL")).rows[0];
  const marker=(await c.query("SELECT 1 FROM properties WHERE public_id='property_acceptance'")).rows[0];
  if(!actor||!marker)throw Error('Cleanup requires the synthetic preview fixture.');
  if(apply)await c.query('SELECT pg_advisory_xact_lock(183575,1715)');
  const exists=(await c.query("SELECT to_regclass('preview_rental_monitor_batches') AS name")).rows[0].name;
  if(!exists)throw Error('Run the monitoring import first.');
  const batch=(await c.query('SELECT b.namespace FROM preview_rental_monitor_batches b JOIN preview_legacy_import_batches i USING(namespace) WHERE b.namespace=$1 AND i.owner_public_id=$2',[NS,OWNER])).rows[0];
  if(!batch)throw Error('Expected preview import batch not found.');
  const candidates=(await c.query(`SELECT p.* FROM preview_rental_monitor_payments p LEFT JOIN preview_rental_monitor_rows t ON t.namespace=p.namespace AND t.source_id=p.tenant_source_id WHERE p.namespace=$1 AND t.source_id IS NULL`,[NS])).rows;
  const canonical=(await c.query(`SELECT
   (SELECT count(*)::int FROM rent_payments p LEFT JOIN tenants t ON t.id=p.tenant_id LEFT JOIN owners o ON o.id=p.owner_id WHERE t.id IS NULL OR o.id IS NULL) AS missing_payment_parties,
   (SELECT count(*)::int FROM rent_payment_allocations a JOIN rent_payments p ON p.id=a.payment_id JOIN rent_invoices i ON i.id=a.invoice_id WHERE p.tenant_id<>i.tenant_id OR p.owner_id<>i.owner_id) AS mismatched_allocations,
   (SELECT count(*)::int FROM rent_payments p WHERE p.status='completed' AND NOT EXISTS(SELECT 1 FROM rent_payment_allocations a WHERE a.payment_id=p.id)) AS unallocated_completed_payments`)).rows[0];
  if(!apply){await c.query('ROLLBACK');return {mode:'dry-run',would_remove:candidates.length,canonical_checks:canonical};}
  await c.query(`CREATE TABLE IF NOT EXISTS preview_rental_monitor_exclusions(namespace text REFERENCES preview_rental_monitor_batches(namespace),source_id text,source jsonb NOT NULL,reason text NOT NULL,removed_by bigint REFERENCES users(id),removed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(namespace,source_id))`);
  for(const row of candidates){
   await c.query(`INSERT INTO preview_rental_monitor_exclusions(namespace,source_id,source,reason,removed_by) VALUES($1,$2,$3::jsonb,'User-confirmed legacy system testing; unmatched tenant',$4) ON CONFLICT(namespace,source_id) DO NOTHING`,[NS,row.source_id,JSON.stringify(row.source),actor.id]);
   await c.query('DELETE FROM preview_rental_monitor_payments WHERE namespace=$1 AND source_id=$2',[NS,row.source_id]);
  }
  const constraint=(await c.query("SELECT 1 FROM pg_constraint WHERE conrelid='preview_rental_monitor_payments'::regclass AND conname='preview_monitor_payment_tenant_fk'")).rows[0];
  if(!constraint)await c.query('ALTER TABLE preview_rental_monitor_payments ADD CONSTRAINT preview_monitor_payment_tenant_fk FOREIGN KEY(namespace,tenant_source_id) REFERENCES preview_rental_monitor_rows(namespace,source_id) ON DELETE RESTRICT');
  const identity=(await c.query("SELECT 1 FROM pg_constraint WHERE conrelid='preview_rental_monitor_payments'::regclass AND conname='preview_monitor_payment_identity_check'")).rows[0];
  if(!identity)await c.query("ALTER TABLE preview_rental_monitor_payments ADD CONSTRAINT preview_monitor_payment_identity_check CHECK(source->>'tenant_id' IS NOT NULL AND source->>'tenant_id'=tenant_source_id AND source->>'id' IS NOT NULL AND source->>'id'=source_id)");
  const totals=(await c.query("SELECT count(*)::int AS payments,coalesce(sum((source->>'amount')::numeric),0) AS total FROM preview_rental_monitor_payments WHERE namespace=$1",[NS])).rows[0];
  const excluded=(await c.query('SELECT count(*)::int AS n FROM preview_rental_monitor_exclusions WHERE namespace=$1',[NS])).rows[0].n;
  await c.query(`UPDATE preview_rental_monitor_batches SET summary=summary || $2::jsonb WHERE namespace=$1`,[NS,JSON.stringify({payments:totals.payments,total_payment_amount:Number(totals.total),orphan_payments:0,excluded_test_payments:excluded})]);
  await c.query('COMMIT');return {mode:'cleaned',removed:candidates.length,payments:totals.payments,total_payment_amount:Number(totals.total),excluded_test_payments:excluded,canonical_checks:canonical};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
module.exports={cleanMonitoring};
if(require.main===module){(async()=>{
 const args=process.argv.slice(2);if(args.length!==1||!['--apply','--dry-run'].includes(args[0]))throw Error('Use --dry-run or --apply.');
 if(!process.env.UX_NATIVE_DATABASE_URL)throw Error('Set the existing local preview database URL.');
 const {withDatabase}=require('./lease-database-check.cjs');await withDatabase(async({pool})=>console.log(JSON.stringify(await cleanMonitoring({pool,apply:args[0]==='--apply'}),null,2)));
})().catch(e=>{console.error(e.message);process.exitCode=1;});}

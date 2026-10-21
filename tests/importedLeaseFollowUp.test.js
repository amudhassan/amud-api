const {buildImportedLeaseFollowUps: build} = require('../services/importedLeaseFollowUpService');
const asOf = '2026-10-19';
const profile = {public_id:'tenant_one',display_name:'Resident',status:'active',deleted_at:null};
function row(overrides={}) { return {source_id:'1',tenant_public_id:'tenant_one',source:{date_in:'2025-10-01',monthly_rent:100000,unit:'01',unit_public_id:'unit_one',property:'Property'},review:{},history:[{amount:600000,date_created:'2025-10-01'}],current_payments:[],duplicate_review:[],account:{status:'expired',total_paid:600000},...overrides}; }
const run = (r=row(), profiles=[profile], leases=[]) => build({rows:[r],profiles,leases,asOf});
test('missing ended tenancy appears with paid-through date, without a fabricated contract',()=>{
 expect(run()).toEqual([expect.objectContaining({status:'expired',paid_through:'2026-03-31',contract_end:null})]);
});
test.each(['inactive','prospective'])('excludes %s tenants',status=>expect(run(row(),[{...profile,status}])).toEqual([]));
test('excludes archived tenants',()=>expect(run(row(),[{...profile,deleted_at:'2026-10-01'}])).toEqual([]));
test('confirmed renewal hides source record, including existing tenant alias on the same house',()=>{
 expect(run(row(),[profile],[{tenant_public_id:'alias',unit_public_id:'unit_one',status:'active',end_date:'2026-12-31'}])).toEqual([]);
});
test.each(['draft','cancelled'])('%s renewal does not hide follow-up',status=>{
 expect(run(row(),[profile],[{tenant_public_id:'tenant_one',unit_public_id:'unit_one',status,end_date:'2026-12-31'}])).toHaveLength(1);
});
test('monitoring keeps the resident while linking the latest ended contract in Leases',()=>{
 expect(run(row(),[profile],[{public_id:'lease_ended',tenant_public_id:'tenant_one',unit_public_id:'unit_one',status:'expired',end_date:'2026-03-31'}])[0]).toMatchObject({latest_lease_public_id:'lease_ended',contract_end:'2026-03-31',status:'expired'});
});
test('partial-month payments do not produce a guessed date',()=>{
 expect(run(row({history:[{amount:650000,date_created:'2025-10-01'}]}))[0].paid_through).toBeNull();
});
test('new payments can remove follow-up while an invoice remains absent',()=>expect(run(row({account:{status:'current'}}))).toEqual([]));
test('unreviewed missing details remain visible for review',()=>{
 expect(run(row({source:{date_in:'',monthly_rent:null,unit:''},account:{status:'needs_review',total_paid:600000}}))[0]).toMatchObject({status:'needs_review',paid_through:null});
});
test('new timestamps use Tanzania payment date and exclude imported and suspected duplicates',()=>{
 const r=row({current_payments:[{amount:100000,paid_at:new Date('2026-04-01T21:00:00Z'),status:'completed',receipt_number:'new'}, {amount:600000,paid_at:'2026-04-02',status:'completed',imported_from_csv:true},{amount:200000,paid_at:'2026-04-02',status:'completed',receipt_number:'dupe'}],duplicate_review:['dupe']});
 expect(run(r)[0]).toMatchObject({paid_through:'2026-04-30',last_payment_date:'2026-04-02'});
});

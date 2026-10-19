const {buildPaymentTimeline:build}=require('../services/paymentTimelineService');
const source=(id,amount,date,created_at=date)=>({id,amount,date_created:date,created_at,invoice:`ref-${id}`});
test('keeps each CSV installment in payment-date order and computes exact cumulative totals',()=>{
 const rows=build([source('3','90000','2026-03-01'),source('1','180000','2025-08-01','2026-01-01'),source('2','90000','2025-12-01')],[],[],'2026-10-19');
 expect(rows.map(r=>[r.payment_date,r.amount,r.running_total])).toEqual([['2025-08-01',180000,180000],['2025-12-01',90000,270000],['2026-03-01',90000,360000]]);
 expect(rows[0].recorded_at).toBe('2026-01-01');
});
test('does not collapse equal payments with separate source IDs or mutate input',()=>{
 const history=[source('1','10.10','2025-08-01'),source('2','10.10','2025-08-01')];const before=JSON.stringify(history);
 const rows=build(history,[],[],'2026-10-19');expect(rows).toHaveLength(2);expect(rows[1].running_total).toBe(20.2);expect(JSON.stringify(history)).toBe(before);
});
test('excludes migrated copies, flags suspected duplicates, and uses Tanzania dates',()=>{
 const p={receipt_number:'new',amount:90000,status:'completed',paid_at:new Date('2025-11-30T21:00:00Z')};
 const rows=build([source('1',180000,'2025-08-01')],[{...p,receipt_number:'copy',imported_from_csv:true},{...p,receipt_number:'review'},p,{...p,receipt_number:'cancelled',status:'cancelled'}],['review'],'2026-10-19');
 expect(rows).toHaveLength(3);expect(rows.at(-1).running_total).toBe(270000);expect(rows.find(r=>r.needs_review).included_in_total).toBe(false);expect(rows.find(r=>r.source_id==='new').payment_date).toBe('2025-12-01');
});
test('retains advance and future-dated records without inventing dates or methods',()=>{
 const r=build([source('1',100,'2027-01-01')],[],[],'2026-10-19')[0];expect(r.future).toBe(true);expect(r.payment_date).toBe('2027-01-01');expect(r.payment_method).toBeUndefined();
});

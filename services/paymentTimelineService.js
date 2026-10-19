const paymentDay = value => new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Dar_es_Salaam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
function buildPaymentTimeline(history, currentPayments, duplicateReview = [], asOf) {
    const csv = history.map(p => ({
        key: `csv:${p.id}`, source:'CSV', source_id:p.id,
        payment_date:p.date_created.slice(0,10), recorded_at:p.created_at || null,
        amount:Number(p.amount), reference:p.invoice || null,
        needs_review:false, included_in_total:true
    }));
    const native = currentPayments.filter(p => !p.imported_from_csv && p.status === 'completed').map(p => ({
        key:`system:${p.receipt_number}`,source:'Mfumo mpya',source_id:p.receipt_number,
        payment_date:paymentDay(p.paid_at),recorded_at:null,
        amount:Number(p.amount),reference:p.transaction_reference || p.receipt_number,
        needs_review:duplicateReview.includes(p.receipt_number),included_in_total:!duplicateReview.includes(p.receipt_number)
    }));
    const rows=[...csv,...native].sort((a,b)=>a.payment_date.localeCompare(b.payment_date) ||
        (a.recorded_at || '').localeCompare(b.recorded_at || '') || a.key.localeCompare(b.key,undefined,{numeric:true}));
    let cents=0;
    return rows.map((row,index)=>{
        if(row.included_in_total)cents+=Math.round(row.amount*100);
        return {...row,installment:index+1,running_total:cents/100,future:row.payment_date>asOf};
    });
}
module.exports={buildPaymentTimeline};

const {validDate}=require('./legacy-rental-monitor.cjs');
const DAY=86400000;
// Inclusive date-in through as-of; anchored calendar months and actual-day proration.
function calculateBalance(row,history,asOf,additionalPaid=0){
 const paid=history.filter(p=>p.date_created.slice(0,10)<=asOf).reduce((a,p)=>a+Math.round(Number(p.amount)*100),0);
 const result={csv_paid:paid/100,new_paid:additionalPaid,total_paid:Math.round(paid+additionalPaid*100)/100,months:null,days:null,days_in_period:null,total_days:null,rent_due:null,balance:null,arrears:null,credit:null,status:'needs_review'};
 if(!validDate(row.date_in)||!validDate(asOf)||row.date_in>asOf||row.monthly_rent===null||!Number.isFinite(row.monthly_rent)||row.monthly_rent<0||!row.unit)return result;
 const start=new Date(row.date_in+'T00:00:00Z'),until=new Date(Date.parse(asOf+'T00:00:00Z')+DAY);
 const anniversary=n=>{const m=start.getUTCMonth()+n;return new Date(Date.UTC(start.getUTCFullYear(),m,Math.min(start.getUTCDate(),new Date(Date.UTC(start.getUTCFullYear(),m+1,0)).getUTCDate())));};
 let months=(until.getUTCFullYear()-start.getUTCFullYear())*12+until.getUTCMonth()-start.getUTCMonth();
 while(anniversary(months)>until)months--;
 while(anniversary(months+1)<=until)months++;
 const days=Math.round((until-anniversary(months))/DAY),periodDays=Math.round((anniversary(months+1)-anniversary(months))/DAY);
 const dueCents=Math.round(Math.round(row.monthly_rent*100)*(months+days/periodDays));
 const balanceCents=Math.round(result.total_paid*100)-dueCents;
 return {...result,months,days,days_in_period:periodDays,total_days:Math.round((until-start)/DAY),rent_due:dueCents/100,balance:balanceCents/100,arrears:Math.max(0,-balanceCents)/100,credit:Math.max(0,balanceCents)/100,status:balanceCents<0?'expired':balanceCents>0?'current':'settled'};
}
module.exports={calculateBalance};

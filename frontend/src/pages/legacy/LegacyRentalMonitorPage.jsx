import { useEffect, useState } from 'react';
import apiClient from '../../api/apiClient';

const money = value => Number(value || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });
const day = value => value ? String(value).slice(0, 10) : '—';
function state(row) {
    if (row.duplicate_review?.length) return 'Hakiki malipo yanayofanana';
    return {needs_review:'Taarifa hazitoshi',expired:'Imeisha',current:'Bado',settled:'Imelipwa hadi leo'}[row.account.status];
}
export default function LegacyRentalMonitorPage() {
    const [data, setData] = useState(null), [error, setError] = useState('');
    const [search, setSearch] = useState(''), [filter, setFilter] = useState('all'), [selected, setSelected] = useState(null);
    const [paidThrough, setPaidThrough] = useState(''), [evidence, setEvidence] = useState(''), [saving, setSaving] = useState(false);
    async function load() {
        try { const result = await apiClient.get('/preview-rental-monitor'); setData(result.data.data); setError(''); }
        catch (e) { setError(e.response?.data?.message || 'Unable to load monitoring.'); }
    }
    useEffect(() => { load(); }, []);
    function select(row) { setSelected(row); setPaidThrough(row.review.paid_through || ''); setEvidence(row.review.evidence || ''); setError(''); }
    async function save(event) {
        event.preventDefault(); setSaving(true);
        try {
            const result = await apiClient.put(`/preview-rental-monitor/${selected.source_id}/review`, {paid_through:paidThrough || null, evidence, version:selected.version});
            const updated = {...selected, ...result.data.data}; setSelected(updated);
            setData(previous => ({...previous, rows:previous.rows.map(r => r.source_id === updated.source_id ? updated : r)})); setError('');
        } catch(e) { setError(e.response?.data?.message || 'Unable to save review.'); }
        finally { setSaving(false); }
    }
    const rows = (data?.rows || []).filter(row => {
        const s=row.source, match=`${s.name} ${s.contact} ${s.property} ${s.unit} ${row.source_id}`.toLowerCase().includes(search.toLowerCase());
        const status=state(row,data.as_of);
        return match && (filter==='all' || (filter==='expired' && s.status==='1' && status.startsWith('Imeisha')) || (filter==='review' && (row.account.status==='needs_review' || row.duplicate_review?.length)));
    }).sort((a,b)=>(a.source.property || 'ZZZ').localeCompare(b.source.property || 'ZZZ') || a.source.unit.localeCompare(b.source.unit, undefined, {numeric:true}) || Number(a.source_id)-Number(b.source_id));
    return <div className="space-y-5 p-4 sm:p-6">
        <header><h1 className="text-2xl font-bold text-slate-950">Legacy Rental Monitoring</h1><p className="mt-1 text-slate-600">Wapangaji Active • Historia ya CSV na uhakiki wa accountant • Preview pekee • Tarehe {data?.as_of || '…'}</p></header>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Hesabu: date-in hadi leo (leo imejumuishwa). Kodi = miezi kamili × kodi ya mwezi + siku zilizobaki ÷ siku halisi za kipindi × kodi ya mwezi. Balance = malipo − kodi ya kipindi. Bei ya sasa imetumika tangu date-in; malipo ya kabla ya date-in ni advance. Hii ni hesabu ya monitoring; haibadilishi salio la invoice.</div>
        {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <button className="underline" onClick={load}>Reload</button></div>}
        {!data && !error && <p>Inapakia taarifa…</p>}
        {data && <>
            <div className="flex flex-wrap gap-4 rounded-xl border bg-white p-4 text-sm"><span>Wapangaji: <strong>{data.rows.length}</strong></span><span>Malipo CSV: <strong>{data.batch.summary.payments}</strong></span><span>Jumla CSV: <strong>TZS {money(data.batch.summary.total_payment_amount)}</strong></span>{data.orphan_payments.length>0 && <span>Tenant ID zisizopo: <strong>{data.orphan_payments.length} malipo</strong></span>}</div>
            <div className="flex flex-wrap gap-3"><input aria-label="Search tenants" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Jina, simu, property au nyumba" className="min-w-64 flex-1 rounded-lg border border-slate-300 bg-white p-3"/><select aria-label="Filter monitoring" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border bg-white p-3"><option value="all">Wote</option><option value="expired">Active: Imeisha</option><option value="review">Wanahitaji uhakiki</option></select><button onClick={load} className="rounded-lg border bg-white px-4">Refresh</button></div>
            {selected && <section aria-label="Tenant monitoring detail" className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                <div className="flex justify-between gap-3"><h2 className="text-xl font-bold">{selected.source.name || 'Jina halipo'} • ID {selected.source_id}</h2><button className="rounded-lg border px-3 py-2" onClick={()=>setSelected(null)}>Close detail</button></div>
                <p className="mt-2">Simu: {selected.source.contact || 'Haipo'} • {selected.source.property || 'Property haipo'} / {selected.source.unit || 'Nyumba haipo'} • Date-in: {selected.source.date_in}</p>
                <p className="mt-2">Jumla CSV: TZS {money(selected.estimate.total)} • Kodi/mwezi: {selected.source.monthly_rent === null ? 'Haipo' : `TZS ${money(selected.source.monthly_rent)}`}</p>
                <p className="mt-2 text-sm text-slate-600">Hali: {state(selected,data.as_of)}</p>
                <div className="my-4 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                    <p>Muda aliokaa: <strong>{selected.account.months === null ? 'Date-in/nyumba/kodi ihakikiwe' : `miezi ${selected.account.months}, siku ${selected.account.days} (${selected.account.total_days} siku)`}</strong></p>
                    <p>Kodi ya kipindi: <strong>{selected.account.rent_due === null ? '—' : `TZS ${money(selected.account.rent_due)}`}</strong></p>
                    <p>Malipo CSV: TZS {money(selected.account.csv_paid)} • Mfumo mpya: TZS {money(selected.account.new_paid)}</p>
                    <p>Jumla malipo: <strong>TZS {money(selected.account.total_paid)}</strong></p>
                    <p className="text-red-800">Anadaiwa: <strong>{selected.account.arrears === null ? '—' : `TZS ${money(selected.account.arrears)}`}</strong></p>
                    <p className="text-green-800">Salio la mbele: <strong>{selected.account.credit === null ? '—' : `TZS ${money(selected.account.credit)}`}</strong></p>
                    {selected.duplicate_review?.length>0 && <p className="text-amber-800">Receipts zinazofanana na historia hazijajumlishwa mpaka zihakiwe: {selected.duplicate_review.join(', ')}</p>}
                </div>
                <form onSubmit={save} className="my-5 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-2"><label className="text-sm">Imelipiwa hadi (tarehe iliyothibitishwa)<input type="date" value={paidThrough} onChange={e=>setPaidThrough(e.target.value)} className="mt-1 block w-full rounded-lg border bg-white p-2"/></label><label className="text-sm">Ushahidi / maelezo ya uhakiki<textarea required minLength={10} maxLength={2000} value={evidence} onChange={e=>setEvidence(e.target.value)} className="mt-1 block w-full rounded-lg border bg-white p-2"/></label><button disabled={saving} className="rounded-lg bg-blue-700 p-3 text-white disabled:opacity-50">{saving?'Inahifadhi…':'Hifadhi uhakiki'}</button><p className="text-xs text-slate-600">Uhakiki huhifadhi actor na audit. Tarehe hii haibadilishi hesabu ya date-in hadi leo. Hauundi invoice, receipt au mkataba.</p></form>
                {selected.review.reviewed_at && <p className="mb-3 text-xs text-slate-600">Uhakiki: {selected.review.reviewed_at} • {selected.review.reviewed_by}</p>}
                <h3 className="font-bold">Malipo ya CSV ({selected.history.length})</h3><div className="overflow-x-auto"><table style={{minWidth:650}} className="w-full text-left text-sm"><thead><tr><th className="p-2">Payment ID</th><th>Tarehe ya malipo</th><th>Kiasi TZS</th><th>Reference</th><th>Rekodi iliingizwa</th></tr></thead><tbody>{selected.history.map(p=><tr key={p.id} className="border-t"><td className="p-2">{p.id}</td><td>{p.date_created}</td><td>{money(p.amount)}</td><td>{p.invoice || '—'}</td><td>{p.created_at}</td></tr>)}</tbody></table>{!selected.history.length && <p className="py-2">Hakuna malipo kwenye CSV; si uthibitisho wa kutolipa.</p>}</div>
                <h3 className="mt-5 font-bold">Mfumo mpya — payments na invoices (hazijajumlishwa na CSV)</h3>{selected.current_payments.map(p=><p key={p.receipt_number} className="mt-2 text-sm">{p.receipt_number} • {day(p.paid_at)} • TZS {money(p.amount)} • {p.status}</p>)}{selected.current_invoices.map(i=><p key={i.invoice_number} className="mt-2 text-sm">{i.invoice_number} • {i.billing_period_start} → {i.billing_period_end} • {i.status} • Balance TZS {money(i.balance_amount)}</p>)}{!selected.current_payments.length && !selected.current_invoices.length && <p className="mt-2 text-sm text-slate-600">Hakuna invoice/payment iliyorekodiwa kwenye mfumo mpya kwa mpangaji huyu.</p>}
            </section>}
            <p className="text-sm text-slate-600">Rekodi {rows.length}. Chagua mpangaji kuona malipo na kuhifadhi uhakiki.</p>
            <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-100"><tr>{['Mpangaji / simu','Property / nyumba','Date-in / CSV status','Kodi/mwezi TZS','Malipo CSV TZS','Muda aliokaa','Kodi hadi leo TZS','Anadaiwa TZS','Salio la mbele TZS','Hali'].map((h,i)=><th key={i} className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.source_id} className="border-t"><td className="p-3 font-medium"><button aria-label={`Review ID ${row.source_id}`} onClick={()=>{select(row);window.scrollTo({top:0,behavior:'smooth'});}} className="text-left font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4">{row.source.name || 'Jina halipo'}</button><div className="text-xs font-normal text-slate-500">ID {row.source_id} • {row.source.contact || 'Simu haipo'}</div></td><td className="p-3">{row.source.property || 'Haipo'}<div>{row.source.unit || 'Haipo'}</div></td><td className="p-3">{row.source.date_in}<div>{row.source.status==='1'?'Active':'Inactive'}</div></td><td className="p-3">{row.source.monthly_rent===null?'—':money(row.source.monthly_rent)}</td><td className="p-3">{money(row.estimate.total)}</td><td className="p-3">{row.account.months === null ? '—' : `${row.account.months} miezi ${row.account.days} siku`}</td><td className="p-3">{row.account.rent_due === null ? '—' : money(row.account.rent_due)}</td><td className="p-3 text-red-800">{row.account.arrears === null ? '—' : money(row.account.arrears)}</td><td className="p-3 text-green-800">{row.account.credit === null ? '—' : money(row.account.credit)}</td><td className="p-3">{state(row,data.as_of)}</td></tr>)}</tbody></table></div>
            {data.orphan_payments.length>0 && <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">Malipo yasiyounganishwa na tenant ({data.orphan_payments.length})</summary><p className="my-2 text-sm text-slate-600">Yamehifadhiwa kwa uhakiki; hayajapewa mpangaji mwingine kwa kubahatisha.</p>{data.orphan_payments.map(p=><p className="py-1 text-sm" key={p.id}>Payment {p.id} • Tenant ID {p.tenant_id} • {p.date_created} • TZS {money(p.amount)} • {p.invoice}</p>)}</details>}
        </>}
    </div>;
}

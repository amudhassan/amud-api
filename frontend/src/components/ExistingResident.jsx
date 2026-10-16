import { useEffect, useState } from 'react';
import apiClient from '../api/apiClient';
export function useExistingResidents() {
 const [rows,setRows]=useState([]);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(import.meta.env.VITE_PREVIEW_LEGACY_MONITORING!=='true')return;
  let active=true;
  apiClient.get('/preview-existing-occupancies').then(r=>{if(active)setRows(r.data?.data||[]);}).catch(()=>{if(active)setError('Resident information could not be loaded. Refresh to retry.');});
  return ()=>{active=false;};
 },[]);
 return {rows,error};
}
export default function ExistingResident({rows,tenantId,unitId,error}) {
 if(error)return <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>;
 const resident=rows.find(r=>tenantId?r.tenant_public_id===tenantId:r.unit_public_id===unitId);
 if(!resident)return null;
 return <div className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900">
  <p className="font-semibold">{resident.origin==='lease'?'Current tenancy':'Existing resident'}</p>
  <p>{tenantId?`${resident.property_name} · House ${resident.unit_code}`:resident.tenant_name}</p>
  {resident.calculated_paid_through&&<p className="text-xs">Paid through (calculated): {resident.calculated_paid_through}</p>}
 </div>;
}

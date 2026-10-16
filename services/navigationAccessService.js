const pool=require('../config/db');
const all=['dashboard','users','owners','properties','units','tenants','leases','invoices','payments','maintenance','notifications','reports','settings','profile','legacy-rental-monitor'];
async function getNavigationModules(user){
 if(user.role==='admin')return all;
 const links=(await pool.query(`SELECT ou.*,o.public_id AS owner_public_id FROM owner_users ou JOIN owners o ON o.id=ou.owner_id WHERE ou.user_id=$1 AND ou.revoked_at IS NULL AND o.deleted_at IS NULL AND o.status='active'`,[user.id])).rows;
 const modules=new Set(['dashboard','profile','settings','notifications']);
 for(const link of links){
  if(['owner','representative','manager'].includes(link.relationship_role))modules.add('owners');
  if(link.can_manage_properties){for(const m of ['properties','units','tenants','leases','reports'])modules.add(m);}
  if(link.can_manage_finances){for(const m of ['properties','units','tenants','leases','invoices','payments','reports'])modules.add(m);}
  if(link.can_view_maintenance_requests||link.can_create_maintenance_requests||link.can_update_maintenance_requests||link.can_assign_maintenance_work||link.can_manage_maintenance_costs||link.can_approve_maintenance_costs||link.can_change_maintenance_status||link.can_close_maintenance_requests||link.can_reopen_maintenance_requests)modules.add('maintenance');
  if(link.can_manage_finances&&link.owner_public_id==='owner_mkutasidu_legacy')modules.add('legacy-rental-monitor');
 }
 return [...modules];
}
module.exports={getNavigationModules};

// UI hints only. Every write service independently checks current database access.
async function getActionPermissions(user) {
 if (user.role === 'admin') return {all:true};
 const {canManageTenants,isAccountant} = require('./tenantActionAccessService');
 const links=(await pool.query(`SELECT ou.*,o.public_id AS owner_public_id FROM owner_users ou JOIN owners o ON o.id=ou.owner_id WHERE ou.user_id=$1 AND ou.revoked_at IS NULL AND o.deleted_at IS NULL AND o.status='active'`,[user.id])).rows;
 const owners={};
 for(const link of links) owners[link.owner_public_id]={manage:canManageTenants(link),tenant_contacts:canManageTenants(link)||isAccountant(link),tenant_add:canManageTenants(link)||isAccountant(link)};
 const properties={};
 const rows=(await pool.query(`SELECT DISTINCT p.public_id FROM properties p JOIN property_owners po ON po.property_id=p.id AND po.effective_to IS NULL JOIN owners o ON o.id=po.owner_id AND o.deleted_at IS NULL AND o.status='active' JOIN owner_users ou ON ou.owner_id=o.id AND ou.revoked_at IS NULL WHERE p.deleted_at IS NULL AND ou.user_id=$1 AND ou.can_manage_properties=TRUE AND ou.relationship_role IN ('owner','representative','manager')`,[user.id])).rows;
 for(const row of rows) properties[row.public_id]={manage:true};
 return {owners,properties};
}
module.exports.getActionPermissions=getActionPermissions;

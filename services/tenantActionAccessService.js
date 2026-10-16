const AppError = require('../utils/AppError');
const CONTACT_FIELDS = ['email','phone_number','alternative_phone','address','city','region','country'];
const MANAGER_ROLES = ['owner','representative','manager'];
const canManageTenants = link => Boolean(link?.can_manage_properties && MANAGER_ROLES.includes(link.relationship_role));
const isAccountant = link => Boolean(link?.can_manage_finances && link.relationship_role === 'accountant');
async function checkTenantWrite(client, ownerId, user, data, creating = false) {
    if (user.role === 'admin') return;
    const link = (await client.query(`SELECT * FROM owner_users WHERE owner_id=$1 AND user_id=$2 AND revoked_at IS NULL FOR SHARE`, [ownerId,user.id])).rows[0];
    if (canManageTenants(link)) return;
    if (!isAccountant(link)) throw new AppError('Tenant write permission required.',403);
    const allowed = creating ? [...CONTACT_FIELDS,'tenant_type','display_name','notes'] : CONTACT_FIELDS;
    if (Object.keys(data).some(field => !allowed.includes(field))) {
        throw new AppError('Accountants may update tenant contacts only; identity changes require an owner or manager.',403);
    }
}
module.exports = { CONTACT_FIELDS, canManageTenants, isAccountant, checkTenantWrite };

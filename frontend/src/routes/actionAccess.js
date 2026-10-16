import { useAuth } from '../contexts/AuthContext';
export function useActionAccess() {
 const {user}=useAuth();
 const permissions=user?.action_permissions || {};
 return {
  owner:(id,action='manage')=>Boolean(permissions.all || permissions.owners?.[id]?.[action]),
  property:id=>Boolean(permissions.all || permissions.properties?.[id]?.manage),
  anyProperty: Boolean(permissions.all || Object.values(permissions.owners || {}).some(p=>p.manage)),
 };
}

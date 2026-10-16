// Optional existing-resident records in the local preview, separate from signed leases.
module.exports=pool=>{
 const router=require('express').Router();
 router.use(require('../../middleware/authMiddleware').authMiddleware);
 router.get('/',async(req,res,next)=>{try{
  const present=(await pool.query("SELECT to_regclass('preview_existing_occupancies') AS name")).rows[0].name;
  const values=req.user.role==='admin'?[]:[req.user.id];
  const access=req.user.role==='admin'?'':`AND EXISTS(SELECT 1 FROM owner_users ou JOIN owners o ON o.id=ou.owner_id WHERE ou.owner_id=x.owner_id AND ou.user_id=$1 AND ou.revoked_at IS NULL AND o.deleted_at IS NULL AND o.status='active')`;
  const source=present?`SELECT owner_id,tenant_id,unit_id,date_in::text,calculated_paid_through::text,'existing'::text AS origin FROM preview_existing_occupancies`:`SELECT NULL::bigint AS owner_id,NULL::bigint AS tenant_id,NULL::bigint AS unit_id,NULL::text AS date_in,NULL::text AS calculated_paid_through,NULL::text AS origin WHERE FALSE`;
  const result=await pool.query(`WITH residents AS (${source}), combined AS (
   SELECT * FROM residents r WHERE NOT EXISTS(SELECT 1 FROM leases l WHERE l.unit_id=r.unit_id AND l.status='active')
   UNION ALL SELECT owner_id,tenant_id,unit_id,start_date::text,NULL::text,'lease'::text FROM leases WHERE status='active')
   SELECT t.public_id AS tenant_public_id,t.display_name AS tenant_name,u.public_id AS unit_public_id,u.unit_code,
    p.public_id AS property_public_id,p.property_name,o.public_id AS owner_public_id,x.date_in,x.calculated_paid_through,x.origin
   FROM combined x JOIN tenants t ON t.id=x.tenant_id AND t.deleted_at IS NULL JOIN units u ON u.id=x.unit_id AND u.deleted_at IS NULL
   JOIN properties p ON p.id=u.property_id AND p.deleted_at IS NULL JOIN owners o ON o.id=x.owner_id AND o.deleted_at IS NULL
   WHERE TRUE ${access} ORDER BY p.property_name,u.unit_code`,values);
  res.json({success:true,data:result.rows});
 }catch(e){next(e);}});
 return router;
};

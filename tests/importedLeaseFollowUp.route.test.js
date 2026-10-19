jest.mock('../middleware/authMiddleware',()=>({authMiddleware:(req,res,next)=>{
 if(!req.headers['x-test-user']) return res.status(401).json({message:'Authentication required'});
 req.user={id:2,role:'user'};next();
}}));
const express=require('express');const request=require('supertest');
const createRouter=require('../scripts/ux/legacy-rental-monitor-router.cjs');
let allowed, pool, app;
beforeEach(()=>{
 allowed=true;
 pool={query:jest.fn(async(sql,values)=>{
  if(sql.startsWith('SELECT id FROM owners'))return {rows:[{id:100}]};
  if(sql.includes('SELECT 1 FROM owner_users')){expect(values).toEqual([100,2]);return {rows:allowed?[{allowed:1}]:[]};}
  if(sql.includes('to_regclass'))return {rows:[{name:'installed'}]};
  if(sql.startsWith('SELECT source FROM'))return {rows:[{source:{tenant_id:'1',amount:600000,date_created:'2025-10-01'}}]};
  if(sql.startsWith('SELECT source_id'))return {rows:[{source_id:'1',tenant_public_id:'tenant_one',source:{status:'1',unit:'01',unit_public_id:'unit_one',date_in:'2025-10-01',monthly_rent:100000},review:{}}]};
  if(sql.startsWith('SELECT summary'))return {rows:[{summary:{}}]};
  if(sql.includes('FROM tenants t JOIN owner_tenants')){expect(values).toEqual([100]);return {rows:[{public_id:'tenant_one',display_name:'Resident',status:'active',deleted_at:null}]};}
  if(sql.includes('WHERE l.owner_id=$1'))expect(values).toEqual([100]);
  return {rows:[]};
 })};app=express();app.use(createRouter(pool));
});
test('follow-ups require authentication',async()=>{await request(app).get('/follow-ups').expect(401);expect(pool.query).not.toHaveBeenCalled();});
test('revoked or missing finance permission cannot access company follow-ups',async()=>{allowed=false;await request(app).get('/follow-ups').set('x-test-user','fixture').expect(403);});
test('authorized finance user receives missing expired source record without writing a lease',async()=>{
 const r=await request(app).get('/follow-ups').set('x-test-user','fixture').expect(200);
 expect(r.body.data.rows).toEqual([expect.objectContaining({tenant_public_id:'tenant_one',status:'expired',contract_end:null,paid_through:'2026-03-31'})]);
 expect(pool.query.mock.calls.every(([sql])=>sql.startsWith('SELECT'))).toBe(true);
});

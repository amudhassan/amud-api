jest.mock('../config/db',()=>({query:jest.fn()}));
const pool=require('../config/db');
const {resolvePropertyScope}=require('../services/reports/occupancyLeaseReportService');
beforeEach(()=>pool.query.mockReset());
test('accountant read reports retain owner and revocation boundaries',async()=>{
 pool.query.mockResolvedValue({rows:[{id:7,public_id:'owner_demo',display_name:'Demo',can_manage_finances:true,can_manage_properties:false}]});
 const scope=await resolvePropertyScope({filters:{owner_public_id:'owner_demo'},authenticatedUser:{id:12,role:'user'}});
 expect(scope.owner_ids).toEqual([7]);
 const [sql,args]=pool.query.mock.calls[0];
 expect(sql).toContain('ou.can_manage_finances = TRUE');
 expect(sql).toContain('ou.can_manage_properties = TRUE');
 expect(sql).toContain('ou.revoked_at IS NULL');
 expect(sql).toContain('o.deleted_at IS NULL');
 expect(args).toEqual([12,'owner_demo']);
});
test('unlinked or revoked staff cannot read portfolio reports',async()=>{
 pool.query.mockResolvedValue({rows:[]});
 const scope=await resolvePropertyScope({filters:{},authenticatedUser:{id:13,role:'user'}});
 expect(scope.forbidden).toBe(true);
});

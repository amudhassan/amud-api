// Isolated database + production API and browser checks; no imported tenant data.
const assert=require('node:assert/strict');
const request=require('supertest');
const {run}=require('./lease-database-check.cjs');
run(async ({db,pool})=>{
 const jwt=require('jsonwebtoken');
 const express=require('express');
 const app=express();app.use(express.json());
 for(const [path,name] of [['tenants','tenantRoutes'],['properties','propertyRoutes'],['units','unitRoutes']])app.use(`/api/${path}`,require(`../../routes/${name}`));
 app.use((err,req,res,next)=>res.status(err.statusCode||500).json({message:err.message}));
 const staff={id:2,role:'user'};
 const token=jwt.sign({public_id:'user_acceptance_staff'},process.env.JWT_SECRET,{expiresIn:'5m'});
 async function api(method,url,body,status){let q=request(app)[method](url).set('Authorization',`Bearer ${token}`);if(body)q=q.send(body);const res=await q;assert.equal(res.status,status,JSON.stringify(res.body));return res.body;}
 await db.query("UPDATE owner_users SET relationship_role='accountant',can_manage_properties=false,can_manage_finances=true WHERE public_id='owner_user_acceptance'");
 const access=require('../../services/navigationAccessService');
 let permissions=await access.getActionPermissions(staff);
 assert.deepEqual(permissions.owners.owner_acceptance,{manage:false,tenant_contacts:true,tenant_add:true});
 assert.deepEqual(permissions.properties,{});
 for(const menu of ['properties','units','tenants'])assert.ok((await access.getNavigationModules(staff)).includes(menu));
 await api('get','/api/properties/property_acceptance',null,200);
 await api('get','/api/units/unit_acceptance',null,200);
 const created=await api('post','/api/tenants',{owner_public_id:'owner_acceptance',tenant_type:'individual',display_name:'Contacts Test',phone_number:'0712345678'},201);
 const id=created.data.tenant.public_id;
 await api('patch',`/api/tenants/${id}?owner_public_id=owner_acceptance`,{phone_number:'0799999999'},200);
 for(const field of ['display_name','national_id','passport_number','registration_number','tax_identification_number','tenant_type']){
  await api('patch',`/api/tenants/${id}?owner_public_id=owner_acceptance`,{[field]:field==='tenant_type'?'company':'Changed identity',phone_number:'0700000000'},403);
 }
 assert.equal((await db.query('SELECT phone_number FROM tenants WHERE public_id=$1',[id])).rows[0].phone_number,'0799999999');
 await api('post','/api/tenants',{owner_public_id:'owner_acceptance',tenant_type:'individual',display_name:'Forbidden ID',national_id:'PRIVATE-TEST-ID'},403);
 await api('patch',`/api/tenants/${id}/activate?owner_public_id=owner_acceptance`,{},404);
 await api('patch','/api/properties/property_acceptance',{property_name:'Forbidden change'},404);
 await api('patch','/api/units/unit_acceptance',{unit_code:'Forbidden'},404);
 console.log('PASS: Accountant adds tenants and edits contacts; identity, lifecycle and property/unit changes denied atomically.');
 // A current relationship belonging to another owner must not grant cross-owner writes.
 await db.query("INSERT INTO owners(id,public_id,owner_type,display_name,country,status,created_by) VALUES(900,'owner_unassigned','individual','Unassigned Owner','Tanzania','active',1)");
 await api('post','/api/tenants',{owner_public_id:'owner_unassigned',tenant_type:'individual',display_name:'Cross Owner'},404);
 await db.query("UPDATE owner_users SET revoked_at=now() WHERE public_id='owner_user_acceptance'");
 await api('patch',`/api/tenants/${id}?owner_public_id=owner_acceptance`,{phone_number:'0700000000'},404);
 assert.deepEqual((await access.getActionPermissions(staff)).owners,{});
 await db.query("UPDATE owner_users SET revoked_at=NULL,can_manage_finances=false WHERE public_id='owner_user_acceptance'");
 await api('patch',`/api/tenants/${id}?owner_public_id=owner_acceptance`,{phone_number:'0700000000'},404);
 await db.query("UPDATE owner_users SET can_manage_finances=true WHERE public_id='owner_user_acceptance'");
 await db.query("UPDATE owner_tenants SET is_primary_owner_relationship=false WHERE tenant_id=(SELECT id FROM tenants WHERE public_id=$1)",[id]);
 await api('patch',`/api/tenants/${id}?owner_public_id=owner_acceptance`,{phone_number:'0700000000'},404);
 await db.query("UPDATE owner_tenants SET is_primary_owner_relationship=true WHERE tenant_id=(SELECT id FROM tenants WHERE public_id=$1)",[id]);
 console.log('PASS: unassigned owner, revoked membership, removed finance permission and secondary-owner writes denied.');
 await db.query("UPDATE owner_users SET relationship_role='manager',can_manage_properties=true WHERE public_id='owner_user_acceptance'");
 await api('patch',`/api/tenants/${id}?owner_public_id=owner_acceptance`,{display_name:'Manager Updated'},200);
 assert.equal((await access.getActionPermissions(staff)).properties.property_acceptance.manage,true);
 console.log('PASS: existing manager identity permissions preserved.');
 await db.query("UPDATE owner_users SET relationship_role='accountant',can_manage_properties=false,can_manage_finances=true WHERE public_id='owner_user_acceptance'");
 if(process.env.UX_ACTION_BROWSER==='1'){
  const {createRequire}=require('node:module');const runtime=createRequire(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/package.json`);
  const {chromium}=runtime('playwright');
  const preview=await require('./lease-accountant-preview.cjs').startPreview({db,pool});
  let browser;
  try{
   browser=await chromium.launch({executablePath:process.env.UX_CHROMIUM_EXECUTABLE,headless:true});
   const page=await browser.newPage();await page.goto(preview.staffUrl);await page.waitForURL('**/leases');
   async function open(path){await page.goto(new URL(path,preview.url).href);await page.waitForLoadState('networkidle');assert.equal(await page.getByText('Access restricted',{exact:true}).count(),0);}
   await open('/properties');assert.equal(await page.getByRole('button',{name:'Add Property',exact:true}).count(),0);
   await open('/properties/property_acceptance');assert.equal(await page.getByRole('button',{name:'Edit property',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Manage Ownership',exact:true}).count(),0);
   await open('/units');assert.equal(await page.getByRole('button',{name:'Add Unit',exact:true}).count(),0);
   await open('/units/unit_acceptance');assert.equal(await page.getByRole('button',{name:'Edit unit',exact:true}).count(),0);
   await open(`/tenants/${id}?owner_public_id=owner_acceptance`);await page.getByRole('button',{name:'Edit contacts',exact:true}).click();
   assert.equal(await page.locator('[name="display_name"]').count(),0);assert.equal(await page.locator('[name="national_id"]').count(),0);
   await page.locator('[name="phone_number"]').fill('0788888888');await page.getByRole('button',{name:'Save Changes',exact:true}).click();await page.waitForLoadState('networkidle');
   assert.equal((await db.query('SELECT phone_number FROM tenants WHERE public_id=$1',[id])).rows[0].phone_number,'0788888888');
   assert.equal(await page.getByRole('button',{name:'Manage tenant users',exact:true}).count(),0);
   await open('/tenants');await page.locator('select').first().selectOption('owner_acceptance');
   await page.getByRole('button',{name:'Add Tenant',exact:true}).click();
   assert.equal(await page.locator('[name="national_id"]').count(),0);
   await page.locator('[name="display_name"]').fill('Browser New Tenant');
   const saved=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/tenants'));
   await page.getByRole('dialog').getByRole('button',{name:'Add Tenant',exact:true}).click();assert.equal((await saved).status(),201);
   console.log('PASS: real browser hides property/unit writes and tenant identity/lifecycle actions; contact save works.');
  }finally{if(browser)await browser.close();await preview.close();}
 }
}).catch(error=>{console.error(error);process.exitCode=1;});

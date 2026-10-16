const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {run}=require('./lease-database-check.cjs');
const profiles=require('./legacy-rental-preview-import.cjs');
const {loadMonitoring,importMonitoring,estimate}=require('./legacy-rental-monitor.cjs');
run(async({db,pool,app,auth})=>{
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'monitor-check-'));
    let browser,preview;
    try{
        const supplied=process.argv.indexOf('--source-dir');
        if(supplied>=0){for(const name of ['categories.csv','houses.csv','tenants.csv','payments.csv'])fs.copyFileSync(path.join(process.argv[supplied+1],name),path.join(directory,name));}
        else {
            fs.writeFileSync(path.join(directory,'categories.csv'),'id,name\n23,Example Block\n');
            fs.writeFileSync(path.join(directory,'houses.csv'),'id,house_no,category_id,description,price\n22,001,23,ROOM,150000.0\n');
            fs.writeFileSync(path.join(directory,'tenants.csv'),'id,firstname,middlename,lastname,email,contact,house_id,status,date_in\n42,Example,Test,Tenant,,0712345678,22,1,2025-08-29\n128,,,,,,0,1,0000-00-00\n');
            fs.writeFileSync(path.join(directory,'payments.csv'),'id,tenant_id,amount,invoice,date_created,created_at\n1,42,600000.0,EXAMPLE,2025-08-29 00:00:00,2025-09-19 10:00:00\n2,999,10000.0,ORPHAN,2025-09-01 00:00:00,2025-09-19 10:00:00\n');
        }
        const source=loadMonitoring(directory);
        const plan=profiles.buildPlan(profiles.loadSource(directory),{region:'Synthetic test region'});
        for(const table of ['owners','properties','units','tenants'])await db.query(`SELECT setval(pg_get_serial_sequence('${table}','id'),(SELECT max(id) FROM ${table}))`);
        await profiles.importPlan({pool,plan,apply:true});
        const counts=async()=>{const out={};for(const table of ['leases','rent_invoices','rent_payments','notifications'])out[table]=(await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;return out;};
        const before=await counts();
        const dry=await importMonitoring({pool,source});assert.equal(dry.mode,'dry-run');assert.equal((await db.query("SELECT to_regclass('preview_rental_monitor_batches') AS name")).rows[0].name,null);
        const wrong={...source,baseHash:'wrong'};await assert.rejects(importMonitoring({pool,source:wrong,apply:true}),/Source does not match/);
        // A late insert failure rolls back the full batch, rows, history and access grant.
        let fail=true;
        const faultPool={...pool,connect:async()=>{const client=await pool.connect();return {...client,query:async(sql,args)=>{if(fail&&sql.startsWith('INSERT INTO preview_rental_monitor_payments')){fail=false;throw Error('Injected monitoring failure');}return client.query(sql,args);},release:()=>client.release()};}};
        await assert.rejects(importMonitoring({pool:faultPool,source,apply:true}),/Injected/);
        assert.equal((await db.query("SELECT to_regclass('preview_rental_monitor_batches') AS name")).rows[0].name,null);
        const applied=await importMonitoring({pool,source,apply:true});assert.equal(applied.mode,'imported');assert.equal(applied.tenants,source.rows.length);assert.equal(applied.payments,source.payments.length-applied.excluded_test_payments);
        assert.equal((await importMonitoring({pool,source,apply:true})).mode,'already-imported');
        await assert.rejects(importMonitoring({pool,source:{...source,sourceHash:'changed'},apply:true}),/source changed/);
        assert.deepEqual(await counts(),before);
        assert.equal((await db.query('SELECT count(*)::int AS n FROM preview_rental_monitor_rows')).rows[0].n,source.rows.length);
        assert.equal((await db.query('SELECT count(*)::int AS n FROM preview_rental_monitor_payments')).rows[0].n,source.payments.length-applied.excluded_test_payments);
        assert.equal(Number((await db.query("SELECT sum((source->>'amount')::numeric) AS total FROM preview_rental_monitor_payments")).rows[0].total),applied.total_payment_amount);
        assert.equal(estimate({date_in:'2025-01-31',monthly_rent:100,unit:'1'},[{amount:'100',date_created:'2025-01-31'}],'2026-01-01').end,'2025-02-27');
        assert.equal(estimate({date_in:'2025-01-01',monthly_rent:100,unit:'1'},[{amount:'150',date_created:'2025-01-01'}],'2026-01-01').status,'partial_month');
        const {cleanMonitoring}=require('./legacy-rental-monitor-clean.cjs');
        // Simulate the earlier import shape, then verify cleanup and hard guards.
        const excluded=source.payments.filter(p=>!source.rows.some(t=>t.id===p.tenant_id));
        await db.query('ALTER TABLE preview_rental_monitor_payments DROP CONSTRAINT preview_monitor_payment_tenant_fk');
        for(const p of excluded)await db.query('INSERT INTO preview_rental_monitor_payments(namespace,source_id,tenant_source_id,source) VALUES($1,$2,$3,$4::jsonb)',['mkutasidu_legacy_v1',p.id,p.tenant_id,JSON.stringify(p)]);
        assert.equal((await cleanMonitoring({pool})).would_remove,excluded.length);
        const cleanupFault={connect:async()=>{const c=await pool.connect();return {query:async(sql,args)=>{if(sql.includes('ADD CONSTRAINT preview_monitor_payment_tenant_fk'))throw Error('Injected cleanup failure');return c.query(sql,args);},release:()=>c.release()};}};
        await assert.rejects(cleanMonitoring({pool:cleanupFault,apply:true}),/Injected cleanup failure/);
        assert.equal((await cleanMonitoring({pool})).would_remove,excluded.length,'Cleanup failure restores deleted testing rows and prior totals');

        assert.equal((await cleanMonitoring({pool,apply:true})).removed,excluded.length);
        assert.equal((await cleanMonitoring({pool,apply:true})).removed,0);
        assert.deepEqual((await cleanMonitoring({pool})).canonical_checks,{missing_payment_parties:0,mismatched_allocations:0,unallocated_completed_payments:0});
        if(excluded.length)await assert.rejects(db.query('INSERT INTO preview_rental_monitor_payments(namespace,source_id,tenant_source_id,source) VALUES($1,$2,$3,$4::jsonb)',['mkutasidu_legacy_v1',excluded[0].id,excluded[0].tenant_id,JSON.stringify(excluded[0])]),/foreign key/i);
        const good=source.payments.find(p=>source.rows.some(t=>t.id===p.tenant_id));
        await assert.rejects(db.query('INSERT INTO preview_rental_monitor_payments(namespace,source_id,tenant_source_id,source) VALUES($1,$2,$3,$4::jsonb)',['mkutasidu_legacy_v1','999999999999',good.tenant_id,JSON.stringify(good)]),/check constraint/i);
        assert.deepEqual(await counts(),before);
        console.log('PASS: old unmatched test payments removed, private audit retained, repeat no-op, FK rejects missing tenant, identity CHECK rejects mismatched payload; canonical payment audit clean.');
        const {calculateBalance}=require('./legacy-rental-balance.cjs');
        const balanceRow={date_in:'2026-10-01',monthly_rent:60000,unit:'TEST'};
        const balance=calculateBalance(balanceRow,[],'2026-10-16',180000);
        assert.equal(balance.days,16);assert.equal(balance.rent_due,30967.74);assert.equal(balance.credit,149032.26);
        assert.equal(calculateBalance(balanceRow,[],'2026-10-31').rent_due,60000);
        assert.equal(calculateBalance({...balanceRow,date_in:'2024-01-31'},[],'2024-02-28').rent_due,60000);
        assert.equal(calculateBalance(balanceRow,[{date_created:'2026-09-01',amount:'10000'}],'2026-10-16').csv_paid,10000);
        assert.equal(calculateBalance(balanceRow,[],'2026-09-30').status,'needs_review');
        assert.equal(calculateBalance({...balanceRow,monthly_rent:0},[],'2026-10-16').balance,0);
        console.log('PASS: date-in to as-of balance, actual-day proration, inclusive today, calendar/leap boundaries, advance payments and missing/future inputs.');
        const jwt=require('jsonwebtoken');const staff=jwt.sign({public_id:'user_acceptance_staff'},process.env.JWT_SECRET,{expiresIn:'5m'});
        app.use('/api/preview-rental-monitor',require('./legacy-rental-monitor-router.cjs')(pool));
        app.use((error,req,res,next)=>res.status(error.statusCode||500).json({message:error.message}));
        const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
        const base=`http://127.0.0.1:${server.address().port}/api/preview-rental-monitor`;
        const request=(suffix='',token=auth,body)=>fetch(base+suffix,{method:body?'PUT':'GET',headers:{Authorization:token?`Bearer ${token}`:'','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
        try {
            assert.equal((await request('',null)).status,401);
            let response=await request('',staff);assert.equal(response.status,200);const data=(await response.json()).data;assert.equal(data.rows.length,source.rows.filter(r=>r.status==='1').length);assert.ok(data.rows.every(r=>r.source.status==='1'));assert.ok(data.rows.every(r=>Object.hasOwn(r.account,'balance')));
            const activeIds=new Set(source.rows.filter(r=>r.status==='1').map(r=>r.id));
            assert.equal(data.batch.summary.payments,source.payments.filter(p=>activeIds.has(p.tenant_id)).length);assert.equal(data.orphan_payments.length,applied.orphan_payments);
            const id=source.rows.find(r=>r.name).id;const review={paid_through:'2026-12-31',evidence:'Verified from the signed payment ledger.',version:0};
            response=await request(`/${id}/review`,staff,review);assert.equal(response.status,200,await response.text());
            assert.equal((await request(`/${id}/review`,staff,review)).status,409);
            assert.equal((await request(`/${id}/review`,staff,{...review,version:1,paid_through:'2026-02-30'})).status,400);
            assert.equal((await request('/128/review',staff,{...review,version:0})).status,400);
            assert.equal((await db.query('SELECT count(*)::int AS n FROM preview_rental_monitor_audit')).rows[0].n,1);
            assert.equal((await importMonitoring({pool,source,apply:true})).mode,'already-imported');
            assert.equal((await db.query('SELECT review FROM preview_rental_monitor_rows WHERE source_id=$1',[id])).rows[0].review.paid_through,'2026-12-31');
            await db.query("UPDATE owner_users SET revoked_at=now() WHERE public_id='owner_user_mkut_preview'");
            assert.equal((await request('',staff)).status,403);
            assert.equal((await request(`/${id}/review`,staff,{...review,version:1})).status,403);
            await db.query("UPDATE owner_users SET revoked_at=NULL WHERE public_id='owner_user_mkut_preview'");
            assert.deepEqual(await counts(),before);
            console.log('PASS: monitoring CSV validation, guarded dry-run, rollback, all source rows/payments, source mismatch, repeat preservation, owner access/revocation, optimistic review/audit, calendar math and unchanged canonical billing.');
        }finally{await new Promise(resolve=>server.close(resolve));}
        if(process.env.UX_MONITOR_BROWSER==='1'){
            const {createRequire}=require('node:module');const runtime=createRequire(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/package.json`);const {chromium}=runtime('playwright');
            preview=await require('./lease-accountant-preview.cjs').startPreview({db});
            browser=await chromium.launch({executablePath:process.env.UX_CHROMIUM_EXECUTABLE,headless:true});
            for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
                const page=await browser.newPage({viewport});
                const errors=[];page.on('pageerror',e=>errors.push(e.message));
                await page.goto(preview.staffUrl);await page.goto(preview.url.replace('/__preview','/legacy-rental-monitor'));
                await page.getByRole('heading',{name:'Legacy Rental Monitoring',exact:true}).waitFor();
                await page.getByRole('button',{name:`Review ID ${source.rows.find(r=>r.name).id}`,exact:true}).click();
                await page.getByRole('heading',{name:/Malipo ya CSV/}).waitFor();
                await page.getByLabel('Ushahidi / maelezo ya uhakiki').fill('Browser check: verified payment period from ledger.');
                const saved=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('/preview-rental-monitor/'));
                await page.getByRole('button',{name:'Hifadhi uhakiki',exact:true}).click();
                assert.equal((await saved).status(),200);
                await page.getByRole('button',{name:'Hifadhi uhakiki',exact:true}).waitFor();
                await page.waitForFunction(()=>!document.querySelector('[role="alert"]') && [...document.querySelectorAll('button')].some(b=>b.textContent==='Hifadhi uhakiki'&&!b.disabled));
                assert.deepEqual(errors,[]);await page.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished));});await page.getByRole('region',{name:'Tenant monitoring detail',exact:true}).screenshot({path:`/tmp/legacy-monitor-${viewport.width}.png`});
                console.log(`PASS: ${viewport.width}px real browser/API monitoring, tenant history and staff review.`);await page.close();
            }
        }
    }finally{if(browser)await browser.close();if(preview)await preview.close();fs.rmSync(directory,{recursive:true,force:true});}
}).catch(error=>{console.error(error);process.exitCode=1;});

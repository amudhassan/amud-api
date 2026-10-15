// Browser -> real local API -> disposable PostgreSQL engine. No API fixtures.
// UX_PGLITE_DEPS=/tmp/lease-pglite-check UX_CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/ux/lease-live-api-browser-check.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const runtime = process.env.UX_BROWSER_DEPS
    ? createRequire(path.resolve(process.env.UX_BROWSER_DEPS,'package.json'))
    : process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
        ? createRequire(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/package.json`)
        : require;
const { chromium } = runtime('playwright');
const { run } = require('./lease-database-check.cjs');

run(async ({db,app,auth,dates}) => {
    // Mount the existing application routers required by the real page.
    app.use('/api/auth',require('../../routes/authRoutes'));
    app.use('/api/owners',require('../../routes/ownerRoutes'));
    app.use('/api/properties',require('../../routes/propertyRoutes'));
    app.use('/api/tenants',require('../../routes/tenantRoutes'));
    app.use('/api/notifications',require('../../routes/notificationRoutes'));
    app.use('/api/lease-clause-templates',require('../../routes/leaseClauseTemplateRoutes'));
    app.use((error,req,res,next)=>res.status(error.statusCode||500).json({message:error.message}));
    const api=await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server));});
    let vite,browser;
    try {
        process.env.VITE_API_BASE_URL='/api';
        const { createServer } = await import('../../frontend/node_modules/vite/dist/node/index.js');
        vite=await createServer({root:path.resolve(__dirname,'../../frontend'),server:{host:'127.0.0.1',port:0,proxy:{'/api':`http://127.0.0.1:${api.address().port}`}}});
        await vite.listen();
        const url=`http://127.0.0.1:${vite.httpServer.address().port}`;
        browser=await chromium.launch({headless:true,...(process.env.UX_CHROMIUM_EXECUTABLE?{executablePath:process.env.UX_CHROMIUM_EXECUTABLE}:{})});
        for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:1280,height:640}]) {
            const unit=`unit_browser_${viewport.width}`;
            await db.query(`INSERT INTO units(id,public_id,property_id,unit_code,unit_type,operational_status,created_by)
                VALUES($1,$2,1,$3,'room','available',1)`,[viewport.width,unit,`B${viewport.width}`]);
            const timezoneId=viewport.width===1440?'America/New_York':'Africa/Dar_es_Salaam';
            const page=await browser.newPage({viewport,timezoneId,acceptDownloads:true});
            page.setDefaultTimeout(10000);
            const errors=[];
            page.on('pageerror',error=>errors.push(error.message));
            page.on('response',response=>{if(response.status()>=400)console.error('API response:',response.status(),response.url());});
            // Refuse non-local network requests; local API responses are never mocked.
            await page.route('**/*',route=>{
                const target=new URL(route.request().url());
                return ['127.0.0.1','localhost'].includes(target.hostname)?route.continue():route.abort();
            });
            await page.addInitScript(token=>localStorage.setItem('access_token',token),auth);
            await page.goto(`${url}/leases`);
            try {
                await page.getByRole('button',{name:'Clause Templates',exact:true}).click();
                const templatesDialog=page.getByRole('dialog',{name:'Owner Clause Templates',exact:true});
                const ownerLabel=templatesDialog.locator('label[for="lease_template_owner"]');
                await ownerLabel.waitFor();
                await ownerLabel.scrollIntoViewIfNeeded();
                assert.equal(await ownerLabel.evaluate(element=>{
                    const box=element.getBoundingClientRect();
                    const hit=document.elementFromPoint(box.left+Math.min(12,box.width/2),box.top+box.height/2);
                    return element===hit||element.contains(hit);
                }),true,'Owner label is visible above the sidebar, including its left edge');
                assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden','Background scrolling is locked');
                await templatesDialog.locator('#lease_template_owner').selectOption('owner_acceptance');
                await templatesDialog.getByText('Preview 20 clauses and review checklist',{exact:true}).click();
                await templatesDialog.getByRole('heading',{name:'Kabla ya kusaini',exact:true}).waitFor();
                const panel=templatesDialog.locator(':scope > div');
                await panel.evaluate(element=>{element.scrollTop=element.scrollHeight;});
                const closeButton=templatesDialog.getByRole('button',{name:'Close clause templates',exact:true});
                assert.equal(await closeButton.evaluate(element=>{
                    const box=element.getBoundingClientRect();
                    return element.contains(document.elementFromPoint(box.left+box.width/2,box.top+box.height/2));
                }),true,'Close button stays visible after scrolling the long preview');
                await panel.evaluate(element=>{element.scrollTop=0;});
                if(viewport.width===1440) await page.screenshot({path:'/tmp/template-dialog-desktop.png'});
                if(viewport.width===390) await page.screenshot({path:'/tmp/template-dialog-mobile.png'});
                const presetInstalled=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/lease-clause-templates/defaults/residential-mainland'&&r.request().method()==='POST');
                await templatesDialog.getByRole('button',{name:'Add / open mainland residential template',exact:true}).click();
                const presetResponse=await presetInstalled;
                assert.equal(presetResponse.status(),viewport.width===1440?201:200,await presetResponse.text());
                await templatesDialog.getByRole('status').waitFor();
                const defaultId=(await presetResponse.json()).data.template.public_id;
                const defaultItems=await db.query(`SELECT count(*)::int AS count FROM lease_clause_template_items i
                    JOIN lease_clause_templates t ON t.id=i.template_id WHERE t.public_id=$1 AND i.deleted_at IS NULL`,[defaultId]);
                assert.equal(defaultItems.rows[0].count,20);
                assert.equal(await templatesDialog.evaluate(element=>element.scrollWidth<=element.clientWidth),true,'Template preview fits viewport');
                await templatesDialog.getByRole('button',{name:'Close clause templates',exact:true}).click();
                assert.equal(await page.evaluate(()=>document.body.style.overflow),'','Background scroll is restored after closing');
                console.log(`PASS: ${viewport.width}px default preview and owner installation/reopen`);
                await page.getByRole('button',{name:'Add Lease',exact:true}).click();
                await page.locator('#lease_owner').selectOption('owner_acceptance');
                if(viewport.width===390) {
                    await page.getByRole('button',{name:'Add new tenant',exact:true}).click();
                    await page.locator('input[name="display_name"]').fill('New inline browser tenant');
                    const tenantCreated=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/tenants'&&r.request().method()==='POST');
                    await page.getByRole('button',{name:'Add Tenant',exact:true}).click();
                    const tenantResponse=await tenantCreated;
                    assert.equal(tenantResponse.status(),201,await tenantResponse.text());
                    assert.equal((await tenantResponse.json()).data.tenant.status,'prospective');
                    const activation=page.getByRole('dialog',{name:'Activate Tenant',exact:true});
                    await activation.getByRole('button',{name:'Cancel',exact:true}).click();
                    assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden','Closing a child dialog keeps the parent scroll lock');
                    await page.getByRole('button',{name:'Continue',exact:true}).click();
                    await page.getByText('Activate the selected tenant before continuing with the lease.',{exact:true}).waitFor();
                    await page.getByRole('button',{name:'Activate selected tenant',exact:true}).click();
                    const activatedTenant=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/activate')&&r.request().method()==='PATCH');
                    await activation.getByRole('button',{name:'Activate Tenant',exact:true}).click();
                    const activatedResponse=await activatedTenant;
                    assert.equal(activatedResponse.status(),200,await activatedResponse.text());
                    assert.equal((await activatedResponse.json()).data.tenant.status,'active');
                    await activation.waitFor({state:'hidden'});
                } else await page.locator('#lease_tenant').selectOption('tenant_acceptance');
                await page.getByRole('button',{name:'Continue',exact:true}).click();
                await page.locator('#lease_property').selectOption('property_acceptance');
                await page.locator('#lease_unit').selectOption(unit);
                await page.getByRole('button',{name:'Continue',exact:true}).click();
                await page.locator('#lease_start_date').fill(dates.start);
                await page.locator('#lease_end_date').fill(dates.finish);
                await page.locator('#lease_rent_amount').fill('200000');
                await page.getByRole('button',{name:'Review lease',exact:true}).click();
                await page.getByRole('checkbox',{name:'I have checked'}).check();
                const created=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/leases'&&r.request().method()==='POST');
                await page.getByRole('button',{name:'Save and review contract terms'}).click();
                const createResponse=await created;
                assert.equal(createResponse.status(),201,await createResponse.text());
                const lease=(await createResponse.json()).data.lease;
                await page.getByRole('button',{name:'Continue to signed agreement',exact:true}).click();
                const localSignature=await page.evaluate(iso=>{
                    const value=new Date(iso);
                    return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,16);
                },dates.signed);
                await page.locator('#schedule_signed_at').fill(localSignature);
                await page.getByRole('checkbox',{name:/The tenant already moved in/}).check();
                await page.locator('#registration_reason').fill('Browser acceptance: registering the original tenancy dates.');
                await page.getByRole('button',{name:'Confirm Signed Agreement',exact:true}).click();
                await page.getByRole('region',{name:'Next lease step'}).getByRole('button',{name:'Start tenancy',exact:true}).click();
                await page.getByRole('button',{name:'Start Tenancy',exact:true}).click();
                await page.getByRole('button',{name:'Prepare invoice',exact:true}).click();
                await page.locator('#billing_period_start').fill(dates.start);
                await page.locator('#billing_period_end').fill(dates.period_end);
                await page.locator('#invoice_due_date').fill(dates.today);
                const invoiceCreated=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/invoices'&&r.request().method()==='POST');
                await page.getByRole('button',{name:'Create Draft Invoice',exact:true}).click();
                const invoiceResponse=await invoiceCreated;
                assert.equal(invoiceResponse.status(),201,await invoiceResponse.text());
                const invoice=(await invoiceResponse.json()).data.invoice;
                await page.getByRole('button',{name:'Add First Item',exact:true}).click();
                const itemDialog=page.getByRole('dialog',{name:'Add Invoice Item',exact:true});
                await itemDialog.getByLabel(/Item Type/).selectOption('rent');
                await itemDialog.getByLabel('Description',{exact:true}).fill('Browser acceptance rent');
                await itemDialog.getByLabel('Quantity',{exact:true}).fill('1');
                await itemDialog.getByLabel(/Unit Amount/).fill('200000');
                await itemDialog.getByRole('button',{name:'Add Item',exact:true}).click();
                await itemDialog.waitFor({state:'hidden'});
                await page.getByRole('button',{name:'Issue Invoice',exact:true}).click();
                await page.getByRole('button',{name:'Issue Invoice',exact:true}).last().click();
                await page.getByRole('button',{name:'Record payment',exact:true}).click();
                const amount=page.getByLabel('Amount',{exact:false});
                await page.waitForFunction(()=>document.querySelector('input[placeholder="0.00"]')?.value==='200000.00');
                await amount.fill('50000');
                assert.equal(await amount.inputValue(),'50000');
                const paymentDate=page.getByLabel(/Payment Date & Time/);
                const defaultTime=await paymentDate.inputValue();
                // A manually selected pre-issue time must stay rejected.
                await paymentDate.fill(localSignature);
                await page.getByRole('button',{name:'Record Payment',exact:true}).click();
                await page.getByText('Payment date and time cannot be before the invoice was issued.',{exact:true}).waitFor();
                await paymentDate.fill(defaultTime);
                const paid=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/invoices/${invoice.public_id}/payments`&&r.request().method()==='POST');
                await page.getByRole('button',{name:'Record Payment',exact:true}).click();
                const paymentResponse=await paid;
                assert.equal(paymentResponse.status(),201,await paymentResponse.text());
                const payment=(await paymentResponse.json()).data.payment;
                await page.getByRole('heading',{name:'Rent Payment Receipt',exact:true}).waitFor();
                const download=page.waitForEvent('download');
                await page.getByRole('button',{name:'Download PDF',exact:true}).click();
                const downloaded=await download;
                assert.equal(await downloaded.failure(),null);
                assert.match(downloaded.suggestedFilename(),/\.pdf$/i);
                const chunks=[];
                for await(const chunk of await downloaded.createReadStream())chunks.push(chunk);
                assert.equal(Buffer.concat(chunks).subarray(0,5).toString(),'%PDF-');
                const saved=(await db.query(`SELECT l.status AS lease_status,i.status AS invoice_status,i.balance_amount,
                    p.amount,p.receipt_number FROM leases l JOIN rent_invoices i ON i.lease_id=l.id
                    JOIN rent_payment_allocations a ON a.invoice_id=i.id JOIN rent_payments p ON p.id=a.payment_id
                    WHERE l.public_id=$1 AND i.public_id=$2`,[lease.public_id,invoice.public_id])).rows;
                assert.equal(saved.length,1);
                assert.equal(saved[0].lease_status,'active');
                assert.equal(saved[0].invoice_status,'partially_paid');
                assert.equal(Number(saved[0].balance_amount),150000);
                assert.equal(saved[0].receipt_number,payment.receipt_number);
                assert.deepEqual(errors,[]);
                console.log(`PASS real browser/API ${viewport.width}px ${timezoneId}: existing tenancy -> signed agreement -> activation -> invoice/items/issue -> partial payment -> receipt PDF download; database balances verified`);
            } catch(error) {
                console.error('Browser page:',await page.locator('body').innerText());
                throw error;
            } finally { await page.close(); }
        }
    } finally {
        if(browser)await browser.close();
        if(vite)await vite.close();
        await new Promise((resolve,reject)=>api.close(error=>error?reject(error):resolve()));
    }
}).catch(error=>{console.error(error);process.exitCode=1;});

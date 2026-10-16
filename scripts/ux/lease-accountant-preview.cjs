// Local human review of synthetic acceptance data. No migration/reset on startup.
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

async function startPreview({db}) {
    // The shared adapter already restricts native URLs to local lease_acceptance_*.
    const identity=(await db.query(`SELECT public_id,email,role FROM users WHERE id=1`)).rows[0];
    const staff=(await db.query(`SELECT public_id FROM users WHERE id=2 AND deleted_at IS NULL`)).rows[0];
    assert.ok(identity?.public_id==='user_acceptance_admin' && identity.email==='admin@example.invalid' &&
        identity.role==='admin' && staff?.public_id==='user_acceptance_staff',
        'Preview requires the local acceptance login accounts.');
    // Business test records may have been deliberately removed. Never reseed them on startup.
    // Explicit fixture IDs must not collide with IDs assigned by real create forms.
    for(const table of ['users','owners','properties','units','tenants']) {
        await db.query(`SELECT setval(pg_get_serial_sequence('${table}','id'),COALESCE(max(id),1),max(id) IS NOT NULL) FROM ${table}`);
    }
    process.env.JWT_SECRET=crypto.randomBytes(48).toString('hex');
    process.env.RECEIPT_QR_SECRET=crypto.randomBytes(48).toString('hex');
    process.env.APP_BASE_URL='http://localhost';
    const app=express();
    app.use(express.json());
    const {authMiddleware}=require('../../middleware/authMiddleware');
    const {getProfile}=require('../../controllers/authController');
    app.get('/api/auth/profile',authMiddleware,getProfile);
    for(const [prefix,router] of [['owners','ownerRoutes'],['properties','propertyRoutes'],['units','unitRoutes'],
        ['tenants','tenantRoutes'],['leases','leaseRoutes'],['lease-clause-templates','leaseClauseTemplateRoutes'],
        ['invoices','invoiceRoutes'],['payments','paymentRoutes'],['receipts','receiptRoutes'],['notifications','notificationRoutes']]) {
        app.use(`/api/${prefix}`,require(`../../routes/${router}`));
    }
    app.use('/api/preview-rental-monitor',require('./legacy-rental-monitor-router.cjs')(require('../../config/db')));
    app.use((error,req,res,next)=>res.status(error.statusCode||500).json({message:error.message}));
    const api=await new Promise((resolve,reject)=>{
        const server=app.listen(0,'127.0.0.1',()=>resolve(server));
        server.once('error',reject);
    });
    let vite;
    try {
        const {createServer}=await import('../../frontend/node_modules/vite/dist/node/index.js');
        process.env.VITE_API_BASE_URL='/api';
        process.env.VITE_PREVIEW_LEGACY_MONITORING='true';
        vite=await createServer({root:path.resolve(__dirname,'../../frontend'),envDir:false,
            server:{host:'127.0.0.1',port:5173,proxy:{'/api':`http://127.0.0.1:${api.address().port}`}},
            plugins:[{name:'local-acceptance-entry',configureServer(server) {
                server.middlewares.use('/__preview',(req,res)=>{
                    const role=new URL(req.url,'http://localhost').searchParams.get('role');
                    const public_id=role==='staff'?'user_acceptance_staff':'user_acceptance_admin';
                    const token=jwt.sign({public_id},process.env.JWT_SECRET,{expiresIn:'8h'});
                    res.setHeader('Content-Type','text/html; charset=utf-8');
                    res.setHeader('Cache-Control','no-store');
                    res.end(`<!doctype html><title>Local test preview</title><p>Opening synthetic test data...</p><script>localStorage.setItem('access_token',${JSON.stringify(token)});location.replace('/leases');</script>`);
                });
            }}]});
        await vite.listen();
        const origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
        process.env.APP_BASE_URL=origin;
        let closed=false;
        return {url:`${origin}/__preview`,staffUrl:`${origin}/__preview?role=staff`,async close() {
            if(closed)return;
            closed=true;
            await vite.close();
            await new Promise((resolve,reject)=>api.close(error=>error?reject(error):resolve()));
        }};
    } catch(error) {
        if(vite)await vite.close();
        await new Promise(resolve=>api.close(resolve));
        throw error;
    }
}
module.exports={startPreview};
if(require.main===module) {
    if(!process.env.UX_NATIVE_DATABASE_URL)throw Error('Set UX_NATIVE_DATABASE_URL to the existing local acceptance database.');
    const {withDatabase}=require('./lease-database-check.cjs');
    withDatabase(async context=>{
        const preview=await startPreview(context);
        console.log(`LOCAL TEST DATA ONLY. Admin review: ${preview.url}`);
        console.log(`Staff review: ${preview.staffUrl}`);
        console.log('Use REVIEW rooms. No migrations or reset were run. Keep this terminal open; Ctrl+C stops the preview.');
        try {
            await new Promise(resolve=>{
                const stop=()=>{process.off('SIGINT',stop);process.off('SIGTERM',stop);resolve();};
                process.on('SIGINT',stop);process.on('SIGTERM',stop);
            });
        } finally {await preview.close();}
    }).catch(error=>{console.error(error);process.exitCode=1;});
}

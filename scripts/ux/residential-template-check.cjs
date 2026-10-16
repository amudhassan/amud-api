// Real routers and transactions against the disposable acceptance database.
// UX_PGLITE_DEPS=/tmp/lease-pglite-check node scripts/ux/residential-template-check.cjs
const assert = require('node:assert/strict');
const {run} = require('./lease-database-check.cjs');

async function checkResidentialTemplate({db, auth, dates}) {
    const express = require('express');
    const request = require('supertest');
    const jwt = require('jsonwebtoken');
    const app = express();
    app.use(express.json());
    app.use('/api/lease-clause-templates', require('../../routes/leaseClauseTemplateRoutes'));
    app.use((error, req, res, next) => res.status(error.statusCode || 500).json({message:error.message}));
    const endpoint = '/api/lease-clause-templates/defaults/residential-mainland';
    const staff = jwt.sign({public_id:'user_acceptance_staff'}, process.env.JWT_SECRET, {expiresIn:'5m'});
    const api = async (method, url, body, status, token = auth) => {
        let req = request(app)[method](url);
        if (token) req = req.set('Authorization', `Bearer ${token}`);
        if (body !== undefined) req = req.send(body);
        const response = await req;
        assert.equal(response.status, status, JSON.stringify(response.body));
        return response.body.data;
    };
    await api('get', endpoint, undefined, 401, null);
    const preset = await api('get', endpoint, undefined, 200);
    assert.equal(preset.items.length, 20);
    assert.ok(preset.items.every(item => item.clause_text.length <= 10000 && item.title.length <= 200));
    await api('get', `${endpoint}?owner_public_id=owner_acceptance`, undefined, 400);
    await api('post', endpoint, {owner_public_id:'owner_acceptance', items:[]}, 400);
    await api('post', endpoint, {}, 400);
    console.log('PASS: built-in mainland catalog requires authentication and strict request validation');

    await db.query("UPDATE owner_users SET can_manage_finances=false WHERE user_id=2");
    await api('post', endpoint, {owner_public_id:'owner_acceptance'}, 404, staff);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM lease_clause_templates')).rows[0].count, 0);
    await db.query("UPDATE owner_users SET can_manage_finances=true WHERE user_id=2");
    const installed = await api('post', endpoint, {owner_public_id:'owner_acceptance'}, 201, staff);
    const id = installed.template.public_id;
    const detail = await api('get', `/api/lease-clause-templates/${id}`, undefined, 200);
    assert.deepEqual(detail.template.items.map(({clause_category,title,clause_text,is_mandatory,display_order}) =>
        ({clause_category,title,clause_text,is_mandatory,display_order})), preset.items);
    console.log('PASS: authorized owner receives all 20 clauses atomically with correct order');

    const services = require('../../services/leaseClauseTemplateService');
    const admin = {id:1,role:'admin'};
    await services.updateLeaseClauseTemplate({templatePublicId:id, templateData:{name:'Owner reviewed residential terms'}, authenticatedUser:admin});
    await services.updateLeaseClauseTemplateItem({templatePublicId:id, itemPublicId:detail.template.items[0].public_id,
        itemData:{clause_text:'Owner-specific reviewed contract wording.'}, authenticatedUser:admin});
    const retry = await api('post', endpoint, {owner_public_id:'owner_acceptance'}, 200);
    assert.equal(retry.template.public_id, id);
    const edited = await api('get', `/api/lease-clause-templates/${id}`, undefined, 200);
    assert.equal(edited.template.name, 'Owner reviewed residential terms');
    assert.equal(edited.template.items[0].clause_text, 'Owner-specific reviewed contract wording.');
    console.log('PASS: repeated installation preserves renamed templates and edited clauses');

    await db.query(`INSERT INTO units(id,public_id,property_id,unit_code,unit_type,operational_status,created_by)
        VALUES(7000,'unit_preset_check',1,'PRESET','room','available',1)`);
    const draft = await require('../../services/leaseService').createDraftLease({authenticatedUser:admin, leaseData:{
        owner_public_id:'owner_acceptance', property_public_id:'property_acceptance', unit_public_id:'unit_preset_check',
        tenant_public_id:'tenant_acceptance', start_date:dates.today, end_date:dates.finish, rent_amount:200000
    }});
    const applied = await services.applyLeaseClauseTemplate({leasePublicId:draft.lease.public_id, templatePublicId:id, authenticatedUser:admin});
    assert.equal(applied.copied_count, 20);
    await services.updateLeaseClauseTemplateItem({templatePublicId:id, itemPublicId:detail.template.items[0].public_id,
        itemData:{clause_text:'Later template edit must not alter the lease.'}, authenticatedUser:admin});
    const snapshot = await db.query(`SELECT c.clause_text FROM lease_clauses c JOIN leases l ON l.id=c.lease_id
        WHERE l.public_id=$1 ORDER BY c.display_order LIMIT 1`, [draft.lease.public_id]);
    assert.equal(snapshot.rows[0].clause_text, 'Owner-specific reviewed contract wording.');
    console.log('PASS: applying the default creates an independent draft lease snapshot');

    await services.deleteLeaseClauseTemplate({templatePublicId:id, authenticatedUser:admin});
    const replacement = await api('post', endpoint, {owner_public_id:'owner_acceptance'}, 201);
    assert.notEqual(replacement.template.public_id, id);
    console.log('PASS: deleted default can be re-added without restoring deleted data');

    await db.query(`INSERT INTO owners(id,public_id,owner_type,display_name,country,status,created_by)
        VALUES(7000,'owner_preset_other','individual','Other synthetic owner','Tanzania','active',1)`);
    await api('post', endpoint, {owner_public_id:'owner_preset_other'}, 404, staff);
    await db.exec(`CREATE FUNCTION acceptance_fail_preset_item() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.display_order=3 AND EXISTS (SELECT 1 FROM lease_clause_templates WHERE id=NEW.template_id AND owner_id=7000)
            THEN RAISE EXCEPTION 'Synthetic item failure'; END IF;
            RETURN NEW;
        END $$;
        CREATE TRIGGER acceptance_fail_preset BEFORE INSERT ON lease_clause_template_items
            FOR EACH ROW EXECUTE FUNCTION acceptance_fail_preset_item();`);
    await api('post', endpoint, {owner_public_id:'owner_preset_other'}, 422);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM lease_clause_templates WHERE owner_id=7000')).rows[0].count, 0);
    await db.exec('DROP TRIGGER acceptance_fail_preset ON lease_clause_template_items; DROP FUNCTION acceptance_fail_preset_item();');
    await api('post', endpoint, {owner_public_id:'owner_preset_other'}, 201);
    await db.query("UPDATE owners SET status='inactive' WHERE id=7000");
    await api('post', endpoint, {owner_public_id:'owner_preset_other'}, 404);
    console.log('PASS: owner isolation, inactive owners and full rollback on item failure');
}

module.exports = {checkResidentialTemplate};
if (require.main === module) run(checkResidentialTemplate).catch(error => { console.error(error); process.exitCode=1; });

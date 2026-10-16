// Preview-only profile import. No production configuration, messages or balances.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const NAMESPACE = 'mkutasidu_legacy_v1';
const OWNER_NAME = 'MKUTASIDU ENTERPRISES LIMITED';
const OWNER_ID = 'owner_mkutasidu_legacy';
const HEADERS = {
    'categories.csv': ['id','name'],
    'houses.csv': ['id','house_no','category_id','description','price'],
    'tenants.csv': ['id','firstname','middlename','lastname','email','contact','house_id','status','date_in']
};
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const clean = value => String(value || '').trim();
const requireValue = (condition, message) => { if (!condition) throw Error(message); };

// RFC 4180 quoted fields, escaped quotes, embedded newlines and UTF-8 BOM.
function parseCsv(text) {
    text = text.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [], field = '', quoted = false, closedQuote = false;
    for (let i=0; i<text.length; i++) {
        const character = text[i];
        if (quoted) {
            if (character === '"') {
                if (text[i+1] === '"') { field += '"'; i++; }
                else { quoted = false; closedQuote = true; }
            } else field += character;
        } else if (character === '"') {
            requireValue(!field && !closedQuote, 'Malformed CSV quotation.');
            quoted = true;
        } else if (character === ',' || character === '\n' || character === '\r') {
            row.push(field); field = ''; closedQuote = false;
            if (character !== ',') {
                if (character === '\r' && text[i+1] === '\n') i++;
                if (row.some(value => value !== '')) rows.push(row);
                row = [];
            }
        } else {
            requireValue(!closedQuote, 'Unexpected data after a closing CSV quote.');
            field += character;
        }
    }
    requireValue(!quoted, 'Unclosed CSV quotation.');
    if (field || row.length || closedQuote) { row.push(field); rows.push(row); }
    return rows;
}

function loadSource(directory) {
    const tables = {}, fingerprints = [];
    for (const [filename, expected] of Object.entries(HEADERS)) {
        const file = path.join(directory, filename);
        requireValue(fs.statSync(file).size < 5_000_000, `${filename} exceeds the preview import limit.`);
        const raw = fs.readFileSync(file);
        const rows = parseCsv(new TextDecoder('utf-8', {fatal:true}).decode(raw));
        requireValue(JSON.stringify(rows.shift()) === JSON.stringify(expected), `${filename}: unexpected columns/order.`);
        requireValue(rows.length <= 10000, `${filename}: too many records.`);
        const seen = new Set();
        tables[filename] = rows.map((values, index) => {
            requireValue(values.length === expected.length, `${filename}: field count at row ${index+2}.`);
            const row = Object.fromEntries(expected.map((field, position) => [field, values[position]]));
            requireValue(/^[1-9]\d{0,11}$/.test(row.id) && !seen.has(row.id), `${filename}: invalid/duplicate source ID at row ${index+2}.`);
            seen.add(row.id);
            requireValue(values.every(value => !value.includes('\0')), `${filename}: NUL character at row ${index+2}.`);
            return row;
        });
        fingerprints.push(`${filename}:${digest(raw)}`);
    }
    return {tables, sourceHash:digest(fingerprints.join('\n'))};
}

function buildPlan(source, {region, regions={}, asOf=new Date().toISOString().slice(0,10)}={}) {
    const {tables, sourceHash} = source;
    const issues = [];
    const issue = (table, id, code) => issues.push({table, source_id:id, code});
    const regionFor = id => clean(regions[id] || region);
    const properties = tables['categories.csv'].map(row => {
        requireValue(clean(row.name) && clean(row.name).length<=255, `Category ${row.id}: invalid name.`);
        const resolvedRegion = regionFor(row.id);
        requireValue(resolvedRegion.length<=100, `Category ${row.id}: region too long.`);
        if (!resolvedRegion) issue('categories', row.id, 'region_required');
        return {source:row, public_id:`property_mkut_${row.id}`, region:resolvedRegion};
    });
    const propertyIds = new Set(properties.map(item => item.source.id));
    const unitCodes = new Set();
    const units = tables['houses.csv'].map(row => {
        requireValue(propertyIds.has(row.category_id), `House ${row.id}: missing category.`);
        requireValue(clean(row.house_no) && row.house_no.length<=50, `House ${row.id}: invalid number.`);
        const key = `${row.category_id}:${clean(row.house_no).toLowerCase()}`;
        requireValue(!unitCodes.has(key), `House ${row.id}: duplicate number within property.`); unitCodes.add(key);
        requireValue(/^\d+(?:\.\d{1,2})?$/.test(row.price), `House ${row.id}: invalid source rent.`);
        if (Number(row.price)===0) issue('houses', row.id, 'zero_source_rent');
        requireValue(row.description.length<5000, `House ${row.id}: description too long.`);
        return {source:row, public_id:`unit_mkut_${row.id}`};
    });
    const unitIds = new Set(units.map(item => item.source.id));
    const tenants = [], held = [];
    for (const row of tables['tenants.csv']) {
        requireValue(['0','1'].includes(row.status), `Tenant ${row.id}: unknown legacy status.`);
        const name = [row.firstname,row.middlename,row.lastname].map(clean).filter(Boolean).join(' ');
        if (!name) { held.push(row.id); issue('tenants', row.id, 'missing_name_held'); continue; }
        requireValue(name.length<=200, `Tenant ${row.id}: name too long.`);
        let phone = clean(row.contact).replace(/[\s()-]/g, '');
        if (/^0[67]\d{8}$/.test(phone)) phone = `+255${phone.slice(1)}`;
        else if (/^255[67]\d{8}$/.test(phone)) phone = `+${phone}`;
        if (!phone) issue('tenants', row.id, 'missing_phone');
        else if (!/^\+255[67]\d{8}$/.test(phone)) { issue('tenants',row.id,'invalid_phone_held_in_notes'); phone = ''; }
        let email = clean(row.email).toLowerCase();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { issue('tenants',row.id,'invalid_email_held_in_notes'); email = ''; }
        requireValue(email.length<=255, `Tenant ${row.id}: email too long.`);
        if (!unitIds.has(row.house_id)) issue('tenants',row.id,'missing_house_assignment');
        const date = new Date(`${row.date_in}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date_in) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==row.date_in) issue('tenants',row.id,'invalid_source_start_date');
        else if (row.date_in>asOf) issue('tenants',row.id,'future_source_start_date');
        tenants.push({source:row, public_id:`tenant_mkut_${row.id}`, name, phone:phone||null, email:email||null});
    }
    for (const field of ['email','phone']) {
        const counts = new Map();
        for (const item of tenants) if (item[field]) counts.set(item[field], (counts.get(item[field])||0)+1);
        for (const item of tenants) if (item[field] && counts.get(item[field])>1) issue('tenants',item.source.id,`shared_${field}_review_without_merging`);
    }
    const summary = {
        source_namespace:NAMESPACE, source_sha256:sourceHash, owner_name:OWNER_NAME,
        source_tenants:tables['tenants.csv'].length, properties:properties.length, units:units.length,
        tenant_profiles:tenants.length, held_tenant_ids:held,
        initial_state:'Owner active; properties and units inactive; tenants prospective; no occupancy/billing generated.',
        excluded:['users/passwords','system settings','SMS/outbox/templates','historical payments','leases/invoices/balances'],
        issue_counts:Object.fromEntries([...new Set(issues.map(item=>item.code))].map(code=>[code,issues.filter(item=>item.code===code).length])),
        issues,
        ready_to_apply:!issues.some(item=>item.code==='region_required')
    };
    const plan = {sourceHash, properties, units, tenants, summary};
    plan.planHash = digest(JSON.stringify({sourceHash, regionMapping:properties.map(item=>[item.source.id,item.region]), owner:OWNER_NAME, version:NAMESPACE}));
    return plan;
}

async function importPlan({pool, plan, apply=false}) {
    const client = await pool.connect();
    try {
        await client.query(apply?'BEGIN':'BEGIN READ ONLY');
        const actor = (await client.query(`SELECT id FROM users WHERE public_id='user_acceptance_admin'
            AND email='admin@example.invalid' AND role='admin' AND deleted_at IS NULL`)).rows[0];
        const marker = (await client.query(`SELECT id FROM properties WHERE public_id='property_acceptance' AND deleted_at IS NULL`)).rows[0];
        requireValue(actor && marker, 'Refused: not the guarded synthetic accountant preview database.');
        if (apply) await client.query("SELECT pg_advisory_xact_lock(183575, 1715)");
        const journal = (await client.query("SELECT to_regclass('preview_legacy_import_batches') AS name")).rows[0].name;
        const prior = journal ? (await client.query(`SELECT * FROM preview_legacy_import_batches WHERE namespace=$1 ${apply?'FOR UPDATE':''}`,[NAMESPACE])).rows[0] : null;
        if (prior) {
            requireValue(prior.source_sha256===plan.sourceHash && prior.plan_sha256===plan.planHash, 'Source or region mapping changed after import; review separately. Existing data will not be overwritten.');
            await client.query(apply?'COMMIT':'ROLLBACK');
            return {mode:'already-imported',...prior.summary};
        }
        const existing = await client.query(`SELECT id FROM owners WHERE public_id=$1 OR (lower(btrim(display_name))=lower($2) AND deleted_at IS NULL)`,[OWNER_ID,OWNER_NAME]);
        requireValue(!existing.rows.length, 'An owner with this name/import ID already exists without this import journal. Review before linking; no duplicate owner will be created.');
        for (const [table, records] of [['properties',plan.properties],['units',plan.units],['tenants',plan.tenants]]) {
            const collisions = await client.query(`SELECT public_id FROM ${table} WHERE public_id=ANY($1::text[])`,[records.map(item=>item.public_id)]);
            requireValue(!collisions.rows.length, `Existing ${table} import IDs found without this import journal. Review before importing.`);
        }
        if (!apply) { await client.query('ROLLBACK'); return {mode:'dry-run',...plan.summary}; }
        requireValue(plan.summary.ready_to_apply, 'Region is required for every property. Supply --region or --regions-file; no data was inserted.');
        await client.query(`CREATE TABLE IF NOT EXISTS preview_legacy_import_batches (
            namespace text PRIMARY KEY, source_sha256 text NOT NULL, plan_sha256 text NOT NULL,
            owner_public_id varchar(40) NOT NULL REFERENCES owners(public_id),
            imported_by bigint NOT NULL REFERENCES users(id), imported_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            summary jsonb NOT NULL)`);
        const owner = (await client.query(`INSERT INTO owners(public_id,owner_type,display_name,country,status,created_by)
            VALUES($1,'company',$2,'Tanzania','active',$3) RETURNING id`,[OWNER_ID,OWNER_NAME,actor.id])).rows[0];
        const propertyIds = new Map();
        for (const item of plan.properties) {
            const property = (await client.query(`INSERT INTO properties
                (public_id,property_code,property_name,property_type,usage_category,description,region,country,is_multi_unit,operational_status,created_by)
                VALUES($1,$2,$3,'other','other',$4,$5,'Tanzania',true,'inactive',$6) RETURNING id`,
            [item.public_id,`LEGACY-MKUT-${item.source.id}`,clean(item.source.name),
                `Preview legacy category ${item.source.id}. Property type/use and physical details require review. Source SHA256: ${plan.sourceHash}.`,item.region,actor.id])).rows[0];
            propertyIds.set(item.source.id,property.id);
            // Current administrative owner link, not a claim about historical title dates.
            await client.query(`INSERT INTO property_owners(public_id,property_id,owner_id,ownership_percentage,is_primary_contact,created_by)
                VALUES($1,$2,$3,100,true,$4)`,[`ownership_mkut_${item.source.id}`,property.id,owner.id,actor.id]);
        }
        for (const item of plan.units) {
            await client.query(`INSERT INTO units(public_id,property_id,unit_code,unit_name,unit_type,description,operational_status,created_by)
                VALUES($1,$2,$3,$4,'other',$5,'inactive',$6)`,
            [item.public_id,propertyIds.get(item.source.category_id),clean(item.source.house_no),`Nyumba ${clean(item.source.house_no)}`,
                `Preview legacy house. Source: ${JSON.stringify(item.source)}. Type, rent period/currency, physical details and occupancy require review.`,actor.id]);
        }
        for (const item of plan.tenants) {
            const tenant = (await client.query(`INSERT INTO tenants(public_id,tenant_type,display_name,email,phone_number,country,status,created_by)
                VALUES($1,'individual',$2,$3,$4,'Tanzania','prospective',$5) RETURNING id`,
            [item.public_id,item.name,item.email,item.phone,actor.id])).rows[0];
            await client.query(`INSERT INTO owner_tenants(public_id,owner_id,tenant_id,relationship_status,is_primary_owner_relationship,notes,created_by)
                VALUES($1,$2,$3,'active',true,$4,$5)`,
            [`owner_tenant_mkut_${item.source.id}`,owner.id,tenant.id,
                `Preview legacy profile; not proof of current occupancy. Original record: ${JSON.stringify(item.source)}. Confirm tenant activation and lease dates separately.`,actor.id]);
        }
        await client.query(`INSERT INTO preview_legacy_import_batches(namespace,source_sha256,plan_sha256,owner_public_id,imported_by,summary)
            VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[NAMESPACE,plan.sourceHash,plan.planHash,OWNER_ID,actor.id,JSON.stringify(plan.summary)]);
        await client.query('SET CONSTRAINTS ALL IMMEDIATE');
        await client.query('COMMIT');
        return {mode:'imported',...plan.summary};
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); }
}

module.exports = {parseCsv, loadSource, buildPlan, importPlan};
if (require.main===module) {
    (async()=>{
        const args = process.argv.slice(2), options = {};
        for (let i=0;i<args.length;i++) {
            const arg = args[i];
            requireValue(['--source-dir','--region','--regions-file','--apply','--dry-run','--plan-only'].includes(arg),`Unknown argument: ${arg}`);
            requireValue(!Object.hasOwn(options,arg),`Repeated argument: ${arg}`);
            if (['--apply','--dry-run','--plan-only'].includes(arg)) options[arg]=true;
            else { requireValue(args[i+1] && !args[i+1].startsWith('--'),`${arg} requires a value.`); options[arg]=args[++i]; }
        }
        requireValue(options['--source-dir'],'Specify --source-dir containing the extracted CSV files.');
        requireValue(!(options['--apply']&&(options['--dry-run']||options['--plan-only'])),'Choose one mode. Default is dry-run.');
        const regions = options['--regions-file'] ? JSON.parse(fs.readFileSync(options['--regions-file'],'utf8')) : {};
        requireValue(regions && typeof regions==='object' && !Array.isArray(regions) && Object.values(regions).every(value=>typeof value==='string'),'Region mapping must be a JSON object keyed by category ID.');
        const plan = buildPlan(loadSource(path.resolve(options['--source-dir'])),{region:options['--region'], regions});
        const printSummary = result => { const {issues, ...summary}=result; console.log(JSON.stringify(summary,null,2)); };
        if (options['--plan-only']) { printSummary({mode:'plan-only',...plan.summary}); return; }
        requireValue(process.env.UX_NATIVE_DATABASE_URL,'Set UX_NATIVE_DATABASE_URL for the existing local acceptance database.');
        // This adapter refuses non-loopback URLs and non-acceptance database names.
        const {withDatabase} = require('./lease-database-check.cjs');
        await withDatabase(async ({pool})=>printSummary(await importPlan({pool,plan,apply:Boolean(options['--apply'])})));
    })().catch(error=>{console.error(error.message);process.exitCode=1;});
}

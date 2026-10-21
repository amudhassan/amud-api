const paymentDay = value => new Intl.DateTimeFormat('en-CA', {timeZone: 'Africa/Dar_es_Salaam', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(value));
const { estimate, validDate } = require('../scripts/ux/legacy-rental-monitor.cjs');

// A missing canonical contract must stay visible without inventing a signed lease.
function buildImportedLeaseFollowUps({ rows, profiles, leases, asOf }) {
    const tenants = new Map(profiles.map(t => [t.public_id, t]));
    return rows.flatMap(row => {
        const tenant = tenants.get(row.tenant_public_id);
        if (!tenant || tenant.status !== 'active' || tenant.deleted_at) return [];
        const live = leases.some(l =>
            ['active', 'scheduled'].includes(l.status) && l.end_date >= asOf &&
            (l.tenant_public_id === row.tenant_public_id ||
                (row.source.unit_public_id && l.unit_public_id === row.source.unit_public_id)));
        if (live) return [];
        const own = leases.filter(l => l.tenant_public_id === row.tenant_public_id && !['draft', 'cancelled'].includes(l.status));
        // Keep the monitoring view alongside the latest ended contract in Leases.
        const latestEnded = own.filter(l => l.status === 'expired').sort((a,b) => b.end_date.localeCompare(a.end_date))[0];
        if (own.length && !latestEnded) return [];
        const reviewedEnd = row.review?.paid_through;
        if (validDate(reviewedEnd) && reviewedEnd >= asOf) return [];
        if (row.account.status !== 'expired' && row.account.status !== 'needs_review') return [];
        const native = row.current_payments.filter(p => !p.imported_from_csv && p.status === 'completed' &&
            !row.duplicate_review.includes(p.receipt_number) && paymentDay(p.paid_at) <= asOf);
        const history = [...row.history, ...native.map(p => ({amount: p.amount, date_created: paymentDay(p.paid_at)}))];
        const coverage = estimate(row.source, history, asOf);
        const paidThrough = validDate(reviewedEnd) ? reviewedEnd :
            coverage.status !== 'needs_review' && coverage.remainder === 0 ? coverage.end : null;
        const status = row.account.status === 'expired' ? 'expired' : 'needs_review';
        return [{
            source_id: row.source_id, tenant_public_id: row.tenant_public_id,
            tenant_name: tenant.display_name, property: row.source.property,
            property_public_id: row.source.property_public_id,
            unit: row.source.unit, date_in: row.source.date_in,
            monthly_rent: row.source.monthly_rent, status,
            paid_through: paidThrough,
            last_payment_date: history.map(p => p.date_created.slice(0, 10)).sort().at(-1) || null,
            total_paid: row.account.total_paid,
            reason: status === 'expired' ? 'Kodi imeisha; renewal haijarekodiwa' : 'Taarifa zinahitaji uhakiki',
            coverage_basis: validDate(reviewedEnd) ? 'reviewed' : 'payment_history',
            contract_end: latestEnded?.end_date || null,
            latest_lease_public_id: latestEnded?.public_id || null
        }];
    }).sort((a,b) => (a.paid_through || '9999').localeCompare(b.paid_through || '9999') || a.tenant_name.localeCompare(b.tenant_name));
}
module.exports = { buildImportedLeaseFollowUps };

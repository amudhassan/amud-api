jest.mock('../config/db', () => ({ query: jest.fn() }));
const pool = require('../config/db');
const { getLeases } = require('../services/leaseService');
beforeEach(() => pool.query.mockImplementation(async sql => ({ rows: sql.includes('COUNT(*) AS total_records') ? [{total_records:'0'}] : [] })));
afterEach(() => jest.clearAllMocks());
test.each([undefined,'current','archived','all'])('count and paginated list use the same archive view: %s', async view => {
    await getLeases({filters:{view,page:'2',limit:'20'},authenticatedUser:{id:1,role:'admin'}});
    const [count,list] = pool.query.mock.calls.map(([sql]) => sql);
    for (const sql of [count,list]) {
        if (view === 'all') expect(sql).not.toContain('SELECT 1 FROM leases successor');
        else {
            expect(sql).toContain("successor.status IN ('scheduled', 'active', 'expired', 'terminated')");
            expect(sql).toContain('successor.tenant_id = l.tenant_id');
            expect(sql).toContain('successor.unit_id = l.unit_id');
            expect(sql.includes("NOT (l.status IN ('expired', 'terminated')")).toBe(view !== 'archived');
        }
    }
});

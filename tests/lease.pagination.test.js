jest.mock('../config/db', () => ({ query: jest.fn() }));
const pool = require('../config/db');
const { getLeases } = require('../services/leaseService');

describe('lease pagination from HTTP query strings', () => {
    beforeEach(() => {
        pool.query.mockReset();
        pool.query.mockImplementation(async sql => ({
            rows: sql.includes('COUNT(*) AS total_records')
                ? [{ total_records: '54' }] : []
        }));
    });
    test.each([['1', 0, false, true], ['2', 20, true, true], ['3', 40, true, false]])(
        'page %s selects its own offset', async (page, offset, previous, next) => {
            const result = await getLeases({
                filters: { page, limit: '20' }, authenticatedUser: { id: 1, role: 'admin' }
            });
            expect(pool.query.mock.calls[1][1].slice(-2)).toEqual([20, offset]);
            expect(result.pagination).toMatchObject({
                page: Number(page), total_pages: 3,
                has_previous_page: previous, has_next_page: next
            });
        }
    );
    test('respects a validated custom page size', async () => {
        const result = await getLeases({
            filters: { page: '2', limit: '10' }, authenticatedUser: { id: 1, role: 'admin' }
        });
        expect(pool.query.mock.calls[1][1].slice(-2)).toEqual([10, 10]);
        expect(result.pagination.total_pages).toBe(6);
    });
});

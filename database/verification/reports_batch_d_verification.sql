-- =========================================================
-- REPORTS & DASHBOARD - BATCH D VERIFICATION
-- =========================================================

WITH expected_indexes(index_name) AS (
    VALUES
        ('idx_reports_maintenance_property_reported_at'),
        ('idx_reports_maintenance_owner_currency_reported_at'),
        ('idx_reports_maintenance_resolution_request_work'),
        ('idx_reports_maintenance_assignment_request_user_status'),
        ('idx_reports_maintenance_cost_request_currency_status')
)
SELECT
    e.index_name AS missing_index
FROM expected_indexes AS e
LEFT JOIN pg_indexes AS i
    ON i.schemaname = 'public'
   AND i.indexname = e.index_name
WHERE i.indexname IS NULL
ORDER BY e.index_name;

-- Expected: zero rows.

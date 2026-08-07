-- =========================================================
-- REPORTS & DASHBOARD - BATCH E VERIFICATION
-- =========================================================

WITH expected_indexes(index_name) AS (
    VALUES
        ('idx_reports_dashboard_maintenance_owner_priority_open'),
        ('idx_reports_dashboard_invoices_owner_open_due'),
        ('idx_reports_dashboard_payments_owner_recent')
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

-- =========================================================
-- REPORTS & DASHBOARD - BATCH C VERIFICATION
-- =========================================================

WITH expected_indexes(index_name) AS (
    VALUES
        ('idx_reports_leases_owner_active_end'),
        ('idx_reports_leases_property_active_end'),
        ('idx_reports_leases_property_status_dates'),
        ('idx_reports_properties_active_not_deleted')
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

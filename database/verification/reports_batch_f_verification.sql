-- =========================================================
-- REPORTS & DASHBOARD - BATCH F VERIFICATION
-- =========================================================

WITH expected_objects AS (
    SELECT
        to_regclass(
            'public.report_exports'
        ) IS NOT NULL
            AS report_exports_table_exists,

        to_regprocedure(
            'public.protect_report_export_audit()'
        ) IS NOT NULL
            AS immutable_function_exists,

        EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname =
                'trg_report_exports_immutable'
              AND tgrelid =
                'report_exports'::regclass
              AND NOT tgisinternal
        ) AS immutable_trigger_exists
)
SELECT *
FROM expected_objects;

-- Expected: all TRUE.

WITH expected_indexes(index_name) AS (
    VALUES
        ('idx_report_exports_actor_generated'),
        ('idx_report_exports_type_generated'),
        ('idx_report_exports_owner_generated')
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

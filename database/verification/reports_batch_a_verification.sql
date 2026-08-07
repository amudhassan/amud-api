-- =========================================================
-- REPORTS & DASHBOARD - BATCH A VERIFICATION
-- Read-only verification. No transaction is intentionally
-- left open by this script.
-- =========================================================

WITH expected_tables(table_name) AS (
    VALUES
        ('users'),
        ('owners'),
        ('owner_users'),
        ('properties'),
        ('property_owners'),
        ('units'),
        ('tenants'),
        ('leases'),
        ('rent_invoices'),
        ('rent_payments'),
        ('maintenance_requests')
),
missing_tables AS (
    SELECT e.table_name
    FROM expected_tables AS e
    WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.tables AS t
        WHERE t.table_schema = 'public'
          AND t.table_name = e.table_name
    )
),
expected_indexes(index_name) AS (
    VALUES
        ('idx_reports_owner_users_user_owner_access'),
        ('idx_reports_property_owners_owner_property_active'),
        ('idx_reports_leases_owner_status_end_date'),
        ('idx_reports_rent_invoices_owner_currency_issue'),
        ('idx_reports_rent_payments_owner_currency_paid_at'),
        ('idx_reports_maintenance_owner_status_reported_at')
),
missing_indexes AS (
    SELECT e.index_name
    FROM expected_indexes AS e
    WHERE NOT EXISTS (
        SELECT 1
        FROM pg_indexes AS i
        WHERE i.schemaname = 'public'
          AND i.indexname = e.index_name
    )
)
SELECT
    (SELECT COUNT(*) FROM missing_tables)
        AS missing_source_tables,
    (SELECT COUNT(*) FROM missing_indexes)
        AS missing_reporting_indexes,
    CASE
        WHEN (SELECT COUNT(*) FROM missing_tables) = 0
         AND (SELECT COUNT(*) FROM missing_indexes) = 0
            THEN 'passed'
        ELSE 'failed'
    END AS reports_batch_a_foundation;

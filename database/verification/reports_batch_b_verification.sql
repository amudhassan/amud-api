-- =========================================================
-- REPORTS & DASHBOARD - BATCH B VERIFICATION
-- Read-only verification.
-- =========================================================

WITH expected_tables(table_name) AS (
    VALUES
        ('owners'),
        ('owner_users'),
        ('properties'),
        ('property_owners'),
        ('tenants'),
        ('rent_invoices'),
        ('rent_payments'),
        ('rent_payment_allocations')
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
        ('idx_reports_invoices_property_currency_issue'),
        ('idx_reports_invoices_owner_currency_due_open'),
        ('idx_reports_invoices_property_currency_due_open'),
        ('idx_reports_invoices_tenant_currency_open'),
        ('idx_reports_payments_status_currency_paid_at'),
        ('idx_reports_payment_allocations_payment_invoice')
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
),
status_checks AS (
    SELECT
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'rent_invoices'::regclass
              AND conname = 'chk_rent_invoices_status'
        ) AS invoice_status_check_exists,
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'rent_payments'::regclass
              AND conname = 'chk_rent_payments_status'
        ) AS payment_status_check_exists
)
SELECT
    (SELECT COUNT(*) FROM missing_tables)
        AS missing_source_tables,
    (SELECT COUNT(*) FROM missing_indexes)
        AS missing_financial_indexes,
    invoice_status_check_exists,
    payment_status_check_exists,
    CASE
        WHEN (SELECT COUNT(*) FROM missing_tables) = 0
         AND (SELECT COUNT(*) FROM missing_indexes) = 0
         AND invoice_status_check_exists = TRUE
         AND payment_status_check_exists = TRUE
            THEN 'passed'
        ELSE 'failed'
    END AS reports_batch_b_financial
FROM status_checks;

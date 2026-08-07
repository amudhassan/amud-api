-- =========================================================
-- REPORTS & DASHBOARD - BATCHES A-F FINAL VERIFICATION
-- Run after migrations 034 through 039.
-- =========================================================

WITH expected_tables(table_name) AS (
    VALUES
        ('owners'),
        ('owner_users'),
        ('property_owners'),
        ('properties'),
        ('units'),
        ('leases'),
        ('tenants'),
        ('rent_invoices'),
        ('rent_payments'),
        ('rent_payment_allocations'),
        ('maintenance_requests'),
        ('maintenance_assignments'),
        ('maintenance_costs'),
        ('maintenance_resolutions'),
        ('maintenance_activity_history'),
        ('report_exports')
),
missing_tables AS (
    SELECT e.table_name
    FROM expected_tables AS e
    LEFT JOIN information_schema.tables AS t
        ON t.table_schema = 'public'
       AND t.table_name = e.table_name
    WHERE t.table_name IS NULL
),
expected_indexes(index_name) AS (
    VALUES
        ('idx_reports_owner_users_user_owner_access'),
        ('idx_reports_property_owners_owner_property_active'),
        ('idx_reports_leases_owner_status_end_date'),
        ('idx_reports_rent_invoices_owner_currency_issue'),
        ('idx_reports_rent_payments_owner_currency_paid_at'),
        ('idx_reports_maintenance_owner_status_reported_at'),
        ('idx_reports_invoices_property_currency_issue'),
        ('idx_reports_invoices_owner_currency_due_open'),
        ('idx_reports_invoices_property_currency_due_open'),
        ('idx_reports_invoices_tenant_currency_open'),
        ('idx_reports_payments_status_currency_paid_at'),
        ('idx_reports_payment_allocations_payment_invoice'),
        ('idx_reports_leases_owner_active_end'),
        ('idx_reports_leases_property_active_end'),
        ('idx_reports_leases_property_status_dates'),
        ('idx_reports_properties_active_not_deleted'),
        ('idx_reports_maintenance_property_reported_at'),
        ('idx_reports_maintenance_owner_currency_reported_at'),
        ('idx_reports_maintenance_resolution_request_work'),
        ('idx_reports_maintenance_assignment_request_user_status'),
        ('idx_reports_maintenance_cost_request_currency_status'),
        ('idx_reports_dashboard_maintenance_owner_priority_open'),
        ('idx_reports_dashboard_invoices_owner_open_due'),
        ('idx_reports_dashboard_payments_owner_recent'),
        ('idx_report_exports_actor_generated'),
        ('idx_report_exports_type_generated'),
        ('idx_report_exports_owner_generated')
),
missing_indexes AS (
    SELECT e.index_name
    FROM expected_indexes AS e
    LEFT JOIN pg_indexes AS i
        ON i.schemaname = 'public'
       AND i.indexname = e.index_name
    WHERE i.indexname IS NULL
),
permission_column AS (
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'owner_users'
          AND column_name =
              'can_view_maintenance_requests'
    ) AS exists_value
),
export_trigger AS (
    SELECT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname =
            'trg_report_exports_immutable'
          AND tgrelid =
            'report_exports'::regclass
          AND NOT tgisinternal
    ) AS exists_value
)
SELECT
    (
        SELECT COUNT(*)
        FROM missing_tables
    )::INTEGER AS missing_tables,

    (
        SELECT COUNT(*)
        FROM missing_indexes
    )::INTEGER AS missing_indexes,

    (
        SELECT exists_value
        FROM permission_column
    ) AS maintenance_permission_available,

    (
        SELECT exists_value
        FROM export_trigger
    ) AS export_audit_immutable;

-- Expected:
-- missing_tables = 0
-- missing_indexes = 0
-- maintenance_permission_available = true
-- export_audit_immutable = true

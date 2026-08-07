BEGIN;

-- =========================================================
-- REPORTS & DASHBOARD - BATCH B
-- Financial Reporting Read-Path Indexes
--
-- No transactional business data is duplicated here.
-- These indexes only support invoice/payment aggregations.
-- =========================================================

CREATE INDEX IF NOT EXISTS
    idx_reports_invoices_property_currency_issue
ON rent_invoices (
    property_id,
    currency_code,
    issue_date
)
WHERE status NOT IN (
    'draft',
    'void'
);

CREATE INDEX IF NOT EXISTS
    idx_reports_invoices_owner_currency_due_open
ON rent_invoices (
    owner_id,
    currency_code,
    due_date
)
WHERE status IN (
    'issued',
    'partially_paid',
    'overdue'
);

CREATE INDEX IF NOT EXISTS
    idx_reports_invoices_property_currency_due_open
ON rent_invoices (
    property_id,
    currency_code,
    due_date
)
WHERE status IN (
    'issued',
    'partially_paid',
    'overdue'
);

CREATE INDEX IF NOT EXISTS
    idx_reports_invoices_tenant_currency_open
ON rent_invoices (
    tenant_id,
    currency_code,
    due_date
)
WHERE status IN (
    'issued',
    'partially_paid',
    'overdue'
);

CREATE INDEX IF NOT EXISTS
    idx_reports_payments_status_currency_paid_at
ON rent_payments (
    status,
    currency_code,
    paid_at DESC
);

CREATE INDEX IF NOT EXISTS
    idx_reports_payment_allocations_payment_invoice
ON rent_payment_allocations (
    payment_id,
    invoice_id
);

COMMIT;

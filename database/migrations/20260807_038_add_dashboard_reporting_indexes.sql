BEGIN;

-- =========================================================
-- REPORTS & DASHBOARD - BATCH E
-- Dashboard Read-Path Optimizations
-- =========================================================

CREATE INDEX IF NOT EXISTS
    idx_reports_dashboard_maintenance_owner_priority_open
ON maintenance_requests (
    owner_id,
    priority,
    reported_at DESC
)
WHERE status NOT IN (
    'closed',
    'rejected',
    'cancelled'
);

CREATE INDEX IF NOT EXISTS
    idx_reports_dashboard_invoices_owner_open_due
ON rent_invoices (
    owner_id,
    currency_code,
    due_date
)
INCLUDE (
    total_amount,
    paid_amount,
    balance_amount
)
WHERE status IN (
    'issued',
    'partially_paid',
    'overdue'
);

CREATE INDEX IF NOT EXISTS
    idx_reports_dashboard_payments_owner_recent
ON rent_payments (
    owner_id,
    paid_at DESC,
    status
)
INCLUDE (
    amount,
    currency_code,
    receipt_number
);

COMMIT;

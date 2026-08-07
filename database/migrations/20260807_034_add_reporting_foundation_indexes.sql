BEGIN;

-- =========================================================
-- REPORTS & DASHBOARD - BATCH A
-- Reporting Foundation & Shared Access Layer
--
-- This migration adds only read-path indexes. It does not
-- duplicate or denormalize transactional business data.
-- =========================================================

-- Resolve owner-report access for an authenticated user.
CREATE INDEX IF NOT EXISTS
    idx_reports_owner_users_user_owner_access
ON owner_users (
    user_id,
    owner_id
)
WHERE revoked_at IS NULL
  AND (
        can_manage_properties = TRUE
        OR can_manage_finances = TRUE
  );

-- Reporting queries commonly start from an owner and then
-- resolve the properties currently attached to that owner.
CREATE INDEX IF NOT EXISTS
    idx_reports_property_owners_owner_property_active
ON property_owners (
    owner_id,
    property_id
)
WHERE effective_to IS NULL;

-- Lease status and expiry reporting by owner.
CREATE INDEX IF NOT EXISTS
    idx_reports_leases_owner_status_end_date
ON leases (
    owner_id,
    status,
    end_date
);

-- Financial reporting groups issued/non-void invoices by
-- owner, currency and issue date.
CREATE INDEX IF NOT EXISTS
    idx_reports_rent_invoices_owner_currency_issue
ON rent_invoices (
    owner_id,
    currency_code,
    issue_date
)
WHERE status NOT IN (
    'draft',
    'void'
);

-- Revenue/collection reporting uses completed payments only.
CREATE INDEX IF NOT EXISTS
    idx_reports_rent_payments_owner_currency_paid_at
ON rent_payments (
    owner_id,
    currency_code,
    paid_at DESC
)
WHERE status = 'completed';

-- Maintenance trend and status reporting by owner/date.
CREATE INDEX IF NOT EXISTS
    idx_reports_maintenance_owner_status_reported_at
ON maintenance_requests (
    owner_id,
    status,
    reported_at DESC
);

COMMIT;

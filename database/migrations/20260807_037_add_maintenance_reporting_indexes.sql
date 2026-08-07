BEGIN;

-- =========================================================
-- REPORTS & DASHBOARD - BATCH D
-- Maintenance Reporting Read-Path Indexes
-- =========================================================

CREATE INDEX IF NOT EXISTS
    idx_reports_maintenance_property_reported_at
ON maintenance_requests (
    property_id,
    reported_at DESC
);

CREATE INDEX IF NOT EXISTS
    idx_reports_maintenance_owner_currency_reported_at
ON maintenance_requests (
    owner_id,
    currency_code,
    reported_at DESC
);

CREATE INDEX IF NOT EXISTS
    idx_reports_maintenance_resolution_request_work
ON maintenance_resolutions (
    maintenance_request_id,
    sequence_number DESC,
    work_completed_at
);

CREATE INDEX IF NOT EXISTS
    idx_reports_maintenance_assignment_request_user_status
ON maintenance_assignments (
    maintenance_request_id,
    assigned_user_id,
    status
)
WHERE assignment_type = 'internal_technician'
  AND assigned_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
    idx_reports_maintenance_cost_request_currency_status
ON maintenance_costs (
    maintenance_request_id,
    currency_code,
    status,
    cost_type
);

COMMIT;

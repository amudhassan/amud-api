BEGIN;

-- =========================================================
-- REPORTS & DASHBOARD - BATCH C
-- Occupancy & Lease Reporting Read-Path Indexes
-- =========================================================

CREATE INDEX IF NOT EXISTS
    idx_reports_leases_owner_active_end
ON leases (
    owner_id,
    end_date
)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS
    idx_reports_leases_property_active_end
ON leases (
    property_id,
    end_date
)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS
    idx_reports_leases_property_status_dates
ON leases (
    property_id,
    status,
    start_date,
    end_date
);

CREATE INDEX IF NOT EXISTS
    idx_reports_properties_active_not_deleted
ON properties (
    operational_status,
    id
)
WHERE deleted_at IS NULL;

COMMIT;

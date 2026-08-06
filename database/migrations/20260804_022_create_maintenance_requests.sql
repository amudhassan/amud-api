BEGIN;

-- =========================================================
-- OWNER USER MAINTENANCE PERMISSIONS
-- Adds maintenance-specific permissions without changing
-- the existing owner-user relationship lifecycle.
-- =========================================================

ALTER TABLE owner_users
    ADD COLUMN can_view_maintenance_requests BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    ADD COLUMN can_create_maintenance_requests BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    ADD COLUMN can_update_maintenance_requests BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    ADD COLUMN can_assign_maintenance_work BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    ADD COLUMN can_manage_maintenance_costs BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    ADD COLUMN can_approve_maintenance_costs BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    ADD COLUMN can_change_maintenance_status BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    ADD COLUMN can_close_maintenance_requests BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    ADD COLUMN can_reopen_maintenance_requests BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    ADD COLUMN can_view_internal_maintenance_notes BOOLEAN
        NOT NULL
        DEFAULT FALSE;


-- =========================================================
-- MAINTENANCE REQUESTS
-- Core maintenance record for unit-level and property
-- common-area work. Requests are permanent audit records.
-- =========================================================

CREATE TABLE maintenance_requests (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(50) NOT NULL,

    request_number VARCHAR(30) NOT NULL,

    request_scope VARCHAR(30) NOT NULL,

    request_source VARCHAR(30)
        NOT NULL
        DEFAULT 'manual',

    /*
     * The foreign key is added after
     * preventive_maintenance_plans is created in migration 026.
     */
    preventive_plan_id BIGINT,

    owner_id BIGINT NOT NULL,

    property_id BIGINT NOT NULL,

    unit_id BIGINT,

    tenant_id BIGINT,

    lease_id BIGINT,

    title VARCHAR(255) NOT NULL,

    description TEXT NOT NULL,

    category VARCHAR(50) NOT NULL,

    priority VARCHAR(20)
        NOT NULL
        DEFAULT 'medium',

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'reported',

    impact_level VARCHAR(40)
        NOT NULL
        DEFAULT 'no_operational_impact',

    location_details VARCHAR(500),

    problem_started_at TIMESTAMPTZ,

    preferred_visit_at TIMESTAMPTZ,

    access_instruction VARCHAR(40),

    reported_by BIGINT,

    reporter_type VARCHAR(30) NOT NULL,

    reported_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    target_review_at TIMESTAMPTZ,

    target_work_start_at TIMESTAMPTZ,

    target_resolution_at TIMESTAMPTZ,

    review_overdue BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    work_start_overdue BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    resolution_overdue BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    reviewed_at TIMESTAMPTZ,

    reviewed_by BIGINT,

    work_started_at TIMESTAMPTZ,

    work_started_by BIGINT,

    resolution_clock_paused_at TIMESTAMPTZ,

    total_resolution_hold_seconds BIGINT
        NOT NULL
        DEFAULT 0,

    resolution_confirmation_status VARCHAR(30)
        NOT NULL
        DEFAULT 'not_required',

    resolution_confirmation_deadline_at TIMESTAMPTZ,

    total_estimated_cost NUMERIC(14, 2)
        NOT NULL
        DEFAULT 0,

    total_approved_cost NUMERIC(14, 2)
        NOT NULL
        DEFAULT 0,

    total_actual_cost NUMERIC(14, 2)
        NOT NULL
        DEFAULT 0,

    currency_code VARCHAR(3)
        NOT NULL
        DEFAULT 'TZS',

    coverage_type VARCHAR(40)
        NOT NULL
        DEFAULT 'under_investigation',

    responsibility_status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending_review',

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    -- =====================================================
    -- IDENTIFIERS
    -- =====================================================

    CONSTRAINT uq_maintenance_requests_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_maintenance_requests_public_id
        CHECK (
            public_id ~
            '^maintenance_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_requests_public_id_length
        CHECK (
            char_length(public_id)
                BETWEEN 13 AND 50
        ),

    CONSTRAINT chk_maintenance_requests_number
        CHECK (
            request_number ~
            '^MNT-[0-9]{4}-[A-Z0-9]{8}$'
        ),

    -- =====================================================
    -- REQUEST SCOPE AND SOURCE
    -- =====================================================

    CONSTRAINT chk_maintenance_requests_scope
        CHECK (
            request_scope IN (
                'unit',
                'property_common_area'
            )
        ),

    CONSTRAINT chk_maintenance_requests_source
        CHECK (
            request_source IN (
                'manual',
                'preventive_schedule',
                'system_generated'
            )
        ),

    CONSTRAINT chk_maintenance_requests_preventive_source
        CHECK (
            (
                request_source = 'preventive_schedule'
                AND preventive_plan_id IS NOT NULL
            )
            OR
            (
                request_source = 'manual'
                AND preventive_plan_id IS NULL
            )
            OR
            request_source = 'system_generated'
        ),

    /*
     * Unit requests require a unit. Tenant and lease must
     * either both be present or both be absent.
     * Common-area requests cannot reference a unit, tenant
     * or lease and must identify the affected location.
     */
    CONSTRAINT chk_maintenance_requests_scope_relationships
        CHECK (
            (
                request_scope = 'unit'
                AND unit_id IS NOT NULL
                AND (
                    (
                        tenant_id IS NULL
                        AND lease_id IS NULL
                    )
                    OR
                    (
                        tenant_id IS NOT NULL
                        AND lease_id IS NOT NULL
                    )
                )
            )
            OR
            (
                request_scope = 'property_common_area'
                AND unit_id IS NULL
                AND tenant_id IS NULL
                AND lease_id IS NULL
                AND location_details IS NOT NULL
                AND btrim(location_details) <> ''
            )
        ),

    -- =====================================================
    -- REQUEST CONTENT
    -- =====================================================

    CONSTRAINT chk_maintenance_requests_title
        CHECK (
            char_length(btrim(title))
                BETWEEN 3 AND 255
        ),

    CONSTRAINT chk_maintenance_requests_description
        CHECK (
            char_length(btrim(description))
                BETWEEN 10 AND 5000
        ),

    CONSTRAINT chk_maintenance_requests_location_details
        CHECK (
            location_details IS NULL
            OR btrim(location_details) <> ''
        ),

    CONSTRAINT chk_maintenance_requests_category
        CHECK (
            category IN (
                'plumbing',
                'electrical',
                'appliance',
                'structural',
                'roofing',
                'painting',
                'doors_windows',
                'security',
                'water_supply',
                'sanitation',
                'pest_control',
                'internet_communication',
                'cleaning',
                'common_area',
                'other'
            )
        ),

    CONSTRAINT chk_maintenance_requests_priority
        CHECK (
            priority IN (
                'low',
                'medium',
                'high',
                'emergency'
            )
        ),

    CONSTRAINT chk_maintenance_requests_status
        CHECK (
            status IN (
                'reported',
                'under_review',
                'assigned',
                'in_progress',
                'on_hold',
                'resolved',
                'closed',
                'rejected',
                'cancelled'
            )
        ),

    CONSTRAINT chk_maintenance_requests_impact_level
        CHECK (
            impact_level IN (
                'no_operational_impact',
                'partially_restricted',
                'uninhabitable'
            )
        ),

    CONSTRAINT chk_maintenance_requests_access_instruction
        CHECK (
            access_instruction IS NULL
            OR access_instruction IN (
                'contact_first',
                'tenant_must_be_present',
                'authorized_entry'
            )
        ),

    -- =====================================================
    -- REPORTER AND TIME CONSISTENCY
    -- =====================================================

    CONSTRAINT chk_maintenance_requests_reporter_type
        CHECK (
            reporter_type IN (
                'admin',
                'owner_user',
                'tenant_user',
                'system'
            )
        ),

    CONSTRAINT chk_maintenance_requests_reporter
        CHECK (
            (
                reporter_type = 'system'
                AND reported_by IS NULL
                AND request_source IN (
                    'preventive_schedule',
                    'system_generated'
                )
            )
            OR
            (
                reporter_type IN (
                    'admin',
                    'owner_user',
                    'tenant_user'
                )
                AND reported_by IS NOT NULL
            )
        ),

    CONSTRAINT chk_maintenance_requests_problem_time
        CHECK (
            problem_started_at IS NULL
            OR problem_started_at <= reported_at
        ),

    CONSTRAINT chk_maintenance_requests_preferred_visit
        CHECK (
            preferred_visit_at IS NULL
            OR preferred_visit_at >= reported_at
        ),

    CONSTRAINT chk_maintenance_requests_sla_targets
        CHECK (
            (
                target_review_at IS NULL
                OR target_review_at >= reported_at
            )
            AND
            (
                target_work_start_at IS NULL
                OR target_work_start_at >= reported_at
            )
            AND
            (
                target_resolution_at IS NULL
                OR target_resolution_at >= reported_at
            )
        ),

    CONSTRAINT chk_maintenance_requests_review_audit
        CHECK (
            (
                reviewed_at IS NULL
                AND reviewed_by IS NULL
            )
            OR
            (
                reviewed_at IS NOT NULL
                AND reviewed_by IS NOT NULL
                AND reviewed_at >= reported_at
            )
        ),

    CONSTRAINT chk_maintenance_requests_work_start_audit
        CHECK (
            (
                work_started_at IS NULL
                AND work_started_by IS NULL
            )
            OR
            (
                work_started_at IS NOT NULL
                AND work_started_by IS NOT NULL
                AND work_started_at >= reported_at
            )
        ),

    CONSTRAINT chk_maintenance_requests_hold_seconds
        CHECK (
            total_resolution_hold_seconds >= 0
        ),

    CONSTRAINT chk_maintenance_requests_confirmation_status
        CHECK (
            resolution_confirmation_status IN (
                'pending',
                'confirmed',
                'disputed',
                'no_response',
                'not_required'
            )
        ),

    CONSTRAINT chk_maintenance_requests_confirmation_deadline
        CHECK (
            resolution_confirmation_deadline_at IS NULL
            OR resolution_confirmation_deadline_at >= reported_at
        ),

    -- =====================================================
    -- COST AND RESPONSIBILITY SUMMARIES
    -- =====================================================

    CONSTRAINT chk_maintenance_requests_cost_totals
        CHECK (
            total_estimated_cost >= 0
            AND total_approved_cost >= 0
            AND total_actual_cost >= 0
        ),

    CONSTRAINT chk_maintenance_requests_currency
        CHECK (
            currency_code ~ '^[A-Z]{3}$'
        ),

    CONSTRAINT chk_maintenance_requests_coverage_type
        CHECK (
            coverage_type IN (
                'none',
                'manufacturer_warranty',
                'vendor_warranty',
                'service_contract',
                'insurance',
                'landlord_responsibility',
                'tenant_responsibility',
                'shared_responsibility',
                'under_investigation'
            )
        ),

    CONSTRAINT chk_maintenance_requests_responsibility_status
        CHECK (
            responsibility_status IN (
                'pending_review',
                'owner',
                'tenant',
                'shared',
                'warranty_provider',
                'insurance_provider',
                'external_party',
                'not_applicable'
            )
        ),

    CONSTRAINT chk_maintenance_requests_timestamps
        CHECK (
            updated_at >= created_at
            AND reported_at >= created_at
            AND (
                resolution_clock_paused_at IS NULL
                OR resolution_clock_paused_at >= reported_at
            )
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_maintenance_requests_owner
        FOREIGN KEY (owner_id)
        REFERENCES owners(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_requests_property
        FOREIGN KEY (property_id)
        REFERENCES properties(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_requests_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_requests_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_requests_lease
        FOREIGN KEY (lease_id)
        REFERENCES leases(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_requests_reported_by
        FOREIGN KEY (reported_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_requests_reviewed_by
        FOREIGN KEY (reviewed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_requests_work_started_by
        FOREIGN KEY (work_started_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- MAINTENANCE REQUEST UNIQUENESS AND QUERY INDEXES
-- =========================================================

CREATE UNIQUE INDEX
    uq_maintenance_requests_number_ci
ON maintenance_requests (
    lower(
        btrim(request_number)
    )
);

CREATE INDEX idx_maintenance_requests_owner
ON maintenance_requests (owner_id);

CREATE INDEX idx_maintenance_requests_property
ON maintenance_requests (property_id);

CREATE INDEX idx_maintenance_requests_unit
ON maintenance_requests (unit_id)
WHERE unit_id IS NOT NULL;

CREATE INDEX idx_maintenance_requests_tenant
ON maintenance_requests (tenant_id)
WHERE tenant_id IS NOT NULL;

CREATE INDEX idx_maintenance_requests_lease
ON maintenance_requests (lease_id)
WHERE lease_id IS NOT NULL;

CREATE INDEX idx_maintenance_requests_status
ON maintenance_requests (status);

CREATE INDEX idx_maintenance_requests_priority
ON maintenance_requests (priority);

CREATE INDEX idx_maintenance_requests_category
ON maintenance_requests (category);

CREATE INDEX idx_maintenance_requests_scope
ON maintenance_requests (request_scope);

CREATE INDEX idx_maintenance_requests_source
ON maintenance_requests (request_source);

CREATE INDEX idx_maintenance_requests_owner_status
ON maintenance_requests (
    owner_id,
    status
);

CREATE INDEX idx_maintenance_requests_property_status
ON maintenance_requests (
    property_id,
    status
);

CREATE INDEX idx_maintenance_requests_unit_status
ON maintenance_requests (
    unit_id,
    status
)
WHERE unit_id IS NOT NULL;

CREATE INDEX idx_maintenance_requests_tenant_status
ON maintenance_requests (
    tenant_id,
    status
)
WHERE tenant_id IS NOT NULL;

CREATE INDEX idx_maintenance_requests_priority_status
ON maintenance_requests (
    priority,
    status
);

CREATE INDEX idx_maintenance_requests_target_review
ON maintenance_requests (target_review_at)
WHERE target_review_at IS NOT NULL
  AND reviewed_at IS NULL
  AND status NOT IN (
      'closed',
      'rejected',
      'cancelled'
  );

CREATE INDEX idx_maintenance_requests_target_work_start
ON maintenance_requests (target_work_start_at)
WHERE target_work_start_at IS NOT NULL
  AND work_started_at IS NULL
  AND status NOT IN (
      'closed',
      'rejected',
      'cancelled'
  );

CREATE INDEX idx_maintenance_requests_target_resolution
ON maintenance_requests (target_resolution_at)
WHERE target_resolution_at IS NOT NULL
  AND status NOT IN (
      'resolved',
      'closed',
      'rejected',
      'cancelled'
  );

CREATE INDEX idx_maintenance_requests_reported_at
ON maintenance_requests (
    reported_at DESC
);

CREATE INDEX idx_maintenance_requests_created_at
ON maintenance_requests (
    created_at DESC
);

CREATE INDEX idx_maintenance_requests_reported_by
ON maintenance_requests (reported_by)
WHERE reported_by IS NOT NULL;

CREATE INDEX idx_maintenance_requests_preventive_plan
ON maintenance_requests (preventive_plan_id)
WHERE preventive_plan_id IS NOT NULL;


-- =========================================================
-- MAINTENANCE STATUS HISTORY
-- Append-only lifecycle history. Mutation and hard-delete
-- protection are added by the final integrity migration.
-- =========================================================

CREATE TABLE maintenance_status_history (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(50) NOT NULL,

    maintenance_request_id BIGINT NOT NULL,

    old_status VARCHAR(30),

    new_status VARCHAR(30) NOT NULL,

    reason TEXT,

    changed_by BIGINT,

    changed_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::JSONB,

    CONSTRAINT uq_maintenance_status_history_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_maintenance_status_history_public_id
        CHECK (
            public_id ~
            '^maintenance_status_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_status_history_old_status
        CHECK (
            old_status IS NULL
            OR old_status IN (
                'reported',
                'under_review',
                'assigned',
                'in_progress',
                'on_hold',
                'resolved',
                'closed',
                'rejected',
                'cancelled'
            )
        ),

    CONSTRAINT chk_maintenance_status_history_new_status
        CHECK (
            new_status IN (
                'reported',
                'under_review',
                'assigned',
                'in_progress',
                'on_hold',
                'resolved',
                'closed',
                'rejected',
                'cancelled'
            )
        ),

    CONSTRAINT chk_maintenance_status_history_transition
        CHECK (
            old_status IS NULL
            OR old_status <> new_status
        ),

    CONSTRAINT chk_maintenance_status_history_reason
        CHECK (
            reason IS NULL
            OR (
                btrim(reason) <> ''
                AND char_length(reason) <= 2000
            )
        ),

    CONSTRAINT chk_maintenance_status_history_metadata
        CHECK (
            jsonb_typeof(metadata) = 'object'
        ),

    CONSTRAINT fk_maintenance_status_history_request
        FOREIGN KEY (maintenance_request_id)
        REFERENCES maintenance_requests(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_status_history_changed_by
        FOREIGN KEY (changed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_maintenance_status_history_request
ON maintenance_status_history (
    maintenance_request_id,
    changed_at DESC
);

CREATE INDEX idx_maintenance_status_history_new_status
ON maintenance_status_history (new_status);

CREATE INDEX idx_maintenance_status_history_changed_by
ON maintenance_status_history (changed_by)
WHERE changed_by IS NOT NULL;


-- =========================================================
-- MAINTENANCE REOPEN REQUESTS
-- Terminal requests can only return to an active lifecycle
-- through an approved reopening record.
-- =========================================================

CREATE TABLE maintenance_reopen_requests (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(50) NOT NULL,

    maintenance_request_id BIGINT NOT NULL,

    from_status VARCHAR(30) NOT NULL,

    target_status VARCHAR(30) NOT NULL,

    reason TEXT NOT NULL,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'pending',

    requested_by BIGINT NOT NULL,

    requested_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    decided_by BIGINT,

    decided_at TIMESTAMPTZ,

    decision_note TEXT,

    CONSTRAINT uq_maintenance_reopen_requests_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_maintenance_reopen_requests_public_id
        CHECK (
            public_id ~
            '^maintenance_reopen_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_reopen_requests_transition
        CHECK (
            (
                from_status = 'closed'
                AND target_status = 'under_review'
            )
            OR
            (
                from_status = 'rejected'
                AND target_status = 'under_review'
            )
            OR
            (
                from_status = 'cancelled'
                AND target_status = 'reported'
            )
        ),

    CONSTRAINT chk_maintenance_reopen_requests_reason
        CHECK (
            char_length(btrim(reason))
                BETWEEN 5 AND 2000
        ),

    CONSTRAINT chk_maintenance_reopen_requests_status
        CHECK (
            status IN (
                'pending',
                'approved',
                'rejected',
                'cancelled'
            )
        ),

    CONSTRAINT chk_maintenance_reopen_requests_decision
        CHECK (
            (
                status = 'pending'
                AND decided_by IS NULL
                AND decided_at IS NULL
                AND decision_note IS NULL
            )
            OR
            (
                status IN (
                    'approved',
                    'rejected',
                    'cancelled'
                )
                AND decided_by IS NOT NULL
                AND decided_at IS NOT NULL
                AND decision_note IS NOT NULL
                AND btrim(decision_note) <> ''
                AND decided_at >= requested_at
            )
        ),

    CONSTRAINT fk_maintenance_reopen_requests_request
        FOREIGN KEY (maintenance_request_id)
        REFERENCES maintenance_requests(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_reopen_requests_requested_by
        FOREIGN KEY (requested_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_reopen_requests_decided_by
        FOREIGN KEY (decided_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX
    uq_maintenance_reopen_requests_pending
ON maintenance_reopen_requests (
    maintenance_request_id
)
WHERE status = 'pending';

CREATE INDEX idx_maintenance_reopen_requests_request
ON maintenance_reopen_requests (
    maintenance_request_id,
    requested_at DESC
);

CREATE INDEX idx_maintenance_reopen_requests_status
ON maintenance_reopen_requests (status);

CREATE INDEX idx_maintenance_reopen_requests_requested_by
ON maintenance_reopen_requests (requested_by);


-- =========================================================
-- MAINTENANCE UNIT STATUS LOCKS
-- Tracks every request that requires a unit to remain in
-- maintenance status and preserves its restoration status.
-- =========================================================

CREATE TABLE maintenance_unit_status_locks (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(60) NOT NULL,

    maintenance_request_id BIGINT NOT NULL,

    unit_id BIGINT NOT NULL,

    restoration_status VARCHAR(30) NOT NULL,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    applied_by BIGINT NOT NULL,

    applied_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    released_by BIGINT,

    released_at TIMESTAMPTZ,

    release_reason TEXT,

    CONSTRAINT uq_maintenance_unit_status_locks_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_maintenance_unit_status_locks_public_id
        CHECK (
            public_id ~
            '^maintenance_unit_lock_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_unit_status_locks_restoration
        CHECK (
            restoration_status IN (
                'inactive',
                'available',
                'reserved',
                'occupied',
                'maintenance'
            )
        ),

    CONSTRAINT chk_maintenance_unit_status_locks_release
        CHECK (
            (
                is_active = TRUE
                AND released_by IS NULL
                AND released_at IS NULL
                AND release_reason IS NULL
            )
            OR
            (
                is_active = FALSE
                AND released_by IS NOT NULL
                AND released_at IS NOT NULL
                AND release_reason IS NOT NULL
                AND btrim(release_reason) <> ''
                AND released_at >= applied_at
            )
        ),

    CONSTRAINT fk_maintenance_unit_status_locks_request
        FOREIGN KEY (maintenance_request_id)
        REFERENCES maintenance_requests(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_unit_status_locks_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_unit_status_locks_applied_by
        FOREIGN KEY (applied_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_unit_status_locks_released_by
        FOREIGN KEY (released_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX
    uq_maintenance_unit_status_locks_active_request
ON maintenance_unit_status_locks (
    maintenance_request_id
)
WHERE is_active = TRUE;

CREATE INDEX idx_maintenance_unit_status_locks_request
ON maintenance_unit_status_locks (
    maintenance_request_id,
    applied_at DESC
);

CREATE INDEX idx_maintenance_unit_status_locks_unit
ON maintenance_unit_status_locks (
    unit_id,
    is_active
);

CREATE INDEX idx_maintenance_unit_status_locks_active_unit
ON maintenance_unit_status_locks (unit_id)
WHERE is_active = TRUE;


-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON TABLE maintenance_requests IS
'Permanent maintenance requests for units and property common areas.';

COMMENT ON COLUMN maintenance_requests.public_id IS
'Public API identifier beginning with maintenance_.';

COMMENT ON COLUMN maintenance_requests.request_number IS
'Human-readable immutable request number in MNT-YYYY-XXXXXXXX format.';

COMMENT ON COLUMN maintenance_requests.request_scope IS
'Whether the request affects one unit or a property common area.';

COMMENT ON COLUMN maintenance_requests.preventive_plan_id IS
'Preventive plan reference. Its foreign key is added after preventive maintenance tables are created.';

COMMENT ON COLUMN maintenance_requests.status IS
'Lifecycle status: reported, under_review, assigned, in_progress, on_hold, resolved, closed, rejected or cancelled.';

COMMENT ON COLUMN maintenance_requests.impact_level IS
'Operational impact: no_operational_impact, partially_restricted or uninhabitable.';

COMMENT ON COLUMN maintenance_requests.resolution_confirmation_status IS
'Current resolution confirmation summary: pending, confirmed, disputed, no_response or not_required.';

COMMENT ON TABLE maintenance_status_history IS
'Append-only history of maintenance request status transitions.';

COMMENT ON TABLE maintenance_reopen_requests IS
'Approval workflow for reopening closed, rejected or cancelled maintenance requests.';

COMMENT ON TABLE maintenance_unit_status_locks IS
'Unit maintenance locks used to preserve and safely restore the unit operational status.';

COMMIT;
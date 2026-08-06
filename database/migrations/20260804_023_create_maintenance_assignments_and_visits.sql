BEGIN;

-- =========================================================
-- MAINTENANCE ASSIGNMENTS
-- Stores the complete assignment history for internal
-- technicians and external vendors. Historical assignments
-- remain available after reassignment, decline, completion
-- or revocation.
-- =========================================================

CREATE TABLE maintenance_assignments (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(60) NOT NULL,

    maintenance_request_id BIGINT NOT NULL,

    assignment_type VARCHAR(30) NOT NULL,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'pending',

    /*
     * Internal technician assignment.
     */
    assigned_user_id BIGINT,

    /*
     * External vendor snapshot. These values remain part of
     * the historical assignment even if vendor information
     * changes outside the maintenance workflow.
     */
    vendor_name VARCHAR(255),

    company_name VARCHAR(255),

    contact_person VARCHAR(255),

    phone_number VARCHAR(50),

    email VARCHAR(320),

    service_description TEXT,

    assignment_notes TEXT,

    assigned_by BIGINT NOT NULL,

    assigned_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    accepted_at TIMESTAMPTZ,

    declined_at TIMESTAMPTZ,

    decline_reason TEXT,

    activated_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    completion_notes TEXT,

    revoked_at TIMESTAMPTZ,

    revoked_by BIGINT,

    revocation_reason TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    -- =====================================================
    -- IDENTIFIER AND ENUM-LIKE VALUES
    -- =====================================================

    CONSTRAINT uq_maintenance_assignments_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_maintenance_assignments_public_id
        CHECK (
            public_id ~
            '^maintenance_assignment_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_assignments_type
        CHECK (
            assignment_type IN (
                'internal_technician',
                'external_vendor'
            )
        ),

    CONSTRAINT chk_maintenance_assignments_status
        CHECK (
            status IN (
                'pending',
                'accepted',
                'declined',
                'active',
                'completed',
                'revoked'
            )
        ),

    -- =====================================================
    -- INTERNAL TECHNICIAN / EXTERNAL VENDOR EXCLUSIVITY
    -- =====================================================

    CONSTRAINT chk_maintenance_assignment_target
        CHECK (
            (
                assignment_type = 'internal_technician'
                AND assigned_user_id IS NOT NULL
                AND vendor_name IS NULL
                AND company_name IS NULL
                AND contact_person IS NULL
                AND phone_number IS NULL
                AND email IS NULL
                AND service_description IS NULL
            )
            OR
            (
                assignment_type = 'external_vendor'
                AND assigned_user_id IS NULL
                AND vendor_name IS NOT NULL
                AND btrim(vendor_name) <> ''
                AND (
                    (
                        phone_number IS NOT NULL
                        AND btrim(phone_number) <> ''
                    )
                    OR
                    (
                        email IS NOT NULL
                        AND btrim(email) <> ''
                    )
                )
            )
        ),

    CONSTRAINT chk_maintenance_assignment_email
        CHECK (
            email IS NULL
            OR email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
        ),

    CONSTRAINT chk_maintenance_assignment_phone
        CHECK (
            phone_number IS NULL
            OR char_length(btrim(phone_number))
                BETWEEN 5 AND 50
        ),

    -- =====================================================
    -- STATUS-SPECIFIC AUDIT DATA
    -- =====================================================

    CONSTRAINT chk_maintenance_assignment_decline
        CHECK (
            (
                status = 'declined'
                AND declined_at IS NOT NULL
                AND decline_reason IS NOT NULL
                AND btrim(decline_reason) <> ''
                AND completed_at IS NULL
                AND revoked_at IS NULL
                AND revoked_by IS NULL
                AND revocation_reason IS NULL
            )
            OR
            (
                status <> 'declined'
                AND declined_at IS NULL
                AND decline_reason IS NULL
            )
        ),

    CONSTRAINT chk_maintenance_assignment_completion
        CHECK (
            (
                status = 'completed'
                AND completed_at IS NOT NULL
                AND completion_notes IS NOT NULL
                AND btrim(completion_notes) <> ''
                AND revoked_at IS NULL
                AND revoked_by IS NULL
                AND revocation_reason IS NULL
            )
            OR
            (
                status <> 'completed'
                AND completed_at IS NULL
                AND completion_notes IS NULL
            )
        ),

    CONSTRAINT chk_maintenance_assignment_revocation
        CHECK (
            (
                status = 'revoked'
                AND revoked_at IS NOT NULL
                AND revoked_by IS NOT NULL
                AND revocation_reason IS NOT NULL
                AND btrim(revocation_reason) <> ''
                AND completed_at IS NULL
                AND completion_notes IS NULL
            )
            OR
            (
                status <> 'revoked'
                AND revoked_at IS NULL
                AND revoked_by IS NULL
                AND revocation_reason IS NULL
            )
        ),

    CONSTRAINT chk_maintenance_assignment_acceptance
        CHECK (
            status NOT IN ('accepted', 'active', 'completed')
            OR accepted_at IS NOT NULL
        ),

    CONSTRAINT chk_maintenance_assignment_activation
        CHECK (
            status NOT IN ('active', 'completed')
            OR activated_at IS NOT NULL
        ),

    -- =====================================================
    -- CHRONOLOGY
    -- =====================================================

    CONSTRAINT chk_maintenance_assignment_assigned_time
        CHECK (
            assigned_at >= created_at
        ),

    CONSTRAINT chk_maintenance_assignment_accepted_time
        CHECK (
            accepted_at IS NULL
            OR accepted_at >= assigned_at
        ),

    CONSTRAINT chk_maintenance_assignment_declined_time
        CHECK (
            declined_at IS NULL
            OR declined_at >= assigned_at
        ),

    CONSTRAINT chk_maintenance_assignment_activated_time
        CHECK (
            activated_at IS NULL
            OR (
                activated_at >= assigned_at
                AND (
                    accepted_at IS NULL
                    OR activated_at >= accepted_at
                )
            )
        ),

    CONSTRAINT chk_maintenance_assignment_completed_time
        CHECK (
            completed_at IS NULL
            OR (
                completed_at >= assigned_at
                AND (
                    activated_at IS NULL
                    OR completed_at >= activated_at
                )
            )
        ),

    CONSTRAINT chk_maintenance_assignment_revoked_time
        CHECK (
            revoked_at IS NULL
            OR revoked_at >= assigned_at
        ),

    CONSTRAINT chk_maintenance_assignment_updated_time
        CHECK (
            updated_at >= created_at
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_maintenance_assignments_request
        FOREIGN KEY (maintenance_request_id)
        REFERENCES maintenance_requests(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_assignments_user
        FOREIGN KEY (assigned_user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_assignments_assigned_by
        FOREIGN KEY (assigned_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_assignments_revoked_by
        FOREIGN KEY (revoked_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

/*
 * Only one assignment that can currently control the work
 * may exist for a maintenance request at a time.
 */
CREATE UNIQUE INDEX
    uq_maintenance_assignments_active_request
ON maintenance_assignments (maintenance_request_id)
WHERE status IN (
    'pending',
    'accepted',
    'active'
);

CREATE INDEX idx_maintenance_assignments_request
ON maintenance_assignments (
    maintenance_request_id,
    assigned_at DESC
);

CREATE INDEX idx_maintenance_assignments_status
ON maintenance_assignments (
    status,
    assigned_at DESC
);

CREATE INDEX idx_maintenance_assignments_user
ON maintenance_assignments (
    assigned_user_id,
    status
)
WHERE assigned_user_id IS NOT NULL;

CREATE INDEX idx_maintenance_assignments_assigned_by
ON maintenance_assignments (
    assigned_by,
    assigned_at DESC
);

CREATE INDEX idx_maintenance_assignments_vendor
ON maintenance_assignments (
    vendor_name,
    company_name
)
WHERE assignment_type = 'external_vendor';


-- =========================================================
-- MAINTENANCE VISITS
-- A request can require multiple inspections, repairs,
-- follow-ups and completion checks. Assignment is optional
-- only for an owner/admin inspection before work assignment.
-- =========================================================

CREATE TABLE maintenance_visits (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(60) NOT NULL,

    maintenance_request_id BIGINT NOT NULL,

    assignment_id BIGINT,

    visit_type VARCHAR(30) NOT NULL,

    scheduled_start_at TIMESTAMPTZ NOT NULL,

    scheduled_end_at TIMESTAMPTZ NOT NULL,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'scheduled',

    visit_purpose TEXT NOT NULL,

    access_instruction VARCHAR(40),

    tenant_confirmation_status VARCHAR(30)
        NOT NULL
        DEFAULT 'not_required',

    tenant_confirmed_by BIGINT,

    tenant_confirmed_at TIMESTAMPTZ,

    tenant_confirmation_note TEXT,

    arrival_at TIMESTAMPTZ,

    departure_at TIMESTAMPTZ,

    completion_notes TEXT,

    missed_reason VARCHAR(50),

    missed_notes TEXT,

    cancelled_by BIGINT,

    cancelled_at TIMESTAMPTZ,

    cancellation_reason TEXT,

    created_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    -- =====================================================
    -- IDENTIFIER AND ENUM-LIKE VALUES
    -- =====================================================

    CONSTRAINT uq_maintenance_visits_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_maintenance_visits_public_id
        CHECK (
            public_id ~
            '^maintenance_visit_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_visits_type
        CHECK (
            visit_type IN (
                'inspection',
                'repair',
                'follow_up',
                'completion_check',
                'other'
            )
        ),

    CONSTRAINT chk_maintenance_visits_status
        CHECK (
            status IN (
                'scheduled',
                'confirmed',
                'rescheduled',
                'in_progress',
                'completed',
                'missed',
                'cancelled'
            )
        ),

    CONSTRAINT chk_maintenance_visits_access
        CHECK (
            access_instruction IS NULL
            OR access_instruction IN (
                'contact_first',
                'tenant_must_be_present',
                'authorized_entry'
            )
        ),

    CONSTRAINT chk_maintenance_visits_tenant_status
        CHECK (
            tenant_confirmation_status IN (
                'not_required',
                'pending',
                'confirmed',
                'declined',
                'no_response'
            )
        ),

    CONSTRAINT chk_maintenance_visits_missed_reason
        CHECK (
            missed_reason IS NULL
            OR missed_reason IN (
                'tenant_unavailable',
                'technician_unavailable',
                'access_denied',
                'vendor_delay',
                'weather_or_emergency',
                'other'
            )
        ),

    -- =====================================================
    -- GENERAL DATA QUALITY
    -- =====================================================

    CONSTRAINT chk_maintenance_visits_schedule
        CHECK (
            scheduled_end_at > scheduled_start_at
        ),

    CONSTRAINT chk_maintenance_visits_purpose
        CHECK (
            btrim(visit_purpose) <> ''
        ),

    CONSTRAINT chk_maintenance_visits_confirmation
        CHECK (
            (
                tenant_confirmation_status IN (
                    'confirmed',
                    'declined'
                )
                AND tenant_confirmed_by IS NOT NULL
                AND tenant_confirmed_at IS NOT NULL
            )
            OR
            (
                tenant_confirmation_status IN (
                    'not_required',
                    'pending',
                    'no_response'
                )
                AND tenant_confirmed_by IS NULL
                AND tenant_confirmed_at IS NULL
            )
        ),

    CONSTRAINT chk_maintenance_visits_decline_note
        CHECK (
            tenant_confirmation_status <> 'declined'
            OR (
                tenant_confirmation_note IS NOT NULL
                AND btrim(tenant_confirmation_note) <> ''
            )
        ),

    -- =====================================================
    -- VISIT STATUS AUDIT REQUIREMENTS
    -- =====================================================

    CONSTRAINT chk_maintenance_visits_progress
        CHECK (
            status NOT IN ('in_progress', 'completed')
            OR arrival_at IS NOT NULL
        ),

    CONSTRAINT chk_maintenance_visits_completion
        CHECK (
            (
                status = 'completed'
                AND completion_notes IS NOT NULL
                AND btrim(completion_notes) <> ''
                AND cancelled_by IS NULL
                AND cancelled_at IS NULL
                AND cancellation_reason IS NULL
                AND missed_reason IS NULL
                AND missed_notes IS NULL
            )
            OR
            (
                status <> 'completed'
                AND completion_notes IS NULL
            )
        ),

    CONSTRAINT chk_maintenance_visits_missed
        CHECK (
            (
                status = 'missed'
                AND missed_reason IS NOT NULL
                AND cancelled_by IS NULL
                AND cancelled_at IS NULL
                AND cancellation_reason IS NULL
                AND arrival_at IS NULL
                AND departure_at IS NULL
                AND completion_notes IS NULL
            )
            OR
            (
                status <> 'missed'
                AND missed_reason IS NULL
                AND missed_notes IS NULL
            )
        ),

    CONSTRAINT chk_maintenance_visits_cancellation
        CHECK (
            (
                status = 'cancelled'
                AND cancelled_by IS NOT NULL
                AND cancelled_at IS NOT NULL
                AND cancellation_reason IS NOT NULL
                AND btrim(cancellation_reason) <> ''
                AND missed_reason IS NULL
                AND missed_notes IS NULL
                AND completion_notes IS NULL
            )
            OR
            (
                status <> 'cancelled'
                AND cancelled_by IS NULL
                AND cancelled_at IS NULL
                AND cancellation_reason IS NULL
            )
        ),

    -- =====================================================
    -- CHRONOLOGY
    -- =====================================================

    CONSTRAINT chk_maintenance_visits_arrival_time
        CHECK (
            arrival_at IS NULL
            OR arrival_at >= scheduled_start_at
        ),

    CONSTRAINT chk_maintenance_visits_departure_time
        CHECK (
            departure_at IS NULL
            OR (
                arrival_at IS NOT NULL
                AND departure_at >= arrival_at
            )
        ),

    CONSTRAINT chk_maintenance_visits_cancelled_time
        CHECK (
            cancelled_at IS NULL
            OR cancelled_at >= created_at
        ),

    CONSTRAINT chk_maintenance_visits_confirmed_time
        CHECK (
            tenant_confirmed_at IS NULL
            OR tenant_confirmed_at >= created_at
        ),

    CONSTRAINT chk_maintenance_visits_updated_time
        CHECK (
            updated_at >= created_at
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_maintenance_visits_request
        FOREIGN KEY (maintenance_request_id)
        REFERENCES maintenance_requests(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_visits_assignment
        FOREIGN KEY (assignment_id)
        REFERENCES maintenance_assignments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_visits_tenant_user
        FOREIGN KEY (tenant_confirmed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_visits_cancelled_by
        FOREIGN KEY (cancelled_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_visits_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_maintenance_visits_request
ON maintenance_visits (
    maintenance_request_id,
    scheduled_start_at DESC
);

CREATE INDEX idx_maintenance_visits_assignment
ON maintenance_visits (
    assignment_id,
    scheduled_start_at DESC
)
WHERE assignment_id IS NOT NULL;

CREATE INDEX idx_maintenance_visits_status
ON maintenance_visits (
    status,
    scheduled_start_at
);

CREATE INDEX idx_maintenance_visits_upcoming
ON maintenance_visits (
    scheduled_start_at,
    maintenance_request_id
)
WHERE status IN (
    'scheduled',
    'confirmed',
    'rescheduled'
);

CREATE INDEX idx_maintenance_visits_active
ON maintenance_visits (
    maintenance_request_id,
    status
)
WHERE status IN (
    'scheduled',
    'confirmed',
    'rescheduled',
    'in_progress'
);

CREATE INDEX idx_maintenance_visits_tenant_confirmation
ON maintenance_visits (
    tenant_confirmation_status,
    scheduled_start_at
)
WHERE tenant_confirmation_status IN (
    'pending',
    'declined',
    'no_response'
);

CREATE INDEX idx_maintenance_visits_created_by
ON maintenance_visits (
    created_by,
    created_at DESC
);


-- =========================================================
-- MAINTENANCE VISIT HISTORY
-- Append-only lifecycle and rescheduling history. Final
-- immutability and hard-delete protection are added by the
-- maintenance integrity migration.
-- =========================================================

CREATE TABLE maintenance_visit_history (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(60) NOT NULL,

    maintenance_visit_id BIGINT NOT NULL,

    old_status VARCHAR(20),

    new_status VARCHAR(20) NOT NULL,

    old_schedule_start_at TIMESTAMPTZ,

    old_schedule_end_at TIMESTAMPTZ,

    new_schedule_start_at TIMESTAMPTZ NOT NULL,

    new_schedule_end_at TIMESTAMPTZ NOT NULL,

    reason TEXT,

    changed_by BIGINT NOT NULL,

    changed_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::JSONB,

    CONSTRAINT uq_maintenance_visit_history_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_maintenance_visit_history_public_id
        CHECK (
            public_id ~
            '^maintenance_visit_history_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_visit_history_old_status
        CHECK (
            old_status IS NULL
            OR old_status IN (
                'scheduled',
                'confirmed',
                'rescheduled',
                'in_progress',
                'completed',
                'missed',
                'cancelled'
            )
        ),

    CONSTRAINT chk_maintenance_visit_history_new_status
        CHECK (
            new_status IN (
                'scheduled',
                'confirmed',
                'rescheduled',
                'in_progress',
                'completed',
                'missed',
                'cancelled'
            )
        ),

    CONSTRAINT chk_maintenance_visit_history_old_schedule
        CHECK (
            (
                old_schedule_start_at IS NULL
                AND old_schedule_end_at IS NULL
            )
            OR
            (
                old_schedule_start_at IS NOT NULL
                AND old_schedule_end_at IS NOT NULL
                AND old_schedule_end_at
                    > old_schedule_start_at
            )
        ),

    CONSTRAINT chk_maintenance_visit_history_new_schedule
        CHECK (
            new_schedule_end_at
                > new_schedule_start_at
        ),

    CONSTRAINT chk_maintenance_visit_history_reason
        CHECK (
            new_status <> 'rescheduled'
            OR (
                reason IS NOT NULL
                AND btrim(reason) <> ''
            )
        ),

    CONSTRAINT chk_maintenance_visit_history_metadata
        CHECK (
            jsonb_typeof(metadata) = 'object'
        ),

    CONSTRAINT fk_maintenance_visit_history_visit
        FOREIGN KEY (maintenance_visit_id)
        REFERENCES maintenance_visits(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_visit_history_changed_by
        FOREIGN KEY (changed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_maintenance_visit_history_visit
ON maintenance_visit_history (
    maintenance_visit_id,
    changed_at DESC
);

CREATE INDEX idx_maintenance_visit_history_status
ON maintenance_visit_history (
    new_status,
    changed_at DESC
);

CREATE INDEX idx_maintenance_visit_history_changed_by
ON maintenance_visit_history (
    changed_by,
    changed_at DESC
);


-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON TABLE maintenance_assignments IS
'Permanent assignment history for internal technicians and external vendors.';

COMMENT ON COLUMN maintenance_assignments.assignment_type IS
'Assignment target type: internal_technician or external_vendor.';

COMMENT ON COLUMN maintenance_assignments.status IS
'Assignment lifecycle status: pending, accepted, declined, active, completed or revoked.';

COMMENT ON TABLE maintenance_visits IS
'Scheduled inspections, repairs, follow-ups and completion checks for maintenance requests.';

COMMENT ON COLUMN maintenance_visits.assignment_id IS
'Optional only for owner/admin inspection before an assignment exists.';

COMMENT ON COLUMN maintenance_visits.tenant_confirmation_status IS
'Tenant scheduling response: not_required, pending, confirmed, declined or no_response.';

COMMENT ON TABLE maintenance_visit_history IS
'Append-only status and schedule history for maintenance visits.';

COMMIT;
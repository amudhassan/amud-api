BEGIN;

-- =========================================================
-- PREVENTIVE MAINTENANCE PLANS
-- Defines one-time and recurring maintenance schedules for
-- units and property common areas. Plans remain permanent
-- operational and audit records after pause, completion or
-- cancellation.
-- =========================================================

CREATE TABLE preventive_maintenance_plans (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(50) NOT NULL,

    owner_id BIGINT NOT NULL,

    property_id BIGINT NOT NULL,

    unit_id BIGINT,

    request_scope VARCHAR(30) NOT NULL,

    title VARCHAR(255) NOT NULL,

    description TEXT NOT NULL,

    category VARCHAR(50) NOT NULL,

    priority VARCHAR(20)
        NOT NULL
        DEFAULT 'medium',

    impact_level VARCHAR(40)
        NOT NULL
        DEFAULT 'no_operational_impact',

    location_details VARCHAR(500),

    access_instruction VARCHAR(40),

    frequency VARCHAR(30) NOT NULL,

    interval_value INTEGER
        NOT NULL
        DEFAULT 1,

    custom_interval_days INTEGER,

    next_due_at TIMESTAMPTZ NOT NULL,

    last_generated_at TIMESTAMPTZ,

    last_completed_at TIMESTAMPTZ,

    missed_occurrence_count INTEGER
        NOT NULL
        DEFAULT 0,

    default_assignment_type VARCHAR(30),

    assigned_user_id BIGINT,

    vendor_name VARCHAR(255),

    company_name VARCHAR(255),

    contact_person VARCHAR(255),

    phone_number VARCHAR(50),

    email VARCHAR(255),

    service_description VARCHAR(1000),

    estimated_cost NUMERIC(14, 2)
        NOT NULL
        DEFAULT 0,

    currency_code VARCHAR(3)
        NOT NULL
        DEFAULT 'TZS',

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'active',

    pause_reason TEXT,

    paused_at TIMESTAMPTZ,

    paused_by BIGINT,

    cancelled_at TIMESTAMPTZ,

    cancelled_by BIGINT,

    cancellation_reason TEXT,

    created_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    -- =====================================================
    -- IDENTIFIERS
    -- =====================================================

    CONSTRAINT uq_preventive_maintenance_plans_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_preventive_plans_public_id
        CHECK (
            public_id ~
            '^preventive_plan_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_preventive_plans_public_id_length
        CHECK (
            char_length(public_id)
                BETWEEN 18 AND 50
        ),

    -- =====================================================
    -- SCOPE AND REQUEST TEMPLATE
    -- =====================================================

    CONSTRAINT chk_preventive_plans_scope
        CHECK (
            request_scope IN (
                'unit',
                'property_common_area'
            )
        ),

    CONSTRAINT chk_preventive_plans_scope_relationships
        CHECK (
            (
                request_scope = 'unit'
                AND unit_id IS NOT NULL
            )
            OR
            (
                request_scope = 'property_common_area'
                AND unit_id IS NULL
                AND location_details IS NOT NULL
                AND btrim(location_details) <> ''
            )
        ),

    CONSTRAINT chk_preventive_plans_title
        CHECK (
            char_length(btrim(title))
                BETWEEN 3 AND 255
        ),

    CONSTRAINT chk_preventive_plans_description
        CHECK (
            char_length(btrim(description))
                BETWEEN 10 AND 5000
        ),

    CONSTRAINT chk_preventive_plans_location_details
        CHECK (
            location_details IS NULL
            OR btrim(location_details) <> ''
        ),

    CONSTRAINT chk_preventive_plans_category
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

    CONSTRAINT chk_preventive_plans_priority
        CHECK (
            priority IN (
                'low',
                'medium',
                'high',
                'emergency'
            )
        ),

    CONSTRAINT chk_preventive_plans_impact_level
        CHECK (
            impact_level IN (
                'no_operational_impact',
                'partially_restricted',
                'uninhabitable'
            )
        ),

    CONSTRAINT chk_preventive_plans_access_instruction
        CHECK (
            access_instruction IS NULL
            OR access_instruction IN (
                'contact_first',
                'tenant_must_be_present',
                'authorized_entry'
            )
        ),

    -- =====================================================
    -- RECURRENCE
    -- interval_value supports schedules such as every two
    -- weeks or every three months. custom_interval_days is
    -- used only by the custom frequency.
    -- =====================================================

    CONSTRAINT chk_preventive_plans_frequency
        CHECK (
            frequency IN (
                'one_time',
                'weekly',
                'monthly',
                'quarterly',
                'semi_annual',
                'annual',
                'custom'
            )
        ),

    CONSTRAINT chk_preventive_plans_interval_value
        CHECK (
            interval_value > 0
        ),

    CONSTRAINT chk_preventive_plans_custom_interval
        CHECK (
            (
                frequency = 'custom'
                AND custom_interval_days IS NOT NULL
                AND custom_interval_days > 0
            )
            OR
            (
                frequency <> 'custom'
                AND custom_interval_days IS NULL
            )
        ),

    CONSTRAINT chk_preventive_plans_one_time_interval
        CHECK (
            frequency <> 'one_time'
            OR interval_value = 1
        ),

    CONSTRAINT chk_preventive_plans_missed_count
        CHECK (
            missed_occurrence_count >= 0
        ),

    -- =====================================================
    -- DEFAULT ASSIGNMENT
    -- A plan may have no default assignment. Internal and
    -- external assignment details are mutually exclusive.
    -- =====================================================

    CONSTRAINT chk_preventive_plans_assignment_type
        CHECK (
            default_assignment_type IS NULL
            OR default_assignment_type IN (
                'internal_technician',
                'external_vendor'
            )
        ),

    CONSTRAINT chk_preventive_plans_assignment_details
        CHECK (
            (
                default_assignment_type IS NULL
                AND assigned_user_id IS NULL
                AND vendor_name IS NULL
                AND company_name IS NULL
                AND contact_person IS NULL
                AND phone_number IS NULL
                AND email IS NULL
                AND service_description IS NULL
            )
            OR
            (
                default_assignment_type =
                    'internal_technician'
                AND assigned_user_id IS NOT NULL
                AND vendor_name IS NULL
                AND company_name IS NULL
                AND contact_person IS NULL
                AND phone_number IS NULL
                AND email IS NULL
            )
            OR
            (
                default_assignment_type =
                    'external_vendor'
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

    CONSTRAINT chk_preventive_plans_vendor_text
        CHECK (
            (
                vendor_name IS NULL
                OR btrim(vendor_name) <> ''
            )
            AND
            (
                company_name IS NULL
                OR btrim(company_name) <> ''
            )
            AND
            (
                contact_person IS NULL
                OR btrim(contact_person) <> ''
            )
            AND
            (
                phone_number IS NULL
                OR btrim(phone_number) <> ''
            )
            AND
            (
                email IS NULL
                OR btrim(email) <> ''
            )
            AND
            (
                service_description IS NULL
                OR btrim(service_description) <> ''
            )
        ),

    CONSTRAINT chk_preventive_plans_vendor_email
        CHECK (
            email IS NULL
            OR email ~*
                '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
        ),

    -- =====================================================
    -- COST AND STATUS
    -- =====================================================

    CONSTRAINT chk_preventive_plans_estimated_cost
        CHECK (
            estimated_cost >= 0
        ),

    CONSTRAINT chk_preventive_plans_currency
        CHECK (
            currency_code ~ '^[A-Z]{3}$'
        ),

    CONSTRAINT chk_preventive_plans_status
        CHECK (
            status IN (
                'active',
                'paused',
                'completed',
                'cancelled'
            )
        ),

    CONSTRAINT chk_preventive_plans_pause_audit
        CHECK (
            status <> 'paused'
            OR
            (
                paused_at IS NOT NULL
                AND paused_by IS NOT NULL
                AND pause_reason IS NOT NULL
                AND btrim(pause_reason) <> ''
            )
        ),

    CONSTRAINT chk_preventive_plans_cancel_audit
        CHECK (
            (
                status = 'cancelled'
                AND cancelled_at IS NOT NULL
                AND cancelled_by IS NOT NULL
                AND cancellation_reason IS NOT NULL
                AND btrim(cancellation_reason) <> ''
            )
            OR
            (
                status <> 'cancelled'
                AND cancelled_at IS NULL
                AND cancelled_by IS NULL
                AND cancellation_reason IS NULL
            )
        ),

    CONSTRAINT chk_preventive_plans_pause_fields
        CHECK (
            (
                paused_at IS NULL
                AND paused_by IS NULL
                AND pause_reason IS NULL
            )
            OR
            (
                paused_at IS NOT NULL
                AND paused_by IS NOT NULL
                AND pause_reason IS NOT NULL
                AND btrim(pause_reason) <> ''
            )
        ),

    -- =====================================================
    -- TIME CONSISTENCY
    -- =====================================================

    CONSTRAINT chk_preventive_plans_schedule_times
        CHECK (
            next_due_at >= created_at
            AND
            (
                last_generated_at IS NULL
                OR last_generated_at >= created_at
            )
            AND
            (
                last_completed_at IS NULL
                OR last_completed_at >= created_at
            )
        ),

    CONSTRAINT chk_preventive_plans_status_times
        CHECK (
            updated_at >= created_at
            AND
            (
                paused_at IS NULL
                OR paused_at >= created_at
            )
            AND
            (
                cancelled_at IS NULL
                OR cancelled_at >= created_at
            )
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_preventive_plans_owner
        FOREIGN KEY (owner_id)
        REFERENCES owners(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_preventive_plans_property
        FOREIGN KEY (property_id)
        REFERENCES properties(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_preventive_plans_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_preventive_plans_assigned_user
        FOREIGN KEY (assigned_user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_preventive_plans_paused_by
        FOREIGN KEY (paused_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_preventive_plans_cancelled_by
        FOREIGN KEY (cancelled_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_preventive_plans_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- PREVENTIVE PLAN QUERY INDEXES
-- =========================================================

CREATE INDEX idx_preventive_plans_owner
ON preventive_maintenance_plans (owner_id);

CREATE INDEX idx_preventive_plans_property
ON preventive_maintenance_plans (property_id);

CREATE INDEX idx_preventive_plans_unit
ON preventive_maintenance_plans (unit_id)
WHERE unit_id IS NOT NULL;

CREATE INDEX idx_preventive_plans_scope
ON preventive_maintenance_plans (request_scope);

CREATE INDEX idx_preventive_plans_category
ON preventive_maintenance_plans (category);

CREATE INDEX idx_preventive_plans_priority
ON preventive_maintenance_plans (priority);

CREATE INDEX idx_preventive_plans_status
ON preventive_maintenance_plans (status);

CREATE INDEX idx_preventive_plans_owner_status
ON preventive_maintenance_plans (
    owner_id,
    status
);

CREATE INDEX idx_preventive_plans_property_status
ON preventive_maintenance_plans (
    property_id,
    status
);

CREATE INDEX idx_preventive_plans_next_due
ON preventive_maintenance_plans (next_due_at)
WHERE status = 'active';

CREATE INDEX idx_preventive_plans_owner_due
ON preventive_maintenance_plans (
    owner_id,
    next_due_at
)
WHERE status = 'active';

CREATE INDEX idx_preventive_plans_assigned_user
ON preventive_maintenance_plans (assigned_user_id)
WHERE assigned_user_id IS NOT NULL;

CREATE INDEX idx_preventive_plans_created_by
ON preventive_maintenance_plans (created_by);

CREATE INDEX idx_preventive_plans_created_at
ON preventive_maintenance_plans (
    created_at DESC
);


-- =========================================================
-- PREVENTIVE MAINTENANCE OCCURRENCES
-- One immutable scheduling occurrence per plan and due time.
-- The unique plan/due key provides generation idempotency.
-- =========================================================

CREATE TABLE preventive_maintenance_occurrences (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(50) NOT NULL,

    preventive_plan_id BIGINT NOT NULL,

    due_at TIMESTAMPTZ NOT NULL,

    maintenance_request_id BIGINT,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'pending',

    generation_attempted_at TIMESTAMPTZ,

    generated_at TIMESTAMPTZ,

    failure_reason TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    -- =====================================================
    -- IDENTIFIERS AND IDEMPOTENCY
    -- =====================================================

    CONSTRAINT uq_preventive_occurrences_public_id
        UNIQUE (public_id),

    CONSTRAINT uq_preventive_occurrences_plan_due
        UNIQUE (
            preventive_plan_id,
            due_at
        ),

    CONSTRAINT chk_preventive_occurrences_public_id
        CHECK (
            public_id ~
            '^preventive_occurrence_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_preventive_occurrences_public_id_length
        CHECK (
            char_length(public_id)
                BETWEEN 24 AND 50
        ),

    -- =====================================================
    -- STATUS AND RESULT CONSISTENCY
    -- =====================================================

    CONSTRAINT chk_preventive_occurrences_status
        CHECK (
            status IN (
                'pending',
                'generated',
                'skipped',
                'failed',
                'cancelled'
            )
        ),

    CONSTRAINT chk_preventive_occurrences_result
        CHECK (
            (
                status = 'pending'
                AND maintenance_request_id IS NULL
                AND generated_at IS NULL
                AND failure_reason IS NULL
            )
            OR
            (
                status = 'generated'
                AND maintenance_request_id IS NOT NULL
                AND generation_attempted_at IS NOT NULL
                AND generated_at IS NOT NULL
                AND failure_reason IS NULL
            )
            OR
            (
                status IN (
                    'skipped',
                    'cancelled'
                )
                AND maintenance_request_id IS NULL
                AND generated_at IS NULL
                AND failure_reason IS NOT NULL
                AND btrim(failure_reason) <> ''
            )
            OR
            (
                status = 'failed'
                AND maintenance_request_id IS NULL
                AND generation_attempted_at IS NOT NULL
                AND generated_at IS NULL
                AND failure_reason IS NOT NULL
                AND btrim(failure_reason) <> ''
            )
        ),

    CONSTRAINT chk_preventive_occurrences_times
        CHECK (
            updated_at >= created_at
            AND
            (
                generation_attempted_at IS NULL
                OR generation_attempted_at >= created_at
            )
            AND
            (
                generated_at IS NULL
                OR generated_at >= generation_attempted_at
            )
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_preventive_occurrences_plan
        FOREIGN KEY (preventive_plan_id)
        REFERENCES preventive_maintenance_plans(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_preventive_occurrences_request
        FOREIGN KEY (maintenance_request_id)
        REFERENCES maintenance_requests(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- PREVENTIVE OCCURRENCE QUERY INDEXES
-- =========================================================

CREATE UNIQUE INDEX uq_preventive_occurrences_request
ON preventive_maintenance_occurrences (
    maintenance_request_id
)
WHERE maintenance_request_id IS NOT NULL;

CREATE INDEX idx_preventive_occurrences_plan
ON preventive_maintenance_occurrences (
    preventive_plan_id
);

CREATE INDEX idx_preventive_occurrences_due
ON preventive_maintenance_occurrences (due_at);

CREATE INDEX idx_preventive_occurrences_status
ON preventive_maintenance_occurrences (status);

CREATE INDEX idx_preventive_occurrences_plan_status
ON preventive_maintenance_occurrences (
    preventive_plan_id,
    status
);

CREATE INDEX idx_preventive_occurrences_pending_due
ON preventive_maintenance_occurrences (due_at)
WHERE status = 'pending';

CREATE INDEX idx_preventive_occurrences_failed
ON preventive_maintenance_occurrences (
    generation_attempted_at DESC
)
WHERE status = 'failed';

CREATE INDEX idx_preventive_occurrences_created_at
ON preventive_maintenance_occurrences (
    created_at DESC
);


-- =========================================================
-- CONNECT PREVENTIVE PLANS TO GENERATED MAINTENANCE REQUESTS
-- The maintenance_requests column was created in migration
-- 022. The foreign key is added now because the parent plan
-- table did not exist at that time.
-- =========================================================

ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_preventive_plan
    FOREIGN KEY (preventive_plan_id)
    REFERENCES preventive_maintenance_plans(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;


-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON TABLE preventive_maintenance_plans IS
'Permanent one-time and recurring preventive-maintenance schedule definitions for unit and property common-area work.';

COMMENT ON COLUMN preventive_maintenance_plans.public_id IS
'Public preventive-plan identifier generated by the application.';

COMMENT ON COLUMN preventive_maintenance_plans.request_scope IS
'Determines whether generated requests apply to a unit or a property common area.';

COMMENT ON COLUMN preventive_maintenance_plans.frequency IS
'Base recurrence unit. interval_value supports every-N schedules and custom_interval_days supports custom day intervals.';

COMMENT ON COLUMN preventive_maintenance_plans.next_due_at IS
'Next due time used by the preventive-maintenance scheduler.';

COMMENT ON COLUMN preventive_maintenance_plans.default_assignment_type IS
'Optional assignment template copied to generated maintenance work.';

COMMENT ON TABLE preventive_maintenance_occurrences IS
'Idempotent occurrence ledger for each preventive plan and scheduled due time.';

COMMENT ON COLUMN preventive_maintenance_occurrences.due_at IS
'Scheduled due time that forms the occurrence idempotency key with preventive_plan_id.';

COMMENT ON COLUMN preventive_maintenance_occurrences.maintenance_request_id IS
'Maintenance request generated for this occurrence when status is generated.';

COMMENT ON COLUMN preventive_maintenance_occurrences.failure_reason IS
'Required explanation for failed, skipped or cancelled occurrence generation.';

COMMENT ON CONSTRAINT uq_preventive_occurrences_plan_due
ON preventive_maintenance_occurrences IS
'Prevents the scheduler from generating more than one occurrence for the same plan and due time.';

COMMIT;
BEGIN;

-- =========================================================
-- MAINTENANCE COSTS
-- Stores estimated, approved and incurred maintenance costs.
-- Historical financial records remain available for audit.
-- =========================================================

CREATE TABLE maintenance_costs (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(60) NOT NULL,

    maintenance_request_id BIGINT NOT NULL,

    assignment_id BIGINT,

    cost_type VARCHAR(30) NOT NULL,

    description TEXT NOT NULL,

    quantity NUMERIC(12, 3)
        NOT NULL
        DEFAULT 1,

    unit_cost NUMERIC(14, 2)
        NOT NULL,

    estimated_amount NUMERIC(14, 2) NOT NULL,

    approved_amount NUMERIC(14, 2),

    actual_amount NUMERIC(14, 2),

    currency_code VARCHAR(3)
        NOT NULL
        DEFAULT 'TZS',

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'draft',

    vendor_reference VARCHAR(255),

    quotation_reference VARCHAR(255),

    incurred_at TIMESTAMPTZ,

    recorded_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    -- =====================================================
    -- IDENTIFIER AND ENUM-LIKE VALUES
    -- =====================================================

    CONSTRAINT uq_maintenance_costs_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_maintenance_costs_public_id
        CHECK (
            public_id ~
            '^maintenance_cost_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_costs_type
        CHECK (
            cost_type IN (
                'labour',
                'materials',
                'transport',
                'inspection',
                'replacement',
                'service_fee',
                'other'
            )
        ),

    CONSTRAINT chk_maintenance_costs_status
        CHECK (
            status IN (
                'draft',
                'submitted',
                'approved',
                'rejected',
                'cancelled',
                'incurred'
            )
        ),

    -- =====================================================
    -- CONTENT AND AMOUNT INTEGRITY
    -- =====================================================

    CONSTRAINT chk_maintenance_costs_description
        CHECK (
            btrim(description) <> ''
        ),

    CONSTRAINT chk_maintenance_costs_quantity
        CHECK (
            quantity > 0
        ),

    CONSTRAINT chk_maintenance_costs_unit_cost
        CHECK (
            unit_cost > 0
        ),

    CONSTRAINT chk_maintenance_costs_estimated_amount
        CHECK (
            estimated_amount > 0
            AND estimated_amount =
                round(quantity * unit_cost, 2)
        ),

    CONSTRAINT chk_maintenance_costs_approved_amount
        CHECK (
            approved_amount IS NULL
            OR approved_amount > 0
        ),

    CONSTRAINT chk_maintenance_costs_actual_amount
        CHECK (
            actual_amount IS NULL
            OR actual_amount > 0
        ),

    CONSTRAINT chk_maintenance_costs_currency
        CHECK (
            currency_code ~ '^[A-Z]{3}$'
        ),

    CONSTRAINT chk_maintenance_costs_vendor_reference
        CHECK (
            vendor_reference IS NULL
            OR btrim(vendor_reference) <> ''
        ),

    CONSTRAINT chk_maintenance_costs_quotation_reference
        CHECK (
            quotation_reference IS NULL
            OR btrim(quotation_reference) <> ''
        ),

    -- =====================================================
    -- STATUS-SPECIFIC FINANCIAL STATE
    -- =====================================================

    CONSTRAINT chk_maintenance_costs_financial_state
        CHECK (
            (
                status IN (
                    'draft',
                    'submitted',
                    'rejected'
                )
                AND approved_amount IS NULL
                AND actual_amount IS NULL
                AND incurred_at IS NULL
            )
            OR
            (
                status = 'approved'
                AND approved_amount IS NOT NULL
                AND actual_amount IS NULL
                AND incurred_at IS NULL
            )
            OR
            (
                status = 'cancelled'
                AND actual_amount IS NULL
                AND incurred_at IS NULL
            )
            OR
            (
                status = 'incurred'
                AND approved_amount IS NOT NULL
                AND actual_amount IS NOT NULL
                AND incurred_at IS NOT NULL
            )
        ),

    CONSTRAINT chk_maintenance_costs_timestamps
        CHECK (
            updated_at >= created_at
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_maintenance_costs_request
        FOREIGN KEY (maintenance_request_id)
        REFERENCES maintenance_requests(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_costs_assignment
        FOREIGN KEY (assignment_id)
        REFERENCES maintenance_assignments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_costs_recorded_by
        FOREIGN KEY (recorded_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_maintenance_costs_request
ON maintenance_costs (
    maintenance_request_id,
    created_at DESC
);

CREATE INDEX idx_maintenance_costs_request_status
ON maintenance_costs (
    maintenance_request_id,
    status
);

CREATE INDEX idx_maintenance_costs_assignment
ON maintenance_costs (
    assignment_id,
    created_at DESC
)
WHERE assignment_id IS NOT NULL;

CREATE INDEX idx_maintenance_costs_type
ON maintenance_costs (
    cost_type,
    status
);

CREATE INDEX idx_maintenance_costs_incurred_at
ON maintenance_costs (
    incurred_at DESC
)
WHERE status = 'incurred';

CREATE INDEX idx_maintenance_costs_recorded_by
ON maintenance_costs (
    recorded_by,
    created_at DESC
);


-- =========================================================
-- MAINTENANCE COST APPROVALS
-- Stores every initial, additional and correction approval.
-- One cost can have many historical approval decisions, but
-- only one pending approval at a time.
-- =========================================================

CREATE TABLE maintenance_cost_approvals (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(70) NOT NULL,

    maintenance_cost_id BIGINT NOT NULL,

    approval_type VARCHAR(20) NOT NULL,

    submitted_amount NUMERIC(14, 2) NOT NULL,

    decision VARCHAR(20)
        NOT NULL
        DEFAULT 'pending',

    submission_note TEXT,

    submitted_by BIGINT NOT NULL,

    submitted_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    decided_by BIGINT,

    decided_at TIMESTAMPTZ,

    decision_note TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    -- =====================================================
    -- IDENTIFIER AND ENUM-LIKE VALUES
    -- =====================================================

    CONSTRAINT uq_maintenance_cost_approvals_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_maintenance_cost_approvals_public_id
        CHECK (
            public_id ~
            '^maintenance_cost_approval_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_cost_approvals_type
        CHECK (
            approval_type IN (
                'initial',
                'additional',
                'correction'
            )
        ),

    CONSTRAINT chk_maintenance_cost_approvals_decision
        CHECK (
            decision IN (
                'pending',
                'approved',
                'rejected',
                'cancelled'
            )
        ),

    -- =====================================================
    -- DECISION AND AUDIT INTEGRITY
    -- =====================================================

    CONSTRAINT chk_maintenance_cost_approvals_amount
        CHECK (
            submitted_amount > 0
        ),

    CONSTRAINT chk_maintenance_cost_approvals_submission_note
        CHECK (
            submission_note IS NULL
            OR btrim(submission_note) <> ''
        ),

    CONSTRAINT chk_maintenance_cost_approvals_decision_state
        CHECK (
            (
                decision = 'pending'
                AND decided_by IS NULL
                AND decided_at IS NULL
                AND decision_note IS NULL
            )
            OR
            (
                decision IN (
                    'approved',
                    'rejected',
                    'cancelled'
                )
                AND decided_by IS NOT NULL
                AND decided_at IS NOT NULL
                AND decision_note IS NOT NULL
                AND btrim(decision_note) <> ''
            )
        ),

    CONSTRAINT chk_maintenance_cost_approvals_timestamps
        CHECK (
            submitted_at >= created_at
            AND (
                decided_at IS NULL
                OR decided_at >= submitted_at
            )
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_maintenance_cost_approvals_cost
        FOREIGN KEY (maintenance_cost_id)
        REFERENCES maintenance_costs(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_cost_approvals_submitted_by
        FOREIGN KEY (submitted_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_cost_approvals_decided_by
        FOREIGN KEY (decided_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX
    uq_maintenance_cost_approvals_pending
ON maintenance_cost_approvals (maintenance_cost_id)
WHERE decision = 'pending';

CREATE INDEX idx_maintenance_cost_approvals_cost
ON maintenance_cost_approvals (
    maintenance_cost_id,
    submitted_at DESC
);

CREATE INDEX idx_maintenance_cost_approvals_decision
ON maintenance_cost_approvals (
    decision,
    submitted_at
);

CREATE INDEX idx_maintenance_cost_approvals_submitted_by
ON maintenance_cost_approvals (
    submitted_by,
    submitted_at DESC
);

CREATE INDEX idx_maintenance_cost_approvals_decided_by
ON maintenance_cost_approvals (
    decided_by,
    decided_at DESC
)
WHERE decided_by IS NOT NULL;


-- =========================================================
-- MAINTENANCE RESPONSIBILITIES
-- One current responsibility and coverage record per request.
-- Detailed allocations are stored separately below.
-- =========================================================

CREATE TABLE maintenance_responsibilities (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(70) NOT NULL,

    maintenance_request_id BIGINT NOT NULL,

    coverage_type VARCHAR(40)
        NOT NULL
        DEFAULT 'under_investigation',

    provider_name VARCHAR(255),

    contract_or_policy_reference VARCHAR(255),

    coverage_start_date DATE,

    coverage_end_date DATE,

    claim_reference VARCHAR(255),

    coverage_notes TEXT,

    responsibility_status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending_review',

    determined_by BIGINT,

    determined_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    -- =====================================================
    -- IDENTIFIER AND ENUM-LIKE VALUES
    -- =====================================================

    CONSTRAINT uq_maintenance_responsibilities_public_id
        UNIQUE (public_id),

    CONSTRAINT uq_maintenance_responsibilities_request
        UNIQUE (maintenance_request_id),

    CONSTRAINT chk_maintenance_responsibilities_public_id
        CHECK (
            public_id ~
            '^maintenance_responsibility_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_responsibilities_coverage
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

    CONSTRAINT chk_maintenance_responsibilities_status
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

    -- =====================================================
    -- COVERAGE AND DETERMINATION INTEGRITY
    -- =====================================================

    CONSTRAINT chk_maintenance_responsibilities_provider
        CHECK (
            (
                coverage_type IN (
                    'manufacturer_warranty',
                    'vendor_warranty',
                    'service_contract',
                    'insurance'
                )
                AND provider_name IS NOT NULL
                AND btrim(provider_name) <> ''
            )
            OR
            coverage_type NOT IN (
                'manufacturer_warranty',
                'vendor_warranty',
                'service_contract',
                'insurance'
            )
        ),

    CONSTRAINT chk_maintenance_responsibilities_reference
        CHECK (
            (
                contract_or_policy_reference IS NULL
                OR btrim(contract_or_policy_reference) <> ''
            )
            AND (
                claim_reference IS NULL
                OR btrim(claim_reference) <> ''
            )
        ),

    CONSTRAINT chk_maintenance_responsibilities_dates
        CHECK (
            coverage_end_date IS NULL
            OR coverage_start_date IS NULL
            OR coverage_end_date >= coverage_start_date
        ),

    CONSTRAINT chk_maintenance_responsibilities_determination
        CHECK (
            (
                responsibility_status = 'pending_review'
                AND determined_by IS NULL
                AND determined_at IS NULL
            )
            OR
            (
                responsibility_status <> 'pending_review'
                AND determined_by IS NOT NULL
                AND determined_at IS NOT NULL
            )
        ),

    CONSTRAINT chk_maintenance_responsibilities_timestamps
        CHECK (
            updated_at >= created_at
            AND (
                determined_at IS NULL
                OR determined_at >= created_at
            )
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_maintenance_responsibilities_request
        FOREIGN KEY (maintenance_request_id)
        REFERENCES maintenance_requests(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_responsibilities_determined_by
        FOREIGN KEY (determined_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_maintenance_responsibilities_coverage
ON maintenance_responsibilities (
    coverage_type,
    created_at DESC
);

CREATE INDEX idx_maintenance_responsibilities_status
ON maintenance_responsibilities (
    responsibility_status,
    created_at DESC
);

CREATE INDEX idx_maintenance_responsibilities_determined_by
ON maintenance_responsibilities (
    determined_by,
    determined_at DESC
)
WHERE determined_by IS NOT NULL;


-- =========================================================
-- MAINTENANCE RESPONSIBILITY ALLOCATIONS
-- Allocates approved maintenance liability to the owner,
-- tenant, insurance, warranty or another external party.
-- =========================================================

CREATE TABLE maintenance_responsibility_allocations (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(80) NOT NULL,

    maintenance_responsibility_id BIGINT NOT NULL,

    party_type VARCHAR(30) NOT NULL,

    tenant_id BIGINT,

    provider_name VARCHAR(255),

    allocated_amount NUMERIC(14, 2),

    allocation_percentage NUMERIC(7, 4),

    reason TEXT NOT NULL,

    approved_by BIGINT NOT NULL,

    approved_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    -- =====================================================
    -- IDENTIFIER AND ENUM-LIKE VALUES
    -- =====================================================

    CONSTRAINT uq_maintenance_resp_allocations_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_maintenance_resp_allocations_public_id
        CHECK (
            public_id ~
            '^maintenance_responsibility_allocation_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_resp_allocations_party
        CHECK (
            party_type IN (
                'owner',
                'tenant',
                'insurance',
                'warranty_provider',
                'external_party',
                'other'
            )
        ),

    -- =====================================================
    -- PARTY AND ALLOCATION INTEGRITY
    -- =====================================================

    CONSTRAINT chk_maintenance_resp_allocations_target
        CHECK (
            (
                party_type = 'tenant'
                AND tenant_id IS NOT NULL
                AND provider_name IS NULL
            )
            OR
            (
                party_type = 'owner'
                AND tenant_id IS NULL
                AND provider_name IS NULL
            )
            OR
            (
                party_type IN (
                    'insurance',
                    'warranty_provider',
                    'external_party',
                    'other'
                )
                AND tenant_id IS NULL
                AND provider_name IS NOT NULL
                AND btrim(provider_name) <> ''
            )
        ),

    CONSTRAINT chk_maintenance_resp_allocations_value
        CHECK (
            (
                allocated_amount IS NOT NULL
                AND allocated_amount > 0
                AND allocation_percentage IS NULL
            )
            OR
            (
                allocated_amount IS NULL
                AND allocation_percentage IS NOT NULL
                AND allocation_percentage > 0
                AND allocation_percentage <= 100
            )
        ),

    CONSTRAINT chk_maintenance_resp_allocations_reason
        CHECK (
            btrim(reason) <> ''
        ),

    CONSTRAINT chk_maintenance_resp_allocations_timestamps
        CHECK (
            approved_at >= created_at
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_maintenance_resp_allocations_responsibility
        FOREIGN KEY (maintenance_responsibility_id)
        REFERENCES maintenance_responsibilities(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_resp_allocations_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_resp_allocations_approved_by
        FOREIGN KEY (approved_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_maintenance_resp_allocations_responsibility
ON maintenance_responsibility_allocations (
    maintenance_responsibility_id,
    created_at DESC
);

CREATE INDEX idx_maintenance_resp_allocations_party
ON maintenance_responsibility_allocations (
    party_type,
    created_at DESC
);

CREATE INDEX idx_maintenance_resp_allocations_tenant
ON maintenance_responsibility_allocations (
    tenant_id,
    created_at DESC
)
WHERE tenant_id IS NOT NULL;

CREATE INDEX idx_maintenance_resp_allocations_approved_by
ON maintenance_responsibility_allocations (
    approved_by,
    approved_at DESC
);


-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON TABLE maintenance_costs IS
'Estimated, approved and actual costs associated with a maintenance request.';

COMMENT ON COLUMN maintenance_costs.estimated_amount IS
'Calculated baseline amount from quantity multiplied by unit cost.';

COMMENT ON COLUMN maintenance_costs.approved_amount IS
'Amount approved through the maintenance cost approval workflow.';

COMMENT ON COLUMN maintenance_costs.actual_amount IS
'Final amount incurred after the approved maintenance work is performed.';

COMMENT ON TABLE maintenance_cost_approvals IS
'Append-oriented history of initial, additional and correction cost approvals.';

COMMENT ON COLUMN maintenance_cost_approvals.approval_type IS
'Approval purpose: initial, additional or correction.';

COMMENT ON TABLE maintenance_responsibilities IS
'Current coverage and repair-responsibility determination for one maintenance request.';

COMMENT ON TABLE maintenance_responsibility_allocations IS
'Approved allocation of maintenance liability by amount or percentage.';

COMMENT ON COLUMN maintenance_responsibility_allocations.tenant_id IS
'Required only when the approved allocation party is the tenant.';

COMMIT;
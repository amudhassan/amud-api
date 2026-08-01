BEGIN;

-- =========================================================
-- LEASES TABLE
-- Permanent contractual records between owners and tenants.
-- =========================================================

CREATE TABLE leases (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(50) NOT NULL,

    lease_number VARCHAR(50) NOT NULL,

    owner_id BIGINT NOT NULL,

    property_id BIGINT NOT NULL,

    unit_id BIGINT NOT NULL,

    tenant_id BIGINT NOT NULL,

    renewed_from_lease_id BIGINT,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'draft',

    start_date DATE NOT NULL,

    end_date DATE NOT NULL,

    signed_at TIMESTAMPTZ,

    scheduled_at TIMESTAMPTZ,

    scheduled_by BIGINT,

    activated_at TIMESTAMPTZ,

    activated_by BIGINT,

    expired_at TIMESTAMPTZ,

    /*
     * May remain NULL when expiry is performed
     * automatically by a scheduled system job.
     */
    expired_by BIGINT,

    terminated_at TIMESTAMPTZ,

    terminated_by BIGINT,

    cancelled_at TIMESTAMPTZ,

    cancelled_by BIGINT,

    currency_code CHAR(3)
        NOT NULL
        DEFAULT 'TZS',

    rent_amount NUMERIC(14, 2)
        NOT NULL,

    billing_frequency VARCHAR(30)
        NOT NULL
        DEFAULT 'monthly',

    payment_due_day SMALLINT
        NOT NULL
        DEFAULT 1,

    grace_period_days SMALLINT
        NOT NULL
        DEFAULT 0,

    security_deposit_amount NUMERIC(14, 2)
        NOT NULL
        DEFAULT 0,

    late_fee_type VARCHAR(20)
        NOT NULL
        DEFAULT 'none',

    late_fee_value NUMERIC(14, 2)
        NOT NULL
        DEFAULT 0,

    termination_reason TEXT,

    cancellation_reason TEXT,

    notes TEXT,

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

    CONSTRAINT uq_leases_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_leases_public_id_format
        CHECK (
            public_id ~
                '^lease_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_leases_number_not_empty
        CHECK (
            btrim(lease_number) <> ''
        ),

    -- =====================================================
    -- STATUS AND DATES
    -- =====================================================

    CONSTRAINT chk_leases_status
        CHECK (
            status IN (
                'draft',
                'scheduled',
                'active',
                'expired',
                'terminated',
                'cancelled'
            )
        ),

    CONSTRAINT chk_leases_date_range
        CHECK (
            end_date > start_date
        ),

    CONSTRAINT chk_leases_timestamp_consistency
        CHECK (
            updated_at >= created_at
            AND (
                scheduled_at IS NULL
                OR scheduled_at >= created_at
            )
            AND (
                activated_at IS NULL
                OR activated_at >= created_at
            )
            AND (
                expired_at IS NULL
                OR expired_at >= created_at
            )
            AND (
                terminated_at IS NULL
                OR terminated_at >= created_at
            )
            AND (
                cancelled_at IS NULL
                OR cancelled_at >= created_at
            )
        ),

    /*
     * signed_at is intentionally allowed to be earlier
     * than created_at because an existing signed lease
     * may be entered into the system later.
     */

    -- =====================================================
    -- ACTOR AND TIMESTAMP PAIRS
    -- =====================================================

    CONSTRAINT chk_leases_scheduling_pair
        CHECK (
            (
                scheduled_at IS NULL
                AND scheduled_by IS NULL
            )
            OR
            (
                scheduled_at IS NOT NULL
                AND scheduled_by IS NOT NULL
            )
        ),

    CONSTRAINT chk_leases_activation_pair
        CHECK (
            (
                activated_at IS NULL
                AND activated_by IS NULL
            )
            OR
            (
                activated_at IS NOT NULL
                AND activated_by IS NOT NULL
            )
        ),

    /*
     * expired_by is optional because expiry may
     * be performed automatically.
     */
    CONSTRAINT chk_leases_expiry_actor
        CHECK (
            expired_by IS NULL
            OR expired_at IS NOT NULL
        ),

    CONSTRAINT chk_leases_termination_pair
        CHECK (
            (
                terminated_at IS NULL
                AND terminated_by IS NULL
                AND termination_reason IS NULL
            )
            OR
            (
                terminated_at IS NOT NULL
                AND terminated_by IS NOT NULL
                AND termination_reason IS NOT NULL
                AND btrim(termination_reason) <> ''
            )
        ),

    CONSTRAINT chk_leases_cancellation_pair
        CHECK (
            (
                cancelled_at IS NULL
                AND cancelled_by IS NULL
                AND cancellation_reason IS NULL
            )
            OR
            (
                cancelled_at IS NOT NULL
                AND cancelled_by IS NOT NULL
                AND cancellation_reason IS NOT NULL
                AND btrim(cancellation_reason) <> ''
            )
        ),

    -- =====================================================
    -- FINANCIAL TERMS
    -- =====================================================

    CONSTRAINT chk_leases_currency_code
        CHECK (
            currency_code ~ '^[A-Z]{3}$'
        ),

    CONSTRAINT chk_leases_rent_amount
        CHECK (
            rent_amount > 0
        ),

    CONSTRAINT chk_leases_billing_frequency
        CHECK (
            billing_frequency IN (
                'monthly',
                'quarterly',
                'semi_annual',
                'annual'
            )
        ),

    CONSTRAINT chk_leases_payment_due_day
        CHECK (
            payment_due_day BETWEEN 1 AND 28
        ),

    CONSTRAINT chk_leases_grace_period
        CHECK (
            grace_period_days BETWEEN 0 AND 30
        ),

    CONSTRAINT chk_leases_security_deposit
        CHECK (
            security_deposit_amount >= 0
        ),

    CONSTRAINT chk_leases_late_fee
        CHECK (
            (
                late_fee_type = 'none'
                AND late_fee_value = 0
            )
            OR
            (
                late_fee_type = 'fixed'
                AND late_fee_value >= 0
            )
            OR
            (
                late_fee_type = 'percentage'
                AND late_fee_value >= 0
                AND late_fee_value <= 100
            )
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_leases_owner
        FOREIGN KEY (owner_id)
        REFERENCES owners(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_leases_property
        FOREIGN KEY (property_id)
        REFERENCES properties(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_leases_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_leases_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_leases_renewed_from
        FOREIGN KEY (renewed_from_lease_id)
        REFERENCES leases(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_leases_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_leases_scheduled_by
        FOREIGN KEY (scheduled_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_leases_activated_by
        FOREIGN KEY (activated_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_leases_expired_by
        FOREIGN KEY (expired_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_leases_terminated_by
        FOREIGN KEY (terminated_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_leases_cancelled_by
        FOREIGN KEY (cancelled_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- =========================================================
-- CASE-INSENSITIVE LEASE NUMBER UNIQUENESS
-- =========================================================

CREATE UNIQUE INDEX
    uq_leases_lease_number_ci
ON leases (
    lower(
        btrim(lease_number)
    )
);

-- =========================================================
-- QUERY INDEXES
-- =========================================================

CREATE INDEX idx_leases_owner_id
ON leases (owner_id);

CREATE INDEX idx_leases_property_id
ON leases (property_id);

CREATE INDEX idx_leases_unit_id
ON leases (unit_id);

CREATE INDEX idx_leases_tenant_id
ON leases (tenant_id);

CREATE INDEX idx_leases_status
ON leases (status);

CREATE INDEX idx_leases_start_date
ON leases (start_date);

CREATE INDEX idx_leases_end_date
ON leases (end_date);

CREATE INDEX idx_leases_unit_dates
ON leases (
    unit_id,
    start_date,
    end_date
);

CREATE INDEX idx_leases_owner_status
ON leases (
    owner_id,
    status
);

CREATE INDEX idx_leases_property_status
ON leases (
    property_id,
    status
);

CREATE INDEX idx_leases_tenant_status
ON leases (
    tenant_id,
    status
);

CREATE INDEX idx_leases_created_by
ON leases (created_by);

CREATE INDEX idx_leases_created_at
ON leases (created_at DESC);

CREATE INDEX idx_leases_renewed_from
ON leases (renewed_from_lease_id)
WHERE renewed_from_lease_id IS NOT NULL;

CREATE INDEX idx_leases_binding_unit_dates
ON leases (
    unit_id,
    start_date,
    end_date
)
WHERE status IN (
    'scheduled',
    'active'
);

-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON TABLE leases IS
'Stores permanent legal lease agreements between owners and tenants for specific property units.';

COMMENT ON COLUMN leases.public_id IS
'Public API identifier generated by the application, for example lease_xxxxx.';

COMMENT ON COLUMN leases.lease_number IS
'Human-readable lease reference used on agreements, invoices, receipts and notices.';

COMMENT ON COLUMN leases.owner_id IS
'Legal owner entering the lease. The owner must have a current property_owners relationship with the selected property.';

COMMENT ON COLUMN leases.property_id IS
'Property containing the leased unit.';

COMMENT ON COLUMN leases.unit_id IS
'Specific rentable unit covered by the lease.';

COMMENT ON COLUMN leases.tenant_id IS
'Tenant legal or business profile. An active owner_tenants relationship is required.';

COMMENT ON COLUMN leases.renewed_from_lease_id IS
'Previous historical lease from which this lease was renewed.';

COMMENT ON COLUMN leases.status IS
'Lifecycle status: draft, scheduled, active, expired, terminated or cancelled.';

COMMENT ON COLUMN leases.rent_amount IS
'Contractual rent amount per billing frequency. Actual charges and payments are stored separately.';

COMMENT ON COLUMN leases.security_deposit_amount IS
'Contractual deposit amount. Actual deposit transactions are stored separately.';

COMMIT;
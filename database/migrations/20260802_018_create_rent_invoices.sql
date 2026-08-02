BEGIN;

-- =========================================================
-- RENT INVOICES
-- Stores contractual billing demands generated from leases.
-- Payments will be connected in a separate module.
-- =========================================================

CREATE TABLE rent_invoices (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(50) NOT NULL,

    invoice_number VARCHAR(50) NOT NULL,

    lease_id BIGINT NOT NULL,

    owner_id BIGINT NOT NULL,

    property_id BIGINT NOT NULL,

    unit_id BIGINT NOT NULL,

    tenant_id BIGINT NOT NULL,

    billing_period_start DATE NOT NULL,

    billing_period_end DATE NOT NULL,

    issue_date DATE,

    due_date DATE NOT NULL,

    currency_code VARCHAR(3)
        NOT NULL
        DEFAULT 'TZS',

    subtotal_amount NUMERIC(14, 2)
        NOT NULL
        DEFAULT 0,

    discount_amount NUMERIC(14, 2)
        NOT NULL
        DEFAULT 0,

    tax_amount NUMERIC(14, 2)
        NOT NULL
        DEFAULT 0,

    late_fee_amount NUMERIC(14, 2)
        NOT NULL
        DEFAULT 0,

    /*
     * Calculated from invoice financial components.
     * The application cannot write this field directly.
     */
    total_amount NUMERIC(14, 2)
        GENERATED ALWAYS AS (
            subtotal_amount
            - discount_amount
            + tax_amount
            + late_fee_amount
        ) STORED,

    paid_amount NUMERIC(14, 2)
        NOT NULL
        DEFAULT 0,

    /*
     * Calculated independently because PostgreSQL
     * generated columns cannot depend on another
     * generated column.
     */
    balance_amount NUMERIC(14, 2)
        GENERATED ALWAYS AS (
            subtotal_amount
            - discount_amount
            + tax_amount
            + late_fee_amount
            - paid_amount
        ) STORED,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'draft',

    notes TEXT,

    issued_at TIMESTAMPTZ,

    issued_by BIGINT,

    voided_at TIMESTAMPTZ,

    voided_by BIGINT,

    void_reason TEXT,

    created_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_rent_invoices_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_rent_invoices_public_id
        CHECK (
            public_id ~
            '^invoice_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_rent_invoices_public_id_length
        CHECK (
            char_length(public_id)
                BETWEEN 9 AND 50
        ),

    CONSTRAINT chk_rent_invoices_number_not_blank
        CHECK (
            btrim(invoice_number) <> ''
        ),

    CONSTRAINT chk_rent_invoices_period
        CHECK (
            billing_period_end >=
            billing_period_start
        ),

    CONSTRAINT chk_rent_invoices_currency
        CHECK (
            currency_code ~ '^[A-Z]{3}$'
        ),

    CONSTRAINT chk_rent_invoices_status
        CHECK (
            status IN (
                'draft',
                'issued',
                'partially_paid',
                'paid',
                'overdue',
                'void'
            )
        ),

    CONSTRAINT chk_rent_invoices_amounts
        CHECK (
            subtotal_amount >= 0
            AND discount_amount >= 0
            AND tax_amount >= 0
            AND late_fee_amount >= 0
            AND paid_amount >= 0
        ),

    /*
     * Discount cannot exceed subtotal plus
     * tax and late-fee components.
     */
    CONSTRAINT chk_rent_invoices_total_non_negative
        CHECK (
            (
                subtotal_amount
                - discount_amount
                + tax_amount
                + late_fee_amount
            ) >= 0
        ),

    /*
     * Recorded payments cannot exceed the
     * invoice total.
     */
    CONSTRAINT chk_rent_invoices_balance_non_negative
        CHECK (
            (
                subtotal_amount
                - discount_amount
                + tax_amount
                + late_fee_amount
                - paid_amount
            ) >= 0
        ),

    CONSTRAINT chk_rent_invoices_issue_audit_pair
        CHECK (
            (
                issued_at IS NULL
                AND issued_by IS NULL
            )
            OR
            (
                issued_at IS NOT NULL
                AND issued_by IS NOT NULL
            )
        ),

    CONSTRAINT chk_rent_invoices_void_audit
        CHECK (
            (
                voided_at IS NULL
                AND voided_by IS NULL
                AND void_reason IS NULL
            )
            OR
            (
                voided_at IS NOT NULL
                AND voided_by IS NOT NULL
                AND void_reason IS NOT NULL
                AND btrim(void_reason) <> ''
            )
        ),

    CONSTRAINT chk_rent_invoices_status_audit
        CHECK (
            (
                status = 'draft'
                AND issued_at IS NULL
                AND issued_by IS NULL
                AND voided_at IS NULL
                AND voided_by IS NULL
                AND void_reason IS NULL
            )
            OR
            (
                status IN (
                    'issued',
                    'partially_paid',
                    'paid',
                    'overdue'
                )
                AND issued_at IS NOT NULL
                AND issued_by IS NOT NULL
                AND issue_date IS NOT NULL
                AND voided_at IS NULL
                AND voided_by IS NULL
                AND void_reason IS NULL
            )
            OR
            (
                status = 'void'
                AND voided_at IS NOT NULL
                AND voided_by IS NOT NULL
                AND void_reason IS NOT NULL
                AND btrim(void_reason) <> ''
            )
        ),

    CONSTRAINT chk_rent_invoices_timestamps
        CHECK (
            updated_at >= created_at
            AND (
                issued_at IS NULL
                OR issued_at >= created_at
            )
            AND (
                voided_at IS NULL
                OR voided_at >= created_at
            )
        ),

    CONSTRAINT fk_rent_invoices_lease
        FOREIGN KEY (lease_id)
        REFERENCES leases(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_rent_invoices_owner
        FOREIGN KEY (owner_id)
        REFERENCES owners(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_rent_invoices_property
        FOREIGN KEY (property_id)
        REFERENCES properties(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_rent_invoices_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_rent_invoices_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_rent_invoices_issued_by
        FOREIGN KEY (issued_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_rent_invoices_voided_by
        FOREIGN KEY (voided_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_rent_invoices_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- CASE-INSENSITIVE INVOICE-NUMBER UNIQUENESS
-- =========================================================

CREATE UNIQUE INDEX
    uq_rent_invoices_invoice_number_ci
ON rent_invoices (
    lower(
        btrim(invoice_number)
    )
);


-- =========================================================
-- RENT INVOICE QUERY INDEXES
-- =========================================================

CREATE INDEX idx_rent_invoices_lease
ON rent_invoices (lease_id);


CREATE INDEX idx_rent_invoices_owner
ON rent_invoices (owner_id);


CREATE INDEX idx_rent_invoices_property
ON rent_invoices (property_id);


CREATE INDEX idx_rent_invoices_unit
ON rent_invoices (unit_id);


CREATE INDEX idx_rent_invoices_tenant
ON rent_invoices (tenant_id);


CREATE INDEX idx_rent_invoices_status
ON rent_invoices (status);


CREATE INDEX idx_rent_invoices_due_date
ON rent_invoices (
    due_date
)
WHERE status IN (
    'issued',
    'partially_paid',
    'overdue'
);


CREATE INDEX idx_rent_invoices_billing_period
ON rent_invoices (
    billing_period_start,
    billing_period_end
);


CREATE INDEX idx_rent_invoices_lease_period
ON rent_invoices (
    lease_id,
    billing_period_start,
    billing_period_end
);


CREATE INDEX idx_rent_invoices_created_at
ON rent_invoices (
    created_at DESC
);


-- =========================================================
-- RENT INVOICE ITEMS
-- =========================================================

CREATE TABLE rent_invoice_items (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(50) NOT NULL,

    invoice_id BIGINT NOT NULL,

    item_type VARCHAR(30) NOT NULL,

    description VARCHAR(500) NOT NULL,

    quantity NUMERIC(12, 4)
        NOT NULL
        DEFAULT 1,

    unit_amount NUMERIC(14, 2)
        NOT NULL,

    line_amount NUMERIC(18, 4)
        GENERATED ALWAYS AS (
            quantity * unit_amount
        ) STORED,

    created_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_rent_invoice_items_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_rent_invoice_items_public_id
        CHECK (
            public_id ~
            '^invoice_item_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_rent_invoice_items_public_id_length
        CHECK (
            char_length(public_id)
                BETWEEN 14 AND 50
        ),

    CONSTRAINT chk_rent_invoice_items_type
        CHECK (
            item_type IN (
                'rent',
                'late_fee',
                'utility',
                'service_charge',
                'adjustment',
                'discount',
                'tax',
                'other'
            )
        ),

    CONSTRAINT chk_rent_invoice_items_description
        CHECK (
            btrim(description) <> ''
        ),

    CONSTRAINT chk_rent_invoice_items_quantity
        CHECK (
            quantity > 0
        ),

    CONSTRAINT chk_rent_invoice_items_unit_amount
        CHECK (
            unit_amount >= 0
        ),

    CONSTRAINT chk_rent_invoice_items_timestamps
        CHECK (
            updated_at >= created_at
        ),

    CONSTRAINT fk_rent_invoice_items_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES rent_invoices(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_rent_invoice_items_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- RENT INVOICE ITEM QUERY INDEXES
-- =========================================================

CREATE INDEX idx_rent_invoice_items_invoice
ON rent_invoice_items (invoice_id);


CREATE INDEX idx_rent_invoice_items_type
ON rent_invoice_items (
    item_type
);


CREATE INDEX idx_rent_invoice_items_created_at
ON rent_invoice_items (
    created_at DESC
);


-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON TABLE rent_invoices IS
'Stores rent and lease-related invoices generated from contractual lease terms.';


COMMENT ON COLUMN rent_invoices.status IS
'Invoice lifecycle status: draft, issued, partially_paid, paid, overdue or void.';


COMMENT ON COLUMN rent_invoices.total_amount IS
'Generated invoice total: subtotal minus discount plus tax and late fee.';


COMMENT ON COLUMN rent_invoices.balance_amount IS
'Generated collectible balance: total amount minus paid amount.';


COMMENT ON COLUMN rent_invoices.paid_amount IS
'Amount applied by the Payments Module. Direct invoice APIs must not modify this field.';


COMMENT ON TABLE rent_invoice_items IS
'Stores immutable billing lines and adjustments belonging to rent invoices.';


COMMENT ON COLUMN rent_invoice_items.line_amount IS
'Generated line total calculated as quantity multiplied by unit amount.';


COMMIT;
BEGIN;

-- =========================================================
-- RENT PAYMENTS
-- Stores completed rent payments and their receipt audit.
-- Payments are retained permanently for financial history.
-- =========================================================

CREATE TABLE rent_payments (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(50) NOT NULL,

    payment_number VARCHAR(50) NOT NULL,

    receipt_number VARCHAR(50) NOT NULL,

    owner_id BIGINT NOT NULL,

    tenant_id BIGINT NOT NULL,

    amount NUMERIC(14, 2) NOT NULL,

    currency_code VARCHAR(3)
        NOT NULL
        DEFAULT 'TZS',

    payment_method VARCHAR(30) NOT NULL,

    transaction_reference VARCHAR(150),

    paid_at TIMESTAMPTZ NOT NULL,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'completed',

    notes TEXT,

    created_by BIGINT NOT NULL,

    reversed_at TIMESTAMPTZ,

    reversed_by BIGINT,

    reversal_reason TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_rent_payments_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_rent_payments_public_id
        CHECK (
            public_id ~
            '^payment_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_rent_payments_public_id_length
        CHECK (
            char_length(public_id)
                BETWEEN 9 AND 50
        ),

    CONSTRAINT chk_rent_payments_number_not_blank
        CHECK (
            btrim(payment_number) <> ''
        ),

    CONSTRAINT chk_rent_payments_receipt_not_blank
        CHECK (
            btrim(receipt_number) <> ''
        ),

    CONSTRAINT chk_rent_payments_amount
        CHECK (
            amount > 0
        ),

    CONSTRAINT chk_rent_payments_currency
        CHECK (
            currency_code ~ '^[A-Z]{3}$'
        ),

    CONSTRAINT chk_rent_payments_method
        CHECK (
            payment_method IN (
                'cash',
                'bank_transfer',
                'mobile_money',
                'card',
                'cheque',
                'other'
            )
        ),

    /*
     * Transaction references are mandatory for
     * externally traceable payment methods.
     */
    CONSTRAINT chk_rent_payments_reference
        CHECK (
            (
                payment_method IN (
                    'bank_transfer',
                    'mobile_money',
                    'card',
                    'cheque'
                )
                AND transaction_reference IS NOT NULL
                AND btrim(transaction_reference) <> ''
            )
            OR
            (
                payment_method IN (
                    'cash',
                    'other'
                )
                AND (
                    transaction_reference IS NULL
                    OR btrim(transaction_reference) <> ''
                )
            )
        ),

    CONSTRAINT chk_rent_payments_status
        CHECK (
            status IN (
                'completed',
                'reversed'
            )
        ),

    CONSTRAINT chk_rent_payments_notes_length
        CHECK (
            notes IS NULL
            OR char_length(notes) <= 1000
        ),

    CONSTRAINT chk_rent_payments_reversal_reason_length
        CHECK (
            reversal_reason IS NULL
            OR char_length(reversal_reason) <= 1000
        ),

    /*
     * Completed payments cannot contain reversal audit.
     * Reversed payments must contain a complete audit.
     */
    CONSTRAINT chk_rent_payments_reversal_audit
        CHECK (
            (
                status = 'completed'
                AND reversed_at IS NULL
                AND reversed_by IS NULL
                AND reversal_reason IS NULL
            )
            OR
            (
                status = 'reversed'
                AND reversed_at IS NOT NULL
                AND reversed_by IS NOT NULL
                AND reversal_reason IS NOT NULL
                AND btrim(reversal_reason) <> ''
            )
        ),

    CONSTRAINT chk_rent_payments_timestamps
        CHECK (
            updated_at >= created_at
            AND (
                reversed_at IS NULL
                OR reversed_at >= created_at
            )
        ),

    CONSTRAINT fk_rent_payments_owner
        FOREIGN KEY (owner_id)
        REFERENCES owners(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_rent_payments_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_rent_payments_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_rent_payments_reversed_by
        FOREIGN KEY (reversed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- CASE-INSENSITIVE PAYMENT AND RECEIPT UNIQUENESS
-- =========================================================

CREATE UNIQUE INDEX
    uq_rent_payments_payment_number_ci
ON rent_payments (
    lower(
        btrim(payment_number)
    )
);


CREATE UNIQUE INDEX
    uq_rent_payments_receipt_number_ci
ON rent_payments (
    lower(
        btrim(receipt_number)
    )
);


/*
 * Prevents an externally traceable transaction from
 * being recorded more than once using the same method.
 */
CREATE UNIQUE INDEX
    uq_rent_payments_method_reference_ci
ON rent_payments (
    payment_method,
    lower(
        btrim(transaction_reference)
    )
)
WHERE transaction_reference IS NOT NULL;


-- =========================================================
-- RENT PAYMENT QUERY INDEXES
-- =========================================================

CREATE INDEX idx_rent_payments_owner
ON rent_payments (owner_id);


CREATE INDEX idx_rent_payments_tenant
ON rent_payments (tenant_id);


CREATE INDEX idx_rent_payments_status
ON rent_payments (status);


CREATE INDEX idx_rent_payments_method
ON rent_payments (payment_method);


CREATE INDEX idx_rent_payments_paid_at
ON rent_payments (
    paid_at DESC
);


CREATE INDEX idx_rent_payments_created_at
ON rent_payments (
    created_at DESC
);


CREATE INDEX idx_rent_payments_owner_paid_at
ON rent_payments (
    owner_id,
    paid_at DESC
);


CREATE INDEX idx_rent_payments_tenant_paid_at
ON rent_payments (
    tenant_id,
    paid_at DESC
);


-- =========================================================
-- RENT PAYMENT ALLOCATIONS
-- Connects a payment to one or more rent invoices.
-- The first API version will allocate one payment to one
-- invoice, while the schema safely supports future expansion.
-- =========================================================

CREATE TABLE rent_payment_allocations (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(50) NOT NULL,

    payment_id BIGINT NOT NULL,

    invoice_id BIGINT NOT NULL,

    allocated_amount NUMERIC(14, 2) NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_rent_payment_allocations_public_id
        UNIQUE (public_id),

    CONSTRAINT uq_rent_payment_allocations_payment_invoice
        UNIQUE (
            payment_id,
            invoice_id
        ),

    CONSTRAINT chk_rent_payment_allocations_public_id
        CHECK (
            public_id ~
            '^payment_allocation_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_rent_payment_allocations_public_id_length
        CHECK (
            char_length(public_id)
                BETWEEN 20 AND 50
        ),

    CONSTRAINT chk_rent_payment_allocations_amount
        CHECK (
            allocated_amount > 0
        ),

    CONSTRAINT fk_rent_payment_allocations_payment
        FOREIGN KEY (payment_id)
        REFERENCES rent_payments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_rent_payment_allocations_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES rent_invoices(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- RENT PAYMENT ALLOCATION QUERY INDEXES
-- =========================================================

CREATE INDEX idx_rent_payment_allocations_payment
ON rent_payment_allocations (
    payment_id
);


CREATE INDEX idx_rent_payment_allocations_invoice
ON rent_payment_allocations (
    invoice_id
);


CREATE INDEX idx_rent_payment_allocations_invoice_created
ON rent_payment_allocations (
    invoice_id,
    created_at DESC
);


-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON TABLE rent_payments IS
'Stores completed and reversed rent payments together with receipt and audit information.';


COMMENT ON COLUMN rent_payments.payment_number IS
'Unique internal payment identifier.';


COMMENT ON COLUMN rent_payments.receipt_number IS
'Unique receipt identifier generated for every completed payment.';


COMMENT ON COLUMN rent_payments.status IS
'Payment lifecycle status: completed or reversed.';


COMMENT ON COLUMN rent_payments.transaction_reference IS
'External bank, mobile-money, card or cheque transaction reference.';


COMMENT ON COLUMN rent_payments.amount IS
'Original payment amount. This value remains immutable after creation.';


COMMENT ON TABLE rent_payment_allocations IS
'Allocates rent-payment amounts to rent invoices. Allocation records are retained permanently.';


COMMENT ON COLUMN rent_payment_allocations.allocated_amount IS
'Amount from the associated payment allocated to the associated rent invoice.';


COMMIT;
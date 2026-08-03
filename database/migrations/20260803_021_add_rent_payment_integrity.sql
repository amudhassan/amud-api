BEGIN;

-- =========================================================
-- PAYMENT LIFECYCLE, IMMUTABILITY AND DELETE PROTECTION
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_rent_payment_mutation_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Rent payments cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'completed' THEN
            RAISE EXCEPTION
                'New rent payments must have completed status.'
                USING ERRCODE = 'P0001';
        END IF;

        RETURN NEW;
    END IF;

    IF OLD.status = 'reversed'
       AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION
            'Reversed rent payments are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.payment_number IS DISTINCT FROM OLD.payment_number
       OR NEW.receipt_number IS DISTINCT FROM OLD.receipt_number
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.transaction_reference IS DISTINCT FROM OLD.transaction_reference
       OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Original rent payment and receipt information is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status <> 'completed'
       OR NEW.status <> 'reversed' THEN
        RAISE EXCEPTION
            'A completed rent payment can only transition to reversed.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_rent_payment_mutation_integrity_trigger
BEFORE INSERT OR UPDATE OR DELETE ON rent_payments
FOR EACH ROW
EXECUTE FUNCTION enforce_rent_payment_mutation_integrity();

-- =========================================================
-- PAYMENT ALLOCATION MUTATION PROTECTION
-- Allocations are append-only and permanent.
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_rent_payment_allocation_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_payment rent_payments%ROWTYPE;
    v_invoice rent_invoices%ROWTYPE;
    v_existing_allocation NUMERIC(14, 2);
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION
            'Rent payment allocations cannot be edited.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Rent payment allocations cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_payment
    FROM rent_payments
    WHERE id = NEW.payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Payment allocation references a payment that does not exist.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_payment.status <> 'completed' THEN
        RAISE EXCEPTION
            'Allocations can only be added to completed payments.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_invoice
    FROM rent_invoices
    WHERE id = NEW.invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Payment allocation references an invoice that does not exist.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_invoice.status NOT IN (
        'issued',
        'partially_paid',
        'overdue'
    ) THEN
        RAISE EXCEPTION
            'Payments can only be allocated to issued, partially paid or overdue invoices.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_payment.owner_id <> v_invoice.owner_id
       OR v_payment.tenant_id <> v_invoice.tenant_id THEN
        RAISE EXCEPTION
            'Payment owner and tenant must match the invoice.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_payment.currency_code <> v_invoice.currency_code THEN
        RAISE EXCEPTION
            'Payment currency must match the invoice currency.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_payment.paid_at < v_invoice.issued_at THEN
        RAISE EXCEPTION
            'Payment date cannot be before the invoice was issued.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.allocated_amount > v_invoice.balance_amount THEN
        RAISE EXCEPTION
            'Payment allocation cannot exceed the invoice balance.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT
        COALESCE(SUM(allocated_amount), 0)::NUMERIC(14, 2)
    INTO v_existing_allocation
    FROM rent_payment_allocations
    WHERE payment_id = NEW.payment_id;

    IF (v_existing_allocation + NEW.allocated_amount) > v_payment.amount THEN
        RAISE EXCEPTION
            'Payment allocations cannot exceed the payment amount.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_rent_payment_allocation_integrity_trigger
BEFORE INSERT OR UPDATE OR DELETE ON rent_payment_allocations
FOR EACH ROW
EXECUTE FUNCTION enforce_rent_payment_allocation_integrity();

-- =========================================================
-- INVOICE PAYMENT TOTAL AND STATUS SYNCHRONIZATION
-- =========================================================

CREATE OR REPLACE FUNCTION synchronize_rent_invoice_payments(
    p_invoice_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_invoice rent_invoices%ROWTYPE;
    v_paid_amount NUMERIC(14, 2);
    v_new_status VARCHAR(30);
BEGIN
    SELECT *
    INTO v_invoice
    FROM rent_invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT
        COALESCE(
            SUM(rpa.allocated_amount) FILTER (
                WHERE rp.status = 'completed'
            ),
            0
        )::NUMERIC(14, 2)
    INTO v_paid_amount
    FROM rent_payment_allocations AS rpa
    JOIN rent_payments AS rp
        ON rp.id = rpa.payment_id
    WHERE rpa.invoice_id = p_invoice_id;

    IF v_invoice.status IN ('draft', 'void') THEN
        IF v_paid_amount <> 0 THEN
            RAISE EXCEPTION
                'Draft or void invoices cannot contain completed payments.'
                USING ERRCODE = 'P0001';
        END IF;

        RETURN;
    END IF;

    IF v_paid_amount > v_invoice.total_amount THEN
        RAISE EXCEPTION
            'Completed payments cannot exceed the invoice total.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_paid_amount = v_invoice.total_amount THEN
        v_new_status := 'paid';
    ELSIF v_invoice.due_date < CURRENT_DATE THEN
        v_new_status := 'overdue';
    ELSIF v_paid_amount > 0 THEN
        v_new_status := 'partially_paid';
    ELSE
        v_new_status := 'issued';
    END IF;

    UPDATE rent_invoices
    SET
        paid_amount = v_paid_amount,
        status = v_new_status,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION synchronize_rent_invoice_payment_allocation_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM synchronize_rent_invoice_payments(
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.invoice_id
            ELSE NEW.invoice_id
        END
    );

    RETURN NULL;
END;
$$;

CREATE TRIGGER synchronize_rent_invoice_payment_allocation_trigger
AFTER INSERT OR UPDATE OR DELETE ON rent_payment_allocations
FOR EACH ROW
EXECUTE FUNCTION synchronize_rent_invoice_payment_allocation_trigger();

CREATE OR REPLACE FUNCTION synchronize_reversed_rent_payment_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_invoice_id BIGINT;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        FOR v_invoice_id IN
            SELECT invoice_id
            FROM rent_payment_allocations
            WHERE payment_id = NEW.id
        LOOP
            PERFORM synchronize_rent_invoice_payments(v_invoice_id);
        END LOOP;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER synchronize_reversed_rent_payment_trigger
AFTER UPDATE ON rent_payments
FOR EACH ROW
EXECUTE FUNCTION synchronize_reversed_rent_payment_trigger();

-- =========================================================
-- CENTRAL PAYMENT INTEGRITY VALIDATOR
-- =========================================================

CREATE OR REPLACE FUNCTION validate_rent_payment_integrity(
    p_payment_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_payment rent_payments%ROWTYPE;
    v_allocation_count BIGINT;
    v_allocation_total NUMERIC(14, 2);
    v_relationship_conflicts BIGINT;
    v_currency_conflicts BIGINT;
    v_issue_time_conflicts BIGINT;
BEGIN
    SELECT *
    INTO v_payment
    FROM rent_payments
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT
        COUNT(*),
        COALESCE(SUM(rpa.allocated_amount), 0)::NUMERIC(14, 2),
        COUNT(*) FILTER (
            WHERE ri.owner_id <> v_payment.owner_id
               OR ri.tenant_id <> v_payment.tenant_id
        ),
        COUNT(*) FILTER (
            WHERE ri.currency_code <> v_payment.currency_code
        ),
        COUNT(*) FILTER (
            WHERE ri.issued_at IS NULL
               OR v_payment.paid_at < ri.issued_at
        )
    INTO
        v_allocation_count,
        v_allocation_total,
        v_relationship_conflicts,
        v_currency_conflicts,
        v_issue_time_conflicts
    FROM rent_payment_allocations AS rpa
    JOIN rent_invoices AS ri
        ON ri.id = rpa.invoice_id
    WHERE rpa.payment_id = v_payment.id;

    IF v_allocation_count = 0 THEN
        RAISE EXCEPTION
            'Completed and reversed payments must retain their allocations.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_allocation_total <> v_payment.amount THEN
        RAISE EXCEPTION
            'Payment allocation total must equal the payment amount.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_relationship_conflicts > 0 THEN
        RAISE EXCEPTION
            'Payment relationships do not match its invoices.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_currency_conflicts > 0 THEN
        RAISE EXCEPTION
            'Payment currency does not match its invoices.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_issue_time_conflicts > 0 THEN
        RAISE EXCEPTION
            'Payment date cannot be before invoice issuance.'
            USING ERRCODE = 'P0001';
    END IF;
END;
$$;

-- =========================================================
-- CENTRAL INVOICE INTEGRITY VALIDATOR
-- Extended to reconcile paid_amount with completed payments.
-- =========================================================

CREATE OR REPLACE FUNCTION validate_rent_invoice_integrity(
    p_invoice_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_invoice rent_invoices%ROWTYPE;
    v_lease leases%ROWTYPE;
    v_unit_property_id BIGINT;
    v_subtotal NUMERIC(14, 2);
    v_discount NUMERIC(14, 2);
    v_tax NUMERIC(14, 2);
    v_late_fee NUMERIC(14, 2);
    v_payment_total NUMERIC(14, 2);
    v_item_count BIGINT;
BEGIN
    SELECT *
    INTO v_invoice
    FROM rent_invoices
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT *
    INTO v_lease
    FROM leases
    WHERE id = v_invoice.lease_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Invoice references a lease that no longer exists.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_lease.status IN ('draft', 'cancelled') THEN
        RAISE EXCEPTION
            'Invoices cannot reference draft or cancelled leases.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_invoice.owner_id <> v_lease.owner_id
       OR v_invoice.property_id <> v_lease.property_id
       OR v_invoice.unit_id <> v_lease.unit_id
       OR v_invoice.tenant_id <> v_lease.tenant_id THEN
        RAISE EXCEPTION
            'Invoice relationships do not match the source lease.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT property_id
    INTO v_unit_property_id
    FROM units
    WHERE id = v_invoice.unit_id;

    IF NOT FOUND
       OR v_unit_property_id <> v_invoice.property_id THEN
        RAISE EXCEPTION
            'Invoice unit does not belong to the invoice property.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_invoice.billing_period_start < v_lease.start_date
       OR v_invoice.billing_period_end > v_lease.end_date THEN
        RAISE EXCEPTION
            'Invoice billing period must be within the lease period.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_invoice.due_date < v_invoice.billing_period_start THEN
        RAISE EXCEPTION
            'Invoice due date cannot be before the billing period start.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT
        COALESCE(SUM(line_amount) FILTER (
            WHERE item_type IN (
                'rent', 'utility', 'service_charge',
                'adjustment', 'other'
            )
        ), 0),
        COALESCE(SUM(line_amount) FILTER (
            WHERE item_type = 'discount'
        ), 0),
        COALESCE(SUM(line_amount) FILTER (
            WHERE item_type = 'tax'
        ), 0),
        COALESCE(SUM(line_amount) FILTER (
            WHERE item_type = 'late_fee'
        ), 0),
        COUNT(*)
    INTO
        v_subtotal,
        v_discount,
        v_tax,
        v_late_fee,
        v_item_count
    FROM rent_invoice_items
    WHERE invoice_id = v_invoice.id;

    IF v_invoice.subtotal_amount <> v_subtotal
       OR v_invoice.discount_amount <> v_discount
       OR v_invoice.tax_amount <> v_tax
       OR v_invoice.late_fee_amount <> v_late_fee THEN
        RAISE EXCEPTION
            'Invoice financial totals do not match its items.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT
        COALESCE(
            SUM(rpa.allocated_amount) FILTER (
                WHERE rp.status = 'completed'
            ),
            0
        )::NUMERIC(14, 2)
    INTO v_payment_total
    FROM rent_payment_allocations AS rpa
    JOIN rent_payments AS rp
        ON rp.id = rpa.payment_id
    WHERE rpa.invoice_id = v_invoice.id;

    IF v_invoice.paid_amount <> v_payment_total THEN
        RAISE EXCEPTION
            'Invoice paid amount does not match completed payment allocations.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_invoice.status = 'draft' THEN
        IF v_invoice.paid_amount <> 0 THEN
            RAISE EXCEPTION
                'Draft invoices cannot contain payments.'
                USING ERRCODE = 'P0001';
        END IF;
    ELSIF v_invoice.status = 'issued' THEN
        IF v_item_count = 0 OR v_invoice.total_amount <= 0 THEN
            RAISE EXCEPTION
                'Issued invoices must contain items and have a positive total.'
                USING ERRCODE = 'P0001';
        END IF;

        IF v_invoice.paid_amount <> 0
           OR v_invoice.balance_amount <> v_invoice.total_amount THEN
            RAISE EXCEPTION
                'Issued invoice payment values are inconsistent.'
                USING ERRCODE = 'P0001';
        END IF;
    ELSIF v_invoice.status = 'partially_paid' THEN
        IF v_invoice.paid_amount <= 0
           OR v_invoice.paid_amount >= v_invoice.total_amount
           OR v_invoice.balance_amount <= 0
           OR v_invoice.due_date < CURRENT_DATE THEN
            RAISE EXCEPTION
                'Partially paid invoice values or due date are inconsistent.'
                USING ERRCODE = 'P0001';
        END IF;
    ELSIF v_invoice.status = 'paid' THEN
        IF v_invoice.total_amount <= 0
           OR v_invoice.paid_amount <> v_invoice.total_amount
           OR v_invoice.balance_amount <> 0 THEN
            RAISE EXCEPTION
                'Paid invoice values are inconsistent.'
                USING ERRCODE = 'P0001';
        END IF;
    ELSIF v_invoice.status = 'overdue' THEN
        IF v_invoice.balance_amount <= 0
           OR v_invoice.due_date >= CURRENT_DATE THEN
            RAISE EXCEPTION
                'Overdue invoice values or due date are inconsistent.'
                USING ERRCODE = 'P0001';
        END IF;
    ELSIF v_invoice.status = 'void' THEN
        IF v_invoice.paid_amount <> 0 THEN
            RAISE EXCEPTION
                'An invoice with recorded payments cannot be voided.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF v_invoice.status IN (
        'issued', 'partially_paid', 'paid', 'overdue'
    ) AND v_invoice.due_date < v_invoice.issue_date THEN
        RAISE EXCEPTION
            'Invoice due date cannot be before its issue date.'
            USING ERRCODE = 'P0001';
    END IF;
END;
$$;

-- =========================================================
-- UPDATED INVOICE LIFECYCLE FOR PAYMENT REVERSALS
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_rent_invoice_mutation_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Rent invoices cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
       OR NEW.lease_id IS DISTINCT FROM OLD.lease_id
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.property_id IS DISTINCT FROM OLD.property_id
       OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Invoice relationship and audit identity is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status = 'void' AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION
            'Void invoices cannot be edited or reactivated.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status <> 'draft' AND (
        NEW.billing_period_start IS DISTINCT FROM OLD.billing_period_start
        OR NEW.billing_period_end IS DISTINCT FROM OLD.billing_period_end
        OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
        OR NEW.due_date IS DISTINCT FROM OLD.due_date
        OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
        OR NEW.subtotal_amount IS DISTINCT FROM OLD.subtotal_amount
        OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
        OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
        OR NEW.late_fee_amount IS DISTINCT FROM OLD.late_fee_amount
        OR NEW.notes IS DISTINCT FROM OLD.notes
        OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
        OR NEW.issued_by IS DISTINCT FROM OLD.issued_by
    ) THEN
        RAISE EXCEPTION
            'Issued invoice terms and issue audit are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NOT (
        (OLD.status = 'draft' AND NEW.status IN ('draft', 'issued', 'void'))
        OR (
            OLD.status IN ('issued', 'partially_paid', 'paid', 'overdue')
            AND NEW.status IN ('issued', 'partially_paid', 'paid', 'overdue')
        )
        OR (OLD.status = 'issued' AND NEW.status = 'void')
        OR (OLD.status = 'void' AND NEW.status = 'void')
    ) THEN
        RAISE EXCEPTION
            'Invalid invoice lifecycle transition from % to %.',
            OLD.status,
            NEW.status
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.issued_at IS NOT NULL AND (
        NEW.issued_at IS DISTINCT FROM OLD.issued_at
        OR NEW.issued_by IS DISTINCT FROM OLD.issued_by
        OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
    ) THEN
        RAISE EXCEPTION
            'Invoice issue audit is immutable once recorded.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.voided_at IS NOT NULL AND (
        NEW.voided_at IS DISTINCT FROM OLD.voided_at
        OR NEW.voided_by IS DISTINCT FROM OLD.voided_by
        OR NEW.void_reason IS DISTINCT FROM OLD.void_reason
    ) THEN
        RAISE EXCEPTION
            'Invoice void audit is immutable once recorded.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

-- =========================================================
-- DEFERRED PAYMENT VALIDATION
-- =========================================================

CREATE OR REPLACE FUNCTION validate_rent_payment_row_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM validate_rent_payment_integrity(
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END
    );

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER constraint_rent_payments_integrity
AFTER INSERT OR UPDATE ON rent_payments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_rent_payment_row_trigger();

CREATE OR REPLACE FUNCTION validate_rent_payment_allocation_row_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.payment_id <> NEW.payment_id THEN
        PERFORM validate_rent_payment_integrity(OLD.payment_id);
    END IF;

    PERFORM validate_rent_payment_integrity(
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.payment_id
            ELSE NEW.payment_id
        END
    );

    PERFORM validate_rent_invoice_integrity(
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.invoice_id
            ELSE NEW.invoice_id
        END
    );

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER constraint_rent_payment_allocations_integrity
AFTER INSERT OR UPDATE OR DELETE ON rent_payment_allocations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_rent_payment_allocation_row_trigger();

-- =========================================================
-- VALIDATE EXISTING DATA
-- =========================================================

DO $$
DECLARE
    v_payment_id BIGINT;
    v_invoice_id BIGINT;
BEGIN
    FOR v_payment_id IN
        SELECT id
        FROM rent_payments
    LOOP
        PERFORM validate_rent_payment_integrity(v_payment_id);
    END LOOP;

    FOR v_invoice_id IN
        SELECT id
        FROM rent_invoices
    LOOP
        PERFORM validate_rent_invoice_integrity(v_invoice_id);
    END LOOP;
END;
$$;

COMMENT ON FUNCTION validate_rent_payment_integrity(BIGINT) IS
'Validates payment allocation totals, relationships, currency and invoice issue timing.';

COMMENT ON FUNCTION synchronize_rent_invoice_payments(BIGINT) IS
'Recalculates invoice paid amount and lifecycle status from completed payment allocations.';

COMMENT ON FUNCTION enforce_rent_payment_mutation_integrity() IS
'Protects permanent payment identity and permits only completed-to-reversed lifecycle transitions.';

SET CONSTRAINTS ALL IMMEDIATE;

COMMIT;
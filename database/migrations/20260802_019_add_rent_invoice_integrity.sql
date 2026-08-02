BEGIN;

-- Required by the non-overlapping invoice-period constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =========================================================
-- NON-OVERLAPPING CURRENT BILLING PERIODS
-- Void invoices do not block replacement billing records.
-- =========================================================

ALTER TABLE rent_invoices
    ADD CONSTRAINT ex_rent_invoices_current_period
    EXCLUDE USING gist (
        lease_id WITH =,
        daterange(
            billing_period_start,
            billing_period_end,
            '[]'
        ) WITH &&
    )
    WHERE (status <> 'void')
    DEFERRABLE INITIALLY DEFERRED;

-- =========================================================
-- CENTRAL INVOICE INTEGRITY VALIDATOR
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

    IF NOT FOUND OR
       v_unit_property_id <> v_invoice.property_id THEN
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
           OR v_invoice.balance_amount <= 0 THEN
            RAISE EXCEPTION
                'Partially paid invoice values are inconsistent.'
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
-- IMMUTABILITY, LIFECYCLE AND HARD-DELETE PROTECTION
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
        OR (OLD.status = 'issued' AND NEW.status IN (
            'issued', 'partially_paid', 'paid', 'overdue', 'void'
        ))
        OR (OLD.status = 'partially_paid' AND NEW.status IN (
            'partially_paid', 'paid', 'overdue'
        ))
        OR (OLD.status = 'overdue' AND NEW.status IN (
            'overdue', 'partially_paid', 'paid'
        ))
        OR (OLD.status = 'paid' AND NEW.status = 'paid')
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

CREATE TRIGGER enforce_rent_invoice_mutation_integrity_trigger
BEFORE UPDATE OR DELETE ON rent_invoices
FOR EACH ROW
EXECUTE FUNCTION enforce_rent_invoice_mutation_integrity();

-- =========================================================
-- ITEM MUTATION PROTECTION
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_rent_invoice_item_mutation_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_invoice_id BIGINT;
    v_status VARCHAR(30);
BEGIN
    v_invoice_id := CASE
        WHEN TG_OP = 'DELETE' THEN OLD.invoice_id
        ELSE NEW.invoice_id
    END;

    SELECT status
    INTO v_status
    FROM rent_invoices
    WHERE id = v_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Invoice item references an invoice that does not exist.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_status <> 'draft' THEN
        RAISE EXCEPTION
            'Items can only be changed while the invoice is draft.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'UPDATE' AND (
        NEW.public_id IS DISTINCT FROM OLD.public_id
        OR NEW.invoice_id IS DISTINCT FROM OLD.invoice_id
        OR NEW.created_by IS DISTINCT FROM OLD.created_by
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
    ) THEN
        RAISE EXCEPTION
            'Invoice item relationship and audit identity is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN CASE
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$;

CREATE TRIGGER enforce_rent_invoice_item_mutation_integrity_trigger
BEFORE INSERT OR UPDATE OR DELETE ON rent_invoice_items
FOR EACH ROW
EXECUTE FUNCTION enforce_rent_invoice_item_mutation_integrity();

-- =========================================================
-- AUTOMATIC HEADER TOTAL SYNCHRONIZATION
-- =========================================================

CREATE OR REPLACE FUNCTION synchronize_rent_invoice_totals(
    p_invoice_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE rent_invoices AS ri
    SET
        subtotal_amount = totals.subtotal,
        discount_amount = totals.discount,
        tax_amount = totals.tax,
        late_fee_amount = totals.late_fee,
        updated_at = CURRENT_TIMESTAMP
    FROM (
        SELECT
            COALESCE(SUM(line_amount) FILTER (
                WHERE item_type IN (
                    'rent', 'utility', 'service_charge',
                    'adjustment', 'other'
                )
            ), 0)::NUMERIC(14, 2) AS subtotal,
            COALESCE(SUM(line_amount) FILTER (
                WHERE item_type = 'discount'
            ), 0)::NUMERIC(14, 2) AS discount,
            COALESCE(SUM(line_amount) FILTER (
                WHERE item_type = 'tax'
            ), 0)::NUMERIC(14, 2) AS tax,
            COALESCE(SUM(line_amount) FILTER (
                WHERE item_type = 'late_fee'
            ), 0)::NUMERIC(14, 2) AS late_fee
        FROM rent_invoice_items
        WHERE invoice_id = p_invoice_id
    ) AS totals
    WHERE ri.id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION synchronize_rent_invoice_totals_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.invoice_id <> NEW.invoice_id THEN
        PERFORM synchronize_rent_invoice_totals(OLD.invoice_id);
    END IF;

    PERFORM synchronize_rent_invoice_totals(
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.invoice_id
            ELSE NEW.invoice_id
        END
    );

    RETURN NULL;
END;
$$;

CREATE TRIGGER synchronize_rent_invoice_totals_trigger
AFTER INSERT OR UPDATE OR DELETE ON rent_invoice_items
FOR EACH ROW
EXECUTE FUNCTION synchronize_rent_invoice_totals_trigger();

-- =========================================================
-- DEFERRED VALIDATION ON INVOICES AND ITEMS
-- =========================================================

CREATE OR REPLACE FUNCTION validate_rent_invoice_row_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM validate_rent_invoice_integrity(
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END
    );

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER constraint_rent_invoices_integrity
AFTER INSERT OR UPDATE ON rent_invoices
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_rent_invoice_row_trigger();

CREATE OR REPLACE FUNCTION validate_rent_invoice_item_row_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.invoice_id <> NEW.invoice_id THEN
        PERFORM validate_rent_invoice_integrity(OLD.invoice_id);
    END IF;

    PERFORM validate_rent_invoice_integrity(
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.invoice_id
            ELSE NEW.invoice_id
        END
    );

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER constraint_rent_invoice_items_integrity
AFTER INSERT OR UPDATE OR DELETE ON rent_invoice_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_rent_invoice_item_row_trigger();

-- =========================================================
-- RELATED LEASE/UNIT CHANGE PROTECTION
-- =========================================================

CREATE OR REPLACE FUNCTION validate_related_rent_invoices_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_invoice_id BIGINT;
BEGIN
    FOR v_invoice_id IN
        SELECT ri.id
        FROM rent_invoices AS ri
        WHERE
            (TG_TABLE_NAME = 'leases' AND ri.lease_id = NEW.id)
            OR (TG_TABLE_NAME = 'units' AND ri.unit_id = NEW.id)
            OR (TG_TABLE_NAME = 'properties' AND ri.property_id = NEW.id)
            OR (TG_TABLE_NAME = 'owners' AND ri.owner_id = NEW.id)
            OR (TG_TABLE_NAME = 'tenants' AND ri.tenant_id = NEW.id)
    LOOP
        PERFORM validate_rent_invoice_integrity(v_invoice_id);
    END LOOP;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER constraint_leases_rent_invoices
AFTER UPDATE ON leases
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_related_rent_invoices_trigger();

CREATE CONSTRAINT TRIGGER constraint_units_rent_invoices
AFTER UPDATE ON units
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_related_rent_invoices_trigger();

CREATE CONSTRAINT TRIGGER constraint_properties_rent_invoices
AFTER UPDATE ON properties
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_related_rent_invoices_trigger();

CREATE CONSTRAINT TRIGGER constraint_owners_rent_invoices
AFTER UPDATE ON owners
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_related_rent_invoices_trigger();

CREATE CONSTRAINT TRIGGER constraint_tenants_rent_invoices
AFTER UPDATE ON tenants
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_related_rent_invoices_trigger();

-- Validate any pre-existing rows before commit.
DO $$
DECLARE
    v_invoice_id BIGINT;
BEGIN
    FOR v_invoice_id IN
        SELECT id
        FROM rent_invoices
    LOOP
        PERFORM validate_rent_invoice_integrity(v_invoice_id);
    END LOOP;
END;
$$;

COMMENT ON CONSTRAINT ex_rent_invoices_current_period
ON rent_invoices IS
'Prevents overlapping non-void billing periods for the same lease.';

COMMIT;
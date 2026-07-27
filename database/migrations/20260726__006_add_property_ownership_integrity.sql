BEGIN;

-- =========================================================
-- Helper function:
-- Validates the final ownership structure of one property.
-- =========================================================

CREATE OR REPLACE FUNCTION validate_property_ownership_integrity(
    p_property_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_ownership NUMERIC(12,4);
    v_owner_count BIGINT;
    v_property_status VARCHAR(30);
BEGIN
    SELECT operational_status
    INTO v_property_status
    FROM properties
    WHERE id = p_property_id;

    -- Property may already have been removed in another operation.
    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT
        COALESCE(SUM(ownership_percentage), 0),
        COUNT(*)
    INTO
        v_total_ownership,
        v_owner_count
    FROM property_owners
    WHERE property_id = p_property_id
      AND effective_to IS NULL;

    -- Ownership must never exceed 100%.
    IF v_total_ownership > 100.0000 THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = FORMAT(
                'Property ownership cannot exceed 100%%. Current total: %s%%.',
                v_total_ownership
            );
    END IF;

    -- Active property must have at least one owner
    -- and total active ownership must equal 100%.
    IF v_property_status = 'active'
       AND (
            v_owner_count = 0
            OR v_total_ownership <> 100.0000
       )
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = FORMAT(
                'Active property requires at least one owner and exactly 100%% ownership. Current total: %s%%.',
                v_total_ownership
            );
    END IF;
END;
$$;


-- =========================================================
-- Trigger function for property_owners changes.
-- Checks both old and new properties when ownership is moved.
-- =========================================================

CREATE OR REPLACE FUNCTION trigger_validate_property_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM validate_property_ownership_integrity(
            OLD.property_id
        );

    ELSIF TG_OP = 'INSERT' THEN
        PERFORM validate_property_ownership_integrity(
            NEW.property_id
        );

    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM validate_property_ownership_integrity(
            OLD.property_id
        );

        IF NEW.property_id IS DISTINCT FROM OLD.property_id THEN
            PERFORM validate_property_ownership_integrity(
                NEW.property_id
            );
        END IF;
    END IF;

    RETURN NULL;
END;
$$;


-- =========================================================
-- Trigger function for property activation.
-- =========================================================

CREATE OR REPLACE FUNCTION trigger_validate_property_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.operational_status = 'active' THEN
        PERFORM validate_property_ownership_integrity(
            NEW.id
        );
    END IF;

    RETURN NULL;
END;
$$;


-- Safe re-run support.

DROP TRIGGER IF EXISTS
    constraint_property_owners_integrity
ON property_owners;

DROP TRIGGER IF EXISTS
    constraint_properties_activation_integrity
ON properties;


-- =========================================================
-- Deferred constraint trigger:
-- validates ownership after the transaction finishes.
-- =========================================================

CREATE CONSTRAINT TRIGGER constraint_property_owners_integrity
AFTER INSERT OR UPDATE OR DELETE
ON property_owners
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION trigger_validate_property_ownership();


CREATE CONSTRAINT TRIGGER constraint_properties_activation_integrity
AFTER INSERT OR UPDATE
ON properties
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION trigger_validate_property_activation();

COMMIT;
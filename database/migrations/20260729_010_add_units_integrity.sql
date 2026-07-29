BEGIN;

-- =========================================================
-- 1. PREFLIGHT AUDIT
-- Migration isimame ikiwa existing data si salama.
-- =========================================================

DO $$
BEGIN
    /*
     * Soft-deleted unit lazima iwe inactive.
     */
    IF EXISTS (
        SELECT 1
        FROM units
        WHERE deleted_at IS NOT NULL
          AND operational_status <> 'inactive'
    ) THEN
        RAISE EXCEPTION
            'Migration stopped: one or more deleted units are not inactive.';
    END IF;

    /*
     * Single-unit property haiwezi kuwa na zaidi ya
     * unit moja ambayo haijafutwa.
     */
    IF EXISTS (
        SELECT 1
        FROM properties AS p

        INNER JOIN units AS u
            ON u.property_id = p.id
           AND u.deleted_at IS NULL

        WHERE p.is_multi_unit = FALSE

        GROUP BY p.id

        HAVING COUNT(u.id) > 1
    ) THEN
        RAISE EXCEPTION
            'Migration stopped: one or more single-unit properties contain multiple current units.';
    END IF;

    /*
     * Deleted property haiwezi kuwa na current units.
     */
    IF EXISTS (
        SELECT 1
        FROM properties AS p

        INNER JOIN units AS u
            ON u.property_id = p.id
           AND u.deleted_at IS NULL

        WHERE p.deleted_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'Migration stopped: one or more deleted properties contain current units.';
    END IF;

    /*
     * Rentable/occupied statuses zinahitaji active property.
     */
    IF EXISTS (
        SELECT 1
        FROM units AS u

        INNER JOIN properties AS p
            ON p.id = u.property_id

        WHERE u.deleted_at IS NULL

          AND u.operational_status IN (
              'available',
              'reserved',
              'occupied'
          )

          AND (
              p.deleted_at IS NOT NULL
              OR p.operational_status <> 'active'
          )
    ) THEN
        RAISE EXCEPTION
            'Migration stopped: one or more units have rentable statuses under inactive or deleted properties.';
    END IF;
END
$$;


-- =========================================================
-- 2. SOFT-DELETE STATUS CONSISTENCY
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'units_soft_delete_status_check'
          AND conrelid =
            'units'::regclass
    ) THEN
        ALTER TABLE units

        ADD CONSTRAINT
            units_soft_delete_status_check

        CHECK (
            deleted_at IS NULL
            OR operational_status = 'inactive'
        )

        NOT VALID;
    END IF;
END
$$;

ALTER TABLE units
VALIDATE CONSTRAINT
    units_soft_delete_status_check;


-- =========================================================
-- 3. PROPERTY-UNIT INTEGRITY FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION
validate_property_unit_integrity(
    p_property_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_multi_unit BOOLEAN;

    v_property_status
        properties.operational_status%TYPE;

    v_property_deleted_at
        properties.deleted_at%TYPE;

    v_current_unit_count INTEGER;

    v_restricted_status_count INTEGER;
BEGIN
    IF p_property_id IS NULL THEN
        RETURN;
    END IF;

    /*
     * Lock parent property.
     * Hii inazuia concurrent unit creation au
     * property-status modification kwa property moja.
     */
    SELECT
        is_multi_unit,
        operational_status,
        deleted_at

    INTO
        v_is_multi_unit,
        v_property_status,
        v_property_deleted_at

    FROM properties

    WHERE id = p_property_id

    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Property record % does not exist.',
            p_property_id

        USING ERRCODE = '23503';
    END IF;

    SELECT
        COUNT(u.id) FILTER (
            WHERE u.deleted_at IS NULL
        )::INTEGER,

        COUNT(u.id) FILTER (
            WHERE u.deleted_at IS NULL
              AND u.operational_status IN (
                  'available',
                  'reserved',
                  'occupied'
              )
        )::INTEGER

    INTO
        v_current_unit_count,
        v_restricted_status_count

    FROM units AS u

    WHERE u.property_id = p_property_id;

    /*
     * Single-unit property:
     * maximum one non-deleted unit.
     */
    IF v_is_multi_unit = FALSE
       AND v_current_unit_count > 1
    THEN
        RAISE EXCEPTION
            'A single-unit property cannot contain more than one current unit. Current count: %.',
            v_current_unit_count

        USING ERRCODE = '23514';
    END IF;

    /*
     * Deleted property cannot retain current units.
     */
    IF v_property_deleted_at IS NOT NULL
       AND v_current_unit_count > 0
    THEN
        RAISE EXCEPTION
            'A deleted property cannot contain current units. Current count: %.',
            v_current_unit_count

        USING ERRCODE = '23514';
    END IF;

    /*
     * Available, reserved and occupied units require
     * an active, non-deleted parent property.
     */
    IF (
        v_property_deleted_at IS NOT NULL
        OR v_property_status <> 'active'
    )
    AND v_restricted_status_count > 0
    THEN
        RAISE EXCEPTION
            'Units can only be available, reserved or occupied when their property is active. Invalid unit count: %.',
            v_restricted_status_count

        USING ERRCODE = '23514';
    END IF;
END;
$$;


-- =========================================================
-- 4. UNITS TRIGGER FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION
trigger_validate_units_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM
            validate_property_unit_integrity(
                NEW.property_id
            );

        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        PERFORM
            validate_property_unit_integrity(
                OLD.property_id
            );

        RETURN OLD;
    END IF;

    /*
     * UPDATE
     */
    PERFORM
        validate_property_unit_integrity(
            NEW.property_id
        );

    IF OLD.property_id
        IS DISTINCT FROM
        NEW.property_id
    THEN
        PERFORM
            validate_property_unit_integrity(
                OLD.property_id
            );
    END IF;

    RETURN NEW;
END;
$$;


-- =========================================================
-- 5. PROPERTIES TRIGGER FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION
trigger_validate_property_units_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM
        validate_property_unit_integrity(
            NEW.id
        );

    RETURN NEW;
END;
$$;


-- =========================================================
-- 6. DEFERRED CONSTRAINT TRIGGER ON UNITS
-- =========================================================

DROP TRIGGER IF EXISTS
    constraint_units_property_integrity
ON units;

CREATE CONSTRAINT TRIGGER
    constraint_units_property_integrity

AFTER INSERT OR UPDATE OR DELETE
ON units

DEFERRABLE INITIALLY DEFERRED

FOR EACH ROW

EXECUTE FUNCTION
    trigger_validate_units_integrity();


-- =========================================================
-- 7. DEFERRED CONSTRAINT TRIGGER ON PROPERTIES
-- =========================================================

DROP TRIGGER IF EXISTS
    constraint_properties_units_integrity
ON properties;

CREATE CONSTRAINT TRIGGER
    constraint_properties_units_integrity

AFTER INSERT OR UPDATE
ON properties

DEFERRABLE INITIALLY DEFERRED

FOR EACH ROW

EXECUTE FUNCTION
    trigger_validate_property_units_integrity();

COMMIT;
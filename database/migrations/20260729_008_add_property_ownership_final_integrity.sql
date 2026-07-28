BEGIN;

-- =========================================================
-- 1. Preflight audit
-- Migration isimame ikiwa data ya zamani si salama.
-- =========================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM property_owners
        WHERE effective_to IS NOT NULL
          AND effective_from IS NOT NULL
          AND effective_to < effective_from
    ) THEN
        RAISE EXCEPTION
            'Migration stopped: property ownership records contain invalid effective dates.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM property_owners
        WHERE effective_to IS NULL
        GROUP BY property_id, owner_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Migration stopped: duplicate active property-owner relationships exist.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM property_owners
        WHERE effective_to IS NULL
          AND is_primary_contact = TRUE
        GROUP BY property_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Migration stopped: a property has more than one active primary contact.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM property_owners
        WHERE effective_to IS NULL
        GROUP BY property_id
        HAVING SUM(ownership_percentage) > 100
    ) THEN
        RAISE EXCEPTION
            'Migration stopped: active property ownership exceeds 100 percent.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM properties AS p

        LEFT JOIN property_owners AS po
            ON po.property_id = p.id
           AND po.effective_to IS NULL

        LEFT JOIN owners AS o
            ON o.id = po.owner_id

        WHERE p.operational_status = 'active'
          AND p.deleted_at IS NULL

        GROUP BY p.id

        HAVING
            COUNT(po.id) = 0

            OR COALESCE(
                SUM(po.ownership_percentage),
                0
            ) <> 100

            OR COUNT(po.id) FILTER (
                WHERE po.is_primary_contact = TRUE
            ) <> 1

            OR COUNT(po.id) FILTER (
                WHERE po.effective_from > CURRENT_DATE
            ) > 0

            OR COUNT(po.id) FILTER (
                WHERE o.id IS NULL
                   OR o.deleted_at IS NOT NULL
                   OR o.status <> 'active'
            ) > 0
    ) THEN
        RAISE EXCEPTION
            'Migration stopped: one or more active properties violate ownership integrity.';
    END IF;
END
$$;


-- =========================================================
-- 2. Effective-date consistency
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'property_owners_effective_dates_check'
          AND conrelid =
            'property_owners'::regclass
    ) THEN
        ALTER TABLE property_owners

        ADD CONSTRAINT
            property_owners_effective_dates_check

        CHECK (
            effective_to IS NULL
            OR effective_from IS NULL
            OR effective_to >= effective_from
        )

        NOT VALID;
    END IF;
END
$$;

ALTER TABLE property_owners
VALIDATE CONSTRAINT
    property_owners_effective_dates_check;


-- =========================================================
-- 3. One active relationship per property-owner pair
-- =========================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_property_owners_active_owner
ON property_owners (
    property_id,
    owner_id
)
WHERE effective_to IS NULL;


-- =========================================================
-- 4. Maximum one active primary contact per property
-- =========================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_property_owners_active_primary_contact
ON property_owners (
    property_id
)
WHERE effective_to IS NULL
  AND is_primary_contact = TRUE;


-- =========================================================
-- 5. Complete ownership integrity function
-- =========================================================

CREATE OR REPLACE FUNCTION
validate_property_ownership_integrity(
    p_property_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_property_status
        properties.operational_status%TYPE;

    v_property_deleted_at
        properties.deleted_at%TYPE;

    v_active_owner_count INTEGER;

    v_total_active_ownership
        NUMERIC(12,4);

    v_primary_contact_count INTEGER;

    v_future_ownership_count INTEGER;

    v_unavailable_owner_count INTEGER;
BEGIN
    IF p_property_id IS NULL THEN
        RETURN;
    END IF;

    /*
     * Serialize integrity checks for the same property.
     */
    SELECT
        operational_status,
        deleted_at

    INTO
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
        COUNT(po.id)::INTEGER,

        COALESCE(
            SUM(po.ownership_percentage),
            0
        )::NUMERIC(12,4),

        COUNT(po.id) FILTER (
            WHERE po.is_primary_contact = TRUE
        )::INTEGER,

        COUNT(po.id) FILTER (
            WHERE po.effective_from > CURRENT_DATE
        )::INTEGER,

        COUNT(po.id) FILTER (
            WHERE o.id IS NULL
               OR o.deleted_at IS NOT NULL
               OR o.status <> 'active'
        )::INTEGER

    INTO
        v_active_owner_count,
        v_total_active_ownership,
        v_primary_contact_count,
        v_future_ownership_count,
        v_unavailable_owner_count

    FROM property_owners AS po

    LEFT JOIN owners AS o
        ON o.id = po.owner_id

    WHERE po.property_id = p_property_id
      AND po.effective_to IS NULL;

    /*
     * Applies to every property status.
     */
    IF v_total_active_ownership > 100 THEN
        RAISE EXCEPTION
            'Active property ownership cannot exceed 100%%. Current total: %%%.',
            v_total_active_ownership

        USING ERRCODE = '23514';
    END IF;

    IF v_primary_contact_count > 1 THEN
        RAISE EXCEPTION
            'A property cannot have more than one active primary owner contact.'

        USING ERRCODE = '23514';
    END IF;

    /*
     * Stronger requirements for active properties.
     */
    IF v_property_status = 'active'
       AND v_property_deleted_at IS NULL
    THEN
        IF v_active_owner_count = 0 THEN
            RAISE EXCEPTION
                'An active property must have at least one active owner.'

            USING ERRCODE = '23514';
        END IF;

        IF v_total_active_ownership <> 100 THEN
            RAISE EXCEPTION
                'An active property must have exactly 100%% ownership. Current total: %%%.',
                v_total_active_ownership

            USING ERRCODE = '23514';
        END IF;

        IF v_primary_contact_count <> 1 THEN
            RAISE EXCEPTION
                'An active property must have exactly one primary owner contact.'

            USING ERRCODE = '23514';
        END IF;

        IF v_future_ownership_count > 0 THEN
            RAISE EXCEPTION
                'An active property cannot contain future-dated ownership records.'

            USING ERRCODE = '23514';
        END IF;

        IF v_unavailable_owner_count > 0 THEN
            RAISE EXCEPTION
                'All owners of an active property must be active and not deleted.'

            USING ERRCODE = '23514';
        END IF;
    END IF;
END;
$$;


-- =========================================================
-- 6. Property-owner trigger function
-- =========================================================

CREATE OR REPLACE FUNCTION
trigger_validate_property_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM
            validate_property_ownership_integrity(
                NEW.property_id
            );

        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        PERFORM
            validate_property_ownership_integrity(
                OLD.property_id
            );

        RETURN OLD;
    END IF;

    PERFORM
        validate_property_ownership_integrity(
            NEW.property_id
        );

    IF OLD.property_id
        IS DISTINCT FROM
        NEW.property_id
    THEN
        PERFORM
            validate_property_ownership_integrity(
                OLD.property_id
            );
    END IF;

    RETURN NEW;
END;
$$;


-- =========================================================
-- 7. Property activation trigger function
-- =========================================================

CREATE OR REPLACE FUNCTION
trigger_validate_property_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM
        validate_property_ownership_integrity(
            NEW.id
        );

    RETURN NEW;
END;
$$;


-- =========================================================
-- 8. Recreate deferred constraint triggers
-- =========================================================

DROP TRIGGER IF EXISTS
    constraint_property_owners_integrity
ON property_owners;

CREATE CONSTRAINT TRIGGER
    constraint_property_owners_integrity

AFTER INSERT OR UPDATE OR DELETE
ON property_owners

DEFERRABLE INITIALLY DEFERRED

FOR EACH ROW

EXECUTE FUNCTION
    trigger_validate_property_ownership();


DROP TRIGGER IF EXISTS
    constraint_properties_activation_integrity
ON properties;

CREATE CONSTRAINT TRIGGER
    constraint_properties_activation_integrity

AFTER INSERT OR UPDATE
ON properties

DEFERRABLE INITIALLY DEFERRED

FOR EACH ROW

EXECUTE FUNCTION
    trigger_validate_property_activation();

COMMIT;
BEGIN;

-- =========================================================
-- 1. Ensure active/closed state consistency
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'owner_shareholders_state_consistency_check'
          AND conrelid =
            'owner_shareholders'::regclass
    ) THEN
        ALTER TABLE owner_shareholders
        ADD CONSTRAINT
            owner_shareholders_state_consistency_check
        CHECK (
            (
                is_active = TRUE
                AND effective_to IS NULL
            )
            OR
            (
                is_active = FALSE
                AND effective_to IS NOT NULL
            )
        )
        NOT VALID;
    END IF;
END
$$;

ALTER TABLE owner_shareholders
VALIDATE CONSTRAINT
    owner_shareholders_state_consistency_check;


-- =========================================================
-- 2. Ensure effective dates are chronologically valid
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'owner_shareholders_effective_dates_check'
          AND conrelid =
            'owner_shareholders'::regclass
    ) THEN
        ALTER TABLE owner_shareholders
        ADD CONSTRAINT
            owner_shareholders_effective_dates_check
        CHECK (
            effective_to IS NULL
            OR effective_from IS NULL
            OR effective_to >= effective_from
        )
        NOT VALID;
    END IF;
END
$$;

ALTER TABLE owner_shareholders
VALIDATE CONSTRAINT
    owner_shareholders_effective_dates_check;


-- =========================================================
-- 3. Prevent duplicate active shareholding relationships
-- =========================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_owner_shareholders_active_relationship
ON owner_shareholders (
    company_owner_id,
    shareholder_owner_id,
    shareholder_type
)
WHERE
    is_active = TRUE
    AND effective_to IS NULL;


-- =========================================================
-- 4. Company-level shareholding integrity function
-- =========================================================

CREATE OR REPLACE FUNCTION
validate_company_shareholding_integrity(
    p_company_owner_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_company_type TEXT;
    v_total_active_shares NUMERIC(12,4);
BEGIN
    IF p_company_owner_id IS NULL THEN
        RETURN;
    END IF;

    /*
     * Lock the company owner row.
     * This serializes concurrent add, update and close
     * operations affecting the same company.
     */
    SELECT
        owner_type::TEXT
    INTO
        v_company_type
    FROM owners
    WHERE id = p_company_owner_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Company owner record % does not exist.',
            p_company_owner_id
        USING ERRCODE = '23503';
    END IF;

    /*
     * Shareholders can only belong to a company
     * or partnership owner.
     */
    IF v_company_type NOT IN (
        'company',
        'partnership'
    ) THEN
        RAISE EXCEPTION
            'Shareholdings can only belong to company or partnership owners.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * Calculate all active shares after locking
     * the related company owner.
     */
    SELECT
        COALESCE(
            SUM(share_percentage),
            0
        )::NUMERIC(12,4)
    INTO
        v_total_active_shares
    FROM owner_shareholders
    WHERE company_owner_id =
        p_company_owner_id
      AND is_active = TRUE
      AND effective_to IS NULL;

    IF v_total_active_shares > 100 THEN
        RAISE EXCEPTION
            'Active shareholding total cannot exceed 100%%. Current total: %%%.',
            v_total_active_shares
        USING ERRCODE = '23514';
    END IF;
END;
$$;


-- =========================================================
-- 5. Trigger function
-- =========================================================

CREATE OR REPLACE FUNCTION
trigger_validate_owner_shareholding_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM
            validate_company_shareholding_integrity(
                NEW.company_owner_id
            );

        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        PERFORM
            validate_company_shareholding_integrity(
                OLD.company_owner_id
            );

        RETURN OLD;
    END IF;

    /*
     * UPDATE operation
     */
    PERFORM
        validate_company_shareholding_integrity(
            NEW.company_owner_id
        );

    /*
     * If a direct database operation moves a relationship
     * to another company, validate both companies.
     */
    IF OLD.company_owner_id
        IS DISTINCT FROM
        NEW.company_owner_id
    THEN
        PERFORM
            validate_company_shareholding_integrity(
                OLD.company_owner_id
            );
    END IF;

    RETURN NEW;
END;
$$;


-- =========================================================
-- 6. Deferrable constraint trigger
-- =========================================================

DROP TRIGGER IF EXISTS
    constraint_owner_shareholders_integrity
ON owner_shareholders;

CREATE CONSTRAINT TRIGGER
    constraint_owner_shareholders_integrity
AFTER INSERT OR UPDATE OR DELETE
ON owner_shareholders
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION
    trigger_validate_owner_shareholding_integrity();

COMMIT;
BEGIN;

-- =========================================================
-- 1. TENANT PUBLIC ID FORMAT
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'chk_tenants_public_id_format'
          AND conrelid =
            'tenants'::regclass
    ) THEN
        ALTER TABLE tenants
        ADD CONSTRAINT
            chk_tenants_public_id_format
        CHECK (
            public_id ~
            '^tenant_[A-Za-z0-9_-]+$'
        )
        NOT VALID;
    END IF;
END
$$;

ALTER TABLE tenants
VALIDATE CONSTRAINT
    chk_tenants_public_id_format;


-- =========================================================
-- 2. TENANT OPTIONAL FIELDS MUST NOT BE EMPTY STRINGS
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'chk_tenants_optional_fields_not_blank'
          AND conrelid =
            'tenants'::regclass
    ) THEN
        ALTER TABLE tenants
        ADD CONSTRAINT
            chk_tenants_optional_fields_not_blank
        CHECK (
            (
                national_id IS NULL
                OR BTRIM(national_id) <> ''
            )
            AND
            (
                passport_number IS NULL
                OR BTRIM(passport_number) <> ''
            )
            AND
            (
                registration_number IS NULL
                OR BTRIM(registration_number) <> ''
            )
            AND
            (
                tax_identification_number IS NULL
                OR BTRIM(
                    tax_identification_number
                ) <> ''
            )
            AND
            (
                email IS NULL
                OR BTRIM(email) <> ''
            )
            AND
            (
                phone_number IS NULL
                OR BTRIM(phone_number) <> ''
            )
            AND
            (
                alternative_phone IS NULL
                OR BTRIM(alternative_phone) <> ''
            )
            AND
            (
                city IS NULL
                OR BTRIM(city) <> ''
            )
            AND
            (
                region IS NULL
                OR BTRIM(region) <> ''
            )
            AND
            BTRIM(country) <> ''
        )
        NOT VALID;
    END IF;
END
$$;

ALTER TABLE tenants
VALIDATE CONSTRAINT
    chk_tenants_optional_fields_not_blank;


-- =========================================================
-- 3. TENANT TIMESTAMP CONSISTENCY
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'chk_tenants_timestamp_consistency'
          AND conrelid =
            'tenants'::regclass
    ) THEN
        ALTER TABLE tenants
        ADD CONSTRAINT
            chk_tenants_timestamp_consistency
        CHECK (
            updated_at >= created_at
            AND
            (
                deleted_at IS NULL
                OR deleted_at >= created_at
            )
        )
        NOT VALID;
    END IF;
END
$$;

ALTER TABLE tenants
VALIDATE CONSTRAINT
    chk_tenants_timestamp_consistency;


-- =========================================================
-- 4. SOFT-DELETED TENANT MUST BE INACTIVE
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'chk_tenants_soft_delete_status'
          AND conrelid =
            'tenants'::regclass
    ) THEN
        ALTER TABLE tenants
        ADD CONSTRAINT
            chk_tenants_soft_delete_status
        CHECK (
            deleted_at IS NULL
            OR status = 'inactive'
        )
        NOT VALID;
    END IF;
END
$$;

ALTER TABLE tenants
VALIDATE CONSTRAINT
    chk_tenants_soft_delete_status;


-- =========================================================
-- 5. OWNER–TENANT PUBLIC ID FORMAT
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'chk_owner_tenants_public_id_format'
          AND conrelid =
            'owner_tenants'::regclass
    ) THEN
        ALTER TABLE owner_tenants
        ADD CONSTRAINT
            chk_owner_tenants_public_id_format
        CHECK (
            public_id ~
            '^owner_tenant_[A-Za-z0-9_-]+$'
        )
        NOT VALID;
    END IF;
END
$$;

ALTER TABLE owner_tenants
VALIDATE CONSTRAINT
    chk_owner_tenants_public_id_format;


-- =========================================================
-- 6. OWNER–TENANT TIMESTAMP CONSISTENCY
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'chk_owner_tenants_timestamp_consistency'
          AND conrelid =
            'owner_tenants'::regclass
    ) THEN
        ALTER TABLE owner_tenants
        ADD CONSTRAINT
            chk_owner_tenants_timestamp_consistency
        CHECK (
            updated_at >= created_at
            AND
            (
                ended_at IS NULL
                OR ended_at >= created_at
            )
        )
        NOT VALID;
    END IF;
END
$$;

ALTER TABLE owner_tenants
VALIDATE CONSTRAINT
    chk_owner_tenants_timestamp_consistency;


-- =========================================================
-- 7. VALIDATE ONE OWNER–TENANT RELATIONSHIP
-- =========================================================

CREATE OR REPLACE FUNCTION
validate_owner_tenant_relationship_integrity(
    p_relationship_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_relationship_status VARCHAR(20);
    v_ended_at TIMESTAMPTZ;
    v_owner_deleted_at TIMESTAMPTZ;
    v_tenant_deleted_at TIMESTAMPTZ;
BEGIN
    IF p_relationship_id IS NULL THEN
        RETURN;
    END IF;

    SELECT
        ot.relationship_status,
        ot.ended_at,
        owner.deleted_at,
        tenant.deleted_at
    INTO
        v_relationship_status,
        v_ended_at,
        v_owner_deleted_at,
        v_tenant_deleted_at
    FROM owner_tenants AS ot

    INNER JOIN owners AS owner
        ON owner.id = ot.owner_id

    INNER JOIN tenants AS tenant
        ON tenant.id = ot.tenant_id

    WHERE ot.id = p_relationship_id

    FOR UPDATE OF
        ot,
        owner,
        tenant;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    /*
     * Active and blocked relationships are current.
     * They cannot point to deleted owners or tenants.
     */
    IF (
        v_relationship_status IN (
            'active',
            'blocked'
        )
        AND v_ended_at IS NULL
    ) THEN
        IF v_owner_deleted_at IS NOT NULL THEN
            RAISE EXCEPTION
                'A current owner-tenant relationship cannot reference a deleted owner.'
            USING ERRCODE = '23514';
        END IF;

        IF v_tenant_deleted_at IS NOT NULL THEN
            RAISE EXCEPTION
                'A current owner-tenant relationship cannot reference a deleted tenant.'
            USING ERRCODE = '23514';
        END IF;
    END IF;
END;
$$;


-- =========================================================
-- 8. VALIDATE TENANT SOFT DELETE AGAINST CURRENT LINKS
-- =========================================================

CREATE OR REPLACE FUNCTION
validate_tenant_current_owner_relationships(
    p_tenant_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant_deleted_at TIMESTAMPTZ;
    v_current_relationship_count INTEGER;
BEGIN
    IF p_tenant_id IS NULL THEN
        RETURN;
    END IF;

    SELECT
        deleted_at
    INTO
        v_tenant_deleted_at
    FROM tenants
    WHERE id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF v_tenant_deleted_at IS NULL THEN
        RETURN;
    END IF;

   SELECT
        COUNT(*)::INTEGER
    INTO
        v_current_relationship_count
    FROM owner_tenants
    WHERE tenant_id = p_tenant_id
      AND relationship_status IN (
          'active',
          'blocked'
      )
      AND ended_at IS NULL;

    IF v_current_relationship_count > 0 THEN
        RAISE EXCEPTION
            'A tenant with current owner relationships cannot be deleted. Current relationships: %.',
            v_current_relationship_count
        USING ERRCODE = '23514';
    END IF;
END;
$$;


-- =========================================================
-- 9. VALIDATE OWNER SOFT DELETE AGAINST CURRENT TENANT LINKS
-- =========================================================

CREATE OR REPLACE FUNCTION
validate_owner_current_tenant_relationships(
    p_owner_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_owner_deleted_at TIMESTAMPTZ;
    v_current_relationship_count INTEGER;
BEGIN
    IF p_owner_id IS NULL THEN
        RETURN;
    END IF;

    SELECT
        deleted_at
    INTO
        v_owner_deleted_at
    FROM owners
    WHERE id = p_owner_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF v_owner_deleted_at IS NULL THEN
        RETURN;
    END IF;

    SELECT
        COUNT(*)::INTEGER
    INTO
        v_current_relationship_count
    FROM owner_tenants
    WHERE owner_id = p_owner_id
      AND relationship_status IN (
          'active',
          'blocked'
      )
      AND ended_at IS NULL;

    IF v_current_relationship_count > 0 THEN
        RAISE EXCEPTION
            'An owner with current tenant relationships cannot be deleted. Current relationships: %.',
            v_current_relationship_count
        USING ERRCODE = '23514';
    END IF;
END;
$$;

-- =========================================================
-- 10. SHARED CONSTRAINT TRIGGER FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION
trigger_validate_tenant_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    /*
     * Changes to owner_tenants.
     */
    IF TG_TABLE_NAME = 'owner_tenants' THEN
        IF TG_OP = 'INSERT' THEN
            PERFORM
                validate_owner_tenant_relationship_integrity(
                    NEW.id
                );

            PERFORM
                validate_tenant_current_owner_relationships(
                    NEW.tenant_id
                );

            PERFORM
                validate_owner_current_tenant_relationships(
                    NEW.owner_id
                );

            RETURN NEW;
        END IF;

        IF TG_OP = 'UPDATE' THEN
            PERFORM
                validate_owner_tenant_relationship_integrity(
                    NEW.id
                );

            PERFORM
                validate_tenant_current_owner_relationships(
                    NEW.tenant_id
                );

            PERFORM
                validate_owner_current_tenant_relationships(
                    NEW.owner_id
                );

            IF OLD.tenant_id IS DISTINCT FROM
                NEW.tenant_id
            THEN
                PERFORM
                    validate_tenant_current_owner_relationships(
                        OLD.tenant_id
                    );
            END IF;

            IF OLD.owner_id IS DISTINCT FROM
                NEW.owner_id
            THEN
                PERFORM
                    validate_owner_current_tenant_relationships(
                        OLD.owner_id
                    );
            END IF;

            RETURN NEW;
        END IF;

        IF TG_OP = 'DELETE' THEN
            PERFORM
                validate_tenant_current_owner_relationships(
                    OLD.tenant_id
                );

            PERFORM
                validate_owner_current_tenant_relationships(
                    OLD.owner_id
                );

            RETURN OLD;
        END IF;
    END IF;

    /*
     * Changes to tenants.
     */
    IF TG_TABLE_NAME = 'tenants' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;

        PERFORM
            validate_tenant_current_owner_relationships(
                NEW.id
            );

        RETURN NEW;
    END IF;

    /*
     * Changes to owners.
     */
    IF TG_TABLE_NAME = 'owners' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;

        PERFORM
            validate_owner_current_tenant_relationships(
                NEW.id
            );

        RETURN NEW;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;


-- =========================================================
-- 11. OWNER–TENANTS DEFERRED TRIGGER
-- =========================================================

DROP TRIGGER IF EXISTS
    constraint_owner_tenants_integrity
ON owner_tenants;

CREATE CONSTRAINT TRIGGER
    constraint_owner_tenants_integrity
AFTER INSERT OR UPDATE OR DELETE
ON owner_tenants
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION
    trigger_validate_tenant_integrity();


-- =========================================================
-- 12. TENANTS DEFERRED TRIGGER
-- =========================================================

DROP TRIGGER IF EXISTS
    constraint_tenants_owner_relationships
ON tenants;

CREATE CONSTRAINT TRIGGER
    constraint_tenants_owner_relationships
AFTER INSERT OR UPDATE OR DELETE
ON tenants
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION
    trigger_validate_tenant_integrity();

    -- =========================================================
-- 13. OWNERS DEFERRED TRIGGER
-- =========================================================

DROP TRIGGER IF EXISTS
    constraint_owners_tenant_relationships
ON owners;

CREATE CONSTRAINT TRIGGER
    constraint_owners_tenant_relationships
AFTER INSERT OR UPDATE OR DELETE
ON owners
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION
    trigger_validate_tenant_integrity();

COMMIT;
BEGIN;

-- =========================================================
-- 1. TENANT USER PUBLIC ID FORMAT
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1

        FROM pg_constraint

        WHERE conname =
            'chk_tenant_users_public_id_format'
          AND conrelid =
            'tenant_users'::regclass
    ) THEN
        ALTER TABLE tenant_users

        ADD CONSTRAINT
            chk_tenant_users_public_id_format

        CHECK (
            public_id ~
                '^tenant_user_[A-Za-z0-9_-]+$'
        )
        NOT VALID;
    END IF;
END
$$;


ALTER TABLE tenant_users

VALIDATE CONSTRAINT
    chk_tenant_users_public_id_format;


-- =========================================================
-- 2. TENANT USER TIMESTAMP CONSISTENCY
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1

        FROM pg_constraint

        WHERE conname =
            'chk_tenant_users_timestamp_consistency'
          AND conrelid =
            'tenant_users'::regclass
    ) THEN
        ALTER TABLE tenant_users

        ADD CONSTRAINT
            chk_tenant_users_timestamp_consistency

        CHECK (
            updated_at >= created_at
            AND
            (
                revoked_at IS NULL
                OR revoked_at >= created_at
            )
        )
        NOT VALID;
    END IF;
END
$$;


ALTER TABLE tenant_users

VALIDATE CONSTRAINT
    chk_tenant_users_timestamp_consistency;


-- =========================================================
-- 3. VALIDATE ONE TENANT–USER LINK
-- =========================================================

CREATE OR REPLACE FUNCTION
validate_tenant_user_link_integrity(
    p_link_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_revoked_at TIMESTAMPTZ;
    v_tenant_deleted_at TIMESTAMPTZ;
    v_user_deleted_at TIMESTAMPTZ;
BEGIN
    IF p_link_id IS NULL THEN
        RETURN;
    END IF;

    SELECT
        tenant_user.revoked_at,
        tenant.deleted_at,
        app_user.deleted_at

    INTO
        v_revoked_at,
        v_tenant_deleted_at,
        v_user_deleted_at

    FROM tenant_users AS tenant_user

    INNER JOIN tenants AS tenant
        ON tenant.id =
            tenant_user.tenant_id

    INNER JOIN users AS app_user
        ON app_user.id =
            tenant_user.user_id

    WHERE tenant_user.id =
        p_link_id

    FOR UPDATE OF
        tenant_user,
        tenant,
        app_user;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    /*
     * Revoked historical links may reference
     * deleted tenant or user records.
     *
     * Current links may not.
     */
    IF v_revoked_at IS NULL THEN
        IF v_tenant_deleted_at IS NOT NULL THEN
            RAISE EXCEPTION
                'An active tenant-user link cannot reference a deleted tenant.'
            USING ERRCODE = '23514';
        END IF;

        IF v_user_deleted_at IS NOT NULL THEN
            RAISE EXCEPTION
                'An active tenant-user link cannot reference a deleted user.'
            USING ERRCODE = '23514';
        END IF;
    END IF;
END;
$$;


-- =========================================================
-- 4. VALIDATE TENANT SOFT DELETE
-- =========================================================

CREATE OR REPLACE FUNCTION
validate_tenant_active_user_links(
    p_tenant_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant_deleted_at TIMESTAMPTZ;
    v_active_link_count INTEGER;
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
        v_active_link_count

    FROM tenant_users

    WHERE tenant_id = p_tenant_id
      AND revoked_at IS NULL;

    IF v_active_link_count > 0 THEN
        RAISE EXCEPTION
            'A tenant with active tenant-user links cannot be deleted. Active links: %.',
            v_active_link_count
        USING ERRCODE = '23514';
    END IF;
END;
$$;


-- =========================================================
-- 5. VALIDATE USER SOFT DELETE
-- =========================================================

CREATE OR REPLACE FUNCTION
validate_user_active_tenant_links(
    p_user_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_deleted_at TIMESTAMPTZ;
    v_active_link_count INTEGER;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN;
    END IF;

    SELECT
        deleted_at

    INTO
        v_user_deleted_at

    FROM users

    WHERE id = p_user_id

    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF v_user_deleted_at IS NULL THEN
        RETURN;
    END IF;

    SELECT
        COUNT(*)::INTEGER

    INTO
        v_active_link_count

    FROM tenant_users

    WHERE user_id = p_user_id
      AND revoked_at IS NULL;

    IF v_active_link_count > 0 THEN
        RAISE EXCEPTION
            'A user with active tenant links cannot be deleted. Active links: %.',
            v_active_link_count
        USING ERRCODE = '23514';
    END IF;
END;
$$;


-- =========================================================
-- 6. IMMUTABILITY AND HARD-DELETE PROTECTION
-- =========================================================

CREATE OR REPLACE FUNCTION
enforce_tenant_user_audit_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    /*
     * Tenant-user links are audit records.
     * They must be revoked, never hard-deleted.
     */
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Tenant-user links cannot be hard-deleted. Revoke the link instead.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * Revoked links are permanent historical records
     * and cannot be edited or reactivated.
     */
    IF OLD.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION
            'A revoked tenant-user link cannot be updated.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * Relationship identity and audit creator
     * cannot change after creation.
     */
    IF OLD.public_id IS DISTINCT FROM
        NEW.public_id
    THEN
        RAISE EXCEPTION
            'Tenant-user public ID cannot be changed.'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.tenant_id IS DISTINCT FROM
        NEW.tenant_id
    THEN
        RAISE EXCEPTION
            'Tenant-user tenant ID cannot be changed.'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.user_id IS DISTINCT FROM
        NEW.user_id
    THEN
        RAISE EXCEPTION
            'Tenant-user user ID cannot be changed.'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.created_by IS DISTINCT FROM
        NEW.created_by
    THEN
        RAISE EXCEPTION
            'Tenant-user creator cannot be changed.'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.created_at IS DISTINCT FROM
        NEW.created_at
    THEN
        RAISE EXCEPTION
            'Tenant-user creation timestamp cannot be changed.'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
    enforce_tenant_user_audit_integrity_trigger
ON tenant_users;


CREATE TRIGGER
    enforce_tenant_user_audit_integrity_trigger

BEFORE UPDATE OR DELETE
ON tenant_users

FOR EACH ROW

EXECUTE FUNCTION
    enforce_tenant_user_audit_integrity();


-- =========================================================
-- 7. SHARED DEFERRED VALIDATION FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION
trigger_validate_tenant_user_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    /*
     * Changes to tenant_users.
     */
    IF TG_TABLE_NAME = 'tenant_users' THEN
        IF TG_OP = 'INSERT' THEN
            PERFORM
                validate_tenant_user_link_integrity(
                    NEW.id
                );

            PERFORM
                validate_tenant_active_user_links(
                    NEW.tenant_id
                );

            PERFORM
                validate_user_active_tenant_links(
                    NEW.user_id
                );

            RETURN NEW;
        END IF;

        IF TG_OP = 'UPDATE' THEN
            PERFORM
                validate_tenant_user_link_integrity(
                    NEW.id
                );

            PERFORM
                validate_tenant_active_user_links(
                    NEW.tenant_id
                );

            PERFORM
                validate_user_active_tenant_links(
                    NEW.user_id
                );

            RETURN NEW;
        END IF;

        IF TG_OP = 'DELETE' THEN
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
            validate_tenant_active_user_links(
                NEW.id
            );

        RETURN NEW;
    END IF;

    /*
     * Changes to users.
     */
    IF TG_TABLE_NAME = 'users' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;

        PERFORM
            validate_user_active_tenant_links(
                NEW.id
            );

        RETURN NEW;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;


-- =========================================================
-- 8. TENANT USERS DEFERRED TRIGGER
-- =========================================================

DROP TRIGGER IF EXISTS
    constraint_tenant_users_integrity
ON tenant_users;


CREATE CONSTRAINT TRIGGER
    constraint_tenant_users_integrity

AFTER INSERT OR UPDATE
ON tenant_users

DEFERRABLE INITIALLY DEFERRED

FOR EACH ROW

EXECUTE FUNCTION
    trigger_validate_tenant_user_integrity();


-- =========================================================
-- 9. TENANTS DEFERRED TRIGGER
-- =========================================================

DROP TRIGGER IF EXISTS
    constraint_tenants_active_users
ON tenants;


CREATE CONSTRAINT TRIGGER
    constraint_tenants_active_users

AFTER INSERT OR UPDATE
ON tenants

DEFERRABLE INITIALLY DEFERRED

FOR EACH ROW

EXECUTE FUNCTION
    trigger_validate_tenant_user_integrity();


-- =========================================================
-- 10. USERS DEFERRED TRIGGER
-- =========================================================

DROP TRIGGER IF EXISTS
    constraint_users_active_tenants
ON users;


CREATE CONSTRAINT TRIGGER
    constraint_users_active_tenants

AFTER INSERT OR UPDATE
ON users

DEFERRABLE INITIALLY DEFERRED

FOR EACH ROW

EXECUTE FUNCTION
    trigger_validate_tenant_user_integrity();


-- =========================================================
-- 11. PRE-COMMIT EXISTING-DATA VALIDATION
-- =========================================================

DO $$
DECLARE
    v_invalid_link_count INTEGER;
BEGIN
    SELECT
        COUNT(*)::INTEGER

    INTO
        v_invalid_link_count

    FROM tenant_users AS tenant_user

    INNER JOIN tenants AS tenant
        ON tenant.id =
            tenant_user.tenant_id

    INNER JOIN users AS app_user
        ON app_user.id =
            tenant_user.user_id

    WHERE tenant_user.revoked_at IS NULL
      AND (
          tenant.deleted_at IS NOT NULL
          OR app_user.deleted_at IS NOT NULL
      );

    IF v_invalid_link_count > 0 THEN
        RAISE EXCEPTION
            'Tenant-user integrity migration found % invalid active links.',
            v_invalid_link_count
        USING ERRCODE = '23514';
    END IF;
END
$$;

COMMIT;
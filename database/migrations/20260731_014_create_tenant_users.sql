BEGIN;

-- =========================================================
-- TENANT USERS TABLE
-- Connects tenant legal/business profiles with login users.
-- The relationship is retained after revocation for audit.
-- =========================================================

CREATE TABLE tenant_users (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(50) NOT NULL,

    tenant_id BIGINT NOT NULL,

    user_id BIGINT NOT NULL,

    relationship_role VARCHAR(40)
        NOT NULL
        DEFAULT 'viewer',

    is_primary BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    can_view_leases BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    can_view_finances BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    can_make_payments BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    can_submit_maintenance BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    can_manage_tenant_users BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    created_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    revoked_at TIMESTAMPTZ,

    revoked_by BIGINT,

    CONSTRAINT uq_tenant_users_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_tenant_users_role
        CHECK (
            relationship_role IN (
                'primary_contact',
                'authorized_representative',
                'accountant',
                'occupant',
                'viewer'
            )
        ),

    /*
     * revoked_at and revoked_by must always
     * be supplied or cleared together.
     */
    CONSTRAINT chk_tenant_users_revocation
        CHECK (
            (
                revoked_at IS NULL
                AND revoked_by IS NULL
            )
            OR
            (
                revoked_at IS NOT NULL
                AND revoked_by IS NOT NULL
            )
        ),

    /*
     * A revoked tenant-user relationship
     * cannot remain primary.
     */
    CONSTRAINT chk_tenant_users_revoked_primary
        CHECK (
            revoked_at IS NULL
            OR is_primary = FALSE
        ),

    /*
     * A primary user must be the primary contact,
     * remain active and have permission to manage
     * other tenant users.
     */
    CONSTRAINT chk_tenant_users_primary_permissions
        CHECK (
            is_primary = FALSE
            OR
            (
                relationship_role =
                    'primary_contact'
                AND revoked_at IS NULL
                AND can_manage_tenant_users =
                    TRUE
            )
        ),

    /*
     * A user cannot make payments without
     * permission to view financial information.
     */
    CONSTRAINT chk_tenant_users_payment_permission
        CHECK (
            can_make_payments = FALSE
            OR can_view_finances = TRUE
        ),

    CONSTRAINT fk_tenant_users_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_tenant_users_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_tenant_users_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_tenant_users_revoked_by
        FOREIGN KEY (revoked_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- ACTIVE TENANT–USER UNIQUENESS
-- A user can have only one current link per tenant.
-- Revoked historical links do not block a new link.
-- =========================================================

CREATE UNIQUE INDEX
    uq_tenant_users_current_link
ON tenant_users (
    tenant_id,
    user_id
)
WHERE revoked_at IS NULL;


-- =========================================================
-- ONE ACTIVE PRIMARY USER PER TENANT
-- =========================================================

CREATE UNIQUE INDEX
    uq_tenant_users_active_primary
ON tenant_users (
    tenant_id
)
WHERE is_primary = TRUE
  AND revoked_at IS NULL;


-- =========================================================
-- QUERY PERFORMANCE INDEXES
-- =========================================================

CREATE INDEX idx_tenant_users_tenant
ON tenant_users (tenant_id)
WHERE revoked_at IS NULL;


CREATE INDEX idx_tenant_users_user
ON tenant_users (user_id)
WHERE revoked_at IS NULL;


CREATE INDEX idx_tenant_users_role
ON tenant_users (
    relationship_role
)
WHERE revoked_at IS NULL;


CREATE INDEX idx_tenant_users_created_by
ON tenant_users (created_by);


CREATE INDEX idx_tenant_users_created_at
ON tenant_users (created_at DESC);


CREATE INDEX idx_tenant_users_revoked_at
ON tenant_users (revoked_at)
WHERE revoked_at IS NOT NULL;


CREATE INDEX idx_tenant_users_revoked_by
ON tenant_users (revoked_by)
WHERE revoked_by IS NOT NULL;


-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON TABLE tenant_users IS
'Connects tenant legal/business profiles with login users for tenant portal access and preserves revoked relationships for audit.';


COMMENT ON COLUMN tenant_users.public_id IS
'Public API identifier generated by the application, for example tenant_user_xxxxx.';


COMMENT ON COLUMN tenant_users.relationship_role IS
'Supported roles: primary_contact, authorized_representative, accountant, occupant and viewer.';


COMMENT ON COLUMN tenant_users.is_primary IS
'Marks the tenant primary contact. Only one active primary user is allowed per tenant.';


COMMENT ON COLUMN tenant_users.can_view_leases IS
'Allows the user to view tenant lease agreements.';


COMMENT ON COLUMN tenant_users.can_view_finances IS
'Allows the user to view invoices, balances, payments and receipts.';


COMMENT ON COLUMN tenant_users.can_make_payments IS
'Allows the user to initiate or record tenant payments where supported.';


COMMENT ON COLUMN tenant_users.can_submit_maintenance IS
'Allows the user to submit maintenance requests for eligible leased units.';


COMMENT ON COLUMN tenant_users.can_manage_tenant_users IS
'Allows the user to manage other users linked to the tenant where authorization rules permit.';


COMMENT ON COLUMN tenant_users.revoked_at IS
'Timestamp when tenant portal access was revoked. NULL means the relationship is current.';


COMMENT ON COLUMN tenant_users.revoked_by IS
'Internal user ID of the account that revoked the tenant-user relationship.';

COMMIT;
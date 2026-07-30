BEGIN;

-- =========================================================
-- OWNER–TENANTS TABLE
-- Connects tenant legal profiles with owners while retaining
-- historical relationships and enforcing owner data isolation.
-- =========================================================

CREATE TABLE owner_tenants (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(50) NOT NULL,

    owner_id BIGINT NOT NULL,

    tenant_id BIGINT NOT NULL,

    relationship_status VARCHAR(20)
        NOT NULL
        DEFAULT 'active',

    is_primary_owner_relationship BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    notes TEXT,

    created_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    ended_at TIMESTAMPTZ,

    CONSTRAINT uq_owner_tenants_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_owner_tenants_status
        CHECK (
            relationship_status IN (
                'active',
                'blocked',
                'ended'
            )
        ),

    /*
     * Active/blocked relationships are current and therefore
     * must not have ended_at.
     *
     * Ended relationships must have ended_at.
     */
    CONSTRAINT chk_owner_tenants_state_consistency
        CHECK (
            (
                relationship_status IN (
                    'active',
                    'blocked'
                )
                AND ended_at IS NULL
            )
            OR
            (
                relationship_status = 'ended'
                AND ended_at IS NOT NULL
            )
        ),

    /*
     * Only a current active relationship can be marked
     * as the tenant's primary owner relationship.
     */
    CONSTRAINT chk_owner_tenants_primary_state
        CHECK (
            is_primary_owner_relationship = FALSE
            OR
            (
                relationship_status = 'active'
                AND ended_at IS NULL
            )
        ),

    CONSTRAINT fk_owner_tenants_owner
        FOREIGN KEY (owner_id)
        REFERENCES owners(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_owner_tenants_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_owner_tenants_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- ACTIVE RELATIONSHIP INTEGRITY
-- Prevent the same owner and tenant from having more than
-- one current relationship.
-- =========================================================

CREATE UNIQUE INDEX
    uq_owner_tenants_current_relationship
ON owner_tenants (
    owner_id,
    tenant_id
)
WHERE ended_at IS NULL
  AND relationship_status IN (
      'active',
      'blocked'
  );


-- =========================================================
-- PRIMARY OWNER RELATIONSHIP
-- A tenant can have several current owner relationships,
-- but only one can be marked as primary.
-- =========================================================

CREATE UNIQUE INDEX
    uq_owner_tenants_primary_relationship
ON owner_tenants (
    tenant_id
)
WHERE is_primary_owner_relationship = TRUE
  AND relationship_status = 'active'
  AND ended_at IS NULL;


-- =========================================================
-- QUERY PERFORMANCE INDEXES
-- =========================================================

CREATE INDEX idx_owner_tenants_owner
ON owner_tenants (owner_id)
WHERE ended_at IS NULL;


CREATE INDEX idx_owner_tenants_tenant
ON owner_tenants (tenant_id)
WHERE ended_at IS NULL;


CREATE INDEX idx_owner_tenants_status
ON owner_tenants (relationship_status)
WHERE ended_at IS NULL;


CREATE INDEX idx_owner_tenants_created_by
ON owner_tenants (created_by);


CREATE INDEX idx_owner_tenants_created_at
ON owner_tenants (created_at DESC);


CREATE INDEX idx_owner_tenants_ended_at
ON owner_tenants (ended_at)
WHERE ended_at IS NOT NULL;


COMMENT ON TABLE owner_tenants IS
'Connects tenant profiles with owners for access isolation and historical relationship tracking.';


COMMENT ON COLUMN owner_tenants.public_id IS
'Public API identifier, for example owner_tenant_xxxxx.';


COMMENT ON COLUMN owner_tenants.relationship_status IS
'Relationship lifecycle status: active, blocked or ended.';


COMMENT ON COLUMN owner_tenants.is_primary_owner_relationship IS
'Marks the default primary owner relationship for the tenant.';


COMMENT ON COLUMN owner_tenants.ended_at IS
'Timestamp when the owner–tenant relationship ended. NULL means the relationship is current.';

COMMIT;
BEGIN;

CREATE TABLE owner_users (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(40) NOT NULL UNIQUE,

    owner_id BIGINT NOT NULL,

    user_id BIGINT NOT NULL,

    relationship_role VARCHAR(30) NOT NULL DEFAULT 'viewer',

    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    can_manage_properties BOOLEAN NOT NULL DEFAULT FALSE,

    can_manage_finances BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    revoked_at TIMESTAMPTZ DEFAULT NULL,

    CONSTRAINT fk_owner_users_owner
        FOREIGN KEY (owner_id)
        REFERENCES owners(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_owner_users_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_owner_users_relationship_role
        CHECK (
            relationship_role IN (
                'owner',
                'representative',
                'manager',
                'accountant',
                'viewer'
            )
        )
);

CREATE INDEX idx_owner_users_owner_id
ON owner_users(owner_id);

CREATE INDEX idx_owner_users_user_id
ON owner_users(user_id);

CREATE INDEX idx_owner_users_relationship_role
ON owner_users(relationship_role);

CREATE INDEX idx_owner_users_revoked_at
ON owner_users(revoked_at);

CREATE UNIQUE INDEX uq_owner_users_active_relationship
ON owner_users(owner_id, user_id)
WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX uq_owner_users_primary_representative
ON owner_users(owner_id)
WHERE is_primary = TRUE
  AND revoked_at IS NULL;

COMMIT;
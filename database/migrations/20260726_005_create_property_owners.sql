BEGIN;

CREATE TABLE property_owners (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(40) NOT NULL UNIQUE,

    property_id BIGINT NOT NULL,

    owner_id BIGINT NOT NULL,

    ownership_percentage NUMERIC(7,4) NOT NULL,

    ownership_type VARCHAR(30) NOT NULL DEFAULT 'legal',

    is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,

    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,

    effective_to DATE DEFAULT NULL,

    created_by BIGINT DEFAULT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_property_owners_property
        FOREIGN KEY (property_id)
        REFERENCES properties(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_property_owners_owner
        FOREIGN KEY (owner_id)
        REFERENCES owners(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_property_owners_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_property_owners_public_id_not_blank
        CHECK (
            BTRIM(public_id) <> ''
        ),

    CONSTRAINT chk_property_owners_percentage
        CHECK (
            ownership_percentage > 0
            AND ownership_percentage <= 100
        ),

    CONSTRAINT chk_property_owners_type
        CHECK (
            ownership_type IN (
                'legal',
                'beneficial',
                'trustee',
                'nominee',
                'customary',
                'government',
                'other'
            )
        ),

    CONSTRAINT chk_property_owners_dates
        CHECK (
            effective_to IS NULL
            OR effective_to >= effective_from
        )
);

CREATE INDEX idx_property_owners_property_id
ON property_owners(property_id);

CREATE INDEX idx_property_owners_owner_id
ON property_owners(owner_id);

CREATE INDEX idx_property_owners_created_by
ON property_owners(created_by);

CREATE INDEX idx_property_owners_effective_dates
ON property_owners(effective_from, effective_to);

CREATE UNIQUE INDEX uq_property_owners_active_relationship
ON property_owners(property_id, owner_id)
WHERE effective_to IS NULL;

CREATE UNIQUE INDEX uq_property_owners_primary_contact
ON property_owners(property_id)
WHERE is_primary_contact = TRUE
  AND effective_to IS NULL;

COMMIT;
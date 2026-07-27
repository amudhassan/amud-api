BEGIN;

CREATE TABLE owners (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(40) NOT NULL UNIQUE,

    owner_type VARCHAR(30) NOT NULL,

    display_name VARCHAR(255) NOT NULL,

    registration_number VARCHAR(100),

    tax_identification_number VARCHAR(100),

    email VARCHAR(255),

    phone_number VARCHAR(30),

    alternative_phone VARCHAR(30),

    address TEXT,

    city VARCHAR(100),

    region VARCHAR(100),

    country VARCHAR(100) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'active',

    created_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    deleted_at TIMESTAMPTZ DEFAULT NULL,

    CONSTRAINT chk_owners_owner_type
        CHECK (
            owner_type IN (
                'individual',
                'company',
                'government',
                'organization',
                'partnership'
            )
        ),

    CONSTRAINT chk_owners_status
        CHECK (
            status IN (
                'active',
                'inactive',
                'blocked'
            )
        ),

    CONSTRAINT fk_owners_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_owners_owner_type
ON owners(owner_type);

CREATE INDEX idx_owners_status
ON owners(status);

CREATE INDEX idx_owners_created_by
ON owners(created_by);

CREATE INDEX idx_owners_deleted_at
ON owners(deleted_at);

CREATE INDEX idx_owners_display_name
ON owners(display_name);

CREATE UNIQUE INDEX uq_owners_country_registration_number
ON owners(country, registration_number)
WHERE registration_number IS NOT NULL
  AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_owners_country_tax_number
ON owners(country, tax_identification_number)
WHERE tax_identification_number IS NOT NULL
  AND deleted_at IS NULL;

COMMIT;
BEGIN;

CREATE TABLE owner_shareholders (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(40) NOT NULL UNIQUE,

    company_owner_id BIGINT NOT NULL,

    shareholder_owner_id BIGINT NOT NULL,

    share_percentage NUMERIC(7,4) NOT NULL,

    shareholder_type VARCHAR(30) NOT NULL DEFAULT 'ordinary',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,

    effective_to DATE DEFAULT NULL,

    created_by BIGINT DEFAULT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_owner_shareholders_company
        FOREIGN KEY (company_owner_id)
        REFERENCES owners(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_owner_shareholders_shareholder
        FOREIGN KEY (shareholder_owner_id)
        REFERENCES owners(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_owner_shareholders_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_owner_shareholders_percentage
        CHECK (
            share_percentage > 0
            AND share_percentage <= 100
        ),

    CONSTRAINT chk_owner_shareholders_not_self
        CHECK (
            company_owner_id <> shareholder_owner_id
        ),

    CONSTRAINT chk_owner_shareholders_type
        CHECK (
            shareholder_type IN (
                'ordinary',
                'preferred',
                'founder',
                'institutional',
                'government',
                'partner'
            )
        ),

    CONSTRAINT chk_owner_shareholders_dates
        CHECK (
            effective_to IS NULL
            OR effective_to >= effective_from
        ),

    CONSTRAINT chk_owner_shareholders_active_dates
        CHECK (
            NOT (
                is_active = TRUE
                AND effective_to IS NOT NULL
            )
        )
);

CREATE INDEX idx_owner_shareholders_company
ON owner_shareholders(company_owner_id);

CREATE INDEX idx_owner_shareholders_shareholder
ON owner_shareholders(shareholder_owner_id);

CREATE INDEX idx_owner_shareholders_created_by
ON owner_shareholders(created_by);

CREATE INDEX idx_owner_shareholders_active
ON owner_shareholders(is_active);

CREATE INDEX idx_owner_shareholders_effective_dates
ON owner_shareholders(effective_from, effective_to);

CREATE UNIQUE INDEX uq_owner_shareholders_active_relationship
ON owner_shareholders(
    company_owner_id,
    shareholder_owner_id,
    shareholder_type
)
WHERE is_active = TRUE
  AND effective_to IS NULL;

COMMIT;
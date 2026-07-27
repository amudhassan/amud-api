BEGIN;

CREATE TABLE properties (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(40) NOT NULL UNIQUE,

    property_code VARCHAR(50) NOT NULL,

    property_name VARCHAR(255) NOT NULL,

    property_type VARCHAR(60) NOT NULL,

    usage_category VARCHAR(30) NOT NULL,

    description TEXT,

    address TEXT,

    city VARCHAR(100),

    region VARCHAR(100) NOT NULL,

    country VARCHAR(100) NOT NULL,

    postal_code VARCHAR(30),

    latitude NUMERIC(10,7),

    longitude NUMERIC(10,7),

    year_built SMALLINT,

    is_multi_unit BOOLEAN NOT NULL DEFAULT FALSE,

    operational_status VARCHAR(30) NOT NULL DEFAULT 'inactive',

    created_by BIGINT DEFAULT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    deleted_at TIMESTAMPTZ DEFAULT NULL,

    CONSTRAINT fk_properties_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_properties_public_id_not_blank
        CHECK (BTRIM(public_id) <> ''),

    CONSTRAINT chk_properties_code_not_blank
        CHECK (BTRIM(property_code) <> ''),

    CONSTRAINT chk_properties_name_not_blank
        CHECK (BTRIM(property_name) <> ''),

    CONSTRAINT chk_properties_type_not_blank
        CHECK (BTRIM(property_type) <> ''),

    CONSTRAINT chk_properties_region_not_blank
        CHECK (BTRIM(region) <> ''),

    CONSTRAINT chk_properties_country_not_blank
        CHECK (BTRIM(country) <> ''),

    CONSTRAINT chk_properties_usage_category
        CHECK (
            usage_category IN (
                'residential',
                'commercial',
                'mixed',
                'industrial',
                'land',
                'hospitality',
                'institutional',
                'agricultural',
                'other'
            )
        ),

    CONSTRAINT chk_properties_operational_status
        CHECK (
            operational_status IN (
                'inactive',
                'active',
                'maintenance',
                'under_construction',
                'sold'
            )
        ),

    CONSTRAINT chk_properties_latitude
        CHECK (
            latitude IS NULL
            OR latitude BETWEEN -90 AND 90
        ),

    CONSTRAINT chk_properties_longitude
        CHECK (
            longitude IS NULL
            OR longitude BETWEEN -180 AND 180
        ),

    CONSTRAINT chk_properties_coordinate_pair
        CHECK (
            (
                latitude IS NULL
                AND longitude IS NULL
            )
            OR
            (
                latitude IS NOT NULL
                AND longitude IS NOT NULL
            )
        ),

    CONSTRAINT chk_properties_year_built
        CHECK (
            year_built IS NULL
            OR year_built BETWEEN 1000 AND 9999
        )
);

CREATE UNIQUE INDEX uq_properties_property_code_ci
ON properties (
    LOWER(BTRIM(property_code))
);

CREATE INDEX idx_properties_property_name
ON properties(property_name);

CREATE INDEX idx_properties_property_type
ON properties(property_type);

CREATE INDEX idx_properties_usage_category
ON properties(usage_category);

CREATE INDEX idx_properties_operational_status
ON properties(operational_status);

CREATE INDEX idx_properties_location
ON properties(country, region, city);

CREATE INDEX idx_properties_created_by
ON properties(created_by);

CREATE INDEX idx_properties_deleted_at
ON properties(deleted_at);

COMMIT;
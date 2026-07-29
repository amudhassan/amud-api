BEGIN;

-- =========================================================
-- UNITS TABLE
-- A rentable space belonging to one property.
-- =========================================================

CREATE TABLE units (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(50) NOT NULL,

    property_id BIGINT NOT NULL,

    unit_code VARCHAR(50) NOT NULL,

    unit_name VARCHAR(150),

    unit_type VARCHAR(30) NOT NULL,

    floor_number INTEGER,

    bedrooms INTEGER NOT NULL DEFAULT 0,

    bathrooms NUMERIC(5,2) NOT NULL DEFAULT 0,

    area_size NUMERIC(14,2),

    area_unit VARCHAR(30),

    description TEXT,

    operational_status VARCHAR(30)
        NOT NULL
        DEFAULT 'inactive',

    created_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    deleted_at TIMESTAMPTZ,

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT units_property_fk
        FOREIGN KEY (property_id)
        REFERENCES properties(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT units_created_by_fk
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    -- =====================================================
    -- PUBLIC ID VALIDATION
    -- =====================================================

    CONSTRAINT units_public_id_format_check
        CHECK (
            public_id ~
            '^unit_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT units_public_id_length_check
        CHECK (
            CHAR_LENGTH(public_id)
            BETWEEN 10 AND 50
        ),

    -- =====================================================
    -- UNIT CODE AND NAME
    -- =====================================================

    CONSTRAINT units_code_not_empty_check
        CHECK (
            BTRIM(unit_code) <> ''
        ),

    CONSTRAINT units_name_not_empty_check
        CHECK (
            unit_name IS NULL
            OR BTRIM(unit_name) <> ''
        ),

    -- =====================================================
    -- UNIT TYPE
    -- =====================================================

    CONSTRAINT units_type_check
        CHECK (
            unit_type IN (
                'apartment',
                'house',
                'room',
                'shop',
                'office',
                'warehouse',
                'studio',
                'villa',
                'land_section',
                'commercial_space',
                'other'
            )
        ),

    -- =====================================================
    -- FLOOR AND PHYSICAL DETAILS
    -- Negative floors support basements.
    -- =====================================================

    CONSTRAINT units_floor_number_check
        CHECK (
            floor_number IS NULL
            OR floor_number BETWEEN -20 AND 300
        ),

    CONSTRAINT units_bedrooms_check
        CHECK (
            bedrooms BETWEEN 0 AND 100
        ),

    CONSTRAINT units_bathrooms_check
        CHECK (
            bathrooms BETWEEN 0 AND 100
        ),

    CONSTRAINT units_area_size_check
        CHECK (
            area_size IS NULL
            OR area_size > 0
        ),

    CONSTRAINT units_area_unit_check
        CHECK (
            area_unit IS NULL
            OR area_unit IN (
                'square_meter',
                'square_foot',
                'acre',
                'hectare',
                'other'
            )
        ),

    -- =====================================================
    -- OPERATIONAL STATUS
    -- =====================================================

    CONSTRAINT units_operational_status_check
        CHECK (
            operational_status IN (
                'inactive',
                'available',
                'reserved',
                'occupied',
                'maintenance'
            )
        ),

    -- =====================================================
    -- SOFT DELETE DATE CONSISTENCY
    -- =====================================================

    CONSTRAINT units_deleted_at_check
        CHECK (
            deleted_at IS NULL
            OR deleted_at >= created_at
        )
);


-- =========================================================
-- UNIQUE IDENTIFIERS
-- =========================================================

CREATE UNIQUE INDEX
    uq_units_public_id
ON units (public_id);


-- Unit code is unique within one property while not deleted.
-- LOWER + BTRIM prevents A-01 and a-01 from coexisting.
CREATE UNIQUE INDEX
    uq_units_active_property_code
ON units (
    property_id,
    LOWER(BTRIM(unit_code))
)
WHERE deleted_at IS NULL;


-- =========================================================
-- PERFORMANCE INDEXES
-- =========================================================

CREATE INDEX
    idx_units_property_id
ON units (property_id);


CREATE INDEX
    idx_units_created_by
ON units (created_by);


CREATE INDEX
    idx_units_operational_status
ON units (operational_status)
WHERE deleted_at IS NULL;


CREATE INDEX
    idx_units_property_status
ON units (
    property_id,
    operational_status
)
WHERE deleted_at IS NULL;


CREATE INDEX
    idx_units_property_type
ON units (
    property_id,
    unit_type
)
WHERE deleted_at IS NULL;


CREATE INDEX
    idx_units_property_floor
ON units (
    property_id,
    floor_number
)
WHERE deleted_at IS NULL;


CREATE INDEX
    idx_units_deleted_at
ON units (deleted_at)
WHERE deleted_at IS NOT NULL;


CREATE INDEX
    idx_units_created_at
ON units (created_at DESC);


-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON TABLE units IS
'Rentable spaces belonging to properties. Every lease will eventually reference a unit.';

COMMENT ON COLUMN units.public_id IS
'Public API identifier beginning with unit_.';

COMMENT ON COLUMN units.unit_code IS
'Property-specific unit identifier such as A-01, SHOP-03 or ENTIRE-HOUSE.';

COMMENT ON COLUMN units.operational_status IS
'Unit lifecycle status: inactive, available, reserved, occupied or maintenance.';

COMMENT ON COLUMN units.deleted_at IS
'Soft-delete timestamp. NULL means the unit has not been deleted.';

COMMIT;
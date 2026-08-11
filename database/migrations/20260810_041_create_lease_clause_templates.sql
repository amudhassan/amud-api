BEGIN;

-- =========================================================
-- LEASE CLAUSE TEMPLATES
-- Reusable owner-specific contractual clause collections.
--
-- BUSINESS RULES:
-- 1. Every template belongs to exactly one owner.
-- 2. Templates are reusable definitions, not live links.
-- 3. Applying a template to a Draft lease will later COPY
--    its active items into lease_clauses as a snapshot.
-- 4. Template deletion is soft delete only.
-- 5. Template items are ordered and use the same clause
--    categories as lease_clauses.
-- =========================================================

CREATE TABLE lease_clause_templates (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(90) NOT NULL,

    owner_id BIGINT NOT NULL,

    name VARCHAR(200) NOT NULL,

    description TEXT,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'active',

    created_by BIGINT NOT NULL,

    updated_by BIGINT,

    deleted_by BIGINT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    deleted_at TIMESTAMPTZ,

    -- =====================================================
    -- IDENTIFIER
    -- =====================================================

    CONSTRAINT uq_lease_clause_templates_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_lease_clause_templates_public_id
        CHECK (
            public_id ~
                '^lease_clause_template_[A-Za-z0-9_-]+$'
        ),

    -- =====================================================
    -- TEMPLATE CONTENT
    -- =====================================================

    CONSTRAINT chk_lease_clause_templates_name
        CHECK (
            btrim(name) <> ''
            AND char_length(btrim(name))
                <= 200
        ),

    CONSTRAINT chk_lease_clause_templates_description
        CHECK (
            description IS NULL
            OR (
                btrim(description) <> ''
                AND char_length(btrim(description))
                    <= 2000
            )
        ),

    CONSTRAINT chk_lease_clause_templates_status
        CHECK (
            status IN (
                'active',
                'inactive'
            )
        ),

    -- =====================================================
    -- SOFT DELETE / AUDIT
    -- =====================================================

    CONSTRAINT chk_lease_clause_templates_deleted_pair
        CHECK (
            (
                deleted_at IS NULL
                AND deleted_by IS NULL
            )
            OR
            (
                deleted_at IS NOT NULL
                AND deleted_by IS NOT NULL
            )
        ),

    CONSTRAINT chk_lease_clause_templates_timestamps
        CHECK (
            updated_at >= created_at
            AND (
                deleted_at IS NULL
                OR deleted_at >= created_at
            )
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_lease_clause_templates_owner
        FOREIGN KEY (owner_id)
        REFERENCES owners(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_lease_clause_templates_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_lease_clause_templates_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_lease_clause_templates_deleted_by
        FOREIGN KEY (deleted_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- TEMPLATE ITEM TABLE
-- =========================================================

CREATE TABLE lease_clause_template_items (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(100) NOT NULL,

    template_id BIGINT NOT NULL,

    clause_category VARCHAR(40) NOT NULL,

    title VARCHAR(200) NOT NULL,

    clause_text TEXT NOT NULL,

    is_mandatory BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    display_order INTEGER
        NOT NULL
        DEFAULT 1,

    created_by BIGINT NOT NULL,

    updated_by BIGINT,

    deleted_by BIGINT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    deleted_at TIMESTAMPTZ,

    -- =====================================================
    -- IDENTIFIER
    -- =====================================================

    CONSTRAINT uq_lease_clause_template_items_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_lease_clause_template_items_public_id
        CHECK (
            public_id ~
                '^lease_clause_template_item_[A-Za-z0-9_-]+$'
        ),

    -- =====================================================
    -- CONTRACT CONTENT
    -- =====================================================

    CONSTRAINT chk_lease_clause_template_items_category
        CHECK (
            clause_category IN (
                'pets',
                'subletting',
                'utilities',
                'maintenance',
                'occupancy',
                'property_use',
                'alterations',
                'notice',
                'termination',
                'deposit',
                'access_inspection',
                'smoking',
                'noise',
                'parking',
                'insurance_liability',
                'custom'
            )
        ),

    CONSTRAINT chk_lease_clause_template_items_title
        CHECK (
            btrim(title) <> ''
            AND char_length(btrim(title))
                <= 200
        ),

    CONSTRAINT chk_lease_clause_template_items_text
        CHECK (
            btrim(clause_text) <> ''
            AND char_length(btrim(clause_text))
                <= 10000
        ),

    CONSTRAINT chk_lease_clause_template_items_display_order
        CHECK (
            display_order >= 1
            AND display_order <= 10000
        ),

    -- =====================================================
    -- SOFT DELETE / AUDIT
    -- =====================================================

    CONSTRAINT chk_lease_clause_template_items_deleted_pair
        CHECK (
            (
                deleted_at IS NULL
                AND deleted_by IS NULL
            )
            OR
            (
                deleted_at IS NOT NULL
                AND deleted_by IS NOT NULL
            )
        ),

    CONSTRAINT chk_lease_clause_template_items_timestamps
        CHECK (
            updated_at >= created_at
            AND (
                deleted_at IS NULL
                OR deleted_at >= created_at
            )
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_lease_clause_template_items_template
        FOREIGN KEY (template_id)
        REFERENCES lease_clause_templates(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_lease_clause_template_items_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_lease_clause_template_items_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_lease_clause_template_items_deleted_by
        FOREIGN KEY (deleted_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- QUERY / UNIQUENESS INDEXES
-- =========================================================

CREATE UNIQUE INDEX
uq_lease_clause_templates_owner_active_name
ON lease_clause_templates (
    owner_id,
    lower(btrim(name))
)
WHERE deleted_at IS NULL;

CREATE INDEX idx_lease_clause_templates_owner
ON lease_clause_templates (
    owner_id
);

CREATE INDEX idx_lease_clause_templates_owner_status
ON lease_clause_templates (
    owner_id,
    status,
    name
)
WHERE deleted_at IS NULL;

CREATE INDEX idx_lease_clause_templates_created_by
ON lease_clause_templates (
    created_by
);

CREATE INDEX idx_lease_clause_templates_deleted
ON lease_clause_templates (
    owner_id,
    deleted_at DESC
)
WHERE deleted_at IS NOT NULL;

CREATE INDEX idx_lease_clause_template_items_template
ON lease_clause_template_items (
    template_id
);

CREATE INDEX idx_lease_clause_template_items_active_order
ON lease_clause_template_items (
    template_id,
    display_order,
    id
)
WHERE deleted_at IS NULL;

CREATE INDEX idx_lease_clause_template_items_active_category
ON lease_clause_template_items (
    template_id,
    clause_category,
    display_order
)
WHERE deleted_at IS NULL;

CREATE INDEX idx_lease_clause_template_items_created_by
ON lease_clause_template_items (
    created_by
);

CREATE INDEX idx_lease_clause_template_items_deleted
ON lease_clause_template_items (
    template_id,
    deleted_at DESC
)
WHERE deleted_at IS NOT NULL;


-- =========================================================
-- TEMPLATE INTEGRITY TRIGGER
--
-- Protects template ownership and audit history:
-- 1. No hard delete.
-- 2. Owner / public ID / creation audit are immutable.
-- 3. Deleted templates cannot be modified.
-- =========================================================

CREATE OR REPLACE FUNCTION
enforce_lease_clause_template_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Lease clause templates cannot be hard deleted.'
        USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.owner_id <> OLD.owner_id THEN
            RAISE EXCEPTION
                'A lease clause template cannot be moved to another owner.'
            USING ERRCODE = '23514';
        END IF;

        IF NEW.public_id <> OLD.public_id THEN
            RAISE EXCEPTION
                'Lease clause template public ID cannot be changed.'
            USING ERRCODE = '23514';
        END IF;

        IF NEW.created_by <> OLD.created_by
           OR NEW.created_at <> OLD.created_at
        THEN
            RAISE EXCEPTION
                'Lease clause template creation audit fields cannot be changed.'
            USING ERRCODE = '23514';
        END IF;

        /*
         * Once soft deleted, the historical template is frozen.
         * A future restore feature should introduce an explicit,
         * reviewed restore lifecycle instead of silently reviving it.
         */
        IF OLD.deleted_at IS NOT NULL THEN
            RAISE EXCEPTION
                'A deleted lease clause template cannot be modified.'
            USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
    enforce_lease_clause_template_integrity_trigger
ON lease_clause_templates;

CREATE TRIGGER
    enforce_lease_clause_template_integrity_trigger

BEFORE UPDATE OR DELETE
ON lease_clause_templates

FOR EACH ROW

EXECUTE FUNCTION
    enforce_lease_clause_template_integrity();


-- =========================================================
-- TEMPLATE ITEM INTEGRITY TRIGGER
--
-- Protects reusable clause definitions:
-- 1. No hard delete.
-- 2. Item cannot move to another template.
-- 3. Public ID / creation audit are immutable.
-- 4. Items cannot be added or modified after the parent
--    template has been soft deleted.
-- 5. Deleted items are frozen historical records.
-- =========================================================

CREATE OR REPLACE FUNCTION
enforce_lease_clause_template_item_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_template_id BIGINT;
    v_template_deleted_at TIMESTAMPTZ;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Lease clause template items cannot be hard deleted.'
        USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.template_id <> OLD.template_id THEN
            RAISE EXCEPTION
                'A lease clause template item cannot be moved to another template.'
            USING ERRCODE = '23514';
        END IF;

        IF NEW.public_id <> OLD.public_id THEN
            RAISE EXCEPTION
                'Lease clause template item public ID cannot be changed.'
            USING ERRCODE = '23514';
        END IF;

        IF NEW.created_by <> OLD.created_by
           OR NEW.created_at <> OLD.created_at
        THEN
            RAISE EXCEPTION
                'Lease clause template item creation audit fields cannot be changed.'
            USING ERRCODE = '23514';
        END IF;

        IF OLD.deleted_at IS NOT NULL THEN
            RAISE EXCEPTION
                'A deleted lease clause template item cannot be modified.'
            USING ERRCODE = '23514';
        END IF;
    END IF;

    v_template_id =
        CASE
            WHEN TG_OP = 'INSERT'
                THEN NEW.template_id
            ELSE OLD.template_id
        END;

    /*
     * Lock the parent template so item mutation cannot race
     * with template soft deletion.
     */
    SELECT deleted_at
    INTO v_template_deleted_at
    FROM lease_clause_templates
    WHERE id = v_template_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Parent lease clause template was not found.'
        USING ERRCODE = '23503';
    END IF;

    IF v_template_deleted_at IS NOT NULL THEN
        RAISE EXCEPTION
            'Items of a deleted lease clause template cannot be modified.'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
    enforce_lease_clause_template_item_integrity_trigger
ON lease_clause_template_items;

CREATE TRIGGER
    enforce_lease_clause_template_item_integrity_trigger

BEFORE INSERT OR UPDATE OR DELETE
ON lease_clause_template_items

FOR EACH ROW

EXECUTE FUNCTION
    enforce_lease_clause_template_item_integrity();


-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON TABLE lease_clause_templates IS
'Stores reusable owner-specific lease clause templates. Applying a template to a Draft lease copies its active items into lease_clauses as an independent contractual snapshot.';

COMMENT ON COLUMN lease_clause_templates.public_id IS
'Public API identifier generated by the application, for example lease_clause_template_xxxxx.';

COMMENT ON COLUMN lease_clause_templates.owner_id IS
'Owner that owns and may reuse this contractual clause template.';

COMMENT ON COLUMN lease_clause_templates.name IS
'Human-readable template name, unique among non-deleted templates for the same owner.';

COMMENT ON COLUMN lease_clause_templates.description IS
'Optional description explaining when the template should be used.';

COMMENT ON COLUMN lease_clause_templates.status IS
'Template availability state. Active templates may be offered for application; inactive templates remain stored but are not intended for new lease application.';

COMMENT ON COLUMN lease_clause_templates.deleted_at IS
'Soft-delete timestamp. Deleted templates remain available for audit history and cannot be hard deleted.';

COMMENT ON TABLE lease_clause_template_items IS
'Stores the ordered contractual clause definitions belonging to a reusable lease clause template.';

COMMENT ON COLUMN lease_clause_template_items.public_id IS
'Public API identifier generated by the application, for example lease_clause_template_item_xxxxx.';

COMMENT ON COLUMN lease_clause_template_items.template_id IS
'Parent reusable lease clause template.';

COMMENT ON COLUMN lease_clause_template_items.clause_category IS
'Business category matching the categories supported by lease_clauses.';

COMMENT ON COLUMN lease_clause_template_items.clause_text IS
'Reusable contractual wording copied into lease_clauses when the template is applied to a Draft lease.';

COMMENT ON COLUMN lease_clause_template_items.display_order IS
'Presentation and copy order for the template item.';

COMMENT ON COLUMN lease_clause_template_items.deleted_at IS
'Soft-delete timestamp. Deleted items remain available for audit history and cannot be hard deleted.';


COMMIT;
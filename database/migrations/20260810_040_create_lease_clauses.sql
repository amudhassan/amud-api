BEGIN;

-- =========================================================
-- LEASE CLAUSES
-- Contractual terms, restrictions and additional agreements
-- attached to one lease.
--
-- IMPORTANT BUSINESS RULE:
-- Clauses are editable only while the parent lease is Draft.
-- Once the lease leaves Draft, its clauses become frozen.
-- =========================================================

CREATE TABLE lease_clauses (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(70) NOT NULL,

    lease_id BIGINT NOT NULL,

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

    CONSTRAINT uq_lease_clauses_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_lease_clauses_public_id
        CHECK (
            public_id ~
                '^lease_clause_[A-Za-z0-9_-]+$'
        ),

    -- =====================================================
    -- CONTRACT CONTENT
    -- =====================================================

    CONSTRAINT chk_lease_clauses_category
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

    CONSTRAINT chk_lease_clauses_title
        CHECK (
            btrim(title) <> ''
            AND char_length(btrim(title))
                <= 200
        ),

    CONSTRAINT chk_lease_clauses_text
        CHECK (
            btrim(clause_text) <> ''
            AND char_length(btrim(clause_text))
                <= 10000
        ),

    CONSTRAINT chk_lease_clauses_display_order
        CHECK (
            display_order >= 1
            AND display_order <= 10000
        ),

    -- =====================================================
    -- SOFT DELETE / AUDIT
    -- =====================================================

    CONSTRAINT chk_lease_clauses_deleted_pair
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

    CONSTRAINT chk_lease_clauses_timestamps
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

    CONSTRAINT fk_lease_clauses_lease
        FOREIGN KEY (lease_id)
        REFERENCES leases(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_lease_clauses_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_lease_clauses_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_lease_clauses_deleted_by
        FOREIGN KEY (deleted_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- QUERY INDEXES
-- =========================================================

CREATE INDEX idx_lease_clauses_lease
ON lease_clauses (
    lease_id
);

CREATE INDEX idx_lease_clauses_active_order
ON lease_clauses (
    lease_id,
    display_order,
    id
)
WHERE deleted_at IS NULL;

CREATE INDEX idx_lease_clauses_active_category
ON lease_clauses (
    lease_id,
    clause_category,
    display_order
)
WHERE deleted_at IS NULL;

CREATE INDEX idx_lease_clauses_created_by
ON lease_clauses (
    created_by
);

CREATE INDEX idx_lease_clauses_deleted
ON lease_clauses (
    lease_id,
    deleted_at DESC
)
WHERE deleted_at IS NOT NULL;


-- =========================================================
-- LEASE CLAUSE INTEGRITY TRIGGER
--
-- Protects the signed contractual snapshot:
--   1. No hard delete.
--   2. Clause cannot move to another lease.
--   3. Identifier / creation audit is immutable.
--   4. Add/Edit/Soft-delete is allowed only for Draft lease.
-- =========================================================

CREATE OR REPLACE FUNCTION
enforce_lease_clause_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_lease_id BIGINT;
    v_lease_status VARCHAR(20);
BEGIN
    /*
     * Contract clauses are permanent audit records.
     * Removal is represented by soft delete only.
     */
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Lease clauses cannot be hard deleted.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * Creation audit and clause ownership cannot be
     * rewritten after the row is created.
     */
    IF TG_OP = 'UPDATE' THEN
        IF NEW.lease_id <> OLD.lease_id THEN
            RAISE EXCEPTION
                'A lease clause cannot be moved to another lease.'
            USING ERRCODE = '23514';
        END IF;

        IF NEW.public_id <> OLD.public_id THEN
            RAISE EXCEPTION
                'Lease clause public ID cannot be changed.'
            USING ERRCODE = '23514';
        END IF;

        IF NEW.created_by <> OLD.created_by
           OR NEW.created_at <> OLD.created_at
        THEN
            RAISE EXCEPTION
                'Lease clause creation audit fields cannot be changed.'
            USING ERRCODE = '23514';
        END IF;
    END IF;

    v_lease_id =
        CASE
            WHEN TG_OP = 'INSERT'
                THEN NEW.lease_id
            ELSE OLD.lease_id
        END;

    /*
     * Lock the parent lease so clause mutation cannot race
     * with scheduling/activation lifecycle transitions.
     */
    SELECT status
    INTO v_lease_status
    FROM leases
    WHERE id = v_lease_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Parent lease was not found.'
        USING ERRCODE = '23503';
    END IF;

    /*
     * Clauses freeze permanently once the lease leaves Draft.
     */
    IF v_lease_status <> 'draft' THEN
        RAISE EXCEPTION
            'Lease clauses can only be changed while the lease is in draft status.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * Soft-deleted rows remain historical records.
     * They cannot be edited while still deleted.
     *
     * A future explicit restore operation may clear
     * deleted_at/deleted_by while the parent lease is Draft.
     */
    IF TG_OP = 'UPDATE'
       AND OLD.deleted_at IS NOT NULL
       AND NEW.deleted_at IS NOT NULL
       AND (
            NEW.clause_category IS DISTINCT FROM
                OLD.clause_category
            OR NEW.title IS DISTINCT FROM OLD.title
            OR NEW.clause_text IS DISTINCT FROM
                OLD.clause_text
            OR NEW.is_mandatory IS DISTINCT FROM
                OLD.is_mandatory
            OR NEW.display_order IS DISTINCT FROM
                OLD.display_order
       )
    THEN
        RAISE EXCEPTION
            'A deleted lease clause cannot be edited.'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
    enforce_lease_clause_integrity_trigger
ON lease_clauses;

CREATE TRIGGER
    enforce_lease_clause_integrity_trigger

BEFORE INSERT OR UPDATE OR DELETE
ON lease_clauses

FOR EACH ROW

EXECUTE FUNCTION
    enforce_lease_clause_integrity();


-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON TABLE lease_clauses IS
'Stores contractual terms, restrictions and additional agreements belonging to a lease. Clauses are editable only while the parent lease is draft and become frozen when the lease leaves draft status.';

COMMENT ON COLUMN lease_clauses.public_id IS
'Public API identifier generated by the application, for example lease_clause_xxxxx.';

COMMENT ON COLUMN lease_clauses.lease_id IS
'Parent lease whose contractual agreement contains this clause.';

COMMENT ON COLUMN lease_clauses.clause_category IS
'Business category of the contractual term, such as pets, subletting, utilities, maintenance, occupancy, notice, termination, deposit or custom.';

COMMENT ON COLUMN lease_clauses.title IS
'Short human-readable heading for the contractual clause.';

COMMENT ON COLUMN lease_clauses.clause_text IS
'Full contractual wording agreed between the landlord/owner and tenant.';

COMMENT ON COLUMN lease_clauses.is_mandatory IS
'Indicates that the clause is a mandatory contractual term within the lease agreement.';

COMMENT ON COLUMN lease_clauses.display_order IS
'Presentation order used when displaying or generating the lease agreement document.';

COMMENT ON COLUMN lease_clauses.deleted_at IS
'Soft-delete timestamp. Deleted clauses remain available for audit history and cannot be hard deleted.';


COMMIT;
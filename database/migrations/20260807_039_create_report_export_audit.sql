BEGIN;

-- =========================================================
-- REPORTS & DASHBOARD - BATCH F
-- Report Export Audit
--
-- Export audit is reporting metadata only. It does not
-- duplicate transactional invoices, payments, leases,
-- properties or maintenance business records.
-- =========================================================

CREATE TABLE IF NOT EXISTS report_exports (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(60) NOT NULL,

    report_type VARCHAR(60) NOT NULL,

    export_format VARCHAR(10) NOT NULL,

    owner_public_id VARCHAR(50),

    property_public_id VARCHAR(50),

    filters JSONB
        NOT NULL
        DEFAULT '{}'::JSONB,

    row_count INTEGER
        NOT NULL
        DEFAULT 0,

    file_name VARCHAR(255) NOT NULL,

    generated_by BIGINT NOT NULL,

    generated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_report_exports_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_report_exports_public_id
        CHECK (
            public_id ~
            '^report_export_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_report_exports_report_type
        CHECK (
            report_type IN (
                'financial_summary',
                'financial_revenue',
                'financial_outstanding',
                'financial_collections',
                'occupancy',
                'leases',
                'expiring_leases',
                'maintenance_summary',
                'maintenance_performance',
                'maintenance_costs',
                'dashboard'
            )
        ),

    CONSTRAINT chk_report_exports_format
        CHECK (
            export_format IN (
                'csv',
                'pdf'
            )
        ),

    CONSTRAINT chk_report_exports_owner_public_id
        CHECK (
            owner_public_id IS NULL
            OR owner_public_id ~
                '^owner_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_report_exports_property_public_id
        CHECK (
            property_public_id IS NULL
            OR property_public_id ~
                '^property_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_report_exports_filters
        CHECK (
            jsonb_typeof(filters) =
                'object'
        ),

    CONSTRAINT chk_report_exports_row_count
        CHECK (
            row_count >= 0
        ),

    CONSTRAINT chk_report_exports_file_name
        CHECK (
            btrim(file_name) <> ''
        ),

    CONSTRAINT fk_report_exports_generated_by
        FOREIGN KEY (generated_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS
    idx_report_exports_actor_generated
ON report_exports (
    generated_by,
    generated_at DESC
);

CREATE INDEX IF NOT EXISTS
    idx_report_exports_type_generated
ON report_exports (
    report_type,
    generated_at DESC
);

CREATE INDEX IF NOT EXISTS
    idx_report_exports_owner_generated
ON report_exports (
    owner_public_id,
    generated_at DESC
)
WHERE owner_public_id IS NOT NULL;

CREATE OR REPLACE FUNCTION
protect_report_export_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Report export audit records are immutable.'
        USING ERRCODE = 'P0001';
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname =
            'trg_report_exports_immutable'
          AND tgrelid =
            'report_exports'::regclass
    ) THEN
        CREATE TRIGGER
            trg_report_exports_immutable
        BEFORE UPDATE OR DELETE
        ON report_exports
        FOR EACH ROW
        EXECUTE FUNCTION
            protect_report_export_audit();
    END IF;
END
$$;

COMMIT;

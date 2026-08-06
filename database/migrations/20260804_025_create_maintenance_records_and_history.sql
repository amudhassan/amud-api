BEGIN;

-- =========================================================
-- MAINTENANCE RESOLUTIONS
-- Stores every resolution attempt separately so a tenant
-- dispute or corrective-work cycle never overwrites the
-- previous resolution record.
-- =========================================================

CREATE TABLE maintenance_resolutions (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(70) NOT NULL,

    maintenance_request_id BIGINT NOT NULL,

    sequence_number INTEGER NOT NULL,

    resolution_summary TEXT NOT NULL,

    work_completed_at TIMESTAMPTZ NOT NULL,

    actual_cost_summary TEXT,

    evidence_override_reason TEXT,

    confirmation_status VARCHAR(30)
        NOT NULL
        DEFAULT 'pending',

    confirmation_deadline_at TIMESTAMPTZ,

    submitted_by BIGINT NOT NULL,

    submitted_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    confirmed_by BIGINT,

    confirmed_at TIMESTAMPTZ,

    confirmation_note TEXT,

    disputed_by BIGINT,

    disputed_at TIMESTAMPTZ,

    dispute_reason TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    -- =====================================================
    -- IDENTIFIER AND ENUM-LIKE VALUES
    -- =====================================================

    CONSTRAINT uq_maintenance_resolutions_public_id
        UNIQUE (public_id),

    CONSTRAINT uq_maintenance_resolutions_sequence
        UNIQUE (
            maintenance_request_id,
            sequence_number
        ),

    CONSTRAINT chk_maintenance_resolutions_public_id
        CHECK (
            public_id ~
            '^maintenance_resolution_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_resolutions_sequence
        CHECK (
            sequence_number > 0
        ),

    CONSTRAINT chk_maintenance_resolutions_status
        CHECK (
            confirmation_status IN (
                'pending',
                'confirmed',
                'disputed',
                'no_response',
                'not_required'
            )
        ),

    -- =====================================================
    -- CONTENT INTEGRITY
    -- =====================================================

    CONSTRAINT chk_maintenance_resolutions_summary
        CHECK (
            char_length(btrim(resolution_summary))
                BETWEEN 10 AND 5000
        ),

    CONSTRAINT chk_maintenance_resolutions_cost_summary
        CHECK (
            actual_cost_summary IS NULL
            OR btrim(actual_cost_summary) <> ''
        ),

    CONSTRAINT chk_maintenance_resolutions_override_reason
        CHECK (
            evidence_override_reason IS NULL
            OR btrim(evidence_override_reason) <> ''
        ),

    -- =====================================================
    -- CONFIRMATION / DISPUTE AUDIT
    -- =====================================================

    CONSTRAINT chk_maintenance_resolutions_confirmation
        CHECK (
            (
                confirmation_status = 'pending'
                AND confirmation_deadline_at IS NOT NULL
                AND confirmed_by IS NULL
                AND confirmed_at IS NULL
                AND confirmation_note IS NULL
                AND disputed_by IS NULL
                AND disputed_at IS NULL
                AND dispute_reason IS NULL
            )
            OR
            (
                confirmation_status = 'confirmed'
                AND confirmed_by IS NOT NULL
                AND confirmed_at IS NOT NULL
                AND disputed_by IS NULL
                AND disputed_at IS NULL
                AND dispute_reason IS NULL
            )
            OR
            (
                confirmation_status = 'no_response'
                AND confirmed_by IS NOT NULL
                AND confirmed_at IS NOT NULL
                AND confirmation_note IS NOT NULL
                AND btrim(confirmation_note) <> ''
                AND disputed_by IS NULL
                AND disputed_at IS NULL
                AND dispute_reason IS NULL
            )
            OR
            (
                confirmation_status = 'disputed'
                AND confirmed_by IS NULL
                AND confirmed_at IS NULL
                AND disputed_by IS NOT NULL
                AND disputed_at IS NOT NULL
                AND dispute_reason IS NOT NULL
                AND btrim(dispute_reason) <> ''
            )
            OR
            (
                confirmation_status = 'not_required'
                AND confirmation_deadline_at IS NULL
                AND confirmed_by IS NULL
                AND confirmed_at IS NULL
                AND confirmation_note IS NULL
                AND disputed_by IS NULL
                AND disputed_at IS NULL
                AND dispute_reason IS NULL
            )
        ),

    -- =====================================================
    -- CHRONOLOGY
    -- =====================================================

    CONSTRAINT chk_maintenance_resolutions_work_time
        CHECK (
            work_completed_at <= submitted_at
        ),

    CONSTRAINT chk_maintenance_resolutions_deadline
        CHECK (
            confirmation_deadline_at IS NULL
            OR confirmation_deadline_at >= submitted_at
        ),

    CONSTRAINT chk_maintenance_resolutions_confirmed_time
        CHECK (
            confirmed_at IS NULL
            OR confirmed_at >= submitted_at
        ),

    CONSTRAINT chk_maintenance_resolutions_disputed_time
        CHECK (
            disputed_at IS NULL
            OR disputed_at >= submitted_at
        ),

    CONSTRAINT chk_maintenance_resolutions_created_time
        CHECK (
            created_at >= submitted_at
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_maintenance_resolutions_request
        FOREIGN KEY (maintenance_request_id)
        REFERENCES maintenance_requests(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_resolutions_submitted_by
        FOREIGN KEY (submitted_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_resolutions_confirmed_by
        FOREIGN KEY (confirmed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_resolutions_disputed_by
        FOREIGN KEY (disputed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_maintenance_resolutions_pending
ON maintenance_resolutions (
    maintenance_request_id
)
WHERE confirmation_status = 'pending';

CREATE INDEX idx_maintenance_resolutions_request
ON maintenance_resolutions (
    maintenance_request_id,
    sequence_number DESC
);

CREATE INDEX idx_maintenance_resolutions_confirmation
ON maintenance_resolutions (
    confirmation_status,
    confirmation_deadline_at
);

CREATE INDEX idx_maintenance_resolutions_pending_deadline
ON maintenance_resolutions (
    confirmation_deadline_at,
    maintenance_request_id
)
WHERE confirmation_status = 'pending';

CREATE INDEX idx_maintenance_resolutions_submitted_by
ON maintenance_resolutions (
    submitted_by,
    submitted_at DESC
);

CREATE INDEX idx_maintenance_resolutions_confirmed_by
ON maintenance_resolutions (
    confirmed_by,
    confirmed_at DESC
)
WHERE confirmed_by IS NOT NULL;

CREATE INDEX idx_maintenance_resolutions_disputed_by
ON maintenance_resolutions (
    disputed_by,
    disputed_at DESC
)
WHERE disputed_by IS NOT NULL;


-- =========================================================
-- MAINTENANCE COMMENTS
-- Human communication and progress updates. Comment text is
-- permanent; moderation hides a comment without deleting it.
-- =========================================================

CREATE TABLE maintenance_comments (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(70) NOT NULL,

    maintenance_request_id BIGINT NOT NULL,

    comment_type VARCHAR(30) NOT NULL,

    visibility VARCHAR(30) NOT NULL,

    message TEXT NOT NULL,

    created_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    hidden_at TIMESTAMPTZ,

    hidden_by BIGINT,

    moderation_reason TEXT,

    -- =====================================================
    -- IDENTIFIER AND ENUM-LIKE VALUES
    -- =====================================================

    CONSTRAINT uq_maintenance_comments_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_maintenance_comments_public_id
        CHECK (
            public_id ~
            '^maintenance_comment_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_comments_type
        CHECK (
            comment_type IN (
                'public_update',
                'internal_note',
                'tenant_message',
                'technician_update',
                'resolution_feedback'
            )
        ),

    CONSTRAINT chk_maintenance_comments_visibility
        CHECK (
            visibility IN (
                'internal',
                'tenant_visible',
                'technician_visible',
                'shared'
            )
        ),

    -- =====================================================
    -- CONTENT AND MODERATION INTEGRITY
    -- =====================================================

    CONSTRAINT chk_maintenance_comments_message
        CHECK (
            char_length(btrim(message))
                BETWEEN 1 AND 5000
        ),

    CONSTRAINT chk_maintenance_comments_moderation
        CHECK (
            (
                hidden_at IS NULL
                AND hidden_by IS NULL
                AND moderation_reason IS NULL
            )
            OR
            (
                hidden_at IS NOT NULL
                AND hidden_by IS NOT NULL
                AND moderation_reason IS NOT NULL
                AND btrim(moderation_reason) <> ''
            )
        ),

    CONSTRAINT chk_maintenance_comments_hidden_time
        CHECK (
            hidden_at IS NULL
            OR hidden_at >= created_at
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_maintenance_comments_request
        FOREIGN KEY (maintenance_request_id)
        REFERENCES maintenance_requests(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_comments_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_comments_hidden_by
        FOREIGN KEY (hidden_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_maintenance_comments_request
ON maintenance_comments (
    maintenance_request_id,
    created_at DESC
);

CREATE INDEX idx_maintenance_comments_type
ON maintenance_comments (
    comment_type,
    created_at DESC
);

CREATE INDEX idx_maintenance_comments_visibility
ON maintenance_comments (
    maintenance_request_id,
    visibility,
    created_at DESC
);

CREATE INDEX idx_maintenance_comments_created_by
ON maintenance_comments (
    created_by,
    created_at DESC
);

CREATE INDEX idx_maintenance_comments_hidden
ON maintenance_comments (
    hidden_at DESC,
    maintenance_request_id
)
WHERE hidden_at IS NOT NULL;


-- =========================================================
-- MAINTENANCE ATTACHMENTS
-- Stores secure metadata for problem evidence, quotations,
-- financial documents, work progress and completion proof.
-- File bytes remain in the configured storage provider.
-- =========================================================

CREATE TABLE maintenance_attachments (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(80) NOT NULL,

    maintenance_request_id BIGINT NOT NULL,

    comment_id BIGINT,

    cost_id BIGINT,

    visit_id BIGINT,

    resolution_id BIGINT,

    attachment_type VARCHAR(30) NOT NULL,

    visibility VARCHAR(30) NOT NULL,

    original_file_name VARCHAR(255) NOT NULL,

    stored_file_name VARCHAR(255) NOT NULL,

    storage_path TEXT NOT NULL,

    mime_type VARCHAR(100) NOT NULL,

    file_size_bytes BIGINT NOT NULL,

    file_checksum VARCHAR(64) NOT NULL,

    description TEXT,

    uploaded_by BIGINT NOT NULL,

    uploaded_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    revoked_at TIMESTAMPTZ,

    revoked_by BIGINT,

    revocation_reason TEXT,

    -- =====================================================
    -- IDENTIFIER AND ENUM-LIKE VALUES
    -- =====================================================

    CONSTRAINT uq_maintenance_attachments_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_maintenance_attachments_public_id
        CHECK (
            public_id ~
            '^maintenance_attachment_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_attachments_type
        CHECK (
            attachment_type IN (
                'problem_evidence',
                'quotation',
                'approval_document',
                'work_progress',
                'purchase_receipt',
                'vendor_invoice',
                'completion_evidence',
                'other'
            )
        ),

    CONSTRAINT chk_maintenance_attachments_visibility
        CHECK (
            visibility IN (
                'internal',
                'tenant_visible',
                'technician_visible',
                'shared'
            )
        ),

    -- =====================================================
    -- FILE METADATA AND CONTEXT INTEGRITY
    -- =====================================================

    CONSTRAINT chk_maintenance_attachments_file_names
        CHECK (
            btrim(original_file_name) <> ''
            AND btrim(stored_file_name) <> ''
            AND btrim(storage_path) <> ''
        ),

    CONSTRAINT chk_maintenance_attachments_mime_type
        CHECK (
            mime_type IN (
                'image/jpeg',
                'image/png',
                'image/webp',
                'application/pdf'
            )
        ),

    CONSTRAINT chk_maintenance_attachments_file_size
        CHECK (
            file_size_bytes > 0
            AND file_size_bytes <= 10485760
        ),

    CONSTRAINT chk_maintenance_attachments_checksum
        CHECK (
            file_checksum ~ '^[A-Fa-f0-9]{64}$'
        ),

    CONSTRAINT chk_maintenance_attachments_description
        CHECK (
            description IS NULL
            OR btrim(description) <> ''
        ),

    /*
     * An attachment always belongs to the request and may be
     * linked to one specific child record for additional
     * context. Multiple child links would be ambiguous.
     */
    CONSTRAINT chk_maintenance_attachments_context
        CHECK (
            num_nonnulls(
                comment_id,
                cost_id,
                visit_id,
                resolution_id
            ) <= 1
        ),

    CONSTRAINT chk_maintenance_attachments_revocation
        CHECK (
            (
                revoked_at IS NULL
                AND revoked_by IS NULL
                AND revocation_reason IS NULL
            )
            OR
            (
                revoked_at IS NOT NULL
                AND revoked_by IS NOT NULL
                AND revocation_reason IS NOT NULL
                AND btrim(revocation_reason) <> ''
            )
        ),

    CONSTRAINT chk_maintenance_attachments_revoked_time
        CHECK (
            revoked_at IS NULL
            OR revoked_at >= uploaded_at
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_maintenance_attachments_request
        FOREIGN KEY (maintenance_request_id)
        REFERENCES maintenance_requests(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_attachments_comment
        FOREIGN KEY (comment_id)
        REFERENCES maintenance_comments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_attachments_cost
        FOREIGN KEY (cost_id)
        REFERENCES maintenance_costs(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_attachments_visit
        FOREIGN KEY (visit_id)
        REFERENCES maintenance_visits(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_attachments_resolution
        FOREIGN KEY (resolution_id)
        REFERENCES maintenance_resolutions(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_attachments_uploaded_by
        FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_attachments_revoked_by
        FOREIGN KEY (revoked_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_maintenance_attachments_request
ON maintenance_attachments (
    maintenance_request_id,
    uploaded_at DESC
);

CREATE INDEX idx_maintenance_attachments_comment
ON maintenance_attachments (
    comment_id,
    uploaded_at DESC
)
WHERE comment_id IS NOT NULL;

CREATE INDEX idx_maintenance_attachments_cost
ON maintenance_attachments (
    cost_id,
    uploaded_at DESC
)
WHERE cost_id IS NOT NULL;

CREATE INDEX idx_maintenance_attachments_visit
ON maintenance_attachments (
    visit_id,
    uploaded_at DESC
)
WHERE visit_id IS NOT NULL;

CREATE INDEX idx_maintenance_attachments_resolution
ON maintenance_attachments (
    resolution_id,
    uploaded_at DESC
)
WHERE resolution_id IS NOT NULL;

CREATE INDEX idx_maintenance_attachments_type
ON maintenance_attachments (
    attachment_type,
    uploaded_at DESC
);

CREATE INDEX idx_maintenance_attachments_visibility
ON maintenance_attachments (
    maintenance_request_id,
    visibility,
    uploaded_at DESC
);

CREATE INDEX idx_maintenance_attachments_active
ON maintenance_attachments (
    maintenance_request_id,
    attachment_type,
    uploaded_at DESC
)
WHERE revoked_at IS NULL;

CREATE INDEX idx_maintenance_attachments_checksum
ON maintenance_attachments (
    file_checksum
);

CREATE INDEX idx_maintenance_attachments_uploaded_by
ON maintenance_attachments (
    uploaded_by,
    uploaded_at DESC
);

CREATE INDEX idx_maintenance_attachments_revoked
ON maintenance_attachments (
    revoked_at DESC,
    maintenance_request_id
)
WHERE revoked_at IS NOT NULL;


-- =========================================================
-- MAINTENANCE ACTIVITY HISTORY
-- Append-only audit stream for lifecycle, assignment, visit,
-- cost, responsibility, evidence and SLA actions. Final
-- immutability is added by migration 027.
-- =========================================================

CREATE TABLE maintenance_activity_history (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(80) NOT NULL,

    maintenance_request_id BIGINT NOT NULL,

    activity_type VARCHAR(60) NOT NULL,

    old_value JSONB,

    new_value JSONB,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::JSONB,

    reason TEXT,

    performed_by BIGINT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    -- =====================================================
    -- IDENTIFIER AND ACTIVITY TYPES
    -- =====================================================

    CONSTRAINT uq_maintenance_activity_history_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_maintenance_activity_history_public_id
        CHECK (
            public_id ~
            '^maintenance_activity_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_activity_history_type
        CHECK (
            activity_type IN (
                'request_created',
                'request_updated',
                'status_changed',
                'assignment_created',
                'assignment_changed',
                'assignment_declined',
                'assignment_revoked',
                'visit_scheduled',
                'visit_rescheduled',
                'visit_started',
                'visit_completed',
                'visit_missed',
                'visit_cancelled',
                'cost_created',
                'cost_submitted',
                'cost_approved',
                'cost_rejected',
                'cost_cancelled',
                'cost_incurred',
                'responsibility_determined',
                'responsibility_allocated',
                'attachment_added',
                'attachment_revoked',
                'comment_added',
                'comment_hidden',
                'request_resolved',
                'resolution_confirmed',
                'resolution_disputed',
                'request_closed',
                'request_cancelled',
                'request_rejected',
                'request_reopened',
                'unit_status_applied',
                'unit_status_released',
                'sla_target_changed',
                'maintenance_overdue',
                'emergency_escalated',
                'preventive_request_created'
            )
        ),

    -- =====================================================
    -- JSON AND REASON INTEGRITY
    -- =====================================================

    CONSTRAINT chk_maintenance_activity_history_old_value
        CHECK (
            old_value IS NULL
            OR jsonb_typeof(old_value) = 'object'
        ),

    CONSTRAINT chk_maintenance_activity_history_new_value
        CHECK (
            new_value IS NULL
            OR jsonb_typeof(new_value) = 'object'
        ),

    CONSTRAINT chk_maintenance_activity_history_metadata
        CHECK (
            jsonb_typeof(metadata) = 'object'
        ),

    CONSTRAINT chk_maintenance_activity_history_reason
        CHECK (
            reason IS NULL
            OR btrim(reason) <> ''
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_maintenance_activity_history_request
        FOREIGN KEY (maintenance_request_id)
        REFERENCES maintenance_requests(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_maintenance_activity_history_performed_by
        FOREIGN KEY (performed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_maintenance_activity_history_request
ON maintenance_activity_history (
    maintenance_request_id,
    created_at DESC
);

CREATE INDEX idx_maintenance_activity_history_type
ON maintenance_activity_history (
    activity_type,
    created_at DESC
);

CREATE INDEX idx_maintenance_activity_history_actor
ON maintenance_activity_history (
    performed_by,
    created_at DESC
)
WHERE performed_by IS NOT NULL;

CREATE INDEX idx_maintenance_activity_history_created
ON maintenance_activity_history (
    created_at DESC
);


-- =========================================================
-- MAINTENANCE EVENTS
-- Transactional outbox for the future Notifications Module.
-- Maintenance operations store events here; delivery failure
-- never removes or rewrites the underlying maintenance audit.
-- =========================================================

CREATE TABLE maintenance_events (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(80) NOT NULL,

    maintenance_request_id BIGINT,

    event_type VARCHAR(70) NOT NULL,

    idempotency_key VARCHAR(255) NOT NULL,

    payload JSONB
        NOT NULL
        DEFAULT '{}'::JSONB,

    occurred_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    available_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    processed_at TIMESTAMPTZ,

    processing_attempts INTEGER
        NOT NULL
        DEFAULT 0,

    last_processing_error TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    -- =====================================================
    -- IDENTIFIER AND EVENT TYPES
    -- =====================================================

    CONSTRAINT uq_maintenance_events_public_id
        UNIQUE (public_id),

    CONSTRAINT uq_maintenance_events_idempotency_key
        UNIQUE (idempotency_key),

    CONSTRAINT chk_maintenance_events_public_id
        CHECK (
            public_id ~
            '^maintenance_event_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_maintenance_events_type
        CHECK (
            event_type IN (
                'maintenance_reported',
                'maintenance_assigned',
                'maintenance_visit_scheduled',
                'maintenance_visit_rescheduled',
                'maintenance_status_changed',
                'maintenance_cost_submitted',
                'maintenance_cost_approved',
                'maintenance_resolved',
                'maintenance_resolution_disputed',
                'maintenance_closed',
                'maintenance_overdue',
                'maintenance_emergency_escalated',
                'preventive_maintenance_due',
                'preventive_request_created'
            )
        ),

    -- =====================================================
    -- OUTBOX STATE INTEGRITY
    -- =====================================================

    CONSTRAINT chk_maintenance_events_idempotency_key
        CHECK (
            btrim(idempotency_key) <> ''
        ),

    CONSTRAINT chk_maintenance_events_payload
        CHECK (
            jsonb_typeof(payload) = 'object'
        ),

    CONSTRAINT chk_maintenance_events_attempts
        CHECK (
            processing_attempts >= 0
        ),

    CONSTRAINT chk_maintenance_events_available_time
        CHECK (
            available_at >= occurred_at
        ),

    CONSTRAINT chk_maintenance_events_processed_time
        CHECK (
            processed_at IS NULL
            OR processed_at >= occurred_at
        ),

    CONSTRAINT chk_maintenance_events_error
        CHECK (
            last_processing_error IS NULL
            OR btrim(last_processing_error) <> ''
        ),

    CONSTRAINT chk_maintenance_events_created_time
        CHECK (
            created_at >= occurred_at
        ),

    -- =====================================================
    -- FOREIGN KEYS
    -- =====================================================

    CONSTRAINT fk_maintenance_events_request
        FOREIGN KEY (maintenance_request_id)
        REFERENCES maintenance_requests(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_maintenance_events_request
ON maintenance_events (
    maintenance_request_id,
    occurred_at DESC
)
WHERE maintenance_request_id IS NOT NULL;

CREATE INDEX idx_maintenance_events_type
ON maintenance_events (
    event_type,
    occurred_at DESC
);

CREATE INDEX idx_maintenance_events_pending
ON maintenance_events (
    available_at,
    occurred_at,
    id
)
WHERE processed_at IS NULL;

CREATE INDEX idx_maintenance_events_processed
ON maintenance_events (
    processed_at DESC,
    event_type
)
WHERE processed_at IS NOT NULL;

CREATE INDEX idx_maintenance_events_failed
ON maintenance_events (
    processing_attempts DESC,
    available_at
)
WHERE processed_at IS NULL
  AND processing_attempts > 0;


-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON TABLE maintenance_resolutions IS
'Permanent resolution attempts and tenant confirmation or dispute history for maintenance requests.';

COMMENT ON COLUMN maintenance_resolutions.sequence_number IS
'One-based resolution attempt number unique within the maintenance request.';

COMMENT ON COLUMN maintenance_resolutions.evidence_override_reason IS
'Documented owner/admin justification when completion evidence is intentionally waived.';

COMMENT ON TABLE maintenance_comments IS
'Human maintenance communication and progress updates with controlled visibility and moderation audit.';

COMMENT ON COLUMN maintenance_comments.visibility IS
'Controls whether the comment is internal, tenant-visible, technician-visible or shared.';

COMMENT ON TABLE maintenance_attachments IS
'Secure metadata for maintenance evidence and documents; audit-significant files are revoked instead of deleted.';

COMMENT ON COLUMN maintenance_attachments.file_checksum IS
'SHA-256 hexadecimal checksum used for integrity and tamper verification.';

COMMENT ON COLUMN maintenance_attachments.storage_path IS
'Private storage location; API access must still enforce maintenance ownership and visibility permissions.';

COMMENT ON TABLE maintenance_activity_history IS
'Append-only maintenance audit stream; immutability and hard-delete protection are added by migration 027.';

COMMENT ON TABLE maintenance_events IS
'Transactional notification outbox consumed later by the Notifications Module.';

COMMENT ON COLUMN maintenance_events.idempotency_key IS
'Unique operation-derived key preventing the same notification event from being inserted more than once.';

COMMIT;
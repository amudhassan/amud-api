BEGIN;

-- =========================================================
-- NOTIFICATIONS
-- Permanent in-app notification records for authenticated
-- users. External delivery channels are supported by the
-- delivery-attempt table but are not required for in-app use.
-- =========================================================

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(80) NOT NULL,

    recipient_user_id BIGINT NOT NULL,
    actor_user_id BIGINT,

    notification_type VARCHAR(80) NOT NULL,
    category VARCHAR(40) NOT NULL,
    priority VARCHAR(20)
        NOT NULL
        DEFAULT 'normal',

    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    action_path VARCHAR(500),

    source_module VARCHAR(50) NOT NULL,
    source_entity_type VARCHAR(60),
    source_entity_public_id VARCHAR(100),
    source_event_public_id VARCHAR(100),
    source_event_type VARCHAR(80) NOT NULL,
    source_event_idempotency_key VARCHAR(255) NOT NULL,

    payload JSONB
        NOT NULL
        DEFAULT '{}'::JSONB,

    is_read BOOLEAN
        NOT NULL
        DEFAULT FALSE,
    read_at TIMESTAMPTZ,

    is_archived BOOLEAN
        NOT NULL
        DEFAULT FALSE,
    archived_at TIMESTAMPTZ,

    available_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_notifications_public_id
        UNIQUE (public_id),

    CONSTRAINT uq_notifications_recipient_event
        UNIQUE (
            recipient_user_id,
            source_event_idempotency_key
        ),

    CONSTRAINT chk_notifications_public_id
        CHECK (
            public_id ~
            '^notification_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_notifications_public_id_length
        CHECK (
            char_length(public_id)
                BETWEEN 21 AND 80
        ),

    CONSTRAINT chk_notifications_type
        CHECK (
            notification_type ~
            '^[a-z][a-z0-9_]{2,79}$'
        ),

    CONSTRAINT chk_notifications_category
        CHECK (
            category IN (
                'access',
                'lease',
                'billing',
                'payment',
                'maintenance',
                'preventive_maintenance',
                'system'
            )
        ),

    CONSTRAINT chk_notifications_priority
        CHECK (
            priority IN (
                'low',
                'normal',
                'high',
                'urgent'
            )
        ),

    CONSTRAINT chk_notifications_title
        CHECK (
            char_length(btrim(title))
                BETWEEN 3 AND 255
        ),

    CONSTRAINT chk_notifications_message
        CHECK (
            char_length(btrim(message))
                BETWEEN 3 AND 5000
        ),

    CONSTRAINT chk_notifications_action_path
        CHECK (
            action_path IS NULL
            OR (
                char_length(btrim(action_path))
                    BETWEEN 1 AND 500
                AND action_path LIKE '/%'
                AND action_path !~* '^https?://'
            )
        ),

    CONSTRAINT chk_notifications_source_module
        CHECK (
            source_module IN (
                'authentication',
                'users',
                'owners',
                'properties',
                'units',
                'tenants',
                'leases',
                'invoices',
                'payments',
                'receipts',
                'maintenance',
                'preventive_maintenance',
                'system'
            )
        ),

    CONSTRAINT chk_notifications_source_entity_type
        CHECK (
            source_entity_type IS NULL
            OR source_entity_type ~
                '^[a-z][a-z0-9_]{1,59}$'
        ),

    CONSTRAINT chk_notifications_source_entity_public_id
        CHECK (
            source_entity_public_id IS NULL
            OR btrim(source_entity_public_id) <> ''
        ),

    CONSTRAINT chk_notifications_source_event_public_id
        CHECK (
            source_event_public_id IS NULL
            OR btrim(source_event_public_id) <> ''
        ),

    CONSTRAINT chk_notifications_source_event_type
        CHECK (
            source_event_type ~
            '^[a-z][a-z0-9_]{2,79}$'
        ),

    CONSTRAINT chk_notifications_source_event_key
        CHECK (
            btrim(source_event_idempotency_key) <> ''
        ),

    CONSTRAINT chk_notifications_payload
        CHECK (
            jsonb_typeof(payload) = 'object'
        ),

    CONSTRAINT chk_notifications_read_state
        CHECK (
            (
                is_read = FALSE
                AND read_at IS NULL
            )
            OR
            (
                is_read = TRUE
                AND read_at IS NOT NULL
                AND read_at >= created_at
            )
        ),

    CONSTRAINT chk_notifications_archive_state
        CHECK (
            (
                is_archived = FALSE
                AND archived_at IS NULL
            )
            OR
            (
                is_archived = TRUE
                AND archived_at IS NOT NULL
                AND is_read = TRUE
                AND archived_at >= read_at
            )
        ),

    CONSTRAINT chk_notifications_available_time
        CHECK (
            available_at >= created_at
        ),

    CONSTRAINT chk_notifications_expiry_time
        CHECK (
            expires_at IS NULL
            OR expires_at > created_at
        ),

    CONSTRAINT chk_notifications_updated_time
        CHECK (
            updated_at >= created_at
        ),

    CONSTRAINT fk_notifications_recipient
        FOREIGN KEY (recipient_user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_notifications_actor
        FOREIGN KEY (actor_user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_notifications_recipient_created
ON notifications (
    recipient_user_id,
    created_at DESC,
    id DESC
);

CREATE INDEX idx_notifications_recipient_active
ON notifications (
    recipient_user_id,
    is_read,
    created_at DESC,
    id DESC
)
WHERE is_archived = FALSE;

CREATE INDEX idx_notifications_recipient_unread
ON notifications (
    recipient_user_id,
    priority,
    created_at DESC,
    id DESC
)
WHERE is_read = FALSE
  AND is_archived = FALSE;

CREATE INDEX idx_notifications_category
ON notifications (
    category,
    created_at DESC
);

CREATE INDEX idx_notifications_source
ON notifications (
    source_module,
    source_event_type,
    created_at DESC
);

CREATE INDEX idx_notifications_source_entity
ON notifications (
    source_module,
    source_entity_type,
    source_entity_public_id
)
WHERE source_entity_public_id IS NOT NULL;

CREATE INDEX idx_notifications_available
ON notifications (
    available_at,
    created_at,
    id
)
WHERE is_archived = FALSE;

CREATE INDEX idx_notifications_expiry
ON notifications (expires_at)
WHERE expires_at IS NOT NULL;


-- =========================================================
-- NOTIFICATION PREFERENCES
-- One permanent preference profile per login user. In-app is
-- the current core channel; external channels are future-ready.
-- =========================================================

CREATE TABLE notification_preferences (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(80) NOT NULL,
    user_id BIGINT NOT NULL,

    in_app_enabled BOOLEAN
        NOT NULL
        DEFAULT TRUE,
    email_enabled BOOLEAN
        NOT NULL
        DEFAULT FALSE,
    sms_enabled BOOLEAN
        NOT NULL
        DEFAULT FALSE,
    whatsapp_enabled BOOLEAN
        NOT NULL
        DEFAULT FALSE,
    push_enabled BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    minimum_priority VARCHAR(20)
        NOT NULL
        DEFAULT 'low',

    digest_frequency VARCHAR(20)
        NOT NULL
        DEFAULT 'immediate',

    quiet_hours_enabled BOOLEAN
        NOT NULL
        DEFAULT FALSE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(64)
        NOT NULL
        DEFAULT 'UTC',

    category_preferences JSONB
        NOT NULL
        DEFAULT jsonb_build_object(
            'access', TRUE,
            'lease', TRUE,
            'billing', TRUE,
            'payment', TRUE,
            'maintenance', TRUE,
            'preventive_maintenance', TRUE,
            'system', TRUE
        ),

    updated_by BIGINT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_notification_preferences_public_id
        UNIQUE (public_id),

    CONSTRAINT uq_notification_preferences_user
        UNIQUE (user_id),

    CONSTRAINT chk_notification_preferences_public_id
        CHECK (
            public_id ~
            '^notification_preference_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_notification_preferences_priority
        CHECK (
            minimum_priority IN (
                'low',
                'normal',
                'high',
                'urgent'
            )
        ),

    CONSTRAINT chk_notification_preferences_digest
        CHECK (
            digest_frequency IN (
                'immediate',
                'daily',
                'weekly',
                'disabled'
            )
        ),

    CONSTRAINT chk_notification_preferences_quiet_hours
        CHECK (
            (
                quiet_hours_enabled = FALSE
                AND quiet_hours_start IS NULL
                AND quiet_hours_end IS NULL
            )
            OR
            (
                quiet_hours_enabled = TRUE
                AND quiet_hours_start IS NOT NULL
                AND quiet_hours_end IS NOT NULL
                AND quiet_hours_start <>
                    quiet_hours_end
            )
        ),

    CONSTRAINT chk_notification_preferences_timezone
        CHECK (
            btrim(timezone) <> ''
        ),

    CONSTRAINT chk_notification_preferences_categories
        CHECK (
            jsonb_typeof(category_preferences)
                = 'object'
        ),

    CONSTRAINT chk_notification_preferences_updated_time
        CHECK (
            updated_at >= created_at
        ),

    CONSTRAINT fk_notification_preferences_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_notification_preferences_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_notification_preferences_user
ON notification_preferences (user_id);

CREATE INDEX idx_notification_preferences_channels
ON notification_preferences (
    email_enabled,
    sms_enabled,
    whatsapp_enabled,
    push_enabled
);

CREATE INDEX idx_notification_preferences_updated_by
ON notification_preferences (updated_by)
WHERE updated_by IS NOT NULL;


-- =========================================================
-- NOTIFICATION DELIVERY ATTEMPTS
-- Permanent channel-delivery audit. A retry is represented by
-- a new attempt number rather than rewriting a failed attempt.
-- =========================================================

CREATE TABLE notification_delivery_attempts (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(80) NOT NULL,
    notification_id BIGINT NOT NULL,

    channel VARCHAR(20) NOT NULL,
    attempt_number INTEGER NOT NULL,
    status VARCHAR(20)
        NOT NULL
        DEFAULT 'pending',

    provider_name VARCHAR(100),
    provider_message_id VARCHAR(255),
    destination_snapshot VARCHAR(255),

    requested_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,

    error_code VARCHAR(100),
    error_message TEXT,
    status_note TEXT,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_notification_delivery_attempts_public_id
        UNIQUE (public_id),

    CONSTRAINT uq_notification_delivery_attempts_number
        UNIQUE (
            notification_id,
            channel,
            attempt_number
        ),

    CONSTRAINT chk_notification_delivery_attempts_public_id
        CHECK (
            public_id ~
            '^notification_delivery_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_notification_delivery_attempts_channel
        CHECK (
            channel IN (
                'in_app',
                'email',
                'sms',
                'whatsapp',
                'push'
            )
        ),

    CONSTRAINT chk_notification_delivery_attempts_number
        CHECK (
            attempt_number >= 1
        ),

    CONSTRAINT chk_notification_delivery_attempts_status
        CHECK (
            status IN (
                'pending',
                'processing',
                'sent',
                'delivered',
                'failed',
                'skipped',
                'cancelled'
            )
        ),

    CONSTRAINT chk_notification_delivery_attempts_provider
        CHECK (
            provider_name IS NULL
            OR btrim(provider_name) <> ''
        ),

    CONSTRAINT chk_notification_delivery_attempts_provider_message
        CHECK (
            provider_message_id IS NULL
            OR btrim(provider_message_id) <> ''
        ),

    CONSTRAINT chk_notification_delivery_attempts_destination
        CHECK (
            destination_snapshot IS NULL
            OR btrim(destination_snapshot) <> ''
        ),

    CONSTRAINT chk_notification_delivery_attempts_metadata
        CHECK (
            jsonb_typeof(metadata) = 'object'
        ),

    CONSTRAINT chk_notification_delivery_attempts_state
        CHECK (
            (
                status = 'pending'
                AND started_at IS NULL
                AND sent_at IS NULL
                AND delivered_at IS NULL
                AND failed_at IS NULL
            )
            OR
            (
                status = 'processing'
                AND started_at IS NOT NULL
                AND sent_at IS NULL
                AND delivered_at IS NULL
                AND failed_at IS NULL
            )
            OR
            (
                status = 'sent'
                AND started_at IS NOT NULL
                AND sent_at IS NOT NULL
                AND delivered_at IS NULL
                AND failed_at IS NULL
            )
            OR
            (
                status = 'delivered'
                AND started_at IS NOT NULL
                AND sent_at IS NOT NULL
                AND delivered_at IS NOT NULL
                AND failed_at IS NULL
            )
            OR
            (
                status = 'failed'
                AND failed_at IS NOT NULL
                AND delivered_at IS NULL
                AND error_message IS NOT NULL
                AND btrim(error_message) <> ''
            )
            OR
            (
                status = 'skipped'
                AND started_at IS NULL
                AND sent_at IS NULL
                AND delivered_at IS NULL
                AND failed_at IS NULL
                AND status_note IS NOT NULL
                AND btrim(status_note) <> ''
            )
            OR
            (
                status = 'cancelled'
                AND sent_at IS NULL
                AND delivered_at IS NULL
                AND failed_at IS NULL
                AND status_note IS NOT NULL
                AND btrim(status_note) <> ''
            )
        ),

    CONSTRAINT chk_notification_delivery_attempts_times
        CHECK (
            created_at >= requested_at
            AND updated_at >= created_at
            AND (
                started_at IS NULL
                OR started_at >= requested_at
            )
            AND (
                sent_at IS NULL
                OR (
                    started_at IS NOT NULL
                    AND sent_at >= started_at
                )
            )
            AND (
                delivered_at IS NULL
                OR (
                    sent_at IS NOT NULL
                    AND delivered_at >= sent_at
                )
            )
            AND (
                failed_at IS NULL
                OR failed_at >= requested_at
            )
            AND (
                next_retry_at IS NULL
                OR next_retry_at > requested_at
            )
        ),

    CONSTRAINT fk_notification_delivery_attempts_notification
        FOREIGN KEY (notification_id)
        REFERENCES notifications(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_notification_delivery_attempts_notification
ON notification_delivery_attempts (
    notification_id,
    channel,
    attempt_number DESC
);

CREATE INDEX idx_notification_delivery_attempts_status
ON notification_delivery_attempts (
    status,
    requested_at,
    id
);

CREATE INDEX idx_notification_delivery_attempts_retry
ON notification_delivery_attempts (
    next_retry_at,
    id
)
WHERE status = 'failed'
  AND next_retry_at IS NOT NULL;

CREATE INDEX idx_notification_delivery_attempts_provider_message
ON notification_delivery_attempts (
    provider_name,
    provider_message_id
)
WHERE provider_message_id IS NOT NULL;


-- =========================================================
-- NOTIFICATION EVENT DEDUPLICATION
-- Generic consumer-inbox record used to process source events
-- exactly once from maintenance and all future modules.
-- =========================================================

CREATE TABLE notification_event_deduplication (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(80) NOT NULL,

    source_module VARCHAR(50) NOT NULL,
    source_event_public_id VARCHAR(100),
    source_event_type VARCHAR(80) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,

    payload_fingerprint CHAR(32) NOT NULL,
    payload JSONB
        NOT NULL
        DEFAULT '{}'::JSONB,

    occurred_at TIMESTAMPTZ NOT NULL,
    available_at TIMESTAMPTZ NOT NULL,
    first_seen_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'pending',
    processing_attempts INTEGER
        NOT NULL
        DEFAULT 0,
    processing_started_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    recipient_count INTEGER
        NOT NULL
        DEFAULT 0,
    last_error TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_notification_event_dedup_public_id
        UNIQUE (public_id),

    CONSTRAINT uq_notification_event_dedup_key
        UNIQUE (idempotency_key),

    CONSTRAINT chk_notification_event_dedup_public_id
        CHECK (
            public_id ~
            '^notification_event_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_notification_event_dedup_source_module
        CHECK (
            source_module IN (
                'authentication',
                'users',
                'owners',
                'properties',
                'units',
                'tenants',
                'leases',
                'invoices',
                'payments',
                'receipts',
                'maintenance',
                'preventive_maintenance',
                'system'
            )
        ),

    CONSTRAINT chk_notification_event_dedup_source_public_id
        CHECK (
            source_event_public_id IS NULL
            OR btrim(source_event_public_id) <> ''
        ),

    CONSTRAINT chk_notification_event_dedup_source_type
        CHECK (
            source_event_type ~
            '^[a-z][a-z0-9_]{2,79}$'
        ),

    CONSTRAINT chk_notification_event_dedup_key_value
        CHECK (
            btrim(idempotency_key) <> ''
        ),

    CONSTRAINT chk_notification_event_dedup_fingerprint
        CHECK (
            payload_fingerprint ~
            '^[a-f0-9]{32}$'
        ),

    CONSTRAINT chk_notification_event_dedup_payload
        CHECK (
            jsonb_typeof(payload) = 'object'
        ),

    CONSTRAINT chk_notification_event_dedup_status
        CHECK (
            status IN (
                'pending',
                'processing',
                'processed',
                'failed',
                'dead_letter'
            )
        ),

    CONSTRAINT chk_notification_event_dedup_attempts
        CHECK (
            processing_attempts >= 0
        ),

    CONSTRAINT chk_notification_event_dedup_recipients
        CHECK (
            recipient_count >= 0
        ),

    CONSTRAINT chk_notification_event_dedup_state
        CHECK (
            (
                status = 'pending'
                AND processing_started_at IS NULL
                AND processed_at IS NULL
                AND last_error IS NULL
            )
            OR
            (
                status = 'processing'
                AND processing_started_at IS NOT NULL
                AND processed_at IS NULL
                AND last_error IS NULL
            )
            OR
            (
                status = 'processed'
                AND processing_started_at IS NOT NULL
                AND processed_at IS NOT NULL
                AND last_error IS NULL
            )
            OR
            (
                status IN ('failed', 'dead_letter')
                AND processing_started_at IS NOT NULL
                AND processed_at IS NULL
                AND last_error IS NOT NULL
                AND btrim(last_error) <> ''
            )
        ),

    CONSTRAINT chk_notification_event_dedup_times
        CHECK (
            available_at >= occurred_at
            AND first_seen_at >= occurred_at
            AND last_seen_at >= first_seen_at
            AND created_at >= occurred_at
            AND updated_at >= created_at
            AND (
                processing_started_at IS NULL
                OR processing_started_at >= first_seen_at
            )
            AND (
                processed_at IS NULL
                OR processed_at >= processing_started_at
            )
        )
);

CREATE UNIQUE INDEX uq_notification_event_dedup_source_event
ON notification_event_deduplication (
    source_module,
    source_event_public_id
)
WHERE source_event_public_id IS NOT NULL;

CREATE INDEX idx_notification_event_dedup_pending
ON notification_event_deduplication (
    available_at,
    occurred_at,
    id
)
WHERE status IN ('pending', 'failed');

CREATE INDEX idx_notification_event_dedup_status
ON notification_event_deduplication (
    status,
    updated_at DESC
);

CREATE INDEX idx_notification_event_dedup_source
ON notification_event_deduplication (
    source_module,
    source_event_type,
    occurred_at DESC
);

CREATE INDEX idx_notification_event_dedup_processed
ON notification_event_deduplication (
    processed_at DESC,
    source_module
)
WHERE status = 'processed';


-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON TABLE notifications IS
'Permanent user-targeted in-app notifications with read and archive lifecycle timestamps.';

COMMENT ON COLUMN notifications.source_event_idempotency_key IS
'Operation-derived key unique per recipient, preventing duplicate notification creation for the same source event.';

COMMENT ON COLUMN notifications.action_path IS
'Optional internal application path. Absolute external URLs are not accepted.';

COMMENT ON TABLE notification_preferences IS
'One permanent notification preference profile per login user, including future external-channel preferences.';

COMMENT ON COLUMN notification_preferences.category_preferences IS
'Complete category-to-boolean object validated by the notification integrity migration.';

COMMENT ON TABLE notification_delivery_attempts IS
'Permanent channel-delivery audit. Every retry creates a new attempt_number.';

COMMENT ON TABLE notification_event_deduplication IS
'Generic notification consumer-inbox used to register and process source events idempotently.';

COMMIT;

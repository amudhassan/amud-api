BEGIN;

-- =========================================================
-- INTERNAL HELPERS
-- =========================================================

CREATE OR REPLACE FUNCTION notification_make_public_id(
    p_prefix TEXT,
    p_hash_length INTEGER DEFAULT 24
)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
    IF p_prefix IS NULL
       OR btrim(p_prefix) = ''
       OR p_hash_length < 8
       OR p_hash_length > 32 THEN
        RAISE EXCEPTION
            'Invalid notification public-ID generation parameters.'
            USING ERRCODE = '22023';
    END IF;

    RETURN p_prefix || substr(
        md5(
            random()::TEXT
            || clock_timestamp()::TEXT
            || txid_current()::TEXT
        ),
        1,
        p_hash_length
    );
END;
$$;


CREATE OR REPLACE FUNCTION set_notification_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION prevent_notification_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Notification and delivery audit records cannot be hard deleted from table %.',
        TG_TABLE_NAME
        USING ERRCODE = 'P0001';
END;
$$;


-- =========================================================
-- UPDATED-AT TRIGGERS
-- =========================================================

CREATE TRIGGER a_set_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION set_notification_updated_at();

CREATE TRIGGER a_set_notification_preferences_updated_at
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION set_notification_updated_at();

CREATE TRIGGER a_set_notification_delivery_updated_at
BEFORE UPDATE ON notification_delivery_attempts
FOR EACH ROW
EXECUTE FUNCTION set_notification_updated_at();

CREATE TRIGGER a_set_notification_event_dedup_updated_at
BEFORE UPDATE ON notification_event_deduplication
FOR EACH ROW
EXECUTE FUNCTION set_notification_updated_at();


-- =========================================================
-- NOTIFICATION RECORD LIFECYCLE INTEGRITY
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_notification_record_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Notification and delivery audit records cannot be hard deleted from table %.',
            TG_TABLE_NAME
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.recipient_user_id IS DISTINCT FROM
            OLD.recipient_user_id
       OR NEW.actor_user_id IS DISTINCT FROM
            OLD.actor_user_id
       OR NEW.notification_type IS DISTINCT FROM
            OLD.notification_type
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.priority IS DISTINCT FROM OLD.priority
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.message IS DISTINCT FROM OLD.message
       OR NEW.action_path IS DISTINCT FROM OLD.action_path
       OR NEW.source_module IS DISTINCT FROM
            OLD.source_module
       OR NEW.source_entity_type IS DISTINCT FROM
            OLD.source_entity_type
       OR NEW.source_entity_public_id IS DISTINCT FROM
            OLD.source_entity_public_id
       OR NEW.source_event_public_id IS DISTINCT FROM
            OLD.source_event_public_id
       OR NEW.source_event_type IS DISTINCT FROM
            OLD.source_event_type
       OR NEW.source_event_idempotency_key IS DISTINCT FROM
            OLD.source_event_idempotency_key
       OR NEW.payload IS DISTINCT FROM OLD.payload
       OR NEW.available_at IS DISTINCT FROM OLD.available_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Notification identity, content and source data are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.is_read = TRUE
       AND NEW.is_read = FALSE THEN
        RAISE EXCEPTION
            'A read notification cannot return to unread status.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.read_at IS NOT NULL
       AND NEW.read_at IS DISTINCT FROM OLD.read_at THEN
        RAISE EXCEPTION
            'Notification read timestamp is immutable once recorded.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.is_archived = TRUE
       AND NEW.is_archived = FALSE THEN
        RAISE EXCEPTION
            'An archived notification cannot be restored to the active inbox.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.archived_at IS NOT NULL
       AND NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
        RAISE EXCEPTION
            'Notification archive timestamp is immutable once recorded.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.is_archived = TRUE
       AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION
            'Archived notifications are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER z_enforce_notification_record_integrity
BEFORE UPDATE OR DELETE ON notifications
FOR EACH ROW
EXECUTE FUNCTION enforce_notification_record_integrity();


-- =========================================================
-- PREFERENCE VALIDATION AND DEFAULT PROVISIONING
-- =========================================================

CREATE OR REPLACE FUNCTION validate_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_allowed_keys TEXT[] := ARRAY[
        'access',
        'lease',
        'billing',
        'payment',
        'maintenance',
        'preventive_maintenance',
        'system'
    ];
    v_key TEXT;
    v_value JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Notification and delivery audit records cannot be hard deleted from table %.',
            TG_TABLE_NAME
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.public_id IS DISTINCT FROM OLD.public_id
           OR NEW.user_id IS DISTINCT FROM OLD.user_id
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION
                'Notification preference identity is immutable.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_timezone_names
        WHERE name = NEW.timezone
    ) THEN
        RAISE EXCEPTION
            'Notification preference timezone is not recognized by PostgreSQL.'
            USING ERRCODE = 'P0001';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM jsonb_object_keys(
            NEW.category_preferences
        )
    ) <> cardinality(v_allowed_keys) THEN
        RAISE EXCEPTION
            'Notification category preferences must contain every supported category exactly once.'
            USING ERRCODE = 'P0001';
    END IF;

    FOR v_key, v_value IN
        SELECT key, value
        FROM jsonb_each(
            NEW.category_preferences
        )
    LOOP
        IF NOT (v_key = ANY(v_allowed_keys)) THEN
            RAISE EXCEPTION
                'Unsupported notification category preference: %.',
                v_key
                USING ERRCODE = 'P0001';
        END IF;

        IF jsonb_typeof(v_value) <> 'boolean' THEN
            RAISE EXCEPTION
                'Notification category preference % must be boolean.',
                v_key
                USING ERRCODE = 'P0001';
        END IF;
    END LOOP;

    IF COALESCE(
        (NEW.category_preferences ->> 'access')::BOOLEAN,
        FALSE
    ) <> TRUE THEN
        RAISE EXCEPTION
            'Access and security notifications cannot be disabled.'
            USING ERRCODE = 'P0001';
    END IF;

    IF COALESCE(
        (NEW.category_preferences ->> 'system')::BOOLEAN,
        FALSE
    ) <> TRUE THEN
        RAISE EXCEPTION
            'Critical system notifications cannot be disabled.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER z_validate_notification_preferences
BEFORE INSERT OR UPDATE OR DELETE
ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION validate_notification_preferences();


CREATE OR REPLACE FUNCTION provision_notification_preference_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO notification_preferences (
        public_id,
        user_id,
        created_at,
        updated_at
    )
    VALUES (
        notification_make_public_id(
            'notification_preference_'
        ),
        NEW.id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NULL;
END;
$$;

CREATE TRIGGER provision_notification_preference_after_user_insert
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION provision_notification_preference_for_user();

INSERT INTO notification_preferences (
    public_id,
    user_id,
    created_at,
    updated_at
)
SELECT
    notification_make_public_id(
        'notification_preference_'
    ),
    u.id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM users AS u
WHERE NOT EXISTS (
    SELECT 1
    FROM notification_preferences AS np
    WHERE np.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;


-- =========================================================
-- DELIVERY ATTEMPT LIFECYCLE INTEGRITY
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_notification_delivery_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Notification and delivery audit records cannot be hard deleted from table %.',
            TG_TABLE_NAME
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status NOT IN (
            'pending',
            'skipped',
            'cancelled'
        ) THEN
            RAISE EXCEPTION
                'A notification delivery attempt must start as pending, skipped or cancelled.'
                USING ERRCODE = 'P0001';
        END IF;

        RETURN NEW;
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.notification_id IS DISTINCT FROM
            OLD.notification_id
       OR NEW.channel IS DISTINCT FROM OLD.channel
       OR NEW.attempt_number IS DISTINCT FROM
            OLD.attempt_number
       OR NEW.requested_at IS DISTINCT FROM
            OLD.requested_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Notification delivery attempt identity is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status IN (
        'delivered',
        'failed',
        'skipped',
        'cancelled'
    ) AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION
            'Terminal notification delivery attempts are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status = 'pending'
       AND NEW.status NOT IN (
            'pending',
            'processing',
            'sent',
            'delivered',
            'failed',
            'skipped',
            'cancelled'
       ) THEN
        RAISE EXCEPTION
            'Invalid notification delivery transition from pending to %.',
            NEW.status
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status = 'processing'
       AND NEW.status NOT IN (
            'processing',
            'sent',
            'delivered',
            'failed',
            'cancelled'
       ) THEN
        RAISE EXCEPTION
            'Invalid notification delivery transition from processing to %.',
            NEW.status
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status = 'sent'
       AND NEW.status NOT IN (
            'sent',
            'delivered',
            'failed'
       ) THEN
        RAISE EXCEPTION
            'Invalid notification delivery transition from sent to %.',
            NEW.status
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER z_enforce_notification_delivery_integrity
BEFORE INSERT OR UPDATE OR DELETE
ON notification_delivery_attempts
FOR EACH ROW
EXECUTE FUNCTION enforce_notification_delivery_integrity();


-- =========================================================
-- SOURCE-EVENT REGISTRATION AND DEDUPLICATION
-- =========================================================

CREATE OR REPLACE FUNCTION register_notification_event(
    p_source_module VARCHAR,
    p_source_event_public_id VARCHAR,
    p_source_event_type VARCHAR,
    p_idempotency_key TEXT,
    p_payload JSONB DEFAULT '{}'::JSONB,
    p_occurred_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    p_available_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)
RETURNS TABLE (
    event_internal_id BIGINT,
    event_public_id VARCHAR(80),
    is_new BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_payload JSONB := COALESCE(
        p_payload,
        '{}'::JSONB
    );
    v_fingerprint CHAR(32);
    v_existing notification_event_deduplication%ROWTYPE;
BEGIN
    IF p_source_module IS NULL
       OR btrim(p_source_module) = ''
       OR p_source_event_type IS NULL
       OR btrim(p_source_event_type) = ''
       OR p_idempotency_key IS NULL
       OR btrim(p_idempotency_key) = ''
       OR p_occurred_at IS NULL
       OR p_available_at IS NULL THEN
        RAISE EXCEPTION
            'Notification event registration requires source module, event type, idempotency key and timestamps.'
            USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(v_payload) <> 'object' THEN
        RAISE EXCEPTION
            'Notification event payload must be a JSON object.'
            USING ERRCODE = '22023';
    END IF;

    v_fingerprint := md5(v_payload::TEXT);

    INSERT INTO notification_event_deduplication (
        public_id,
        source_module,
        source_event_public_id,
        source_event_type,
        idempotency_key,
        payload_fingerprint,
        payload,
        occurred_at,
        available_at,
        first_seen_at,
        last_seen_at,
        status,
        processing_attempts,
        recipient_count,
        created_at,
        updated_at
    )
    VALUES (
        notification_make_public_id(
            'notification_event_'
        ),
        p_source_module,
        NULLIF(
            btrim(p_source_event_public_id),
            ''
        ),
        p_source_event_type,
        p_idempotency_key,
        v_fingerprint,
        v_payload,
        p_occurred_at,
        GREATEST(
            p_available_at,
            p_occurred_at
        ),
        GREATEST(
            CURRENT_TIMESTAMP,
            p_occurred_at
        ),
        GREATEST(
            CURRENT_TIMESTAMP,
            p_occurred_at
        ),
        'pending',
        0,
        0,
        GREATEST(
            CURRENT_TIMESTAMP,
            p_occurred_at
        ),
        GREATEST(
            CURRENT_TIMESTAMP,
            p_occurred_at
        )
    )
    ON CONFLICT (idempotency_key)
    DO NOTHING
    RETURNING
        id,
        public_id
    INTO
        event_internal_id,
        event_public_id;

    IF FOUND THEN
        is_new := TRUE;
        RETURN NEXT;
        RETURN;
    END IF;

    SELECT *
    INTO v_existing
    FROM notification_event_deduplication
    WHERE idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Notification event deduplication conflict could not be resolved.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_existing.source_module IS DISTINCT FROM
            p_source_module
       OR v_existing.source_event_public_id IS DISTINCT FROM
            NULLIF(
                btrim(p_source_event_public_id),
                ''
            )
       OR v_existing.source_event_type IS DISTINCT FROM
            p_source_event_type
       OR v_existing.payload_fingerprint IS DISTINCT FROM
            v_fingerprint THEN
        RAISE EXCEPTION
            'Notification event idempotency key was reused with different source data or payload.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE notification_event_deduplication
    SET last_seen_at = GREATEST(
            last_seen_at,
            CURRENT_TIMESTAMP
        )
    WHERE id = v_existing.id;

    event_internal_id := v_existing.id;
    event_public_id := v_existing.public_id;
    is_new := FALSE;

    RETURN NEXT;
END;
$$;


CREATE OR REPLACE FUNCTION enforce_notification_event_dedup_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Notification and delivery audit records cannot be hard deleted from table %.',
            TG_TABLE_NAME
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'pending'
           OR NEW.processing_attempts <> 0
           OR NEW.recipient_count <> 0 THEN
            RAISE EXCEPTION
                'A registered notification event must start pending with zero attempts and recipients.'
                USING ERRCODE = 'P0001';
        END IF;

        RETURN NEW;
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.source_module IS DISTINCT FROM
            OLD.source_module
       OR NEW.source_event_public_id IS DISTINCT FROM
            OLD.source_event_public_id
       OR NEW.source_event_type IS DISTINCT FROM
            OLD.source_event_type
       OR NEW.idempotency_key IS DISTINCT FROM
            OLD.idempotency_key
       OR NEW.payload_fingerprint IS DISTINCT FROM
            OLD.payload_fingerprint
       OR NEW.payload IS DISTINCT FROM OLD.payload
       OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
       OR NEW.first_seen_at IS DISTINCT FROM
            OLD.first_seen_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Notification event source identity and payload are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.last_seen_at < OLD.last_seen_at THEN
        RAISE EXCEPTION
            'Notification event last-seen timestamp cannot move backwards.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.available_at < OLD.available_at THEN
        RAISE EXCEPTION
            'Notification event retry availability cannot move backwards.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.processing_attempts <
            OLD.processing_attempts THEN
        RAISE EXCEPTION
            'Notification event processing attempts cannot decrease.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.recipient_count < OLD.recipient_count THEN
        RAISE EXCEPTION
            'Notification event recipient count cannot decrease.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status IN ('processed', 'dead_letter')
       AND (
            NEW.status IS DISTINCT FROM OLD.status
            OR NEW.processing_attempts IS DISTINCT FROM
                OLD.processing_attempts
            OR NEW.processing_started_at IS DISTINCT FROM
                OLD.processing_started_at
            OR NEW.processed_at IS DISTINCT FROM
                OLD.processed_at
            OR NEW.recipient_count IS DISTINCT FROM
                OLD.recipient_count
            OR NEW.last_error IS DISTINCT FROM
                OLD.last_error
            OR NEW.available_at IS DISTINCT FROM
                OLD.available_at
       ) THEN
        RAISE EXCEPTION
            'Processed and dead-letter notification events are immutable except for duplicate last-seen tracking.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status = 'pending'
       AND NEW.status NOT IN (
            'pending',
            'processing',
            'failed',
            'dead_letter'
       ) THEN
        RAISE EXCEPTION
            'Invalid notification-event transition from pending to %.',
            NEW.status
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status = 'processing'
       AND NEW.status NOT IN (
            'processing',
            'processed',
            'failed',
            'dead_letter'
       ) THEN
        RAISE EXCEPTION
            'Invalid notification-event transition from processing to %.',
            NEW.status
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status = 'failed'
       AND NEW.status NOT IN (
            'failed',
            'processing',
            'dead_letter'
       ) THEN
        RAISE EXCEPTION
            'Invalid notification-event transition from failed to %.',
            NEW.status
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER z_enforce_notification_event_dedup_integrity
BEFORE INSERT OR UPDATE OR DELETE
ON notification_event_deduplication
FOR EACH ROW
EXECUTE FUNCTION enforce_notification_event_dedup_integrity();


-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON FUNCTION register_notification_event(
    VARCHAR,
    VARCHAR,
    VARCHAR,
    TEXT,
    JSONB,
    TIMESTAMPTZ,
    TIMESTAMPTZ
) IS
'Registers a source event idempotently and rejects reuse of an idempotency key with different source data or payload.';

COMMENT ON FUNCTION provision_notification_preference_for_user() IS
'Creates the permanent default notification-preference profile for every newly created login user.';

COMMIT;

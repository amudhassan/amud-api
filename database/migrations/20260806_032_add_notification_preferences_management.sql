BEGIN;

-- =========================================================
-- NOTIFICATION PREFERENCES MANAGEMENT
-- Adds a user-level master switch and an immutable audit trail
-- for every meaningful preference change.
--
-- Access/security and critical-system categories remain
-- mandatory even when the master switch is disabled. That
-- enforcement is applied by notification-generation services.
-- =========================================================

ALTER TABLE notification_preferences
ADD COLUMN notifications_enabled BOOLEAN
    NOT NULL
    DEFAULT TRUE;

COMMENT ON COLUMN
notification_preferences.notifications_enabled IS
'User master switch for configurable notifications. Mandatory access and system notifications are not suppressed.';


-- =========================================================
-- IMMUTABLE PREFERENCE CHANGE AUDIT
-- =========================================================

CREATE TABLE notification_preference_changes (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(100) NOT NULL,

    notification_preference_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    changed_by BIGINT,

    change_source VARCHAR(30)
        NOT NULL
        DEFAULT 'system',

    changed_fields TEXT[] NOT NULL,

    previous_preferences JSONB NOT NULL,
    new_preferences JSONB NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_notification_preference_changes_public_id
        UNIQUE (public_id),

    CONSTRAINT chk_notification_preference_changes_public_id
        CHECK (
            public_id ~
            '^notification_preference_change_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_notification_preference_changes_source
        CHECK (
            change_source IN (
                'api_update',
                'api_reset',
                'system'
            )
        ),

    CONSTRAINT chk_notification_preference_changes_fields
        CHECK (
            cardinality(changed_fields) > 0
        ),

    CONSTRAINT chk_notification_preference_changes_previous
        CHECK (
            jsonb_typeof(previous_preferences) = 'object'
        ),

    CONSTRAINT chk_notification_preference_changes_new
        CHECK (
            jsonb_typeof(new_preferences) = 'object'
        ),

    CONSTRAINT fk_notification_preference_changes_preference
        FOREIGN KEY (notification_preference_id)
        REFERENCES notification_preferences(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_notification_preference_changes_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_notification_preference_changes_changed_by
        FOREIGN KEY (changed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_notification_preference_changes_user
ON notification_preference_changes (
    user_id,
    created_at DESC,
    id DESC
);

CREATE INDEX idx_notification_preference_changes_preference
ON notification_preference_changes (
    notification_preference_id,
    created_at DESC,
    id DESC
);

CREATE INDEX idx_notification_preference_changes_changed_by
ON notification_preference_changes (
    changed_by,
    created_at DESC,
    id DESC
)
WHERE changed_by IS NOT NULL;


-- =========================================================
-- SNAPSHOT HELPER
-- =========================================================

CREATE OR REPLACE FUNCTION build_notification_preference_snapshot(
    p_preference notification_preferences
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT jsonb_build_object(
        'notifications_enabled',
            p_preference.notifications_enabled,
        'channels',
            jsonb_build_object(
                'in_app',
                    p_preference.in_app_enabled,
                'email',
                    p_preference.email_enabled,
                'sms',
                    p_preference.sms_enabled,
                'whatsapp',
                    p_preference.whatsapp_enabled,
                'push',
                    p_preference.push_enabled
            ),
        'minimum_priority',
            p_preference.minimum_priority,
        'digest_frequency',
            p_preference.digest_frequency,
        'quiet_hours',
            jsonb_build_object(
                'enabled',
                    p_preference.quiet_hours_enabled,
                'start',
                    p_preference.quiet_hours_start,
                'end',
                    p_preference.quiet_hours_end,
                'timezone',
                    p_preference.timezone
            ),
        'categories',
            p_preference.category_preferences
    );
$$;


-- =========================================================
-- AUTOMATIC CHANGE AUDIT
-- The API sets a transaction-local source value. Direct SQL
-- changes safely fall back to the system source.
-- =========================================================

CREATE OR REPLACE FUNCTION audit_notification_preference_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_changed_fields TEXT[];
    v_change_source TEXT;
BEGIN
    v_changed_fields := array_remove(
        ARRAY[
            CASE
                WHEN NEW.notifications_enabled
                    IS DISTINCT FROM
                    OLD.notifications_enabled
                THEN 'notifications_enabled'
            END,
            CASE
                WHEN NEW.in_app_enabled
                    IS DISTINCT FROM
                    OLD.in_app_enabled
                THEN 'channels.in_app'
            END,
            CASE
                WHEN NEW.email_enabled
                    IS DISTINCT FROM
                    OLD.email_enabled
                THEN 'channels.email'
            END,
            CASE
                WHEN NEW.sms_enabled
                    IS DISTINCT FROM
                    OLD.sms_enabled
                THEN 'channels.sms'
            END,
            CASE
                WHEN NEW.whatsapp_enabled
                    IS DISTINCT FROM
                    OLD.whatsapp_enabled
                THEN 'channels.whatsapp'
            END,
            CASE
                WHEN NEW.push_enabled
                    IS DISTINCT FROM
                    OLD.push_enabled
                THEN 'channels.push'
            END,
            CASE
                WHEN NEW.minimum_priority
                    IS DISTINCT FROM
                    OLD.minimum_priority
                THEN 'minimum_priority'
            END,
            CASE
                WHEN NEW.digest_frequency
                    IS DISTINCT FROM
                    OLD.digest_frequency
                THEN 'digest_frequency'
            END,
            CASE
                WHEN NEW.quiet_hours_enabled
                    IS DISTINCT FROM
                    OLD.quiet_hours_enabled
                THEN 'quiet_hours.enabled'
            END,
            CASE
                WHEN NEW.quiet_hours_start
                    IS DISTINCT FROM
                    OLD.quiet_hours_start
                THEN 'quiet_hours.start'
            END,
            CASE
                WHEN NEW.quiet_hours_end
                    IS DISTINCT FROM
                    OLD.quiet_hours_end
                THEN 'quiet_hours.end'
            END,
            CASE
                WHEN NEW.timezone
                    IS DISTINCT FROM
                    OLD.timezone
                THEN 'quiet_hours.timezone'
            END,
            CASE
                WHEN NEW.category_preferences
                    IS DISTINCT FROM
                    OLD.category_preferences
                THEN 'categories'
            END
        ],
        NULL
    );

    IF cardinality(v_changed_fields) = 0 THEN
        RETURN NULL;
    END IF;

    v_change_source := NULLIF(
        current_setting(
            'app.notification_preference_change_source',
            TRUE
        ),
        ''
    );

    IF v_change_source IS NULL
       OR v_change_source NOT IN (
            'api_update',
            'api_reset',
            'system'
       ) THEN
        v_change_source := 'system';
    END IF;

    INSERT INTO notification_preference_changes (
        public_id,
        notification_preference_id,
        user_id,
        changed_by,
        change_source,
        changed_fields,
        previous_preferences,
        new_preferences,
        created_at
    )
    VALUES (
        notification_make_public_id(
            'notification_preference_change_'
        ),
        NEW.id,
        NEW.user_id,
        NEW.updated_by,
        v_change_source,
        v_changed_fields,
        build_notification_preference_snapshot(OLD),
        build_notification_preference_snapshot(NEW),
        CURRENT_TIMESTAMP
    );

    RETURN NULL;
END;
$$;

CREATE TRIGGER audit_notification_preference_after_update
AFTER UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION audit_notification_preference_change();


-- =========================================================
-- AUDIT IMMUTABILITY
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_notification_preference_change_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Notification preference change records cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION
            'Notification preference change records are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER z_enforce_notification_preference_change_integrity
BEFORE UPDATE OR DELETE
ON notification_preference_changes
FOR EACH ROW
EXECUTE FUNCTION enforce_notification_preference_change_integrity();

COMMIT;

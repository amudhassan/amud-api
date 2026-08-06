-- =========================================================
-- NOTIFICATIONS BATCH D VERIFICATION
-- Runs inside a transaction and rolls back all test changes.
-- =========================================================

BEGIN;

DO $$
DECLARE
    v_user_id BIGINT;
    v_preference_id BIGINT;
    v_original_enabled BOOLEAN;
    v_change_source TEXT;
    v_changed_fields TEXT[];
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'notification_preferences'
          AND column_name = 'notifications_enabled'
    ) THEN
        RAISE EXCEPTION
            'notifications_enabled column is missing.';
    END IF;

    IF to_regclass(
        'public.notification_preference_changes'
    ) IS NULL THEN
        RAISE EXCEPTION
            'notification_preference_changes table is missing.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname =
            'audit_notification_preference_after_update'
          AND tgisinternal = FALSE
    ) THEN
        RAISE EXCEPTION
            'Preference audit trigger is missing.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname =
            'z_enforce_notification_preference_change_integrity'
          AND tgisinternal = FALSE
    ) THEN
        RAISE EXCEPTION
            'Preference audit integrity trigger is missing.';
    END IF;

    SELECT
        u.id,
        np.id,
        np.notifications_enabled
    INTO
        v_user_id,
        v_preference_id,
        v_original_enabled
    FROM users AS u
    INNER JOIN notification_preferences AS np
        ON np.user_id = u.id
    WHERE u.deleted_at IS NULL
    ORDER BY u.id
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION
            'Batch D verification requires at least one active user with preferences.';
    END IF;

    PERFORM set_config(
        'app.notification_preference_change_source',
        'system',
        TRUE
    );

    UPDATE notification_preferences
    SET
        notifications_enabled =
            NOT notifications_enabled,
        updated_by = v_user_id
    WHERE id = v_preference_id;

    SELECT
        change_source,
        changed_fields
    INTO
        v_change_source,
        v_changed_fields
    FROM notification_preference_changes
    WHERE notification_preference_id =
            v_preference_id
    ORDER BY id DESC
    LIMIT 1;

    IF v_change_source IS NULL THEN
        RAISE EXCEPTION
            'Preference audit record was not created.';
    END IF;

    IF v_change_source <> 'system' THEN
        RAISE EXCEPTION
            'Unexpected preference audit source: %.',
            v_change_source;
    END IF;

    IF NOT (
        'notifications_enabled' = ANY(
            v_changed_fields
        )
    ) THEN
        RAISE EXCEPTION
            'Preference audit changed-fields list is incomplete.';
    END IF;

    BEGIN
        DELETE FROM notification_preference_changes
        WHERE notification_preference_id =
                v_preference_id;

        RAISE EXCEPTION
            USING
                MESSAGE =
                    'Preference audit hard-delete protection failed.',
                ERRCODE = 'ZX001';
    EXCEPTION
        WHEN SQLSTATE 'P0001' THEN
            NULL;
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM notification_preferences
        WHERE id = v_preference_id
          AND notifications_enabled =
                NOT v_original_enabled
    ) THEN
        RAISE EXCEPTION
            'Preference master-switch update failed.';
    END IF;
END;
$$;

SELECT
    'notification_preferences_management' AS verification,
    'passed' AS result;

ROLLBACK;

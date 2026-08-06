-- =========================================================
-- NOTIFICATIONS BATCH C VERIFICATION
-- Runs inside a transaction and rolls back all test data.
-- =========================================================

BEGIN;

DO $$
DECLARE
    v_user_id BIGINT;
    v_notification_id BIGINT;
    v_is_read BOOLEAN;
    v_read_at TIMESTAMPTZ;
    v_is_archived BOOLEAN;
    v_archived_at TIMESTAMPTZ;
BEGIN
    SELECT id
    INTO v_user_id
    FROM users
    WHERE deleted_at IS NULL
    ORDER BY id
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION
            'Batch C verification requires at least one active user.';
    END IF;

    INSERT INTO notifications (
        public_id,
        recipient_user_id,
        actor_user_id,
        notification_type,
        category,
        priority,
        title,
        message,
        action_path,
        source_module,
        source_entity_type,
        source_event_type,
        source_event_idempotency_key,
        payload
    )
    VALUES (
        notification_make_public_id('notification_'),
        v_user_id,
        v_user_id,
        'batch_c_verification',
        'system',
        'normal',
        'Batch C Verification',
        'Temporary notification used to verify archive and restore integrity.',
        '/notifications',
        'system',
        'notification_test',
        'batch_c_verification_created',
        'batch_c_verification_' || txid_current()::TEXT,
        jsonb_build_object(
            'temporary', TRUE,
            'verification', 'batch_c'
        )
    )
    RETURNING id
    INTO v_notification_id;

    UPDATE notifications
    SET
        is_read = TRUE,
        read_at = CURRENT_TIMESTAMP,
        is_archived = TRUE,
        archived_at = CURRENT_TIMESTAMP
    WHERE id = v_notification_id;

    SELECT
        is_read,
        read_at,
        is_archived,
        archived_at
    INTO
        v_is_read,
        v_read_at,
        v_is_archived,
        v_archived_at
    FROM notifications
    WHERE id = v_notification_id;

    IF v_is_read <> TRUE
       OR v_read_at IS NULL
       OR v_is_archived <> TRUE
       OR v_archived_at IS NULL THEN
        RAISE EXCEPTION
            'Archive transition verification failed.';
    END IF;

    UPDATE notifications
    SET
        is_archived = FALSE,
        archived_at = NULL
    WHERE id = v_notification_id;

    SELECT
        is_read,
        read_at,
        is_archived,
        archived_at
    INTO
        v_is_read,
        v_read_at,
        v_is_archived,
        v_archived_at
    FROM notifications
    WHERE id = v_notification_id;

    IF v_is_read <> TRUE
       OR v_read_at IS NULL
       OR v_is_archived <> FALSE
       OR v_archived_at IS NOT NULL THEN
        RAISE EXCEPTION
            'Restore transition verification failed.';
    END IF;
END;
$$;

SELECT
    'notification_archive_restore_integrity' AS verification,
    'passed' AS result;

ROLLBACK;

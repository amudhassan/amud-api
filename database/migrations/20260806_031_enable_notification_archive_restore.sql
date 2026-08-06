BEGIN;

-- =========================================================
-- NOTIFICATION ARCHIVE / RESTORE LIFECYCLE
--
-- Migration 030 intentionally made archived notifications
-- immutable. Batch C introduces an explicit restore action,
-- so this function now permits only the controlled lifecycle:
--
-- active -> archived -> active -> archived ...
--
-- Notification identity, content, recipient, source data and
-- read state remain protected and immutable as before.
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

    -- Notification identity, content and source data never change.
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

    -- Read lifecycle remains one-way.
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

    -- An unchanged archive state cannot carry a changed archive timestamp.
    IF NEW.is_archived IS NOT DISTINCT FROM OLD.is_archived
       AND NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
        RAISE EXCEPTION
            'Notification archive timestamp can change only during an archive or restore transition.'
            USING ERRCODE = 'P0001';
    END IF;

    -- Controlled active -> archived transition.
    IF OLD.is_archived = FALSE
       AND NEW.is_archived = TRUE THEN
        IF NEW.archived_at IS NULL
           OR NEW.is_read <> TRUE
           OR NEW.read_at IS NULL THEN
            RAISE EXCEPTION
                'Archiving requires a read notification and an archive timestamp.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Controlled archived -> active transition.
    -- Restoring does not make the notification unread.
    IF OLD.is_archived = TRUE
       AND NEW.is_archived = FALSE THEN
        IF NEW.archived_at IS NOT NULL
           OR NEW.is_read <> TRUE
           OR NEW.read_at IS NULL THEN
            RAISE EXCEPTION
                'Restoring requires archived_at to be cleared while preserving the read state.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION enforce_notification_record_integrity() IS
'Protects immutable notification data, preserves one-way read state, prevents hard delete and permits only controlled archive/restore transitions.';

COMMIT;

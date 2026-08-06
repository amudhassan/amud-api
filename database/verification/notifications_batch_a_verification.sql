-- =========================================================
-- NOTIFICATIONS BATCH A - NON-DESTRUCTIVE VERIFICATION
-- Run only after migrations 029 and 030 succeed.
-- =========================================================

-- 1. Expected tables. Result must contain zero rows.
WITH expected_tables(table_name) AS (
    VALUES
        ('notifications'),
        ('notification_preferences'),
        ('notification_delivery_attempts'),
        ('notification_event_deduplication')
)
SELECT e.table_name AS missing_table
FROM expected_tables AS e
LEFT JOIN information_schema.tables AS t
    ON t.table_schema = 'public'
   AND t.table_name = e.table_name
WHERE t.table_name IS NULL;


-- 2. Expected helper functions. Result must contain zero rows.
WITH expected_functions(function_name) AS (
    VALUES
        ('notification_make_public_id'),
        ('set_notification_updated_at'),
        ('prevent_notification_hard_delete'),
        ('enforce_notification_record_integrity'),
        ('validate_notification_preferences'),
        ('provision_notification_preference_for_user'),
        ('enforce_notification_delivery_integrity'),
        ('register_notification_event'),
        ('enforce_notification_event_dedup_integrity')
)
SELECT e.function_name AS missing_function
FROM expected_functions AS e
LEFT JOIN pg_proc AS p
    ON p.proname = e.function_name
LEFT JOIN pg_namespace AS n
    ON n.oid = p.pronamespace
   AND n.nspname = 'public'
WHERE p.oid IS NULL;


-- 3. Expected triggers. Result must contain zero rows.
WITH expected_triggers(trigger_name) AS (
    VALUES
        ('a_set_notifications_updated_at'),
        ('a_set_notification_preferences_updated_at'),
        ('a_set_notification_delivery_updated_at'),
        ('a_set_notification_event_dedup_updated_at'),
        ('z_enforce_notification_record_integrity'),
        ('z_validate_notification_preferences'),
        ('provision_notification_preference_after_user_insert'),
        ('z_enforce_notification_delivery_integrity'),
        ('z_enforce_notification_event_dedup_integrity')
)
SELECT e.trigger_name AS missing_trigger
FROM expected_triggers AS e
LEFT JOIN pg_trigger AS t
    ON t.tgname = e.trigger_name
   AND t.tgisinternal = FALSE
WHERE t.oid IS NULL;


-- 4. Every user must have exactly one preference profile.
-- users_missing_preferences and duplicate_preference_users must be 0.
SELECT
    (
        SELECT COUNT(*)
        FROM users AS u
        LEFT JOIN notification_preferences AS np
            ON np.user_id = u.id
        WHERE np.id IS NULL
    ) AS users_missing_preferences,
    (
        SELECT COUNT(*)
        FROM (
            SELECT user_id
            FROM notification_preferences
            GROUP BY user_id
            HAVING COUNT(*) <> 1
        ) AS duplicates
    ) AS duplicate_preference_users;


-- 5. Stored preference JSON must be complete and valid.
-- invalid_preference_rows must be 0.
SELECT COUNT(*) AS invalid_preference_rows
FROM notification_preferences AS np
WHERE jsonb_typeof(np.category_preferences) <> 'object'
   OR (SELECT COUNT(*) FROM jsonb_object_keys(np.category_preferences)) <> 7
   OR NOT (
        np.category_preferences ?& ARRAY[
            'access',
            'lease',
            'billing',
            'payment',
            'maintenance',
            'preventive_maintenance',
            'system'
        ]
   )
   OR COALESCE(
        (np.category_preferences ->> 'access')::BOOLEAN,
        FALSE
   ) <> TRUE
   OR COALESCE(
        (np.category_preferences ->> 'system')::BOOLEAN,
        FALSE
   ) <> TRUE;


-- 6. Row counts for the Batch A tables.
SELECT
    'notifications' AS table_name,
    COUNT(*)::BIGINT AS total_rows
FROM notifications
UNION ALL
SELECT
    'notification_preferences',
    COUNT(*)::BIGINT
FROM notification_preferences
UNION ALL
SELECT
    'notification_delivery_attempts',
    COUNT(*)::BIGINT
FROM notification_delivery_attempts
UNION ALL
SELECT
    'notification_event_deduplication',
    COUNT(*)::BIGINT
FROM notification_event_deduplication
ORDER BY table_name;


-- 7. Required indexes. Result must contain zero rows.
WITH expected_indexes(index_name) AS (
    VALUES
        ('uq_notifications_recipient_event'),
        ('idx_notifications_recipient_active'),
        ('idx_notifications_recipient_unread'),
        ('uq_notification_preferences_user'),
        ('uq_notification_delivery_attempts_number'),
        ('idx_notification_delivery_attempts_retry'),
        ('uq_notification_event_dedup_key'),
        ('uq_notification_event_dedup_source_event'),
        ('idx_notification_event_dedup_pending')
)
SELECT e.index_name AS missing_index
FROM expected_indexes AS e
LEFT JOIN pg_indexes AS i
    ON i.schemaname = 'public'
   AND i.indexname = e.index_name
WHERE i.indexname IS NULL;
WITH verification AS (
    SELECT
        to_regclass(
            'public.notification_recipient_decisions'
        ) IS NOT NULL
            AS recipient_decision_table_exists,

        EXISTS (
            SELECT 1
            FROM pg_proc AS p
            INNER JOIN pg_namespace AS n
                ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname =
                    'notification_priority_rank'
        ) AS priority_function_exists,

        EXISTS (
            SELECT 1
            FROM pg_proc AS p
            INNER JOIN pg_namespace AS n
                ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname =
                    'calculate_notification_available_at'
        ) AS availability_function_exists,

        EXISTS (
            SELECT 1
            FROM pg_proc AS p
            INNER JOIN pg_namespace AS n
                ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname =
                    'enforce_notification_recipient_decision_integrity'
        ) AS integrity_function_exists,

        EXISTS (
            SELECT 1
            FROM pg_trigger AS t
            WHERE t.tgname =
                'enforce_notification_recipient_decision_integrity'
              AND t.tgisinternal = FALSE
        ) AS integrity_trigger_exists,

        (
            SELECT COUNT(*)
            FROM pg_indexes AS i
            WHERE i.schemaname = 'public'
              AND i.indexname IN (
                    'idx_notification_recipient_decisions_user',
                    'idx_notification_recipient_decisions_event',
                    'idx_notification_recipient_decisions_suppressed'
              )
        ) = 3 AS expected_indexes_exist,

        notification_priority_rank('low') = 1
        AND notification_priority_rank('normal') = 2
        AND notification_priority_rank('high') = 3
        AND notification_priority_rank('urgent') = 4
            AS priority_ranks_are_valid,

        calculate_notification_available_at(
            CURRENT_TIMESTAMP,
            'disabled',
            FALSE,
            NULL,
            NULL,
            'UTC'
        ) IS NULL
            AS disabled_digest_returns_null,

        calculate_notification_available_at(
            CURRENT_TIMESTAMP,
            'immediate',
            FALSE,
            NULL,
            NULL,
            'UTC'
        ) >= CURRENT_TIMESTAMP
            AS immediate_delivery_is_valid,

        NOT EXISTS (
            SELECT 1
            FROM notification_recipient_decisions AS nrd
            WHERE (
                nrd.decision = 'created'
                AND nrd.notification_id IS NULL
            )
            OR (
                nrd.decision = 'suppressed'
                AND nrd.notification_id IS NOT NULL
            )
        ) AS decision_rows_are_consistent
)
SELECT
    recipient_decision_table_exists,
    priority_function_exists,
    availability_function_exists,
    integrity_function_exists,
    integrity_trigger_exists,
    expected_indexes_exist,
    priority_ranks_are_valid,
    disabled_digest_returns_null,
    immediate_delivery_is_valid,
    decision_rows_are_consistent,
    CASE
        WHEN recipient_decision_table_exists
         AND priority_function_exists
         AND availability_function_exists
         AND integrity_function_exists
         AND integrity_trigger_exists
         AND expected_indexes_exist
         AND priority_ranks_are_valid
         AND disabled_digest_returns_null
         AND immediate_delivery_is_valid
         AND decision_rows_are_consistent
            THEN 'passed'
        ELSE 'failed'
    END AS notification_maintenance_processing
FROM verification;

SELECT
    me.public_id AS maintenance_event_public_id,
    me.event_type,
    me.processed_at AS source_processed_at,
    me.processing_attempts AS source_attempts,
    me.last_processing_error,

    ned.public_id AS notification_event_public_id,
    ned.status AS notification_event_status,
    ned.recipient_count,
    ned.processing_attempts AS notification_attempts,
    ned.last_error AS notification_last_error,

    COUNT(nrd.id) AS candidate_decisions,
    COUNT(nrd.id) FILTER (
        WHERE nrd.decision = 'created'
    ) AS created_decisions,
    COUNT(nrd.id) FILTER (
        WHERE nrd.decision = 'suppressed'
    ) AS suppressed_decisions,
    COUNT(n.id) AS notifications_created

FROM maintenance_events AS me
LEFT JOIN notification_event_deduplication AS ned
    ON ned.source_event_public_id = me.public_id
LEFT JOIN notification_recipient_decisions AS nrd
    ON nrd.notification_event_id = ned.id
LEFT JOIN notifications AS n
    ON n.id = nrd.notification_id
WHERE me.idempotency_key LIKE
    'notification-batch-e-test:%'
GROUP BY
    me.id,
    me.public_id,
    me.event_type,
    me.processed_at,
    me.processing_attempts,
    me.last_processing_error,
    ned.id,
    ned.public_id,
    ned.status,
    ned.recipient_count,
    ned.processing_attempts,
    ned.last_error
ORDER BY me.id DESC
LIMIT 10;

WITH target_request AS (
    SELECT
        mr.id,
        mr.public_id,
        mr.request_number,
        mr.status,
        mr.priority
    FROM maintenance_requests AS mr
    ORDER BY mr.id ASC
    LIMIT 1
),
new_event AS (
    INSERT INTO maintenance_events (
        public_id,
        maintenance_request_id,
        event_type,
        idempotency_key,
        payload,
        occurred_at,
        available_at,
        processing_attempts,
        created_at
    )
    SELECT
        maintenance_make_public_id(
            'maintenance_event_'
        ),
        tr.id,
        'maintenance_status_changed',
        'notification-batch-e-test:' ||
            md5(
                clock_timestamp()::TEXT ||
                random()::TEXT
            ),
        jsonb_build_object(
            'request_public_id',
                tr.public_id,
            'request_number',
                tr.request_number,
            'old_status',
                tr.status,
            'new_status',
                tr.status,
            'priority',
                tr.priority,
            'test_source',
                'notifications_batch_e'
        ),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        0,
        CURRENT_TIMESTAMP
    FROM target_request AS tr
    RETURNING
        public_id,
        maintenance_request_id,
        event_type,
        idempotency_key,
        processed_at,
        processing_attempts,
        available_at
)
SELECT *
FROM new_event;

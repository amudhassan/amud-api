const pool = require(
    "../../config/db"
);

const {
    financialMaintenanceEventTypes,
    tenantVisibleMaintenanceEventTypes,
    technicianVisibleMaintenanceEventTypes,
    buildMaintenanceNotificationTemplate
} = require(
    "./maintenanceEventTemplateService"
);

const DEFAULT_BATCH_LIMIT = 25;
const MAX_BATCH_LIMIT = 100;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_BASE_SECONDS = 60;
const MAX_RETRY_SECONDS = 3600;

const normalizePositiveInteger = ({
    value,
    fallback,
    maximum = Number.MAX_SAFE_INTEGER
}) => {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isInteger(parsed) || parsed < 1) {
        return fallback;
    }

    return Math.min(parsed, maximum);
};

const normalizeProcessorOptions = options => ({
    limit: normalizePositiveInteger({
        value: options.limit,
        fallback: DEFAULT_BATCH_LIMIT,
        maximum: MAX_BATCH_LIMIT
    }),
    maxAttempts: normalizePositiveInteger({
        value: options.maxAttempts,
        fallback: DEFAULT_MAX_ATTEMPTS,
        maximum: 20
    }),
    retryBaseSeconds: normalizePositiveInteger({
        value: options.retryBaseSeconds,
        fallback: DEFAULT_RETRY_BASE_SECONDS,
        maximum: MAX_RETRY_SECONDS
    })
});

const sanitizeErrorMessage = error => {
    const message =
        error && typeof error.message === "string"
            ? error.message.trim()
            : "Unknown notification processing error.";

    return message.slice(0, 10000) ||
        "Unknown notification processing error.";
};

const calculateRetrySeconds = ({
    attemptNumber,
    retryBaseSeconds
}) => Math.min(
    retryBaseSeconds *
        Math.pow(2, Math.max(0, attemptNumber - 1)),
    MAX_RETRY_SECONDS
);

const beginTransaction = client =>
    client.query(
        `
        BEGIN TRANSACTION
        ISOLATION LEVEL READ COMMITTED
        `
    );

const claimNextMaintenanceEvent = async ({
    client
}) => {
    const claimResult = await client.query(
        `
        SELECT me.id
        FROM maintenance_events AS me
        WHERE me.processed_at IS NULL
          AND me.available_at <= CURRENT_TIMESTAMP
        ORDER BY
            me.available_at ASC,
            me.occurred_at ASC,
            me.id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
        `
    );

    if (claimResult.rows.length === 0) {
        return null;
    }

    const eventId = claimResult.rows[0].id;

    const contextResult = await client.query(
        `
        SELECT
            me.id,
            me.public_id,
            me.maintenance_request_id,
            me.event_type,
            me.idempotency_key,
            me.payload,
            me.occurred_at,
            me.available_at,
            me.processed_at,
            me.processing_attempts,
            me.last_processing_error,
            me.created_at,

            mr.id AS request_id,
            mr.public_id AS request_public_id,
            mr.request_number,
            mr.owner_id AS request_owner_id,
            mr.property_id AS request_property_id,
            mr.unit_id AS request_unit_id,
            mr.tenant_id AS request_tenant_id,
            mr.lease_id AS request_lease_id,
            mr.title AS request_title,
            mr.priority AS request_priority,
            mr.status AS request_status,
            mr.reported_by,
            mr.preventive_plan_id AS request_preventive_plan_id,

            pmp.id AS preventive_plan_id,
            pmp.public_id AS preventive_plan_public_id,
            pmp.owner_id AS preventive_owner_id,
            pmp.property_id AS preventive_property_id,
            pmp.unit_id AS preventive_unit_id,
            pmp.title AS preventive_title,
            pmp.priority AS preventive_priority,
            pmp.status AS preventive_status,
            pmp.created_by AS preventive_created_by

        FROM maintenance_events AS me
        LEFT JOIN maintenance_requests AS mr
            ON mr.id = me.maintenance_request_id
        LEFT JOIN preventive_maintenance_plans AS pmp
            ON pmp.id = mr.preventive_plan_id
            OR (
                me.maintenance_request_id IS NULL
                AND (
                    pmp.public_id =
                        me.payload ->>
                            'preventive_plan_public_id'
                    OR
                    pmp.id = CASE
                        WHEN COALESCE(
                            me.payload ->>
                                'preventive_plan_id',
                            ''
                        ) ~ '^[0-9]+$'
                            THEN (
                                me.payload ->>
                                    'preventive_plan_id'
                            )::BIGINT
                        ELSE NULL
                    END
                )
            )
        WHERE me.id = $1::BIGINT
        LIMIT 1
        `,
        [eventId]
    );

    return contextResult.rows[0] || null;
};

const incrementSourceAttempt = async ({
    client,
    sourceEventId
}) => {
    const result = await client.query(
        `
        UPDATE maintenance_events
        SET
            processing_attempts =
                processing_attempts + 1,
            last_processing_error = NULL
        WHERE id = $1::BIGINT
          AND processed_at IS NULL
        RETURNING processing_attempts
        `,
        [sourceEventId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return Number(
        result.rows[0].processing_attempts
    );
};

const buildSubjectContext = event => {
    if (event.request_id) {
        return {
            id: event.request_id,
            public_id:
                event.request_public_id,
            request_number:
                event.request_number,
            owner_id:
                event.request_owner_id,
            property_id:
                event.request_property_id,
            unit_id:
                event.request_unit_id,
            tenant_id:
                event.request_tenant_id,
            lease_id:
                event.request_lease_id,
            title:
                event.request_title,
            priority:
                event.request_priority,
            status:
                event.request_status,
            reported_by:
                event.reported_by,
            is_preventive_plan: false
        };
    }

    if (
        event.event_type ===
            "preventive_maintenance_due" &&
        event.preventive_plan_id
    ) {
        return {
            id: event.preventive_plan_id,
            public_id:
                event.preventive_plan_public_id,
            request_number: null,
            owner_id:
                event.preventive_owner_id,
            property_id:
                event.preventive_property_id,
            unit_id:
                event.preventive_unit_id,
            tenant_id: null,
            lease_id: null,
            title:
                event.preventive_title,
            priority:
                event.preventive_priority,
            status:
                event.preventive_status,
            reported_by:
                event.preventive_created_by,
            is_preventive_plan: true
        };
    }

    return null;
};

const registerNotificationEvent = async ({
    client,
    event,
    template
}) => {
    const result = await client.query(
        `
        SELECT
            event_internal_id,
            event_public_id,
            is_new
        FROM register_notification_event(
            $1::VARCHAR,
            $2::VARCHAR,
            $3::VARCHAR,
            $4::TEXT,
            $5::JSONB,
            $6::TIMESTAMPTZ,
            $7::TIMESTAMPTZ
        )
        `,
        [
            template.source_module,
            event.public_id,
            event.event_type,
            event.idempotency_key,
            JSON.stringify(event.payload || {}),
            event.occurred_at,
            event.available_at
        ]
    );

    return result.rows[0];
};

const lockNotificationEvent = async ({
    client,
    notificationEventId
}) => {
    const result = await client.query(
        `
        SELECT *
        FROM notification_event_deduplication
        WHERE id = $1::BIGINT
        LIMIT 1
        FOR UPDATE
        `,
        [notificationEventId]
    );

    return result.rows[0] || null;
};

const markNotificationEventProcessing = async ({
    client,
    notificationEventId
}) => {
    const result = await client.query(
        `
        UPDATE notification_event_deduplication
        SET
            status = 'processing',
            processing_attempts =
                processing_attempts + 1,
            processing_started_at =
                CURRENT_TIMESTAMP,
            processed_at = NULL,
            last_error = NULL
        WHERE id = $1::BIGINT
          AND status IN (
              'pending',
              'failed'
          )
        RETURNING *
        `,
        [notificationEventId]
    );

    return result.rows[0] || null;
};

const resolveRecipientCandidates = async ({
    client,
    subject,
    eventType,
    category,
    priority
}) => {
    const isFinancialEvent =
        financialMaintenanceEventTypes.has(
            eventType
        );

    const tenantAllowed =
        tenantVisibleMaintenanceEventTypes.has(
            eventType
        ) &&
        Boolean(subject.tenant_id);

    const technicianAllowed =
        technicianVisibleMaintenanceEventTypes.has(
            eventType
        ) &&
        subject.is_preventive_plan !== true;

    const reporterAllowed =
        !isFinancialEvent &&
        Boolean(subject.reported_by);

    const result = await client.query(
        `
        WITH candidate_users AS (
            SELECT
                u.id AS user_id,
                'admin'::TEXT AS candidate_role
            FROM users AS u
            WHERE u.role = 'admin'
              AND u.deleted_at IS NULL
              AND u.is_verified = TRUE

            UNION ALL

            SELECT
                ou.user_id,
                'owner_user'::TEXT
            FROM owner_users AS ou
            INNER JOIN users AS u
                ON u.id = ou.user_id
               AND u.deleted_at IS NULL
               AND u.is_verified = TRUE
            WHERE ou.owner_id = $1::BIGINT
              AND ou.revoked_at IS NULL
              AND (
                    ou.is_primary = TRUE
                    OR ou.relationship_role = 'owner'
                    OR (
                        $4::BOOLEAN = FALSE
                        AND
                        ou.can_view_maintenance_requests = TRUE
                    )
                    OR (
                        $4::BOOLEAN = TRUE
                        AND (
                            ou.can_manage_maintenance_costs = TRUE
                            OR
                            ou.can_approve_maintenance_costs = TRUE
                            OR
                            ou.can_manage_finances = TRUE
                        )
                    )
              )

            UNION ALL

            SELECT
                tu.user_id,
                'tenant_user'::TEXT
            FROM tenant_users AS tu
            INNER JOIN users AS u
                ON u.id = tu.user_id
               AND u.deleted_at IS NULL
               AND u.is_verified = TRUE
            WHERE $5::BOOLEAN = TRUE
              AND tu.tenant_id = $2::BIGINT
              AND tu.revoked_at IS NULL
              AND (
                    tu.is_primary = TRUE
                    OR tu.can_submit_maintenance = TRUE
              )

            UNION ALL

            SELECT
                ma.assigned_user_id,
                'assigned_technician'::TEXT
            FROM maintenance_assignments AS ma
            INNER JOIN users AS u
                ON u.id = ma.assigned_user_id
               AND u.deleted_at IS NULL
               AND u.is_verified = TRUE
            WHERE $6::BOOLEAN = TRUE
              AND ma.maintenance_request_id = $3::BIGINT
              AND ma.assignment_type =
                    'internal_technician'
              AND ma.assigned_user_id IS NOT NULL
              AND ma.status IN (
                    'pending',
                    'accepted',
                    'active'
              )

            UNION ALL

            SELECT
                u.id,
                'reporter'::TEXT
            FROM users AS u
            WHERE $7::BOOLEAN = TRUE
              AND u.id = $8::BIGINT
              AND u.deleted_at IS NULL
              AND u.is_verified = TRUE
        ),
        grouped_candidates AS (
            SELECT
                user_id,
                array_agg(
                    DISTINCT candidate_role
                    ORDER BY candidate_role
                ) AS candidate_roles
            FROM candidate_users
            GROUP BY user_id
        )
        SELECT
            gc.user_id,
            gc.candidate_roles,

            COALESCE(
                np.notifications_enabled,
                TRUE
            ) AS notifications_enabled,
            COALESCE(
                np.in_app_enabled,
                TRUE
            ) AS in_app_enabled,
            COALESCE(
                np.minimum_priority,
                'low'
            ) AS minimum_priority,
            COALESCE(
                np.digest_frequency,
                'immediate'
            ) AS digest_frequency,
            COALESCE(
                np.quiet_hours_enabled,
                FALSE
            ) AS quiet_hours_enabled,
            np.quiet_hours_start,
            np.quiet_hours_end,
            COALESCE(
                np.timezone,
                'UTC'
            ) AS timezone,
            COALESCE(
                np.category_preferences,
                jsonb_build_object(
                    'access', TRUE,
                    'lease', TRUE,
                    'billing', TRUE,
                    'payment', TRUE,
                    'maintenance', TRUE,
                    'preventive_maintenance', TRUE,
                    'system', TRUE
                )
            ) AS category_preferences,
            COALESCE(
                (
                    np.category_preferences ->>
                        $9::TEXT
                )::BOOLEAN,
                TRUE
            ) AS category_enabled,

            notification_priority_rank(
                $10::VARCHAR
            ) AS notification_priority_rank,
            notification_priority_rank(
                COALESCE(
                    np.minimum_priority,
                    'low'
                )
            ) AS minimum_priority_rank,

            calculate_notification_available_at(
                CURRENT_TIMESTAMP,
                COALESCE(
                    np.digest_frequency,
                    'immediate'
                ),
                COALESCE(
                    np.quiet_hours_enabled,
                    FALSE
                ),
                np.quiet_hours_start,
                np.quiet_hours_end,
                COALESCE(
                    np.timezone,
                    'UTC'
                )
            ) AS scheduled_available_at

        FROM grouped_candidates AS gc
        LEFT JOIN notification_preferences AS np
            ON np.user_id = gc.user_id
        ORDER BY gc.user_id ASC
        `,
        [
            subject.owner_id,
            subject.tenant_id,
            subject.is_preventive_plan
                ? null
                : subject.id,
            isFinancialEvent,
            tenantAllowed,
            technicianAllowed,
            reporterAllowed,
            subject.reported_by,
            category,
            priority
        ]
    );

    return result.rows;
};

const shapePreferenceSnapshot = row => ({
    notifications_enabled:
        Boolean(row.notifications_enabled),
    in_app_enabled:
        Boolean(row.in_app_enabled),
    minimum_priority:
        row.minimum_priority,
    digest_frequency:
        row.digest_frequency,
    quiet_hours: {
        enabled:
            Boolean(row.quiet_hours_enabled),
        start:
            row.quiet_hours_start,
        end:
            row.quiet_hours_end,
        timezone:
            row.timezone
    },
    category_preferences:
        row.category_preferences || {}
});

const evaluateRecipientDecision = row => {
    if (row.notifications_enabled !== true) {
        return {
            decision: "suppressed",
            reason: "notifications_disabled"
        };
    }

    if (row.in_app_enabled !== true) {
        return {
            decision: "suppressed",
            reason: "in_app_disabled"
        };
    }

    if (row.category_enabled !== true) {
        return {
            decision: "suppressed",
            reason: "category_disabled"
        };
    }

    if (
        Number(row.notification_priority_rank) <
        Number(row.minimum_priority_rank)
    ) {
        return {
            decision: "suppressed",
            reason: "below_minimum_priority"
        };
    }

    if (
        row.digest_frequency === "disabled" ||
        !row.scheduled_available_at
    ) {
        return {
            decision: "suppressed",
            reason: "digest_disabled"
        };
    }

    return {
        decision: "created",
        reason: "created"
    };
};

const insertOrLoadNotification = async ({
    client,
    recipientUserId,
    template,
    scheduledAvailableAt
}) => {
    const insertResult = await client.query(
        `
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
            source_entity_public_id,
            source_event_public_id,
            source_event_type,
            source_event_idempotency_key,
            payload,
            available_at,
            expires_at,
            created_at,
            updated_at
        )
        VALUES (
            notification_make_public_id(
                'notification_'
            ),
            $1::BIGINT,
            NULL,
            $2::VARCHAR,
            $3::VARCHAR,
            $4::VARCHAR,
            $5::VARCHAR,
            $6::TEXT,
            $7::VARCHAR,
            $8::VARCHAR,
            $9::VARCHAR,
            $10::VARCHAR,
            $11::VARCHAR,
            $12::VARCHAR,
            $13::TEXT,
            $14::JSONB,
            GREATEST(
                $15::TIMESTAMPTZ,
                CURRENT_TIMESTAMP
            ),
            NULL,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (
            recipient_user_id,
            source_event_idempotency_key
        )
        DO NOTHING
        RETURNING
            id,
            public_id,
            source_event_public_id,
            source_event_type,
            source_entity_public_id,
            available_at
        `,
        [
            recipientUserId,
            template.notification_type,
            template.category,
            template.priority,
            template.title,
            template.message,
            template.action_path,
            template.source_module,
            template.source_entity_type,
            template.source_entity_public_id,
            template.source_event_public_id,
            template.source_event_type,
            template.source_event_idempotency_key,
            JSON.stringify(template.payload),
            scheduledAvailableAt
        ]
    );

    if (insertResult.rows.length > 0) {
        return {
            notification:
                insertResult.rows[0],
            wasCreated: true
        };
    }

    const existingResult = await client.query(
        `
        SELECT
            id,
            public_id,
            source_event_public_id,
            source_event_type,
            source_entity_public_id,
            available_at
        FROM notifications
        WHERE recipient_user_id = $1::BIGINT
          AND source_event_idempotency_key = $2
        LIMIT 1
        `,
        [
            recipientUserId,
            template.source_event_idempotency_key
        ]
    );

    if (existingResult.rows.length === 0) {
        throw new Error(
            "Notification idempotency conflict could not be resolved."
        );
    }

    const existing = existingResult.rows[0];

    if (
        existing.source_event_public_id !==
            template.source_event_public_id ||
        existing.source_event_type !==
            template.source_event_type ||
        existing.source_entity_public_id !==
            template.source_entity_public_id
    ) {
        throw new Error(
            "Notification idempotency key was reused for a different source event."
        );
    }

    return {
        notification: existing,
        wasCreated: false
    };
};

const insertRecipientDecision = async ({
    client,
    notificationEventId,
    recipient,
    template,
    evaluation,
    notificationId,
    scheduledAvailableAt
}) => {
    const preferenceSnapshot =
        shapePreferenceSnapshot(recipient);

    const insertResult = await client.query(
        `
        INSERT INTO notification_recipient_decisions (
            public_id,
            notification_event_id,
            recipient_user_id,
            notification_id,
            decision,
            decision_reason,
            candidate_roles,
            notification_category,
            notification_priority,
            scheduled_available_at,
            preference_snapshot,
            created_at
        )
        VALUES (
            notification_make_public_id(
                'notification_recipient_decision_'
            ),
            $1::BIGINT,
            $2::BIGINT,
            $3::BIGINT,
            $4::VARCHAR,
            $5::VARCHAR,
            $6::TEXT[],
            $7::VARCHAR,
            $8::VARCHAR,
            $9::TIMESTAMPTZ,
            $10::JSONB,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (
            notification_event_id,
            recipient_user_id
        )
        DO NOTHING
        RETURNING id
        `,
        [
            notificationEventId,
            recipient.user_id,
            notificationId,
            evaluation.decision,
            evaluation.reason,
            recipient.candidate_roles,
            template.category,
            template.priority,
            scheduledAvailableAt,
            JSON.stringify(preferenceSnapshot)
        ]
    );

    if (insertResult.rows.length > 0) {
        return;
    }

    const existingResult = await client.query(
        `
        SELECT
            decision,
            decision_reason,
            notification_id
        FROM notification_recipient_decisions
        WHERE notification_event_id = $1::BIGINT
          AND recipient_user_id = $2::BIGINT
        LIMIT 1
        `,
        [
            notificationEventId,
            recipient.user_id
        ]
    );

    const existing = existingResult.rows[0];

    if (
        !existing ||
        existing.decision !== evaluation.decision ||
        existing.decision_reason !==
            evaluation.reason ||
        Number(existing.notification_id || 0) !==
            Number(notificationId || 0)
    ) {
        throw new Error(
            "Notification recipient decision conflict could not be resolved safely."
        );
    }
};

const processRecipients = async ({
    client,
    notificationEventId,
    recipients,
    template
}) => {
    let createdCount = 0;
    let suppressedCount = 0;
    let insertedNotificationCount = 0;

    for (const recipient of recipients) {
        const evaluation =
            evaluateRecipientDecision(
                recipient
            );

        if (evaluation.decision === "suppressed") {
            await insertRecipientDecision({
                client,
                notificationEventId,
                recipient,
                template,
                evaluation,
                notificationId: null,
                scheduledAvailableAt: null
            });

            suppressedCount += 1;
            continue;
        }

        const notificationResult =
            await insertOrLoadNotification({
                client,
                recipientUserId:
                    recipient.user_id,
                template,
                scheduledAvailableAt:
                    recipient
                        .scheduled_available_at
            });

        await insertRecipientDecision({
            client,
            notificationEventId,
            recipient,
            template,
            evaluation,
            notificationId:
                notificationResult
                    .notification.id,
            scheduledAvailableAt:
                notificationResult
                    .notification.available_at
        });

        createdCount += 1;

        if (notificationResult.wasCreated) {
            insertedNotificationCount += 1;
        }
    }

    return {
        candidateCount: recipients.length,
        createdCount,
        suppressedCount,
        insertedNotificationCount
    };
};

const markProcessingSuccess = async ({
    client,
    sourceEventId,
    notificationEventId,
    recipientCount
}) => {
    await client.query(
        `
        UPDATE notification_event_deduplication
        SET
            status = 'processed',
            processed_at = CURRENT_TIMESTAMP,
            recipient_count = GREATEST(
                recipient_count,
                $2::INTEGER
            ),
            last_error = NULL
        WHERE id = $1::BIGINT
          AND status = 'processing'
        `,
        [
            notificationEventId,
            recipientCount
        ]
    );

    await client.query(
        `
        UPDATE maintenance_events
        SET
            processed_at = CURRENT_TIMESTAMP,
            last_processing_error = NULL
        WHERE id = $1::BIGINT
          AND processed_at IS NULL
        `,
        [sourceEventId]
    );
};

const markAlreadyTerminalSource = async ({
    client,
    sourceEventId,
    lastError = null
}) => {
    await client.query(
        `
        UPDATE maintenance_events
        SET
            processed_at = CURRENT_TIMESTAMP,
            last_processing_error = $2::TEXT
        WHERE id = $1::BIGINT
          AND processed_at IS NULL
        `,
        [
            sourceEventId,
            lastError
        ]
    );
};

const persistProcessingFailure = async ({
    client,
    event,
    template,
    attemptNumber,
    maxAttempts,
    retryBaseSeconds,
    errorMessage
}) => {
    const deadLettered =
        attemptNumber >= maxAttempts;

    const retrySeconds =
        calculateRetrySeconds({
            attemptNumber,
            retryBaseSeconds
        });

    const retryResult = await client.query(
        `
        SELECT
            CASE
                WHEN $1::BOOLEAN = TRUE
                    THEN CURRENT_TIMESTAMP
                ELSE CURRENT_TIMESTAMP +
                    ($2::INTEGER * INTERVAL '1 second')
            END AS next_available_at
        `,
        [
            deadLettered,
            retrySeconds
        ]
    );

    const nextAvailableAt =
        retryResult.rows[0]
            .next_available_at;

    let notificationEventId = null;

    await client.query(
        "SAVEPOINT notification_failure_audit"
    );

    try {
        const registration =
            await registerNotificationEvent({
                client,
                event,
                template
            });

        notificationEventId =
            registration.event_internal_id;

        const lockedEvent =
            await lockNotificationEvent({
                client,
                notificationEventId
            });

        if (
            lockedEvent &&
            ![
                "processed",
                "dead_letter"
            ].includes(lockedEvent.status)
        ) {
            await client.query(
                `
                UPDATE notification_event_deduplication
                SET
                    status = $2::VARCHAR,
                    processing_attempts =
                        processing_attempts + 1,
                    processing_started_at =
                        CURRENT_TIMESTAMP,
                    processed_at = NULL,
                    last_error = $3::TEXT,
                    available_at = GREATEST(
                        available_at,
                        $4::TIMESTAMPTZ
                    )
                WHERE id = $1::BIGINT
                `,
                [
                    notificationEventId,
                    deadLettered
                        ? "dead_letter"
                        : "failed",
                    errorMessage,
                    nextAvailableAt
                ]
            );
        }

        await client.query(
            "RELEASE SAVEPOINT notification_failure_audit"
        );
    } catch (failureAuditError) {
        await client.query(
            "ROLLBACK TO SAVEPOINT notification_failure_audit"
        );

        await client.query(
            "RELEASE SAVEPOINT notification_failure_audit"
        );
    }

    await client.query(
        `
        UPDATE maintenance_events
        SET
            available_at = GREATEST(
                available_at,
                $2::TIMESTAMPTZ
            ),
            processed_at = CASE
                WHEN $3::BOOLEAN = TRUE
                    THEN CURRENT_TIMESTAMP
                ELSE NULL
            END,
            last_processing_error = $4::TEXT
        WHERE id = $1::BIGINT
          AND processed_at IS NULL
        `,
        [
            event.id,
            nextAvailableAt,
            deadLettered,
            errorMessage
        ]
    );

    return {
        deadLettered,
        notificationEventId,
        nextAvailableAt
    };
};

const processSingleMaintenanceEvent = async ({
    maxAttempts,
    retryBaseSeconds
}) => {
    const client = await pool.connect();
    let transactionOpen = false;

    try {
        await beginTransaction(client);
        transactionOpen = true;

        const event =
            await claimNextMaintenanceEvent({
                client
            });

        if (!event) {
            await client.query("COMMIT");
            transactionOpen = false;

            return {
                queueEmpty: true
            };
        }

        const attemptNumber =
            await incrementSourceAttempt({
                client,
                sourceEventId: event.id
            });

        if (!attemptNumber) {
            await client.query("COMMIT");
            transactionOpen = false;

            return {
                skipped: true,
                sourceEventPublicId:
                    event.public_id
            };
        }

        const subject =
            buildSubjectContext(event);

        let template = null;

        await client.query(
            "SAVEPOINT notification_event_processing"
        );

        try {
            if (!subject) {
                throw new Error(
                    "Maintenance event has no resolvable request or preventive-plan context."
                );
            }

            template =
                buildMaintenanceNotificationTemplate({
                    event,
                    request: subject
                });

            const registration =
                await registerNotificationEvent({
                    client,
                    event,
                    template
                });

            const notificationEvent =
                await lockNotificationEvent({
                    client,
                    notificationEventId:
                        registration
                            .event_internal_id
                });

            if (!notificationEvent) {
                throw new Error(
                    "Registered notification event could not be loaded."
                );
            }

            if (
                notificationEvent.status ===
                    "processed"
            ) {
                await markAlreadyTerminalSource({
                    client,
                    sourceEventId: event.id
                });

                await client.query(
                    "RELEASE SAVEPOINT notification_event_processing"
                );
                await client.query("COMMIT");
                transactionOpen = false;

                return {
                    processed: true,
                    recovered: true,
                    sourceEventPublicId:
                        event.public_id,
                    notificationEventPublicId:
                        notificationEvent.public_id,
                    candidateCount: 0,
                    createdCount:
                        Number(
                            notificationEvent
                                .recipient_count
                        ),
                    suppressedCount: 0,
                    insertedNotificationCount: 0
                };
            }

            if (
                notificationEvent.status ===
                    "dead_letter"
            ) {
                await markAlreadyTerminalSource({
                    client,
                    sourceEventId: event.id,
                    lastError:
                        notificationEvent
                            .last_error ||
                        "Notification event was already dead-lettered."
                });

                await client.query(
                    "RELEASE SAVEPOINT notification_event_processing"
                );
                await client.query("COMMIT");
                transactionOpen = false;

                return {
                    deadLettered: true,
                    recovered: true,
                    sourceEventPublicId:
                        event.public_id,
                    notificationEventPublicId:
                        notificationEvent.public_id
                };
            }

            const processingEvent =
                await markNotificationEventProcessing({
                    client,
                    notificationEventId:
                        notificationEvent.id
                });

            if (!processingEvent) {
                throw new Error(
                    "Notification event could not enter processing status."
                );
            }

            const recipients =
                await resolveRecipientCandidates({
                    client,
                    subject,
                    eventType:
                        event.event_type,
                    category:
                        template.category,
                    priority:
                        template.priority
                });

            const recipientResult =
                await processRecipients({
                    client,
                    notificationEventId:
                        processingEvent.id,
                    recipients,
                    template
                });

            await markProcessingSuccess({
                client,
                sourceEventId: event.id,
                notificationEventId:
                    processingEvent.id,
                recipientCount:
                    recipientResult.createdCount
            });

            await client.query(
                "RELEASE SAVEPOINT notification_event_processing"
            );
            await client.query("COMMIT");
            transactionOpen = false;

            return {
                processed: true,
                sourceEventPublicId:
                    event.public_id,
                notificationEventPublicId:
                    processingEvent.public_id,
                ...recipientResult
            };
        } catch (processingError) {
            await client.query(
                "ROLLBACK TO SAVEPOINT notification_event_processing"
            );

            await client.query(
                "RELEASE SAVEPOINT notification_event_processing"
            );

            const errorMessage =
                sanitizeErrorMessage(
                    processingError
                );

            if (!template && subject) {
                try {
                    template =
                        buildMaintenanceNotificationTemplate({
                            event,
                            request: subject
                        });
                } catch (templateError) {
                    template = {
                        source_module:
                            event.event_type.startsWith(
                                "preventive_"
                            )
                                ? "preventive_maintenance"
                                : "maintenance"
                    };
                }
            }

            if (!template) {
                template = {
                    source_module:
                        event.event_type.startsWith(
                            "preventive_"
                        )
                            ? "preventive_maintenance"
                            : "maintenance"
                };
            }

            const failureResult =
                await persistProcessingFailure({
                    client,
                    event,
                    template,
                    attemptNumber,
                    maxAttempts,
                    retryBaseSeconds,
                    errorMessage
                });

            await client.query("COMMIT");
            transactionOpen = false;

            return {
                processed: false,
                retryScheduled:
                    !failureResult
                        .deadLettered,
                deadLettered:
                    failureResult
                        .deadLettered,
                sourceEventPublicId:
                    event.public_id,
                notificationEventId:
                    failureResult
                        .notificationEventId,
                attemptNumber,
                nextAvailableAt:
                    failureResult
                        .nextAvailableAt,
                error: errorMessage
            };
        }
    } catch (error) {
        if (transactionOpen) {
            await client.query("ROLLBACK");
        }

        throw error;
    } finally {
        client.release();
    }
};

const processMaintenanceNotificationEvents = async (
    options = {}
) => {
    const normalized =
        normalizeProcessorOptions(options);

    const summary = {
        requested_limit:
            normalized.limit,
        queue_empty: false,
        claimed_events: 0,
        processed_events: 0,
        recovered_events: 0,
        retry_scheduled_events: 0,
        dead_lettered_events: 0,
        skipped_events: 0,
        candidate_recipients: 0,
        notification_recipients: 0,
        suppressed_recipients: 0,
        inserted_notifications: 0,
        failures: []
    };

    for (
        let index = 0;
        index < normalized.limit;
        index += 1
    ) {
        const result =
            await processSingleMaintenanceEvent({
                maxAttempts:
                    normalized.maxAttempts,
                retryBaseSeconds:
                    normalized.retryBaseSeconds
            });

        if (result.queueEmpty) {
            summary.queue_empty = true;
            break;
        }

        summary.claimed_events += 1;

        if (result.skipped) {
            summary.skipped_events += 1;
            continue;
        }

        if (result.processed) {
            summary.processed_events += 1;
            summary.candidate_recipients +=
                result.candidateCount || 0;
            summary.notification_recipients +=
                result.createdCount || 0;
            summary.suppressed_recipients +=
                result.suppressedCount || 0;
            summary.inserted_notifications +=
                result.insertedNotificationCount || 0;

            if (result.recovered) {
                summary.recovered_events += 1;
            }

            continue;
        }

        if (result.retryScheduled) {
            summary.retry_scheduled_events += 1;
        }

        if (result.deadLettered) {
            summary.dead_lettered_events += 1;
        }

        summary.failures.push({
            source_event_public_id:
                result.sourceEventPublicId,
            attempt_number:
                result.attemptNumber,
            retry_scheduled:
                Boolean(
                    result.retryScheduled
                ),
            dead_lettered:
                Boolean(
                    result.deadLettered
                ),
            next_available_at:
                result.nextAvailableAt,
            error: result.error
        });
    }

    return summary;
};

module.exports = {
    normalizeProcessorOptions,
    processSingleMaintenanceEvent,
    processMaintenanceNotificationEvents
};

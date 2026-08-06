const pool = require(
    "../../config/db"
);

const normalizePagination = filters => {
    const page = Number.isInteger(filters.page)
        ? filters.page
        : 1;

    const limit = Number.isInteger(filters.limit)
        ? filters.limit
        : 20;

    return {
        page,
        limit,
        offset: (page - 1) * limit
    };
};

const buildPagination = ({
    page,
    limit,
    total
}) => ({
    page,
    limit,
    total,
    total_pages:
        total === 0
            ? 0
            : Math.ceil(total / limit),
    has_previous_page:
        page > 1,
    has_next_page:
        page * limit < total
});

const beginRepeatableRead = client =>
    client.query(
        `
        BEGIN TRANSACTION
        ISOLATION LEVEL REPEATABLE READ
        READ ONLY
        `
    );

const beginWriteTransaction = client =>
    client.query(
        `
        BEGIN TRANSACTION
        ISOLATION LEVEL READ COMMITTED
        `
    );

const shapeNotification = row => ({
    public_id: row.public_id,
    notification_type:
        row.notification_type,
    category: row.category,
    priority: row.priority,
    title: row.title,
    message: row.message,
    action_path: row.action_path,

    source: {
        module: row.source_module,
        entity_type:
            row.source_entity_type,
        entity_public_id:
            row.source_entity_public_id,
        event_public_id:
            row.source_event_public_id,
        event_type:
            row.source_event_type
    },

    payload: row.payload || {},

    is_read: Boolean(row.is_read),
    read_at: row.read_at,
    is_archived:
        Boolean(row.is_archived),
    archived_at: row.archived_at,

    available_at: row.available_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,

    actor:
        row.actor_public_id
            ? {
                public_id:
                    row.actor_public_id,
                full_name:
                    row.actor_full_name,
                profile_image_url:
                    row.actor_profile_image_url
            }
            : null
});

const notificationSelect = `
    SELECT
        n.id,
        n.public_id,
        n.notification_type,
        n.category,
        n.priority,
        n.title,
        n.message,
        n.action_path,
        n.source_module,
        n.source_entity_type,
        n.source_entity_public_id,
        n.source_event_public_id,
        n.source_event_type,
        n.payload,
        n.is_read,
        n.read_at,
        n.is_archived,
        n.archived_at,
        n.available_at,
        n.expires_at,
        n.created_at,
        n.updated_at,
        actor.public_id
            AS actor_public_id,
        actor.full_name
            AS actor_full_name,
        actor.profile_image_url
            AS actor_profile_image_url
    FROM notifications AS n
    LEFT JOIN users AS actor
        ON actor.id = n.actor_user_id
`;

const activeVisibilityCondition = `
    n.is_archived = FALSE
    AND n.available_at <= CURRENT_TIMESTAMP
    AND (
        n.expires_at IS NULL
        OR n.expires_at > CURRENT_TIMESTAMP
    )
`;

const selectNotificationByInternalId = async ({
    client,
    notificationId,
    recipientUserId
}) => {
    const result = await client.query(
        `
        ${notificationSelect}
        WHERE n.id = $1::BIGINT
          AND n.recipient_user_id = $2::BIGINT
        LIMIT 1
        `,
        [
            notificationId,
            recipientUserId
        ]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return shapeNotification(
        result.rows[0]
    );
};

const getNotifications = async ({
    filters,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginRepeatableRead(client);

        const {
            page,
            limit,
            offset
        } = normalizePagination(filters);

        const values = [
            authenticatedUser.id
        ];

        const conditions = [
            "n.recipient_user_id = $1::BIGINT",
            activeVisibilityCondition
        ];

        const addCondition = (
            sqlBuilder,
            value
        ) => {
            values.push(value);

            conditions.push(
                sqlBuilder(values.length)
            );
        };

        if (filters.search) {
            addCondition(
                parameterNumber => `
                (
                    n.title ILIKE
                        $${parameterNumber}
                    OR n.message ILIKE
                        $${parameterNumber}
                    OR COALESCE(
                        n.source_entity_public_id,
                        ''
                    ) ILIKE $${parameterNumber}
                )
                `,
                `%${filters.search}%`
            );
        }

        if (filters.category) {
            addCondition(
                parameterNumber =>
                    `n.category = $${parameterNumber}`,
                filters.category
            );
        }

        if (filters.priority) {
            addCondition(
                parameterNumber =>
                    `n.priority = $${parameterNumber}`,
                filters.priority
            );
        }

        if (filters.notification_type) {
            addCondition(
                parameterNumber =>
                    `n.notification_type = $${parameterNumber}`,
                filters.notification_type
            );
        }

        if (filters.source_module) {
            addCondition(
                parameterNumber =>
                    `n.source_module = $${parameterNumber}`,
                filters.source_module
            );
        }

        if (
            typeof filters.is_read === "boolean"
        ) {
            addCondition(
                parameterNumber =>
                    `n.is_read = $${parameterNumber}::BOOLEAN`,
                filters.is_read
            );
        }

        if (filters.created_from) {
            addCondition(
                parameterNumber =>
                    `n.created_at >= $${parameterNumber}::TIMESTAMPTZ`,
                filters.created_from
            );
        }

        if (filters.created_to) {
            addCondition(
                parameterNumber =>
                    `n.created_at <= $${parameterNumber}::TIMESTAMPTZ`,
                filters.created_to
            );
        }

        const whereClause =
            conditions.join(" AND ");

        const totalResult = await client.query(
            `
            SELECT COUNT(*)::BIGINT AS total
            FROM notifications AS n
            WHERE ${whereClause}
            `,
            values
        );

        const total = Number(
            totalResult.rows[0].total
        );

        const sortExpressions = {
            created_at:
                "n.created_at",
            available_at:
                "n.available_at",
            priority: `
                CASE n.priority
                    WHEN 'urgent' THEN 4
                    WHEN 'high' THEN 3
                    WHEN 'normal' THEN 2
                    ELSE 1
                END
            `
        };

        const sortBy =
            filters.sort_by ||
            "created_at";

        const sortOrder =
            filters.sort_order === "asc"
                ? "ASC"
                : "DESC";

        const listValues = [
            ...values,
            limit,
            offset
        ];

        const limitPosition =
            listValues.length - 1;

        const offsetPosition =
            listValues.length;

        const notificationsResult =
            await client.query(
                `
                ${notificationSelect}
                WHERE ${whereClause}
                ORDER BY
                    ${sortExpressions[sortBy]}
                        ${sortOrder},
                    n.id ${sortOrder}
                LIMIT $${limitPosition}::INTEGER
                OFFSET $${offsetPosition}::INTEGER
                `,
                listValues
            );

        await client.query("COMMIT");

        return {
            notifications:
                notificationsResult.rows.map(
                    shapeNotification
                ),
            pagination: buildPagination({
                page,
                limit,
                total
            })
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const getUnreadNotificationCount = async ({
    authenticatedUser
}) => {
    const result = await pool.query(
        `
        SELECT
            COUNT(*)::BIGINT
                AS unread_count,
            COUNT(*) FILTER (
                WHERE priority = 'urgent'
            )::BIGINT
                AS urgent_count,
            COUNT(*) FILTER (
                WHERE priority = 'high'
            )::BIGINT
                AS high_count
        FROM notifications AS n
        WHERE n.recipient_user_id = $1::BIGINT
          AND ${activeVisibilityCondition}
          AND n.is_read = FALSE
        `,
        [authenticatedUser.id]
    );

    return {
        unread_count: Number(
            result.rows[0].unread_count
        ),
        urgent_count: Number(
            result.rows[0].urgent_count
        ),
        high_count: Number(
            result.rows[0].high_count
        )
    };
};

const getSingleNotification = async ({
    notificationPublicId,
    authenticatedUser
}) => {
    const result = await pool.query(
        `
        ${notificationSelect}
        WHERE n.public_id = $1
          AND n.recipient_user_id = $2::BIGINT
          AND ${activeVisibilityCondition}
        LIMIT 1
        `,
        [
            notificationPublicId,
            authenticatedUser.id
        ]
    );

    if (result.rows.length === 0) {
        return {
            notificationNotFound: true
        };
    }

    return {
        notification: shapeNotification(
            result.rows[0]
        )
    };
};

const markNotificationAsRead = async ({
    notificationPublicId,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginWriteTransaction(client);

        const notificationResult =
            await client.query(
                `
                SELECT
                    id,
                    is_read
                FROM notifications AS n
                WHERE n.public_id = $1
                  AND n.recipient_user_id =
                        $2::BIGINT
                  AND ${activeVisibilityCondition}
                LIMIT 1
                FOR UPDATE
                `,
                [
                    notificationPublicId,
                    authenticatedUser.id
                ]
            );

        if (
            notificationResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                notificationNotFound: true
            };
        }

        const notification =
            notificationResult.rows[0];

        let noChanges = true;

        if (notification.is_read !== true) {
            await client.query(
                `
                UPDATE notifications
                SET
                    is_read = TRUE,
                    read_at = CURRENT_TIMESTAMP
                WHERE id = $1::BIGINT
                  AND is_read = FALSE
                `,
                [notification.id]
            );

            noChanges = false;
        }

        const updatedNotification =
            await selectNotificationByInternalId({
                client,
                notificationId:
                    notification.id,
                recipientUserId:
                    authenticatedUser.id
            });

        await client.query("COMMIT");

        return {
            noChanges,
            notification:
                updatedNotification
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const markAllNotificationsAsRead = async ({
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginWriteTransaction(client);

        const timestampResult =
            await client.query(
                `
                SELECT CURRENT_TIMESTAMP
                    AS read_at
                `
            );

        const readAt =
            timestampResult.rows[0].read_at;

        const updateResult =
            await client.query(
                `
                UPDATE notifications AS n
                SET
                    is_read = TRUE,
                    read_at = $2::TIMESTAMPTZ
                WHERE n.recipient_user_id =
                        $1::BIGINT
                  AND ${activeVisibilityCondition}
                  AND n.is_read = FALSE
                RETURNING n.id
                `,
                [
                    authenticatedUser.id,
                    readAt
                ]
            );

        await client.query("COMMIT");

        return {
            marked_count:
                updateResult.rowCount,
            read_at: readAt
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    getNotifications,
    getUnreadNotificationCount,
    getSingleNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead
};

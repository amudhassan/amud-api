const pool = require(
    "../../config/db"
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

const selectOwnedNotificationForUpdate = async ({
    client,
    notificationPublicId,
    recipientUserId
}) => {
    const result = await client.query(
        `
        SELECT
            n.id,
            n.public_id,
            n.is_read,
            n.read_at,
            n.is_archived,
            n.archived_at,
            n.available_at,
            n.expires_at,
            (
                n.available_at <= CURRENT_TIMESTAMP
                AND (
                    n.expires_at IS NULL
                    OR n.expires_at > CURRENT_TIMESTAMP
                )
            ) AS is_currently_available
        FROM notifications AS n
        WHERE n.public_id = $1
          AND n.recipient_user_id = $2::BIGINT
        LIMIT 1
        FOR UPDATE
        `,
        [
            notificationPublicId,
            recipientUserId
        ]
    );

    return result.rows[0] || null;
};

const getDatabaseTimestamp = async ({
    client,
    alias
}) => {
    const result = await client.query(
        `
        SELECT CURRENT_TIMESTAMP AS ${alias}
        `
    );

    return result.rows[0][alias];
};

const archiveSingleNotification = async ({
    notificationPublicId,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginWriteTransaction(client);

        const notification =
            await selectOwnedNotificationForUpdate({
                client,
                notificationPublicId,
                recipientUserId:
                    authenticatedUser.id
            });

        if (!notification) {
            await client.query("ROLLBACK");

            return {
                notificationNotFound: true
            };
        }

        if (notification.is_archived === true) {
            const currentNotification =
                await selectNotificationByInternalId({
                    client,
                    notificationId:
                        notification.id,
                    recipientUserId:
                        authenticatedUser.id
                });

            await client.query("COMMIT");

            return {
                noChanges: true,
                newlyRead: false,
                notification:
                    currentNotification
            };
        }

        if (
            notification.is_currently_available !==
                true
        ) {
            await client.query("ROLLBACK");

            return {
                notificationNotAvailable: true
            };
        }

        const archivedAt =
            await getDatabaseTimestamp({
                client,
                alias: "archived_at"
            });

        const newlyRead =
            notification.is_read !== true;

        await client.query(
            `
            UPDATE notifications
            SET
                is_read = TRUE,
                read_at = CASE
                    WHEN is_read = TRUE
                        THEN read_at
                    ELSE $2::TIMESTAMPTZ
                END,
                is_archived = TRUE,
                archived_at = $2::TIMESTAMPTZ
            WHERE id = $1::BIGINT
            `,
            [
                notification.id,
                archivedAt
            ]
        );

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
            noChanges: false,
            newlyRead,
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

const archiveAllNotifications = async ({
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginWriteTransaction(client);

        const archivedAt =
            await getDatabaseTimestamp({
                client,
                alias: "archived_at"
            });

        const updateResult = await client.query(
            `
            UPDATE notifications AS n
            SET
                is_read = TRUE,
                read_at = CASE
                    WHEN n.is_read = TRUE
                        THEN n.read_at
                    ELSE $2::TIMESTAMPTZ
                END,
                is_archived = TRUE,
                archived_at = $2::TIMESTAMPTZ
            WHERE n.recipient_user_id = $1::BIGINT
              AND ${activeVisibilityCondition}
            RETURNING n.id
            `,
            [
                authenticatedUser.id,
                archivedAt
            ]
        );

        await client.query("COMMIT");

        return {
            archived_count:
                updateResult.rowCount,
            archived_at: archivedAt
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const restoreSingleNotification = async ({
    notificationPublicId,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginWriteTransaction(client);

        const notification =
            await selectOwnedNotificationForUpdate({
                client,
                notificationPublicId,
                recipientUserId:
                    authenticatedUser.id
            });

        if (!notification) {
            await client.query("ROLLBACK");

            return {
                notificationNotFound: true
            };
        }

        if (notification.is_archived !== true) {
            const currentNotification =
                await selectNotificationByInternalId({
                    client,
                    notificationId:
                        notification.id,
                    recipientUserId:
                        authenticatedUser.id
                });

            await client.query("COMMIT");

            return {
                noChanges: true,
                notification:
                    currentNotification
            };
        }

        await client.query(
            `
            UPDATE notifications
            SET
                is_archived = FALSE,
                archived_at = NULL
            WHERE id = $1::BIGINT
            `,
            [notification.id]
        );

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
            noChanges: false,
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

const bulkReadNotifications = async ({
    notificationPublicIds,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginWriteTransaction(client);

        const notificationsResult =
            await client.query(
                `
                SELECT
                    n.id,
                    n.public_id,
                    n.is_read
                FROM notifications AS n
                WHERE n.recipient_user_id =
                        $1::BIGINT
                  AND n.public_id = ANY(
                        $2::VARCHAR[]
                  )
                  AND ${activeVisibilityCondition}
                ORDER BY n.id
                FOR UPDATE
                `,
                [
                    authenticatedUser.id,
                    notificationPublicIds
                ]
            );

        if (
            notificationsResult.rows.length !==
                notificationPublicIds.length
        ) {
            await client.query("ROLLBACK");

            return {
                notificationsNotFound: true
            };
        }

        const readAt =
            await getDatabaseTimestamp({
                client,
                alias: "read_at"
            });

        const notificationIds =
            notificationsResult.rows.map(
                notification =>
                    notification.id
            );

        const updateResult = await client.query(
            `
            UPDATE notifications
            SET
                is_read = TRUE,
                read_at = $2::TIMESTAMPTZ
            WHERE id = ANY($1::BIGINT[])
              AND is_read = FALSE
            RETURNING id
            `,
            [
                notificationIds,
                readAt
            ]
        );

        await client.query("COMMIT");

        return {
            requested_count:
                notificationPublicIds.length,
            marked_count:
                updateResult.rowCount,
            read_at: readAt,
            processed_public_ids:
                notificationPublicIds
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const bulkArchiveNotifications = async ({
    notificationPublicIds,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginWriteTransaction(client);

        const notificationsResult =
            await client.query(
                `
                SELECT
                    n.id,
                    n.public_id,
                    n.is_read
                FROM notifications AS n
                WHERE n.recipient_user_id =
                        $1::BIGINT
                  AND n.public_id = ANY(
                        $2::VARCHAR[]
                  )
                  AND ${activeVisibilityCondition}
                ORDER BY n.id
                FOR UPDATE
                `,
                [
                    authenticatedUser.id,
                    notificationPublicIds
                ]
            );

        if (
            notificationsResult.rows.length !==
                notificationPublicIds.length
        ) {
            await client.query("ROLLBACK");

            return {
                notificationsNotFound: true
            };
        }

        const archivedAt =
            await getDatabaseTimestamp({
                client,
                alias: "archived_at"
            });

        const notificationIds =
            notificationsResult.rows.map(
                notification =>
                    notification.id
            );

        const newlyReadCount =
            notificationsResult.rows.filter(
                notification =>
                    notification.is_read !== true
            ).length;

        const updateResult = await client.query(
            `
            UPDATE notifications
            SET
                is_read = TRUE,
                read_at = CASE
                    WHEN is_read = TRUE
                        THEN read_at
                    ELSE $2::TIMESTAMPTZ
                END,
                is_archived = TRUE,
                archived_at = $2::TIMESTAMPTZ
            WHERE id = ANY($1::BIGINT[])
            RETURNING id
            `,
            [
                notificationIds,
                archivedAt
            ]
        );

        await client.query("COMMIT");

        return {
            requested_count:
                notificationPublicIds.length,
            archived_count:
                updateResult.rowCount,
            newly_read_count:
                newlyReadCount,
            archived_at: archivedAt,
            processed_public_ids:
                notificationPublicIds
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    archiveSingleNotification,
    archiveAllNotifications,
    restoreSingleNotification,
    bulkReadNotifications,
    bulkArchiveNotifications
};

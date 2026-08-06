const pool = require(
    "../../config/db"
);

const defaultCategories = {
    access: true,
    lease: true,
    billing: true,
    payment: true,
    maintenance: true,
    preventive_maintenance: true,
    system: true
};

const beginWriteTransaction = client =>
    client.query(
        `
        BEGIN TRANSACTION
        ISOLATION LEVEL READ COMMITTED
        `
    );

const normalizeTime = value => {
    if (value === null || value === undefined) {
        return null;
    }

    if (/^\d{2}:\d{2}$/.test(value)) {
        return `${value}:00`;
    }

    return value;
};

const shapeNotificationPreferences = row => ({
    public_id: row.public_id,
    notifications_enabled:
        Boolean(row.notifications_enabled),

    channels: {
        in_app:
            Boolean(row.in_app_enabled),
        email:
            Boolean(row.email_enabled),
        sms:
            Boolean(row.sms_enabled),
        whatsapp:
            Boolean(row.whatsapp_enabled),
        push:
            Boolean(row.push_enabled)
    },

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

    categories:
        row.category_preferences || {},

    mandatory_categories: [
        "access",
        "system"
    ],

    created_at: row.created_at,
    updated_at: row.updated_at
});

const preferenceSelect = `
    SELECT
        np.id,
        np.public_id,
        np.user_id,
        np.notifications_enabled,
        np.in_app_enabled,
        np.email_enabled,
        np.sms_enabled,
        np.whatsapp_enabled,
        np.push_enabled,
        np.minimum_priority,
        np.digest_frequency,
        np.quiet_hours_enabled,
        np.quiet_hours_start,
        np.quiet_hours_end,
        np.timezone,
        np.category_preferences,
        np.updated_by,
        np.created_at,
        np.updated_at
    FROM notification_preferences AS np
`;

const getOrCreatePreference = async ({
    client,
    userId,
    forUpdate = false
}) => {
    let result = await client.query(
        `
        ${preferenceSelect}
        WHERE np.user_id = $1::BIGINT
        LIMIT 1
        ${forUpdate ? "FOR UPDATE" : ""}
        `,
        [userId]
    );

    if (result.rows.length > 0) {
        return result.rows[0];
    }

    await client.query(
        `
        INSERT INTO notification_preferences (
            public_id,
            user_id,
            created_at,
            updated_at
        )
        VALUES (
            notification_make_public_id(
                'notification_preference_'
            ),
            $1::BIGINT,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (user_id) DO NOTHING
        `,
        [userId]
    );

    result = await client.query(
        `
        ${preferenceSelect}
        WHERE np.user_id = $1::BIGINT
        LIMIT 1
        ${forUpdate ? "FOR UPDATE" : ""}
        `,
        [userId]
    );

    return result.rows[0] || null;
};

const setChangeSource = ({
    client,
    source
}) =>
    client.query(
        `
        SELECT set_config(
            'app.notification_preference_change_source',
            $1,
            TRUE
        )
        `,
        [source]
    );

const getNotificationPreferences = async ({
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginWriteTransaction(client);

        const preference =
            await getOrCreatePreference({
                client,
                userId:
                    authenticatedUser.id,
                forUpdate: false
            });

        await client.query("COMMIT");

        return {
            preferences:
                shapeNotificationPreferences(
                    preference
                )
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const updateNotificationPreferences = async ({
    preferenceData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginWriteTransaction(client);

        const current =
            await getOrCreatePreference({
                client,
                userId:
                    authenticatedUser.id,
                forUpdate: true
            });

        const channels =
            preferenceData.channels || {};

        const quietHours =
            preferenceData.quiet_hours || {};

        const notificationsEnabled =
            preferenceData.notifications_enabled !==
                undefined
                ? preferenceData
                    .notifications_enabled
                : current
                    .notifications_enabled;

        const inAppEnabled =
            channels.in_app !== undefined
                ? channels.in_app
                : current.in_app_enabled;

        const emailEnabled =
            channels.email !== undefined
                ? channels.email
                : current.email_enabled;

        const smsEnabled =
            channels.sms !== undefined
                ? channels.sms
                : current.sms_enabled;

        const whatsappEnabled =
            channels.whatsapp !== undefined
                ? channels.whatsapp
                : current.whatsapp_enabled;

        const pushEnabled =
            channels.push !== undefined
                ? channels.push
                : current.push_enabled;

        const minimumPriority =
            preferenceData.minimum_priority ||
            current.minimum_priority;

        const digestFrequency =
            preferenceData.digest_frequency ||
            current.digest_frequency;

        let quietHoursEnabled =
            quietHours.enabled !== undefined
                ? quietHours.enabled
                : current
                    .quiet_hours_enabled;

        let quietHoursStart =
            quietHours.start !== undefined
                ? normalizeTime(
                    quietHours.start
                )
                : current.quiet_hours_start;

        let quietHoursEnd =
            quietHours.end !== undefined
                ? normalizeTime(
                    quietHours.end
                )
                : current.quiet_hours_end;

        const timezone =
            quietHours.timezone !== undefined
                ? quietHours.timezone
                : current.timezone;

        if (quietHoursEnabled !== true) {
            quietHoursEnabled = false;
            quietHoursStart = null;
            quietHoursEnd = null;
        }

        if (
            quietHoursEnabled === true &&
            (
                !quietHoursStart ||
                !quietHoursEnd ||
                quietHoursStart === quietHoursEnd
            )
        ) {
            await client.query("ROLLBACK");

            return {
                invalidQuietHours: true
            };
        }

        const categoryPreferences = {
            ...current.category_preferences,
            ...(preferenceData.categories || {})
        };

        categoryPreferences.access = true;
        categoryPreferences.system = true;

        await setChangeSource({
            client,
            source: "api_update"
        });

        const updateResult =
            await client.query(
                `
                UPDATE notification_preferences
                SET
                    notifications_enabled =
                        $2::BOOLEAN,
                    in_app_enabled =
                        $3::BOOLEAN,
                    email_enabled =
                        $4::BOOLEAN,
                    sms_enabled =
                        $5::BOOLEAN,
                    whatsapp_enabled =
                        $6::BOOLEAN,
                    push_enabled =
                        $7::BOOLEAN,
                    minimum_priority = $8,
                    digest_frequency = $9,
                    quiet_hours_enabled =
                        $10::BOOLEAN,
                    quiet_hours_start =
                        $11::TIME,
                    quiet_hours_end =
                        $12::TIME,
                    timezone = $13,
                    category_preferences =
                        $14::JSONB,
                    updated_by = $15::BIGINT
                WHERE id = $1::BIGINT
                  AND (
                    notifications_enabled
                        IS DISTINCT FROM
                        $2::BOOLEAN
                    OR in_app_enabled
                        IS DISTINCT FROM
                        $3::BOOLEAN
                    OR email_enabled
                        IS DISTINCT FROM
                        $4::BOOLEAN
                    OR sms_enabled
                        IS DISTINCT FROM
                        $5::BOOLEAN
                    OR whatsapp_enabled
                        IS DISTINCT FROM
                        $6::BOOLEAN
                    OR push_enabled
                        IS DISTINCT FROM
                        $7::BOOLEAN
                    OR minimum_priority
                        IS DISTINCT FROM $8
                    OR digest_frequency
                        IS DISTINCT FROM $9
                    OR quiet_hours_enabled
                        IS DISTINCT FROM
                        $10::BOOLEAN
                    OR quiet_hours_start
                        IS DISTINCT FROM
                        $11::TIME
                    OR quiet_hours_end
                        IS DISTINCT FROM
                        $12::TIME
                    OR timezone
                        IS DISTINCT FROM $13
                    OR category_preferences
                        IS DISTINCT FROM
                        $14::JSONB
                  )
                RETURNING id
                `,
                [
                    current.id,
                    notificationsEnabled,
                    inAppEnabled,
                    emailEnabled,
                    smsEnabled,
                    whatsappEnabled,
                    pushEnabled,
                    minimumPriority,
                    digestFrequency,
                    quietHoursEnabled,
                    quietHoursStart,
                    quietHoursEnd,
                    timezone,
                    JSON.stringify(
                        categoryPreferences
                    ),
                    authenticatedUser.id
                ]
            );

        const updatedPreference =
            await getOrCreatePreference({
                client,
                userId:
                    authenticatedUser.id,
                forUpdate: false
            });

        await client.query("COMMIT");

        return {
            noChanges:
                updateResult.rowCount === 0,
            preferences:
                shapeNotificationPreferences(
                    updatedPreference
                )
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const resetNotificationPreferences = async ({
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginWriteTransaction(client);

        const current =
            await getOrCreatePreference({
                client,
                userId:
                    authenticatedUser.id,
                forUpdate: true
            });

        await setChangeSource({
            client,
            source: "api_reset"
        });

        const updateResult =
            await client.query(
                `
                UPDATE notification_preferences
                SET
                    notifications_enabled = TRUE,
                    in_app_enabled = TRUE,
                    email_enabled = FALSE,
                    sms_enabled = FALSE,
                    whatsapp_enabled = FALSE,
                    push_enabled = FALSE,
                    minimum_priority = 'low',
                    digest_frequency =
                        'immediate',
                    quiet_hours_enabled = FALSE,
                    quiet_hours_start = NULL,
                    quiet_hours_end = NULL,
                    timezone = 'UTC',
                    category_preferences =
                        $2::JSONB,
                    updated_by = $3::BIGINT
                WHERE id = $1::BIGINT
                  AND (
                    notifications_enabled
                        IS DISTINCT FROM TRUE
                    OR in_app_enabled
                        IS DISTINCT FROM TRUE
                    OR email_enabled
                        IS DISTINCT FROM FALSE
                    OR sms_enabled
                        IS DISTINCT FROM FALSE
                    OR whatsapp_enabled
                        IS DISTINCT FROM FALSE
                    OR push_enabled
                        IS DISTINCT FROM FALSE
                    OR minimum_priority
                        IS DISTINCT FROM 'low'
                    OR digest_frequency
                        IS DISTINCT FROM
                        'immediate'
                    OR quiet_hours_enabled
                        IS DISTINCT FROM FALSE
                    OR quiet_hours_start
                        IS NOT NULL
                    OR quiet_hours_end
                        IS NOT NULL
                    OR timezone
                        IS DISTINCT FROM 'UTC'
                    OR category_preferences
                        IS DISTINCT FROM
                        $2::JSONB
                  )
                RETURNING id
                `,
                [
                    current.id,
                    JSON.stringify(
                        defaultCategories
                    ),
                    authenticatedUser.id
                ]
            );

        const updatedPreference =
            await getOrCreatePreference({
                client,
                userId:
                    authenticatedUser.id,
                forUpdate: false
            });

        await client.query("COMMIT");

        return {
            noChanges:
                updateResult.rowCount === 0,
            preferences:
                shapeNotificationPreferences(
                    updatedPreference
                )
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    getNotificationPreferences,
    updateNotificationPreferences,
    resetNotificationPreferences
};

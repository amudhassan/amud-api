const {
    body,
    query
} = require("express-validator");

const allowedTopLevelFields = [
    "notifications_enabled",
    "channels",
    "minimum_priority",
    "digest_frequency",
    "quiet_hours",
    "categories"
];

const allowedChannelFields = [
    "in_app",
    "email",
    "sms",
    "whatsapp",
    "push"
];

const allowedQuietHourFields = [
    "enabled",
    "start",
    "end",
    "timezone"
];

const allowedCategoryFields = [
    "access",
    "lease",
    "billing",
    "payment",
    "maintenance",
    "preventive_maintenance",
    "system"
];

const notificationPriorities = [
    "low",
    "normal",
    "high",
    "urgent"
];

const digestFrequencies = [
    "immediate",
    "daily",
    "weekly",
    "disabled"
];

const timePattern =
    /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const strictQueryValidator = allowedFields =>
    query().custom(value => {
        const suppliedFields =
            Object.keys(value || {});

        const unsupportedFields =
            suppliedFields.filter(
                field =>
                    !allowedFields.includes(field)
            );

        if (unsupportedFields.length > 0) {
            throw new Error(
                `Unsupported query parameters: ${unsupportedFields.join(", ")}.`
            );
        }

        return true;
    });

const noRequestBodyValidator = () =>
    body().custom(value => {
        const suppliedFields =
            Object.keys(value || {});

        if (suppliedFields.length > 0) {
            throw new Error(
                `Request body is not allowed for this operation. Unsupported fields: ${suppliedFields.join(", ")}.`
            );
        }

        return true;
    });

const strictObjectValidator = ({
    field,
    allowedFields,
    requiredAtLeastOne = true
}) =>
    body(field)
        .optional()
        .custom(value => {
            if (
                value === null ||
                typeof value !== "object" ||
                Array.isArray(value)
            ) {
                throw new Error(
                    `${field} must be a JSON object.`
                );
            }

            const suppliedFields =
                Object.keys(value);

            if (
                requiredAtLeastOne &&
                suppliedFields.length === 0
            ) {
                throw new Error(
                    `${field} must contain at least one field.`
                );
            }

            const unsupportedFields =
                suppliedFields.filter(
                    suppliedField =>
                        !allowedFields.includes(
                            suppliedField
                        )
                );

            if (unsupportedFields.length > 0) {
                throw new Error(
                    `Unsupported ${field} fields: ${unsupportedFields.join(", ")}.`
                );
            }

            return true;
        });

const strictUpdateBodyValidator = () =>
    body().custom(value => {
        if (
            value === null ||
            typeof value !== "object" ||
            Array.isArray(value)
        ) {
            throw new Error(
                "Request body must be a JSON object."
            );
        }

        const suppliedFields =
            Object.keys(value);

        if (suppliedFields.length === 0) {
            throw new Error(
                "At least one notification preference field is required."
            );
        }

        const unsupportedFields =
            suppliedFields.filter(
                field =>
                    !allowedTopLevelFields.includes(
                        field
                    )
            );

        if (unsupportedFields.length > 0) {
            throw new Error(
                `Unsupported request body fields: ${unsupportedFields.join(", ")}.`
            );
        }

        return true;
    });

const booleanFieldValidator = field =>
    body(field)
        .optional()
        .isBoolean({
            strict: true
        })
        .withMessage(
            `${field} must be a boolean.`
        )
        .toBoolean();

const getNotificationPreferencesValidator = [
    strictQueryValidator([]),
    noRequestBodyValidator()
];

const updateNotificationPreferencesValidator = [
    strictQueryValidator([]),
    strictUpdateBodyValidator(),

    booleanFieldValidator(
        "notifications_enabled"
    ),

    strictObjectValidator({
        field: "channels",
        allowedFields:
            allowedChannelFields
    }),

    ...allowedChannelFields.map(
        channel =>
            booleanFieldValidator(
                `channels.${channel}`
            )
    ),

    body("minimum_priority")
        .optional()
        .isString()
        .withMessage(
            "minimum_priority must be a string."
        )
        .trim()
        .isIn(notificationPriorities)
        .withMessage(
            "Invalid minimum notification priority."
        ),

    body("digest_frequency")
        .optional()
        .isString()
        .withMessage(
            "digest_frequency must be a string."
        )
        .trim()
        .isIn(digestFrequencies)
        .withMessage(
            "Invalid notification digest frequency."
        ),

    strictObjectValidator({
        field: "quiet_hours",
        allowedFields:
            allowedQuietHourFields
    }),

    booleanFieldValidator(
        "quiet_hours.enabled"
    ),

    body("quiet_hours.start")
        .optional()
        .isString()
        .withMessage(
            "quiet_hours.start must be a string."
        )
        .trim()
        .matches(timePattern)
        .withMessage(
            "quiet_hours.start must use HH:MM or HH:MM:SS in 24-hour format."
        ),

    body("quiet_hours.end")
        .optional()
        .isString()
        .withMessage(
            "quiet_hours.end must be a string."
        )
        .trim()
        .matches(timePattern)
        .withMessage(
            "quiet_hours.end must use HH:MM or HH:MM:SS in 24-hour format."
        ),

    body("quiet_hours.timezone")
        .optional()
        .isString()
        .withMessage(
            "quiet_hours.timezone must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 64
        })
        .withMessage(
            "quiet_hours.timezone must contain between 1 and 64 characters."
        ),

    body("quiet_hours")
        .optional()
        .custom(value => {
            if (
                value.enabled === true &&
                (
                    value.start === undefined ||
                    value.end === undefined
                )
            ) {
                throw new Error(
                    "quiet_hours.start and quiet_hours.end are required when quiet hours are enabled."
                );
            }

            if (
                value.enabled === false &&
                (
                    value.start !== undefined ||
                    value.end !== undefined
                )
            ) {
                throw new Error(
                    "quiet-hours start and end must be omitted when quiet hours are disabled."
                );
            }

            if (
                value.start !== undefined &&
                value.end !== undefined &&
                value.start === value.end
            ) {
                throw new Error(
                    "quiet_hours.start and quiet_hours.end must be different."
                );
            }

            return true;
        }),

    strictObjectValidator({
        field: "categories",
        allowedFields:
            allowedCategoryFields
    }),

    ...allowedCategoryFields.map(
        category =>
            booleanFieldValidator(
                `categories.${category}`
            )
    ),

    body("categories")
        .optional()
        .custom(value => {
            if (value.access === false) {
                throw new Error(
                    "Access and security notifications cannot be disabled."
                );
            }

            if (value.system === false) {
                throw new Error(
                    "Critical system notifications cannot be disabled."
                );
            }

            return true;
        })
];

const resetNotificationPreferencesValidator = [
    strictQueryValidator([]),
    noRequestBodyValidator()
];

module.exports = {
    getNotificationPreferencesValidator,
    updateNotificationPreferencesValidator,
    resetNotificationPreferencesValidator
};

const {
    body,
    param,
    query
} = require("express-validator");

const notificationCategories = [
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

const notificationSourceModules = [
    "authentication",
    "users",
    "owners",
    "properties",
    "units",
    "tenants",
    "leases",
    "invoices",
    "payments",
    "receipts",
    "maintenance",
    "preventive_maintenance",
    "system"
];

const notificationSortFields = [
    "created_at",
    "available_at",
    "priority"
];

const isFullIsoTimestamp = value => {
    if (typeof value !== "string") {
        return false;
    }

    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value
    );
};

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

const notificationPublicIdValidator = () =>
    param("notification_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Notification public ID is required."
        )
        .isString()
        .withMessage(
            "Notification public ID must be a string."
        )
        .trim()
        .isLength({
            min: 21,
            max: 80
        })
        .withMessage(
            "Notification public ID must contain between 21 and 80 characters."
        )
        .matches(
            /^notification_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid notification public ID format."
        );

const getNotificationsValidator = [
    strictQueryValidator([
        "search",
        "category",
        "priority",
        "notification_type",
        "source_module",
        "is_read",
        "created_from",
        "created_to",
        "sort_by",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),

    query("search")
        .optional()
        .isString()
        .withMessage(
            "Search value must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 100
        })
        .withMessage(
            "Search value must contain between 1 and 100 characters."
        ),

    query("category")
        .optional()
        .isString()
        .withMessage(
            "Notification category must be a string."
        )
        .trim()
        .isIn(notificationCategories)
        .withMessage(
            "Invalid notification category."
        ),

    query("priority")
        .optional()
        .isString()
        .withMessage(
            "Notification priority must be a string."
        )
        .trim()
        .isIn(notificationPriorities)
        .withMessage(
            "Invalid notification priority."
        ),

    query("notification_type")
        .optional()
        .isString()
        .withMessage(
            "Notification type must be a string."
        )
        .trim()
        .isLength({
            min: 3,
            max: 80
        })
        .withMessage(
            "Notification type must contain between 3 and 80 characters."
        )
        .matches(
            /^[a-z][a-z0-9_]{2,79}$/
        )
        .withMessage(
            "Invalid notification type format."
        ),

    query("source_module")
        .optional()
        .isString()
        .withMessage(
            "Source module must be a string."
        )
        .trim()
        .isIn(notificationSourceModules)
        .withMessage(
            "Invalid notification source module."
        ),

    query("is_read")
        .optional()
        .isString()
        .withMessage(
            "is_read must be true or false."
        )
        .trim()
        .isIn([
            "true",
            "false"
        ])
        .withMessage(
            "is_read must be true or false."
        )
        .customSanitizer(
            value => value === "true"
        ),

    query("created_from")
        .optional()
        .custom(value => {
            if (!isFullIsoTimestamp(value)) {
                throw new Error(
                    "created_from must be a complete ISO 8601 timestamp with timezone."
                );
            }

            return true;
        }),

    query("created_to")
        .optional()
        .custom(value => {
            if (!isFullIsoTimestamp(value)) {
                throw new Error(
                    "created_to must be a complete ISO 8601 timestamp with timezone."
                );
            }

            return true;
        }),

    query()
        .custom((value, { req }) => {
            const {
                created_from,
                created_to
            } = req.query || {};

            if (
                created_from &&
                created_to &&
                new Date(created_from).getTime() >
                    new Date(created_to).getTime()
            ) {
                throw new Error(
                    "created_from cannot be after created_to."
                );
            }

            return true;
        }),

    query("sort_by")
        .optional()
        .isString()
        .withMessage(
            "Sort field must be a string."
        )
        .trim()
        .isIn(notificationSortFields)
        .withMessage(
            "Invalid notification sort field."
        ),

    query("sort_order")
        .optional()
        .isString()
        .withMessage(
            "Sort order must be a string."
        )
        .trim()
        .isIn([
            "asc",
            "desc"
        ])
        .withMessage(
            "Sort order must be asc or desc."
        ),

    query("page")
        .optional()
        .isInt({
            min: 1,
            max: 1000000
        })
        .withMessage(
            "Page must be an integer between 1 and 1000000."
        )
        .toInt(),

    query("limit")
        .optional()
        .isInt({
            min: 1,
            max: 100
        })
        .withMessage(
            "Limit must be an integer between 1 and 100."
        )
        .toInt()
];

const getUnreadNotificationCountValidator = [
    strictQueryValidator([]),
    noRequestBodyValidator()
];

const getSingleNotificationValidator = [
    strictQueryValidator([]),
    noRequestBodyValidator(),
    notificationPublicIdValidator()
];

const markNotificationAsReadValidator = [
    strictQueryValidator([]),
    noRequestBodyValidator(),
    notificationPublicIdValidator()
];

const markAllNotificationsAsReadValidator = [
    strictQueryValidator([]),
    noRequestBodyValidator()
];

module.exports = {
    getNotificationsValidator,
    getUnreadNotificationCountValidator,
    getSingleNotificationValidator,
    markNotificationAsReadValidator,
    markAllNotificationsAsReadValidator
};

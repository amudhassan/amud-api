const {
    body,
    param,
    query
} = require("express-validator");

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

const strictBodyValidator = allowedFields =>
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

        const unsupportedFields =
            suppliedFields.filter(
                field =>
                    !allowedFields.includes(field)
            );

        if (unsupportedFields.length > 0) {
            throw new Error(
                `Unsupported request body fields: ${unsupportedFields.join(", ")}.`
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

const notificationPublicIdsValidator = () =>
    body("notification_public_ids")
        .exists({
            checkNull: true
        })
        .withMessage(
            "notification_public_ids is required."
        )
        .isArray({
            min: 1,
            max: 100
        })
        .withMessage(
            "notification_public_ids must be an array containing between 1 and 100 values."
        )
        .custom(values => {
            const normalizedValues =
                values.map(value => {
                    if (typeof value !== "string") {
                        throw new Error(
                            "Every notification public ID must be a string."
                        );
                    }

                    const normalizedValue =
                        value.trim();

                    if (
                        normalizedValue.length < 21 ||
                        normalizedValue.length > 80 ||
                        !/^notification_[A-Za-z0-9_-]+$/.test(
                            normalizedValue
                        )
                    ) {
                        throw new Error(
                            `Invalid notification public ID: ${value}.`
                        );
                    }

                    return normalizedValue;
                });

            if (
                new Set(normalizedValues).size !==
                    normalizedValues.length
            ) {
                throw new Error(
                    "notification_public_ids must not contain duplicate values."
                );
            }

            return true;
        })
        .customSanitizer(values =>
            values.map(value => value.trim())
        );

const archiveSingleNotificationValidator = [
    strictQueryValidator([]),
    noRequestBodyValidator(),
    notificationPublicIdValidator()
];

const archiveAllNotificationsValidator = [
    strictQueryValidator([]),
    noRequestBodyValidator()
];

const restoreSingleNotificationValidator = [
    strictQueryValidator([]),
    noRequestBodyValidator(),
    notificationPublicIdValidator()
];

const bulkReadNotificationsValidator = [
    strictQueryValidator([]),
    strictBodyValidator([
        "notification_public_ids"
    ]),
    notificationPublicIdsValidator()
];

const bulkArchiveNotificationsValidator = [
    strictQueryValidator([]),
    strictBodyValidator([
        "notification_public_ids"
    ]),
    notificationPublicIdsValidator()
];

module.exports = {
    archiveSingleNotificationValidator,
    archiveAllNotificationsValidator,
    restoreSingleNotificationValidator,
    bulkReadNotificationsValidator,
    bulkArchiveNotificationsValidator
};

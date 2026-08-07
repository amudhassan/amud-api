const {
    body,
    query
} = require("express-validator");

const {
    isValidDateOnly
} = require(
    "./reportContextValidator"
);

const {
    PERIODS
} = require(
    "./financialReportValidator"
);

const {
    LEASE_STATUSES
} = require(
    "./occupancyLeaseReportValidator"
);

const {
    MAINTENANCE_STATUSES,
    MAINTENANCE_PRIORITIES,
    MAINTENANCE_CATEGORIES
} = require(
    "./maintenanceReportValidator"
);

const buildReportExportValidator = ({
    allowedExtraFields = []
} = {}) => {
    const allowedFields = [
        "owner_public_id",
        "property_public_id",
        "date_from",
        "date_to",
        "currency_code",
        "format"
    ];

    if (
        allowedExtraFields.includes("period")
    ) {
        allowedFields.push("period");
    }

    if (
        allowedExtraFields.includes("limit")
    ) {
        allowedFields.push("limit");
    }

    if (
        allowedExtraFields.includes("days")
    ) {
        allowedFields.push("days");
    }

    if (
        allowedExtraFields.includes(
            "lease_status"
        ) ||
        allowedExtraFields.includes(
            "maintenance_status"
        )
    ) {
        allowedFields.push("status");
    }

    if (
        allowedExtraFields.includes(
            "priority"
        )
    ) {
        allowedFields.push("priority");
    }

    if (
        allowedExtraFields.includes(
            "category"
        )
    ) {
        allowedFields.push("category");
    }

    const validators = [
        query()
            .custom(value => {
                const suppliedFields =
                    Object.keys(value || {});

                const unsupportedFields =
                    suppliedFields.filter(
                        field =>
                            !allowedFields.includes(field)
                    );

                if (
                    unsupportedFields.length > 0
                ) {
                    throw new Error(
                        `Unsupported query parameters: ${unsupportedFields.join(", ")}.`
                    );
                }

                return true;
            }),

        body()
            .custom(value => {
                const suppliedFields =
                    Object.keys(value || {});

                if (suppliedFields.length > 0) {
                    throw new Error(
                        `Request body is not allowed for this operation. Unsupported fields: ${suppliedFields.join(", ")}.`
                    );
                }

                return true;
            }),

        query("format")
            .exists({
                checkFalsy: true
            })
            .withMessage(
                "Export format is required."
            )
            .isIn([
                "csv",
                "pdf"
            ])
            .withMessage(
                "Export format must be csv or pdf."
            ),

        query("owner_public_id")
            .optional()
            .isString()
            .withMessage(
                "Owner public ID must be a string."
            )
            .trim()
            .isLength({
                min: 7,
                max: 50
            })
            .withMessage(
                "Owner public ID must contain between 7 and 50 characters."
            )
            .matches(
                /^owner_[A-Za-z0-9_-]+$/
            )
            .withMessage(
                "Invalid owner public ID format."
            ),

        query("property_public_id")
            .optional()
            .isString()
            .withMessage(
                "Property public ID must be a string."
            )
            .trim()
            .isLength({
                min: 10,
                max: 50
            })
            .withMessage(
                "Property public ID must contain between 10 and 50 characters."
            )
            .matches(
                /^property_[A-Za-z0-9_-]+$/
            )
            .withMessage(
                "Invalid property public ID format."
            ),

        query("date_from")
            .optional()
            .custom(value => {
                if (!isValidDateOnly(value)) {
                    throw new Error(
                        "Date-from must be a valid date in YYYY-MM-DD format."
                    );
                }

                return true;
            }),

        query("date_to")
            .optional()
            .custom(value => {
                if (!isValidDateOnly(value)) {
                    throw new Error(
                        "Date-to must be a valid date in YYYY-MM-DD format."
                    );
                }

                return true;
            })
            .custom((value, { req }) => {
                if (
                    value &&
                    req.query.date_from &&
                    isValidDateOnly(
                        req.query.date_from
                    )
                ) {
                    const from = new Date(
                        `${req.query.date_from}T00:00:00.000Z`
                    );

                    const to = new Date(
                        `${value}T00:00:00.000Z`
                    );

                    if (
                        to.getTime() <
                        from.getTime()
                    ) {
                        throw new Error(
                            "Date-to cannot be before date-from."
                        );
                    }
                }

                return true;
            }),

        query("currency_code")
            .optional()
            .isString()
            .withMessage(
                "Currency code must be a string."
            )
            .trim()
            .matches(/^[A-Z]{3}$/)
            .withMessage(
                "Currency code must contain exactly three uppercase letters."
            )
    ];

    if (
        allowedExtraFields.includes(
            "period"
        )
    ) {
        validators.push(
            query("period")
                .optional()
                .isIn(PERIODS)
                .withMessage(
                    `Period must be one of: ${PERIODS.join(", ")}.`
                )
        );
    }

    if (
        allowedExtraFields.includes(
            "limit"
        )
    ) {
        validators.push(
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
        );
    }

    if (
        allowedExtraFields.includes(
            "days"
        )
    ) {
        validators.push(
            query("days")
                .optional()
                .isInt({
                    min: 1,
                    max: 365
                })
                .withMessage(
                    "Days must be an integer between 1 and 365."
                )
                .toInt()
        );
    }

    if (
        allowedExtraFields.includes(
            "lease_status"
        )
    ) {
        validators.push(
            query("status")
                .optional()
                .isIn(LEASE_STATUSES)
                .withMessage(
                    `Lease status must be one of: ${LEASE_STATUSES.join(", ")}.`
                )
        );
    }

    if (
        allowedExtraFields.includes(
            "maintenance_status"
        )
    ) {
        validators.push(
            query("status")
                .optional()
                .isIn(
                    MAINTENANCE_STATUSES
                )
                .withMessage(
                    "Invalid maintenance status."
                )
        );
    }

    if (
        allowedExtraFields.includes(
            "priority"
        )
    ) {
        validators.push(
            query("priority")
                .optional()
                .isIn(
                    MAINTENANCE_PRIORITIES
                )
                .withMessage(
                    "Invalid maintenance priority."
                )
        );
    }

    if (
        allowedExtraFields.includes(
            "category"
        )
    ) {
        validators.push(
            query("category")
                .optional()
                .isIn(
                    MAINTENANCE_CATEGORIES
                )
                .withMessage(
                    "Invalid maintenance category."
                )
        );
    }

    return validators;
};

module.exports = {
    buildReportExportValidator
};

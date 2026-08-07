const {
    body,
    query
} = require("express-validator");

const {
    isValidDateOnly
} = require(
    "./reportContextValidator"
);

const MAINTENANCE_STATUSES = Object.freeze([
    "reported",
    "under_review",
    "assigned",
    "in_progress",
    "on_hold",
    "resolved",
    "closed",
    "rejected",
    "cancelled"
]);

const MAINTENANCE_PRIORITIES =
    Object.freeze([
        "low",
        "medium",
        "high",
        "emergency"
    ]);

const MAINTENANCE_CATEGORIES =
    Object.freeze([
        "plumbing",
        "electrical",
        "appliance",
        "structural",
        "roofing",
        "painting",
        "doors_windows",
        "security",
        "water_supply",
        "sanitation",
        "pest_control",
        "internet_communication",
        "cleaning",
        "common_area",
        "other"
    ]);

const buildMaintenanceReportValidator = ({
    allowCurrency = false,
    allowLimit = false
} = {}) => {
    const allowedFields = [
        "owner_public_id",
        "property_public_id",
        "date_from",
        "date_to",
        "status",
        "priority",
        "category"
    ];

    if (allowCurrency) {
        allowedFields.push("currency_code");
    }

    if (allowLimit) {
        allowedFields.push("limit");
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

                    const rangeDays =
                        Math.floor(
                            (
                                to.getTime() -
                                from.getTime()
                            ) /
                            86400000
                        );

                    if (rangeDays > 3660) {
                        throw new Error(
                            "Report date range cannot exceed 3660 days."
                        );
                    }
                }

                return true;
            }),

        query("status")
            .optional()
            .isIn(MAINTENANCE_STATUSES)
            .withMessage(
                `Maintenance status must be one of: ${MAINTENANCE_STATUSES.join(", ")}.`
            ),

        query("priority")
            .optional()
            .isIn(MAINTENANCE_PRIORITIES)
            .withMessage(
                `Maintenance priority must be one of: ${MAINTENANCE_PRIORITIES.join(", ")}.`
            ),

        query("category")
            .optional()
            .isIn(MAINTENANCE_CATEGORIES)
            .withMessage(
                "Invalid maintenance category."
            )
    ];

    if (allowCurrency) {
        validators.push(
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
        );
    }

    if (allowLimit) {
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

    return validators;
};

const maintenanceSummaryValidator =
    buildMaintenanceReportValidator();

const maintenancePerformanceValidator =
    buildMaintenanceReportValidator({
        allowLimit: true
    });

const maintenanceCostsValidator =
    buildMaintenanceReportValidator({
        allowCurrency: true
    });

module.exports = {
    MAINTENANCE_STATUSES,
    MAINTENANCE_PRIORITIES,
    MAINTENANCE_CATEGORIES,
    buildMaintenanceReportValidator,
    maintenanceSummaryValidator,
    maintenancePerformanceValidator,
    maintenanceCostsValidator
};

const {
    body,
    query
} = require("express-validator");

const {
    isValidDateOnly
} = require(
    "./reportContextValidator"
);

const PERIODS = Object.freeze([
    "daily",
    "weekly",
    "monthly",
    "quarterly",
    "yearly"
]);

const buildFinancialReportValidator = ({
    allowPeriod = false,
    allowLimit = false
} = {}) => {
    const allowedFields = [
        "owner_public_id",
        "property_public_id",
        "date_from",
        "date_to",
        "currency_code"
    ];

    if (allowPeriod) {
        allowedFields.push("period");
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

    if (allowPeriod) {
        validators.push(
            query("period")
                .optional()
                .isIn(PERIODS)
                .withMessage(
                    `Period must be one of: ${PERIODS.join(", ")}.`
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

const financialSummaryValidator =
    buildFinancialReportValidator();

const financialRevenueValidator =
    buildFinancialReportValidator({
        allowPeriod: true
    });

const financialOutstandingValidator =
    buildFinancialReportValidator({
        allowLimit: true
    });

const financialCollectionsValidator =
    buildFinancialReportValidator({
        allowPeriod: true
    });

module.exports = {
    PERIODS,
    buildFinancialReportValidator,
    financialSummaryValidator,
    financialRevenueValidator,
    financialOutstandingValidator,
    financialCollectionsValidator
};

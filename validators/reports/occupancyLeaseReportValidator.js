const {
    body,
    query
} = require("express-validator");

const {
    isValidDateOnly
} = require(
    "./reportContextValidator"
);

const LEASE_STATUSES = Object.freeze([
    "draft",
    "scheduled",
    "active",
    "expired",
    "terminated",
    "cancelled"
]);

const strictQuery = allowedFields =>
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

const noRequestBody = () =>
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

const ownerPublicIdValidator = () =>
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
        );

const propertyPublicIdValidator = () =>
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
        );

const dateValidators = () => [
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
        })
];

const occupancyReportValidator = [
    strictQuery([
        "owner_public_id",
        "property_public_id"
    ]),
    noRequestBody(),
    ownerPublicIdValidator(),
    propertyPublicIdValidator()
];

const leaseReportValidator = [
    strictQuery([
        "owner_public_id",
        "property_public_id",
        "date_from",
        "date_to",
        "status",
        "limit"
    ]),
    noRequestBody(),
    ownerPublicIdValidator(),
    propertyPublicIdValidator(),
    ...dateValidators(),

    query("status")
        .optional()
        .isIn(LEASE_STATUSES)
        .withMessage(
            `Lease status must be one of: ${LEASE_STATUSES.join(", ")}.`
        ),

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

const expiringLeaseReportValidator = [
    strictQuery([
        "owner_public_id",
        "property_public_id",
        "days",
        "limit"
    ]),
    noRequestBody(),
    ownerPublicIdValidator(),
    propertyPublicIdValidator(),

    query("days")
        .optional()
        .isInt({
            min: 1,
            max: 365
        })
        .withMessage(
            "Days must be an integer between 1 and 365."
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

module.exports = {
    LEASE_STATUSES,
    occupancyReportValidator,
    leaseReportValidator,
    expiringLeaseReportValidator
};

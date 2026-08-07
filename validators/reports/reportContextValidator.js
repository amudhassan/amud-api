const {
    body,
    query
} = require("express-validator");

const isValidDateOnly = value => {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const [year, month, day] =
        value.split("-").map(Number);

    const date = new Date(
        Date.UTC(year, month - 1, day)
    );

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
};

const reportContextValidator = [
    query()
        .custom(value => {
            const allowedFields = [
                "owner_public_id",
                "property_public_id",
                "date_from",
                "date_to",
                "currency_code"
            ];

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
                isValidDateOnly(req.query.date_from)
            ) {
                const from = new Date(
                    `${req.query.date_from}T00:00:00.000Z`
                );

                const to = new Date(
                    `${value}T00:00:00.000Z`
                );

                if (to.getTime() < from.getTime()) {
                    throw new Error(
                        "Date-to cannot be before date-from."
                    );
                }

                const maxRangeDays = 3660;
                const rangeDays =
                    Math.floor(
                        (
                            to.getTime() -
                            from.getTime()
                        ) /
                        86400000
                    );

                if (rangeDays > maxRangeDays) {
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

module.exports = {
    reportContextValidator,
    isValidDateOnly
};

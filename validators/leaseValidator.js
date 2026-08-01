const {
    body
} = require("express-validator");

/*
 * Confirm that a value is a valid
 * YYYY-MM-DD calendar date.
 */
const isValidDateOnly = value => {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const [
        year,
        month,
        day
    ] = value
        .split("-")
        .map(Number);

    const date = new Date(
        Date.UTC(
            year,
            month - 1,
            day
        )
    );

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
};

/*
 * Confirm that a value is an actual
 * finite JSON number.
 */
const isValidNumber = value => (
    typeof value === "number" &&
    Number.isFinite(value)
);

/*
 * POST /api/leases
 */
const createDraftLeaseValidator = [

    /*
     * Request body must be a JSON object.
     */
    body()
        .custom(value => {
            if (
                value === null ||
                typeof value !== "object" ||
                Array.isArray(value)
            ) {
                throw new Error(
                    "Request body must be a JSON object."
                );
            }

            return true;
        }),

    /*
     * Reject unsupported and protected fields.
     */
    body()
        .custom(value => {
            const allowedFields = [
                "owner_public_id",
                "property_public_id",
                "unit_public_id",
                "tenant_public_id",
                "start_date",
                "end_date",
                "currency_code",
                "rent_amount",
                "billing_frequency",
                "payment_due_day",
                "grace_period_days",
                "security_deposit_amount",
                "late_fee_type",
                "late_fee_value",
                "notes"
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
                    `Unsupported fields: ${unsupportedFields.join(", ")}.`
                );
            }

            return true;
        }),

    body("owner_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Owner public ID is required."
        )

        .isString()
        .withMessage(
            "Owner public ID must be a string."
        )

        .trim()

        .isLength({
            min: 7,
            max: 40
        })
        .withMessage(
            "Owner public ID must contain between 7 and 40 characters."
        )

        .matches(
            /^owner_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid owner public ID format."
        ),

    body("property_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Property public ID is required."
        )

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

    body("unit_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Unit public ID is required."
        )

        .isString()
        .withMessage(
            "Unit public ID must be a string."
        )

        .trim()

        .isLength({
            min: 10,
            max: 50
        })
        .withMessage(
            "Unit public ID must contain between 10 and 50 characters."
        )

        .matches(
            /^unit_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid unit public ID format."
        ),

    body("tenant_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Tenant public ID is required."
        )

        .isString()
        .withMessage(
            "Tenant public ID must be a string."
        )

        .trim()

        .isLength({
            min: 8,
            max: 50
        })
        .withMessage(
            "Tenant public ID must contain between 8 and 50 characters."
        )

        .matches(
            /^tenant_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid tenant public ID format."
        ),

    body("start_date")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Lease start date is required."
        )

        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Lease start date must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        }),

    body("end_date")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Lease end date is required."
        )

        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Lease end date must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        })

        .custom((value, {
            req
        }) => {
            if (
                isValidDateOnly(req.body.start_date) &&
                value <= req.body.start_date
            ) {
                throw new Error(
                    "Lease end date must be after the start date."
                );
            }

            return true;
        }),

    body("currency_code")
        .optional()

        .isString()
        .withMessage(
            "Currency code must be a string."
        )

        .trim()

        .matches(
            /^[A-Z]{3}$/
        )
        .withMessage(
            "Currency code must contain exactly three uppercase letters."
        ),

    body("rent_amount")
        .exists({
            checkNull: true
        })
        .withMessage(
            "Rent amount is required."
        )

        .custom(value => {
            if (
                !isValidNumber(value) ||
                value <= 0
            ) {
                throw new Error(
                    "Rent amount must be a number greater than zero."
                );
            }

            if (value > 999999999999.99) {
                throw new Error(
                    "Rent amount exceeds the supported maximum."
                );
            }

            return true;
        }),

    body("billing_frequency")
        .optional()

        .isString()
        .withMessage(
            "Billing frequency must be a string."
        )

        .isIn([
            "monthly",
            "quarterly",
            "semi_annual",
            "annual"
        ])
        .withMessage(
            "Invalid billing frequency."
        ),

    body("payment_due_day")
        .optional()

        .custom(value => {
            if (
                !Number.isInteger(value) ||
                value < 1 ||
                value > 28
            ) {
                throw new Error(
                    "Payment due day must be an integer between 1 and 28."
                );
            }

            return true;
        }),

    body("grace_period_days")
        .optional()

        .custom(value => {
            if (
                !Number.isInteger(value) ||
                value < 0 ||
                value > 30
            ) {
                throw new Error(
                    "Grace period days must be an integer between 0 and 30."
                );
            }

            return true;
        }),

    body("security_deposit_amount")
        .optional()

        .custom(value => {
            if (
                !isValidNumber(value) ||
                value < 0
            ) {
                throw new Error(
                    "Security deposit amount must be a non-negative number."
                );
            }

            if (value > 999999999999.99) {
                throw new Error(
                    "Security deposit amount exceeds the supported maximum."
                );
            }

            return true;
        }),

    body("late_fee_type")
        .optional()

        .isString()
        .withMessage(
            "Late fee type must be a string."
        )

        .isIn([
            "none",
            "fixed",
            "percentage"
        ])
        .withMessage(
            "Invalid late fee type."
        ),

    body("late_fee_value")
        .optional()

        .custom(value => {
            if (
                !isValidNumber(value) ||
                value < 0
            ) {
                throw new Error(
                    "Late fee value must be a non-negative number."
                );
            }

            if (value > 999999999999.99) {
                throw new Error(
                    "Late fee value exceeds the supported maximum."
                );
            }

            return true;
        }),

    /*
     * Cross-field late-fee validation.
     */
    body()
        .custom(value => {
            const lateFeeType =
                value.late_fee_type || "none";

            const lateFeeValue =
                value.late_fee_value ?? 0;

            if (
                lateFeeType === "none" &&
                lateFeeValue !== 0
            ) {
                throw new Error(
                    "Late fee value must be zero when late fee type is none."
                );
            }

            if (
                (
                    lateFeeType === "fixed" ||
                    lateFeeType === "percentage"
                ) &&
                lateFeeValue <= 0
            ) {
                throw new Error(
                    "Late fee value must be greater than zero when a late fee is enabled."
                );
            }

            if (
                lateFeeType === "percentage" &&
                lateFeeValue > 100
            ) {
                throw new Error(
                    "Percentage late fee cannot exceed 100."
                );
            }

            return true;
        }),

    body("notes")
        .optional()

        .isString()
        .withMessage(
            "Notes must be a string."
        )

        .trim()

        .isLength({
            max: 2000
        })
        .withMessage(
            "Notes cannot exceed 2000 characters."
        )
];

module.exports = {
    createDraftLeaseValidator
};
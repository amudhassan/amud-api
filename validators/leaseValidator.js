const {
    body,
    query,
    param
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
/*
 * GET /api/leases
 */
const getLeasesValidator = [

    /*
     * Reject undocumented query parameters.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "search",
                "status",
                "owner_public_id",
                "property_public_id",
                "unit_public_id",
                "tenant_public_id",
                "start_date_from",
                "end_date_to",
                "page",
                "limit"
            ];

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

    /*
     * Search filter.
     */
    query("search")
        .optional()

        .isString()
        .withMessage(
            "Search must be a string."
        )

        .trim()

        .notEmpty()
        .withMessage(
            "Search cannot be empty."
        )

        .isLength({
            max: 100
        })
        .withMessage(
            "Search cannot exceed 100 characters."
        ),

    /*
     * Lease lifecycle status.
     */
    query("status")
        .optional()

        .isString()
        .withMessage(
            "Lease status must be a string."
        )

        .trim()

        .isIn([
            "draft",
            "scheduled",
            "active",
            "expired",
            "terminated",
            "cancelled"
        ])
        .withMessage(
            "Invalid lease status."
        ),

    /*
     * Owner public identifier.
     */
    query("owner_public_id")
        .optional()

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

    /*
     * Property public identifier.
     */
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

    /*
     * Unit public identifier.
     */
    query("unit_public_id")
        .optional()

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

    /*
     * Tenant public identifier.
     */
    query("tenant_public_id")
        .optional()

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

    /*
     * Date-range filters.
     */
    query("start_date_from")
        .optional()

        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Start date from must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        }),

    query("end_date_to")
        .optional()

        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "End date to must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        })

        .custom((value, {
            req
        }) => {
            if (
                req.query.start_date_from &&
                isValidDateOnly(
                    req.query.start_date_from
                ) &&
                value <
                    req.query.start_date_from
            ) {
                throw new Error(
                    "End date to cannot be before start date from."
                );
            }

            return true;
        }),

    /*
     * Pagination.
     */
    query("page")
        .optional()

        .isInt({
            min: 1
        })
        .withMessage(
            "Page must be a positive integer."
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
/*
 * GET /api/leases/:lease_public_id
 */
const getSingleLeaseValidator = [

    /*
     * This endpoint does not accept query
     * parameters.
     */
    query()
        .custom(value => {
            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length > 0) {
                throw new Error(
                    `Unsupported query parameters: ${suppliedFields.join(", ")}.`
                );
            }

            return true;
        }),

    /*
     * Lease public identifier.
     */
    param("lease_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Lease public ID is required."
        )

        .isString()
        .withMessage(
            "Lease public ID must be a string."
        )

        .trim()

        .isLength({
            min: 7,
            max: 50
        })
        .withMessage(
            "Lease public ID must contain between 7 and 50 characters."
        )

        .matches(
            /^lease_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid lease public ID format."
        )
];
/*
 * PATCH /api/leases/:lease_public_id
 */
const updateDraftLeaseValidator = [

    /*
     * This endpoint does not accept query
     * parameters.
     */
    query()
        .custom(value => {
            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length > 0) {
                throw new Error(
                    `Unsupported query parameters: ${suppliedFields.join(", ")}.`
                );
            }

            return true;
        }),

    /*
     * Lease public identifier.
     */
    param("lease_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Lease public ID is required."
        )

        .isString()
        .withMessage(
            "Lease public ID must be a string."
        )

        .trim()

        .isLength({
            min: 7,
            max: 50
        })
        .withMessage(
            "Lease public ID must contain between 7 and 50 characters."
        )

        .matches(
            /^lease_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid lease public ID format."
        ),

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
     * Require at least one supported field and
     * reject protected fields.
     */
    body()
        .custom(value => {
            const allowedFields = [
                "property_public_id",
                "unit_public_id",
                "tenant_public_id",
                "start_date",
                "end_date",
                "signed_at",
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

            if (suppliedFields.length === 0) {
                throw new Error(
                    "At least one draft lease field must be supplied."
                );
            }

            const unsupportedFields =
                suppliedFields.filter(
                    field =>
                        !allowedFields.includes(field)
                );

            if (
                unsupportedFields.length > 0
            ) {
                throw new Error(
                    `Unsupported fields: ${unsupportedFields.join(", ")}.`
                );
            }

            return true;
        }),

    body("property_public_id")
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

    body("unit_public_id")
        .optional()

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
        .optional()

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
        .optional()

        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Lease start date must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        }),

    body("end_date")
        .optional()

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
                req.body.start_date &&
                isValidDateOnly(
                    req.body.start_date
                ) &&
                value <= req.body.start_date
            ) {
                throw new Error(
                    "Lease end date must be after the start date."
                );
            }

            return true;
        }),

    body("signed_at")
        .optional({
            nullable: true
        })

        .isISO8601({
            strict: true,
            strictSeparator: true
        })
        .withMessage(
            "signed_at must be a valid ISO-8601 timestamp or null."
        ),

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
        .optional()

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
     * Cross-field late-fee validation applies
     * when both values are supplied together.
     *
     * Final-value validation remains in the
     * service for partial updates.
     */
    body()
        .custom(value => {
            const hasLateFeeType =
                Object.prototype
                    .hasOwnProperty.call(
                        value,
                        "late_fee_type"
                    );

            const hasLateFeeValue =
                Object.prototype
                    .hasOwnProperty.call(
                        value,
                        "late_fee_value"
                    );

            if (
                !hasLateFeeType ||
                !hasLateFeeValue
            ) {
                return true;
            }

            if (
                value.late_fee_type ===
                    "none" &&
                value.late_fee_value !== 0
            ) {
                throw new Error(
                    "Late fee value must be zero when late fee type is none."
                );
            }

            if (
                (
                    value.late_fee_type ===
                        "fixed" ||
                    value.late_fee_type ===
                        "percentage"
                ) &&
                value.late_fee_value <= 0
            ) {
                throw new Error(
                    "Late fee value must be greater than zero when a late fee is enabled."
                );
            }

            if (
                value.late_fee_type ===
                    "percentage" &&
                value.late_fee_value > 100
            ) {
                throw new Error(
                    "Percentage late fee cannot exceed 100."
                );
            }

            return true;
        }),

    body("notes")
        .optional({
            nullable: true
        })

        .isString()
        .withMessage(
            "Notes must be a string or null."
        )

        .trim()

        .isLength({
            max: 2000
        })
        .withMessage(
            "Notes cannot exceed 2000 characters."
        )
];
/*
 * PATCH /api/leases/:lease_public_id/schedule
 */
const scheduleLeaseValidator = [

    /*
     * This endpoint does not accept query
     * parameters.
     */
    query()
        .custom(value => {
            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length > 0) {
                throw new Error(
                    `Unsupported query parameters: ${suppliedFields.join(", ")}.`
                );
            }

            return true;
        }),

    /*
     * Lease public identifier.
     */
    param("lease_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Lease public ID is required."
        )

        .isString()
        .withMessage(
            "Lease public ID must be a string."
        )

        .trim()

        .isLength({
            min: 7,
            max: 50
        })
        .withMessage(
            "Lease public ID must contain between 7 and 50 characters."
        )

        .matches(
            /^lease_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid lease public ID format."
        ),

    /*
     * Empty JSON object is permitted because the
     * draft may already have signed_at.
     */
    body()
        .custom(value => {
            if (
                value === undefined ||
                value === null
            ) {
                return true;
            }

            if (
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
     * signed_at is the only supported body field.
     */
    body()
        .custom(value => {
            const allowedFields = [
                "signed_at"
            ];

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
                    `Unsupported fields: ${unsupportedFields.join(", ")}.`
                );
            }

            return true;
        }),

    body("signed_at")
        .optional()

        .isISO8601({
            strict: true,
            strictSeparator: true
        })
        .withMessage(
            "signed_at must be a valid ISO-8601 timestamp."
        )
];
/*
 * PATCH /api/leases/:lease_public_id/activate
 */
const activateLeaseValidator = [

    /*
     * Query parameters are not accepted.
     */
    query()
        .custom(value => {
            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length > 0) {
                throw new Error(
                    `Unsupported query parameters: ${suppliedFields.join(", ")}.`
                );
            }

            return true;
        }),

    /*
     * Lease public identifier.
     */
    param("lease_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Lease public ID is required."
        )

        .isString()
        .withMessage(
            "Lease public ID must be a string."
        )

        .trim()

        .isLength({
            min: 7,
            max: 50
        })
        .withMessage(
            "Lease public ID must contain between 7 and 50 characters."
        )

        .matches(
            /^lease_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid lease public ID format."
        ),

    /*
     * Request body must be empty.
     */
    body()
        .custom(value => {
            if (
                value === undefined ||
                value === null
            ) {
                return true;
            }

            if (
                typeof value !== "object" ||
                Array.isArray(value) ||
                Object.keys(value).length > 0
            ) {
                throw new Error(
                    "Request body is not allowed for this operation."
                );
            }

            return true;
        })
];
/*
 * PATCH /api/leases/:lease_public_id/cancel
 */
const cancelLeaseValidator = [

    query()
        .custom(value => {
            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length > 0) {
                throw new Error(
                    `Unsupported query parameters: ${suppliedFields.join(", ")}.`
                );
            }

            return true;
        }),

    param("lease_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Lease public ID is required."
        )
        .isString()
        .withMessage(
            "Lease public ID must be a string."
        )
        .trim()
        .isLength({
            min: 7,
            max: 50
        })
        .withMessage(
            "Lease public ID must contain between 7 and 50 characters."
        )
        .matches(
            /^lease_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid lease public ID format."
        ),

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

            const allowedFields = [
                "cancellation_reason"
            ];

            const suppliedFields =
                Object.keys(value);

            const unsupportedFields =
                suppliedFields.filter(
                    field =>
                        !allowedFields.includes(field)
                );

            if (
                unsupportedFields.length > 0
            ) {
                throw new Error(
                    `Unsupported fields: ${unsupportedFields.join(", ")}.`
                );
            }

            return true;
        }),

    body("cancellation_reason")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Cancellation reason is required."
        )
        .isString()
        .withMessage(
            "Cancellation reason must be a string."
        )
        .trim()
        .isLength({
            min: 5,
            max: 1000
        })
        .withMessage(
            "Cancellation reason must contain between 5 and 1000 characters."
        )
];
/*
 * PATCH /api/leases/:lease_public_id/terminate
 */
const terminateLeaseValidator = [

    query()
        .custom(value => {
            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length > 0) {
                throw new Error(
                    `Unsupported query parameters: ${suppliedFields.join(", ")}.`
                );
            }

            return true;
        }),

    param("lease_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Lease public ID is required."
        )
        .isString()
        .withMessage(
            "Lease public ID must be a string."
        )
        .trim()
        .isLength({
            min: 7,
            max: 50
        })
        .withMessage(
            "Lease public ID must contain between 7 and 50 characters."
        )
        .matches(
            /^lease_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid lease public ID format."
        ),

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

            const allowedFields = [
                "termination_reason"
            ];

            const suppliedFields =
                Object.keys(value);

            const unsupportedFields =
                suppliedFields.filter(
                    field =>
                        !allowedFields.includes(field)
                );

            if (
                unsupportedFields.length > 0
            ) {
                throw new Error(
                    `Unsupported fields: ${unsupportedFields.join(", ")}.`
                );
            }

            return true;
        }),

    body("termination_reason")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Termination reason is required."
        )
        .isString()
        .withMessage(
            "Termination reason must be a string."
        )
        .trim()
        .isLength({
            min: 5,
            max: 2000
        })
        .withMessage(
            "Termination reason must contain between 5 and 2000 characters."
        )
];
/*
 * PATCH /api/leases/:lease_public_id/expire
 */
const expireLeaseValidator = [

    query()
        .custom(value => {
            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length > 0) {
                throw new Error(
                    `Unsupported query parameters: ${suppliedFields.join(", ")}.`
                );
            }

            return true;
        }),

    param("lease_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Lease public ID is required."
        )
        .isString()
        .withMessage(
            "Lease public ID must be a string."
        )
        .trim()
        .isLength({
            min: 7,
            max: 50
        })
        .withMessage(
            "Lease public ID must contain between 7 and 50 characters."
        )
        .matches(
            /^lease_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid lease public ID format."
        ),

    body()
        .custom(value => {
            if (
                value === undefined ||
                value === null
            ) {
                return true;
            }

            if (
                typeof value !== "object" ||
                Array.isArray(value) ||
                Object.keys(value).length > 0
            ) {
                throw new Error(
                    "Request body is not allowed for this operation."
                );
            }

            return true;
        })
];
/*
 * POST /api/leases/:lease_public_id/renew
 */
const renewLeaseValidator = [

    query()
        .custom(value => {
            const fields =
                Object.keys(value || {});

            if (fields.length > 0) {
                throw new Error(
                    `Unsupported query parameters: ${fields.join(", ")}.`
                );
            }

            return true;
        }),

    param("lease_public_id")
        .exists({ checkFalsy: true })
        .withMessage(
            "Lease public ID is required."
        )
        .isString()
        .withMessage(
            "Lease public ID must be a string."
        )
        .trim()
        .isLength({
            min: 7,
            max: 50
        })
        .withMessage(
            "Lease public ID must contain between 7 and 50 characters."
        )
        .matches(
            /^lease_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid lease public ID format."
        ),

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

            const allowedFields = [
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

            const fields =
                Object.keys(value);

            const unsupportedFields =
                fields.filter(
                    field =>
                        !allowedFields.includes(field)
                );

            if (
                unsupportedFields.length > 0
            ) {
                throw new Error(
                    `Unsupported fields: ${unsupportedFields.join(", ")}.`
                );
            }

            return true;
        }),

    body("start_date")
        .exists({ checkFalsy: true })
        .withMessage(
            "Renewal start date is required."
        )
        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Renewal start date must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        }),

    body("end_date")
        .exists({ checkFalsy: true })
        .withMessage(
            "Renewal end date is required."
        )
        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Renewal end date must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        })
        .custom((value, { req }) => {
            if (
                isValidDateOnly(
                    req.body.start_date
                ) &&
                value <= req.body.start_date
            ) {
                throw new Error(
                    "Renewal end date must be after the start date."
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
        .matches(/^[A-Z]{3}$/)
        .withMessage(
            "Currency code must contain exactly three uppercase letters."
        ),

    body("rent_amount")
        .optional()
        .custom(value => {
            if (
                !isValidNumber(value) ||
                value <= 0 ||
                value > 999999999999.99
            ) {
                throw new Error(
                    "Rent amount must be a supported number greater than zero."
                );
            }

            return true;
        }),

    body("billing_frequency")
        .optional()
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
                value < 0 ||
                value > 999999999999.99
            ) {
                throw new Error(
                    "Security deposit amount must be a supported non-negative number."
                );
            }

            return true;
        }),

    body("late_fee_type")
        .optional()
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
                value < 0 ||
                value > 999999999999.99
            ) {
                throw new Error(
                    "Late fee value must be a supported non-negative number."
                );
            }

            return true;
        }),

    /*
     * Validate late-fee values together when
     * both fields are supplied.
     */
    body()
        .custom(value => {
            const hasType =
                Object.prototype
                    .hasOwnProperty.call(
                        value,
                        "late_fee_type"
                    );

            const hasValue =
                Object.prototype
                    .hasOwnProperty.call(
                        value,
                        "late_fee_value"
                    );

            if (!hasType || !hasValue) {
                return true;
            }

            if (
                value.late_fee_type ===
                    "none" &&
                value.late_fee_value !== 0
            ) {
                throw new Error(
                    "Late fee value must be zero when late fee type is none."
                );
            }

            if (
                (
                    value.late_fee_type ===
                        "fixed" ||
                    value.late_fee_type ===
                        "percentage"
                ) &&
                value.late_fee_value <= 0
            ) {
                throw new Error(
                    "Late fee value must be greater than zero when a late fee is enabled."
                );
            }

            if (
                value.late_fee_type ===
                    "percentage" &&
                value.late_fee_value > 100
            ) {
                throw new Error(
                    "Percentage late fee cannot exceed 100."
                );
            }

            return true;
        }),

    body("notes")
        .optional({ nullable: true })
        .isString()
        .withMessage(
            "Notes must be a string or null."
        )
        .trim()
        .isLength({ max: 2000 })
        .withMessage(
            "Notes cannot exceed 2000 characters."
        )
];
module.exports = {
    createDraftLeaseValidator,
    getLeasesValidator,
    getSingleLeaseValidator,
    updateDraftLeaseValidator,
    scheduleLeaseValidator,
    activateLeaseValidator,
    cancelLeaseValidator,
    terminateLeaseValidator,
    expireLeaseValidator,
    renewLeaseValidator
};
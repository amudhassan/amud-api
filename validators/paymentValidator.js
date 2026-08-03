const {
    body,
    query,
    param
} = require("express-validator");

/*
 * Payment methods whose external transaction
 * reference is mandatory.
 */
const referencedPaymentMethods = [
    "bank_transfer",
    "mobile_money",
    "card",
    "cheque"
];

/*
 * Confirm that a value represents a real
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
 * POST /api/invoices/:invoice_public_id/payments
 */
const recordRentPaymentValidator = [

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
     * Invoice public identifier.
     */
    param("invoice_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Invoice public ID is required."
        )

        .isString()
        .withMessage(
            "Invoice public ID must be a string."
        )

        .trim()

        .isLength({
            min: 9,
            max: 50
        })
        .withMessage(
            "Invoice public ID must contain between 9 and 50 characters."
        )

        .matches(
            /^invoice_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid invoice public ID format."
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
     * Reject server-controlled and undocumented
     * request fields.
     */
    body()
        .custom(value => {
            const allowedFields = [
                "amount",
                "payment_method",
                "transaction_reference",
                "paid_at",
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

    /*
     * Positive payment amount with a maximum of
     * twelve whole-number digits and two decimals.
     */
    body("amount")
        .exists({
            checkNull: true
        })
        .withMessage(
            "Payment amount is required."
        )

        .isFloat({
            gt: 0
        })
        .withMessage(
            "Payment amount must be greater than zero."
        )

        .custom(value => {
            const normalizedValue =
                String(value).trim();

            if (
                !/^\d{1,12}(\.\d{1,2})?$/.test(
                    normalizedValue
                )
            ) {
                throw new Error(
                    "Payment amount must contain at most 12 whole-number digits and 2 decimal places."
                );
            }

            return true;
        }),

    /*
     * Supported manual payment method.
     */
    body("payment_method")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Payment method is required."
        )

        .isString()
        .withMessage(
            "Payment method must be a string."
        )

        .trim()

        .isIn([
            "cash",
            "bank_transfer",
            "mobile_money",
            "card",
            "cheque",
            "other"
        ])
        .withMessage(
            "Invalid payment method."
        ),

    /*
     * Optional external transaction reference.
     * Conditional presence is checked below.
     */
    body("transaction_reference")
        .optional({
            nullable: true
        })

        .isString()
        .withMessage(
            "Transaction reference must be a string or null."
        )

        .trim()

        .notEmpty()
        .withMessage(
            "Transaction reference cannot be blank."
        )

        .isLength({
            max: 150
        })
        .withMessage(
            "Transaction reference cannot exceed 150 characters."
        ),

    /*
     * Bank, mobile-money, card and cheque
     * payments require an external reference.
     */
    body()
        .custom(value => {
            if (
                !value ||
                typeof value !== "object" ||
                Array.isArray(value)
            ) {
                return true;
            }

            if (
                referencedPaymentMethods.includes(
                    value.payment_method
                ) &&
                (
                    typeof value
                        .transaction_reference !==
                        "string" ||
                    value.transaction_reference
                        .trim().length === 0
                )
            ) {
                throw new Error(
                    "Transaction reference is required for the selected payment method."
                );
            }

            return true;
        }),

    /*
     * Actual payment timestamp. Completed payments
     * cannot be recorded with a future timestamp.
     */
        body("paid_at")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Payment date and time is required."
        )

        .isString()
        .withMessage(
            "Payment date and time must be a string."
        )

        .trim()

        .isISO8601({
            strict: true,
            strictSeparator: true
        })
        .withMessage(
            "Payment date and time must be a valid ISO 8601 timestamp."
        )

        .bail()

        .custom(value => {
            if (
                !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
                    value
                )
            ) {
                throw new Error(
                    "Payment date and time must include time and timezone information."
                );
            }

            return true;
        })

        .bail()

        .custom(value => {
            const paymentTime =
                new Date(value).getTime();

            if (paymentTime > Date.now()) {
                throw new Error(
                    "Payment date and time cannot be in the future."
                );
            }

            return true;
        }),

    /*
     * Optional payment notes.
     */
    body("notes")
        .optional({
            nullable: true
        })

        .isString()
        .withMessage(
            "Payment notes must be a string or null."
        )

        .trim()

        .isLength({
            max: 1000
        })
        .withMessage(
            "Payment notes cannot exceed 1000 characters."
        )
];
/*
 * GET /api/payments
 */
const getPaymentsValidator = [

    /*
     * Reject undocumented query parameters.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "search",
                "status",
                "payment_method",
                "owner_public_id",
                "tenant_public_id",
                "invoice_public_id",
                "payment_number",
                "receipt_number",
                "paid_at_from",
                "paid_at_to",
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

            if (unsupportedFields.length > 0) {
                throw new Error(
                    `Unsupported query parameters: ${unsupportedFields.join(", ")}.`
                );
            }

            return true;
        }),

    /*
     * Case-insensitive search across payment,
     * receipt, transaction and related records.
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
     * Payment lifecycle status.
     */
    query("status")
        .optional()

        .isString()
        .withMessage(
            "Payment status must be a string."
        )

        .trim()

        .isIn([
            "completed",
            "reversed"
        ])
        .withMessage(
            "Invalid payment status."
        ),

    /*
     * Payment method filter.
     */
    query("payment_method")
        .optional()

        .isString()
        .withMessage(
            "Payment method must be a string."
        )

        .trim()

        .isIn([
            "cash",
            "bank_transfer",
            "mobile_money",
            "card",
            "cheque",
            "other"
        ])
        .withMessage(
            "Invalid payment method."
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

    query("invoice_public_id")
        .optional()

        .isString()
        .withMessage(
            "Invoice public ID must be a string."
        )

        .trim()

        .isLength({
            min: 9,
            max: 50
        })
        .withMessage(
            "Invoice public ID must contain between 9 and 50 characters."
        )

        .matches(
            /^invoice_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid invoice public ID format."
        ),

    query("payment_number")
        .optional()

        .isString()
        .withMessage(
            "Payment number must be a string."
        )

        .trim()

        .notEmpty()
        .withMessage(
            "Payment number cannot be empty."
        )

        .isLength({
            max: 50
        })
        .withMessage(
            "Payment number cannot exceed 50 characters."
        ),

    query("receipt_number")
        .optional()

        .isString()
        .withMessage(
            "Receipt number must be a string."
        )

        .trim()

        .notEmpty()
        .withMessage(
            "Receipt number cannot be empty."
        )

        .isLength({
            max: 50
        })
        .withMessage(
            "Receipt number cannot exceed 50 characters."
        ),

    query("paid_at_from")
        .optional()

        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Paid at from must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        }),

    query("paid_at_to")
        .optional()

        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Paid at to must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        })

        .custom((value, { req }) => {
            if (
                req.query.paid_at_from &&
                isValidDateOnly(
                    req.query.paid_at_from
                ) &&
                value <
                    req.query.paid_at_from
            ) {
                throw new Error(
                    "Paid at to cannot be before paid at from."
                );
            }

            return true;
        }),

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

        .toInt(),

    /*
     * GET operation does not accept request-body
     * fields.
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
 * GET /api/payments/:payment_public_id
 */
const getSinglePaymentValidator = [

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
     * Payment public identifier.
     */
    param("payment_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Payment public ID is required."
        )

        .isString()
        .withMessage(
            "Payment public ID must be a string."
        )

        .trim()

        .isLength({
            min: 9,
            max: 50
        })
        .withMessage(
            "Payment public ID must contain between 9 and 50 characters."
        )

        .matches(
            /^payment_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid payment public ID format."
        ),

    /*
     * GET operation does not accept request-body
     * fields.
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
 * PATCH /api/payments/:payment_public_id/reverse
 */
const reverseRentPaymentValidator = [

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

    param("payment_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Payment public ID is required."
        )

        .isString()
        .withMessage(
            "Payment public ID must be a string."
        )

        .trim()

        .isLength({
            min: 9,
            max: 50
        })
        .withMessage(
            "Payment public ID must contain between 9 and 50 characters."
        )

        .matches(
            /^payment_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid payment public ID format."
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

            return true;
        }),

    body()
        .custom(value => {
            const allowedFields = [
                "reversal_reason"
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

    body("reversal_reason")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Reversal reason is required."
        )

        .isString()
        .withMessage(
            "Reversal reason must be a string."
        )

        .trim()

        .notEmpty()
        .withMessage(
            "Reversal reason cannot be blank."
        )

        .isLength({
            max: 1000
        })
        .withMessage(
            "Reversal reason cannot exceed 1000 characters."
        )
];

module.exports = {
    recordRentPaymentValidator,
    getPaymentsValidator,
    getSinglePaymentValidator,
    reverseRentPaymentValidator
};

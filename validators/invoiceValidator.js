const {
    body,
    query,
    param
} = require("express-validator");

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
 * POST /api/invoices
 */
const createDraftRentInvoiceValidator = [

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
                "lease_public_id",
                "billing_period_start",
                "billing_period_end",
                "due_date",
                "currency_code",
                "notes"
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

    body("lease_public_id")
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

    body("billing_period_start")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Billing period start is required."
        )
        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Billing period start must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        }),

    body("billing_period_end")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Billing period end is required."
        )
        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Billing period end must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        })
        .custom((value, { req }) => {
            if (
                isValidDateOnly(
                    req.body.billing_period_start
                ) &&
                value <
                    req.body.billing_period_start
            ) {
                throw new Error(
                    "Billing period end cannot be before the billing period start."
                );
            }

            return true;
        }),

    body("due_date")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Invoice due date is required."
        )
        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Invoice due date must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        })
        .custom((value, { req }) => {
            if (
                isValidDateOnly(
                    req.body.billing_period_start
                ) &&
                value <
                    req.body.billing_period_start
            ) {
                throw new Error(
                    "Invoice due date cannot be before the billing period start."
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
 * GET /api/invoices
 */
const getInvoicesValidator = [

    /*
     * Reject undocumented query parameters.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "search",
                "status",
                "lease_public_id",
                "owner_public_id",
                "property_public_id",
                "unit_public_id",
                "tenant_public_id",
                "billing_period_start_from",
                "billing_period_end_to",
                "due_date_from",
                "due_date_to",
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
     * Case-insensitive search.
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
     * Invoice lifecycle status.
     */
    query("status")
        .optional()
        .isString()
        .withMessage(
            "Invoice status must be a string."
        )
        .trim()
        .isIn([
            "draft",
            "issued",
            "partially_paid",
            "paid",
            "overdue",
            "void"
        ])
        .withMessage(
            "Invalid invoice status."
        ),

    query("lease_public_id")
        .optional()
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

    query("billing_period_start_from")
        .optional()
        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Billing period start from must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        }),

    query("billing_period_end_to")
        .optional()
        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Billing period end to must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        })
        .custom((value, { req }) => {
            if (
                req.query
                    .billing_period_start_from &&
                isValidDateOnly(
                    req.query
                        .billing_period_start_from
                ) &&
                value <
                    req.query
                        .billing_period_start_from
            ) {
                throw new Error(
                    "Billing period end to cannot be before billing period start from."
                );
            }

            return true;
        }),

    query("due_date_from")
        .optional()
        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Due date from must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        }),

    query("due_date_to")
        .optional()
        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Due date to must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        })
        .custom((value, { req }) => {
            if (
                req.query.due_date_from &&
                isValidDateOnly(
                    req.query.due_date_from
                ) &&
                value <
                    req.query.due_date_from
            ) {
                throw new Error(
                    "Due date to cannot be before due date from."
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
        .toInt()
];
/*
 * GET /api/invoices/:invoice_public_id
 */
const getSingleInvoiceValidator = [

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
 * PATCH /api/invoices/:invoice_public_id
 */
const updateDraftRentInvoiceValidator = [

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
     * Require at least one supported field
     * and reject protected fields.
     */
    body()
        .custom(value => {
            const allowedFields = [
                "due_date",
                "currency_code",
                "notes"
            ];

            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length === 0) {
                throw new Error(
                    "At least one draft invoice field must be supplied."
                );
            }

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
     * Optional payment due date.
     */
    body("due_date")
        .optional()

        .custom(value => {
            if (!isValidDateOnly(value)) {
                throw new Error(
                    "Invoice due date must be a valid date in YYYY-MM-DD format."
                );
            }

            return true;
        }),

    /*
     * Three-letter uppercase currency code.
     */
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

    /*
     * Notes may be cleared using null.
     */
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
 * POST /api/invoices/:invoice_public_id/items
 */
const addDraftRentInvoiceItemValidator = [

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
     * Reject fields controlled by the server
     * or unsupported by this operation.
     */
    body()
        .custom(value => {
            const allowedFields = [
                "item_type",
                "description",
                "quantity",
                "unit_amount"
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
     * Financial classification of the line.
     */
    body("item_type")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Invoice item type is required."
        )

        .isString()
        .withMessage(
            "Invoice item type must be a string."
        )

        .trim()

        .isIn([
            "rent",
            "late_fee",
            "utility",
            "service_charge",
            "adjustment",
            "discount",
            "tax",
            "other"
        ])
        .withMessage(
            "Invalid invoice item type."
        ),

    /*
     * Human-readable line description.
     */
    body("description")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Invoice item description is required."
        )

        .isString()
        .withMessage(
            "Invoice item description must be a string."
        )

        .trim()

        .notEmpty()
        .withMessage(
            "Invoice item description cannot be blank."
        )

        .isLength({
            max: 500
        })
        .withMessage(
            "Invoice item description cannot exceed 500 characters."
        ),

    /*
     * Positive quantity with a maximum of
     * four decimal places.
     */
    body("quantity")
        .exists({
            checkNull: true
        })
        .withMessage(
            "Invoice item quantity is required."
        )

        .isFloat({
            gt: 0
        })
        .withMessage(
            "Invoice item quantity must be greater than zero."
        )

        .custom(value => {
            const normalizedValue =
                String(value).trim();

            if (
                !/^\d{1,8}(\.\d{1,4})?$/.test(
                    normalizedValue
                )
            ) {
                throw new Error(
                    "Invoice item quantity must contain at most 8 whole-number digits and 4 decimal places."
                );
            }

            return true;
        }),

    /*
     * Non-negative unit amount with a maximum
     * of two decimal places.
     */
    body("unit_amount")
        .exists({
            checkNull: true
        })
        .withMessage(
            "Invoice item unit amount is required."
        )

        .isFloat({
            min: 0
        })
        .withMessage(
            "Invoice item unit amount cannot be negative."
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
                    "Invoice item unit amount must contain at most 12 whole-number digits and 2 decimal places."
                );
            }

            return true;
        })
];
/*
 * PATCH /api/invoices/:invoice_public_id/items/:item_public_id
 */
const updateDraftRentInvoiceItemValidator = [

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
     * Invoice-item public identifier.
     */
    param("item_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Invoice item public ID is required."
        )

        .isString()
        .withMessage(
            "Invoice item public ID must be a string."
        )

        .trim()

        .isLength({
            min: 14,
            max: 50
        })
        .withMessage(
            "Invoice item public ID must contain between 14 and 50 characters."
        )

        .matches(
            /^invoice_item_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid invoice item public ID format."
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
     * Require at least one editable field and
     * reject server-controlled fields.
     */
    body()
        .custom(value => {
            const allowedFields = [
                "item_type",
                "description",
                "quantity",
                "unit_amount"
            ];

            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length === 0) {
                throw new Error(
                    "At least one draft invoice item field must be supplied."
                );
            }

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
     * Optional financial classification.
     */
    body("item_type")
        .optional()

        .isString()
        .withMessage(
            "Invoice item type must be a string."
        )

        .trim()

        .isIn([
            "rent",
            "late_fee",
            "utility",
            "service_charge",
            "adjustment",
            "discount",
            "tax",
            "other"
        ])
        .withMessage(
            "Invalid invoice item type."
        ),

    /*
     * Optional item description.
     */
    body("description")
        .optional()

        .isString()
        .withMessage(
            "Invoice item description must be a string."
        )

        .trim()

        .notEmpty()
        .withMessage(
            "Invoice item description cannot be blank."
        )

        .isLength({
            max: 500
        })
        .withMessage(
            "Invoice item description cannot exceed 500 characters."
        ),

    /*
     * Optional positive quantity with a maximum
     * of four decimal places.
     */
    body("quantity")
        .optional()

        .isFloat({
            gt: 0
        })
        .withMessage(
            "Invoice item quantity must be greater than zero."
        )

        .custom(value => {
            const normalizedValue =
                String(value).trim();

            if (
                !/^\d{1,8}(\.\d{1,4})?$/.test(
                    normalizedValue
                )
            ) {
                throw new Error(
                    "Invoice item quantity must contain at most 8 whole-number digits and 4 decimal places."
                );
            }

            return true;
        }),

    /*
     * Optional non-negative amount with a maximum
     * of two decimal places.
     */
    body("unit_amount")
        .optional()

        .isFloat({
            min: 0
        })
        .withMessage(
            "Invoice item unit amount cannot be negative."
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
                    "Invoice item unit amount must contain at most 12 whole-number digits and 2 decimal places."
                );
            }

            return true;
        })
];
/*
 * DELETE /api/invoices/:invoice_public_id/items/:item_public_id
 */
const deleteDraftRentInvoiceItemValidator = [

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
     * Invoice-item public identifier.
     */
    param("item_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Invoice item public ID is required."
        )

        .isString()
        .withMessage(
            "Invoice item public ID must be a string."
        )

        .trim()

        .isLength({
            min: 14,
            max: 50
        })
        .withMessage(
            "Invoice item public ID must contain between 14 and 50 characters."
        )

        .matches(
            /^invoice_item_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid invoice item public ID format."
        ),

    /*
     * DELETE operation does not accept request
     * body fields.
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
 * PATCH /api/invoices/:invoice_public_id/issue
 */
const issueRentInvoiceValidator = [

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
     * Issue operation does not accept request-body
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
 * PATCH /api/invoices/:invoice_public_id/void
 */
const voidRentInvoiceValidator = [

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
     * Only void_reason is accepted.
     */
    body()
        .custom(value => {
            const allowedFields = [
                "void_reason"
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
     * Required non-blank void explanation.
     */
    body("void_reason")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Invoice void reason is required."
        )

        .isString()
        .withMessage(
            "Invoice void reason must be a string."
        )

        .trim()

        .notEmpty()
        .withMessage(
            "Invoice void reason cannot be blank."
        )

        .isLength({
            max: 1000
        })
        .withMessage(
            "Invoice void reason cannot exceed 1000 characters."
        )
];
module.exports = {
    createDraftRentInvoiceValidator,
    getInvoicesValidator,
    getSingleInvoiceValidator,
    updateDraftRentInvoiceValidator,
    addDraftRentInvoiceItemValidator,
    updateDraftRentInvoiceItemValidator,
    deleteDraftRentInvoiceItemValidator,
    issueRentInvoiceValidator,
    voidRentInvoiceValidator
};
const {
    param,
    body,
    query
} = require("express-validator");

/*
 * POST /api/tenants/:tenant_public_id/users
 */
const addTenantUserValidator = [

    /*
     * Tenant public identifier kutoka URL.
     */
    param("tenant_public_id")
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

    /*
     * Request body lazima iwe plain JSON object.
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
     * Zuia fields ambazo API hairuhusu.
     *
     * Audit fields kama public_id, tenant_id,
     * user_id, created_by na timestamps
     * zitajazwa na application/database.
     */
    body()
        .custom(value => {
            const allowedFields = [
                "user_public_id",
                "relationship_role",
                "is_primary",
                "can_view_leases",
                "can_view_finances",
                "can_make_payments",
                "can_submit_maintenance",
                "can_manage_tenant_users"
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
     * Existing login user anayehusishwa na tenant.
     */
    body("user_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "User public ID is required."
        )

        .isString()
        .withMessage(
            "User public ID must be a string."
        )

        .trim()

        .isLength({
            min: 10,
            max: 40
        })
        .withMessage(
            "User public ID must contain between 10 and 40 characters."
        )

        .matches(
            /^[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid user public ID format."
        ),

    /*
     * Tenant-user relationship role.
     * Service itatumia viewer kama role haijatumwa.
     */
    body("relationship_role")
        .optional()

        .isString()
        .withMessage(
            "Relationship role must be a string."
        )

        .isIn([
            "primary_contact",
            "authorized_representative",
            "accountant",
            "occupant",
            "viewer"
        ])
        .withMessage(
            "Invalid tenant-user relationship role."
        ),

    /*
     * Boolean fields lazima ziwe true/false halisi.
     *
     * Hatutumii .toBoolean() kwa sababu hatutaki
     * kubadilisha strings au numbers kuwa Boolean.
     */
    body("is_primary")
        .optional()

        .custom(value => {
            if (typeof value !== "boolean") {
                throw new Error(
                    "is_primary must be a boolean."
                );
            }

            return true;
        }),

    body("can_view_leases")
        .optional()

        .custom(value => {
            if (typeof value !== "boolean") {
                throw new Error(
                    "can_view_leases must be a boolean."
                );
            }

            return true;
        }),

    body("can_view_finances")
        .optional()

        .custom(value => {
            if (typeof value !== "boolean") {
                throw new Error(
                    "can_view_finances must be a boolean."
                );
            }

            return true;
        }),

    body("can_make_payments")
        .optional()

        .custom(value => {
            if (typeof value !== "boolean") {
                throw new Error(
                    "can_make_payments must be a boolean."
                );
            }

            return true;
        }),

    body("can_submit_maintenance")
        .optional()

        .custom(value => {
            if (typeof value !== "boolean") {
                throw new Error(
                    "can_submit_maintenance must be a boolean."
                );
            }

            return true;
        }),

    body("can_manage_tenant_users")
        .optional()

        .custom(value => {
            if (typeof value !== "boolean") {
                throw new Error(
                    "can_manage_tenant_users must be a boolean."
                );
            }

            return true;
        })
];
/*
 * GET /api/tenants/:tenant_public_id/users
 */
const getTenantUsersValidator = [

    /*
     * Tenant public identifier.
     */
    param("tenant_public_id")
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

    /*
     * Only documented query parameters
     * are permitted.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "search",
                "relationship_role",
                "is_primary",
                "can_view_leases",
                "can_view_finances",
                "can_make_payments",
                "can_submit_maintenance",
                "can_manage_tenant_users",
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
     * Search by full name or email.
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
     * Relationship-role filter.
     */
    query("relationship_role")
        .optional()

        .isString()
        .withMessage(
            "Relationship role must be a string."
        )

        .isIn([
            "primary_contact",
            "authorized_representative",
            "accountant",
            "occupant",
            "viewer"
        ])
        .withMessage(
            "Invalid tenant-user relationship role."
        ),

    /*
     * Query parameters arrive as strings.
     * Only literal true and false are accepted.
     */
    query("is_primary")
        .optional()

        .isIn([
            "true",
            "false"
        ])
        .withMessage(
            "is_primary must be true or false."
        )

        .toBoolean(),

    query("can_view_leases")
        .optional()

        .isIn([
            "true",
            "false"
        ])
        .withMessage(
            "can_view_leases must be true or false."
        )

        .toBoolean(),

    query("can_view_finances")
        .optional()

        .isIn([
            "true",
            "false"
        ])
        .withMessage(
            "can_view_finances must be true or false."
        )

        .toBoolean(),

    query("can_make_payments")
        .optional()

        .isIn([
            "true",
            "false"
        ])
        .withMessage(
            "can_make_payments must be true or false."
        )

        .toBoolean(),

    query("can_submit_maintenance")
        .optional()

        .isIn([
            "true",
            "false"
        ])
        .withMessage(
            "can_submit_maintenance must be true or false."
        )

        .toBoolean(),

    query("can_manage_tenant_users")
        .optional()

        .isIn([
            "true",
            "false"
        ])
        .withMessage(
            "can_manage_tenant_users must be true or false."
        )

        .toBoolean(),

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
 * PATCH /api/tenants/:tenant_public_id/users/:link_public_id
 */
const updateTenantUserValidator = [

    /*
     * Tenant public identifier.
     */
    param("tenant_public_id")
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

    /*
     * Tenant-user relationship public identifier.
     */
    param("link_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Tenant-user link public ID is required."
        )

        .isString()
        .withMessage(
            "Tenant-user link public ID must be a string."
        )

        .trim()

        .isLength({
            min: 13,
            max: 50
        })
        .withMessage(
            "Tenant-user link public ID must contain between 13 and 50 characters."
        )

        .matches(
            /^tenant_user_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid tenant-user link public ID format."
        ),

    /*
     * Request body must be a plain JSON object.
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
     * Require at least one supported update field
     * and reject immutable/audit fields.
     */
    body()
        .custom(value => {
            const allowedFields = [
                "relationship_role",
                "is_primary",
                "can_view_leases",
                "can_view_finances",
                "can_make_payments",
                "can_submit_maintenance",
                "can_manage_tenant_users"
            ];

            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length === 0) {
                throw new Error(
                    "At least one tenant-user field must be supplied."
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
     * Optional relationship-role update.
     */
    body("relationship_role")
        .optional()

        .isString()
        .withMessage(
            "Relationship role must be a string."
        )

        .isIn([
            "primary_contact",
            "authorized_representative",
            "accountant",
            "occupant",
            "viewer"
        ])
        .withMessage(
            "Invalid tenant-user relationship role."
        ),

    /*
     * Boolean values must be actual JSON Booleans.
     * Strings and numbers are not converted.
     */
    body("is_primary")
        .optional()

        .custom(value => {
            if (typeof value !== "boolean") {
                throw new Error(
                    "is_primary must be a boolean."
                );
            }

            return true;
        }),

    body("can_view_leases")
        .optional()

        .custom(value => {
            if (typeof value !== "boolean") {
                throw new Error(
                    "can_view_leases must be a boolean."
                );
            }

            return true;
        }),

    body("can_view_finances")
        .optional()

        .custom(value => {
            if (typeof value !== "boolean") {
                throw new Error(
                    "can_view_finances must be a boolean."
                );
            }

            return true;
        }),

    body("can_make_payments")
        .optional()

        .custom(value => {
            if (typeof value !== "boolean") {
                throw new Error(
                    "can_make_payments must be a boolean."
                );
            }

            return true;
        }),

    body("can_submit_maintenance")
        .optional()

        .custom(value => {
            if (
                typeof value !== "boolean"
            ) {
                throw new Error(
                    "can_submit_maintenance must be a boolean."
                );
            }

            return true;
        }),

    body("can_manage_tenant_users")
        .optional()

        .custom(value => {
            if (
                typeof value !== "boolean"
            ) {
                throw new Error(
                    "can_manage_tenant_users must be a boolean."
                );
            }

            return true;
        })
];
/*
 * DELETE /api/tenants/:tenant_public_id/users/:link_public_id
 */
const revokeTenantUserValidator = [

    /*
     * Tenant public identifier.
     */
    param("tenant_public_id")
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

    /*
     * Tenant-user relationship public identifier.
     */
    param("link_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Tenant-user link public ID is required."
        )

        .isString()
        .withMessage(
            "Tenant-user link public ID must be a string."
        )

        .trim()

        .isLength({
            min: 13,
            max: 50
        })
        .withMessage(
            "Tenant-user link public ID must contain between 13 and 50 characters."
        )

        .matches(
            /^tenant_user_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid tenant-user link public ID format."
        ),

    /*
     * DELETE operation does not accept body fields.
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
                    "Request body is not allowed for this operation."
                );
            }

            const suppliedFields =
                Object.keys(value);

            if (suppliedFields.length > 0) {
                throw new Error(
                    "Request body is not allowed for this operation."
                );
            }

            return true;
        })
];
module.exports = {
    addTenantUserValidator,
    getTenantUsersValidator,
    updateTenantUserValidator,
    revokeTenantUserValidator
};
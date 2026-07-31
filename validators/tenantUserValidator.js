const {
    param,
    body
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

module.exports = {
    addTenantUserValidator
};
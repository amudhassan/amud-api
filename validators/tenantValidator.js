const {
    body,
    query,
    param
} = require("express-validator");

const createTenantValidator = [

    body()
        .custom(value => {
            const allowedFields = [
                "owner_public_id",
                "tenant_type",
                "display_name",
                "national_id",
                "passport_number",
                "registration_number",
                "tax_identification_number",
                "email",
                "phone_number",
                "alternative_phone",
                "address",
                "city",
                "region",
                "country",
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

    body("tenant_type")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Tenant type is required."
        )
        .isString()
        .withMessage(
            "Tenant type must be a string."
        )
        .trim()
        .toLowerCase()
        .isIn([
            "individual",
            "company",
            "government",
            "organization",
            "partnership"
        ])
        .withMessage(
            "Tenant type must be individual, company, government, organization or partnership."
        ),

    body("display_name")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Tenant display name is required."
        )
        .isString()
        .withMessage(
            "Tenant display name must be a string."
        )
        .trim()
        .isLength({
            min: 2,
            max: 200
        })
        .withMessage(
            "Tenant display name must contain between 2 and 200 characters."
        ),

    body("national_id")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "National ID must be a string."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "National ID cannot be empty."
        )
        .isLength({
            max: 100
        })
        .withMessage(
            "National ID cannot exceed 100 characters."
        ),

    body("passport_number")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Passport number must be a string."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Passport number cannot be empty."
        )
        .isLength({
            max: 100
        })
        .withMessage(
            "Passport number cannot exceed 100 characters."
        ),

    body("registration_number")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Registration number must be a string."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Registration number cannot be empty."
        )
        .isLength({
            max: 150
        })
        .withMessage(
            "Registration number cannot exceed 150 characters."
        ),

    body("tax_identification_number")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Tax identification number must be a string."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Tax identification number cannot be empty."
        )
        .isLength({
            max: 150
        })
        .withMessage(
            "Tax identification number cannot exceed 150 characters."
        ),

    body("email")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Email must be a string."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Email cannot be empty."
        )
        .isEmail()
        .withMessage(
            "Please provide a valid email address."
        )
        .isLength({
            max: 255
        })
        .withMessage(
            "Email cannot exceed 255 characters."
        )
        .normalizeEmail(),

    body("phone_number")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Phone number must be a string."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Phone number cannot be empty."
        )
        .isLength({
            min: 5,
            max: 50
        })
        .withMessage(
            "Phone number must contain between 5 and 50 characters."
        ),

    body("alternative_phone")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Alternative phone number must be a string."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Alternative phone number cannot be empty."
        )
        .isLength({
            min: 5,
            max: 50
        })
        .withMessage(
            "Alternative phone number must contain between 5 and 50 characters."
        ),

    body("address")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Address must be a string."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Address cannot be empty."
        ),

    body("city")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "City must be a string."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "City cannot be empty."
        )
        .isLength({
            max: 100
        })
        .withMessage(
            "City cannot exceed 100 characters."
        ),

    body("region")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Region must be a string."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Region cannot be empty."
        )
        .isLength({
            max: 100
        })
        .withMessage(
            "Region cannot exceed 100 characters."
        ),

    body("country")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Country must be a string."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Country cannot be empty."
        )
        .isLength({
            max: 100
        })
        .withMessage(
            "Country cannot exceed 100 characters."
        ),

    body("notes")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Notes must be a string."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Notes cannot be empty."
        )
];

/*
 * GET /api/tenants
 */
const getTenantsValidator = [

    query()
        .custom(value => {
            const allowedFields = [
                "owner_public_id",
                "search",
                "tenant_type",
                "status",
                "relationship_status",
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

    query("owner_public_id")
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

    query("search")
        .optional({
            checkFalsy: true
        })
        .isString()
        .withMessage(
            "Search value must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 200
        })
        .withMessage(
            "Search value must contain between 1 and 200 characters."
        ),

    query("tenant_type")
        .optional({
            checkFalsy: true
        })
        .isString()
        .withMessage(
            "Tenant type must be a string."
        )
        .trim()
        .toLowerCase()
        .isIn([
            "individual",
            "company",
            "government",
            "organization",
            "partnership"
        ])
        .withMessage(
            "Invalid tenant type."
        ),

    query("status")
        .optional({
            checkFalsy: true
        })
        .isString()
        .withMessage(
            "Tenant status must be a string."
        )
        .trim()
        .toLowerCase()
        .isIn([
            "prospective",
            "active",
            "inactive",
            "blocked"
        ])
        .withMessage(
            "Invalid tenant status."
        ),

    query("relationship_status")
        .optional({
            checkFalsy: true
        })
        .isString()
        .withMessage(
            "Relationship status must be a string."
        )
        .trim()
        .toLowerCase()
        .isIn([
            "active",
            "blocked"
        ])
        .withMessage(
            "Relationship status must be active or blocked."
        ),

    query("page")
        .optional({
            checkFalsy: true
        })
        .isInt({
            min: 1
        })
        .withMessage(
            "Page must be an integer greater than or equal to 1."
        )
        .toInt(),

    query("limit")
        .optional({
            checkFalsy: true
        })
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
 * GET /api/tenants/deleted
 */
const getDeletedTenantsValidator = [

    query()
        .custom(value => {
            const allowedFields = [
                "owner_public_id",
                "search",
                "tenant_type",
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
     * GET request does not accept body fields.
     */
    body()
        .custom(value => {
            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length > 0) {
                throw new Error(
                    "Deleted tenants request does not accept body fields."
                );
            }

            return true;
        }),

    query("owner_public_id")
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

    query("search")
        .optional()
        .isString()
        .withMessage(
            "Search must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 200
        })
        .withMessage(
            "Search must contain between 1 and 200 characters."
        ),

    query("tenant_type")
        .optional()
        .isString()
        .withMessage(
            "Tenant type must be a string."
        )
        .trim()
        .toLowerCase()
        .isIn([
            "individual",
            "company",
            "government",
            "organization",
            "partnership"
        ])
        .withMessage(
            "Invalid tenant type."
        ),

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
            "Limit must be between 1 and 100."
        )
        .toInt()
];

/*
 * GET /api/tenants/:tenant_public_id
 */
const getSingleTenantValidator = [

    /*
     * Query parameters zinazokubalika.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "owner_public_id"
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
     * Tenant public identifier kutoka URL parameter.
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
     * Owner context ni lazima kwa data isolation.
     */
    query("owner_public_id")
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
        )
];
/*
 * PATCH /api/tenants/:tenant_public_id
 */
const updateTenantValidator = [

    query()
        .custom(value => {
            const allowedFields = [
                "owner_public_id"
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

    param("tenant_public_id")
        .exists({ checkFalsy: true })
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

    query("owner_public_id")
        .exists({ checkFalsy: true })
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

    body()
        .custom(value => {
            const allowedFields = [
                "tenant_type",
                "display_name",
                "national_id",
                "passport_number",
                "registration_number",
                "tax_identification_number",
                "email",
                "phone_number",
                "alternative_phone",
                "address",
                "city",
                "region",
                "country"
            ];

            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length === 0) {
                throw new Error(
                    "At least one tenant field must be supplied."
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

    body("tenant_type")
        .optional()
        .isString()
        .withMessage(
            "Tenant type must be a string."
        )
        .trim()
        .toLowerCase()
        .isIn([
            "individual",
            "company",
            "government",
            "organization",
            "partnership"
        ])
        .withMessage(
            "Invalid tenant type."
        ),

    body("display_name")
        .optional()
        .isString()
        .withMessage(
            "Tenant display name must be a string."
        )
        .trim()
        .isLength({
            min: 2,
            max: 200
        })
        .withMessage(
            "Tenant display name must contain between 2 and 200 characters."
        ),

    body("national_id")
        .optional({ nullable: true })
        .isString()
        .withMessage(
            "National ID must be a string or null."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "National ID cannot be empty."
        )
        .isLength({ max: 100 })
        .withMessage(
            "National ID cannot exceed 100 characters."
        ),

    body("passport_number")
        .optional({ nullable: true })
        .isString()
        .withMessage(
            "Passport number must be a string or null."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Passport number cannot be empty."
        )
        .isLength({ max: 100 })
        .withMessage(
            "Passport number cannot exceed 100 characters."
        ),

    body("registration_number")
        .optional({ nullable: true })
        .isString()
        .withMessage(
            "Registration number must be a string or null."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Registration number cannot be empty."
        )
        .isLength({ max: 150 })
        .withMessage(
            "Registration number cannot exceed 150 characters."
        ),

    body("tax_identification_number")
        .optional({ nullable: true })
        .isString()
        .withMessage(
            "Tax identification number must be a string or null."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Tax identification number cannot be empty."
        )
        .isLength({ max: 150 })
        .withMessage(
            "Tax identification number cannot exceed 150 characters."
        ),

    body("email")
        .optional({ nullable: true })
        .isString()
        .withMessage(
            "Email must be a string or null."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Email cannot be empty."
        )
        .isEmail()
        .withMessage(
            "Please provide a valid email address."
        )
        .isLength({ max: 255 })
        .withMessage(
            "Email cannot exceed 255 characters."
        )
        .normalizeEmail(),

    body("phone_number")
        .optional({ nullable: true })
        .isString()
        .withMessage(
            "Phone number must be a string or null."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Phone number cannot be empty."
        )
        .isLength({
            min: 5,
            max: 50
        })
        .withMessage(
            "Phone number must contain between 5 and 50 characters."
        ),

    body("alternative_phone")
        .optional({ nullable: true })
        .isString()
        .withMessage(
            "Alternative phone number must be a string or null."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Alternative phone number cannot be empty."
        )
        .isLength({
            min: 5,
            max: 50
        })
        .withMessage(
            "Alternative phone number must contain between 5 and 50 characters."
        ),

    body("address")
        .optional({ nullable: true })
        .isString()
        .withMessage(
            "Address must be a string or null."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Address cannot be empty."
        ),

    body("city")
        .optional({ nullable: true })
        .isString()
        .withMessage(
            "City must be a string or null."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "City cannot be empty."
        )
        .isLength({ max: 100 })
        .withMessage(
            "City cannot exceed 100 characters."
        ),

    body("region")
        .optional({ nullable: true })
        .isString()
        .withMessage(
            "Region must be a string or null."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Region cannot be empty."
        )
        .isLength({ max: 100 })
        .withMessage(
            "Region cannot exceed 100 characters."
        ),

    body("country")
        .optional({ nullable: true })
        .isString()
        .withMessage(
            "Country must be a string or null."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Country cannot be empty."
        )
        .isLength({ max: 100 })
        .withMessage(
            "Country cannot exceed 100 characters."
        )
];

/*
 * PATCH /api/tenants/:tenant_public_id/activate
 */
const activateTenantValidator = [

    /*
     * owner_public_id is the only supported
     * query parameter.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "owner_public_id"
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

    query("owner_public_id")
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

    /*
     * Activation is system-controlled.
     */
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
        })
];


/*
 * PATCH /api/tenants/:tenant_public_id/block
 */
const blockTenantValidator = [

    /*
     * owner_public_id is the only supported
     * query parameter.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "owner_public_id"
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

    query("owner_public_id")
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

    /*
     * Block operation is system-controlled.
     */
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
        })
];


/*
 * PATCH /api/tenants/:tenant_public_id/unblock
 */
const unblockTenantValidator = [

    /*
     * owner_public_id is the only supported
     * query parameter.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "owner_public_id"
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

    query("owner_public_id")
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

    /*
     * Unblock operation is system-controlled.
     */
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
        })
];

/*
 * DELETE /api/tenants/:tenant_public_id
 */
const softDeleteTenantValidator = [

    /*
     * owner_public_id pekee ndiyo query
     * parameter inayokubalika.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "owner_public_id"
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

    query("owner_public_id")
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

    /*
     * Soft-delete operation haitumii request body.
     * Lifecycle values zinaamuliwa na system.
     */
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
        })
];
/*
 * PATCH /api/tenants/:tenant_public_id/restore
 */
const restoreTenantValidator = [

    /*
     * owner_public_id pekee ndiyo query
     * parameter inayokubalika.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "owner_public_id"
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

    query("owner_public_id")
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

    /*
     * Restore operation haihitaji body.
     * Status na deleted_at zinaamuliwa na system.
     */
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
        })
];


/*
 * PATCH /api/tenants/:tenant_public_id/relationship/block
 */
const blockOwnerTenantRelationshipValidator = [

    /*
     * owner_public_id is the only supported query parameter.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "owner_public_id"
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

    query("owner_public_id")
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

    /*
     * Relationship blocking is fully system-controlled.
     */
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
        })
];

/*
 * PATCH /api/tenants/:tenant_public_id/relationship/end
 */
const endOwnerTenantRelationshipValidator = [

    /*
     * owner_public_id is the only supported query parameter.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "owner_public_id"
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

    query("owner_public_id")
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

    /*
     * The lifecycle change is fully system-controlled.
     */
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
        })
];

module.exports = {
    createTenantValidator,
    getTenantsValidator,
    getDeletedTenantsValidator,
    getSingleTenantValidator,
    updateTenantValidator,
    activateTenantValidator,
    blockTenantValidator,
    unblockTenantValidator,
    softDeleteTenantValidator,
    restoreTenantValidator,
    blockOwnerTenantRelationshipValidator,
    endOwnerTenantRelationshipValidator
};
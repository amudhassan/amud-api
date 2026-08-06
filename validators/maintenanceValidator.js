const {
    body,
    param,
    query
} = require("express-validator");

/*
 * Supported request values.
 */
const maintenanceCategories = [
    "plumbing",
    "electrical",
    "appliance",
    "structural",
    "roofing",
    "painting",
    "doors_windows",
    "security",
    "water_supply",
    "sanitation",
    "pest_control",
    "internet_communication",
    "cleaning",
    "common_area",
    "other"
];

const maintenancePriorities = [
    "low",
    "medium",
    "high",
    "emergency"
];

const maintenanceImpactLevels = [
    "no_operational_impact",
    "partially_restricted",
    "uninhabitable"
];

const maintenanceAccessInstructions = [
    "contact_first",
    "tenant_must_be_present",
    "authorized_entry"
];

const maintenanceRequestScopes = [
    "unit",
    "property_common_area"
];

/*
 * Require a complete ISO 8601 timestamp with
 * both time and timezone information.
 */
const isFullIsoTimestamp = value => {
    if (typeof value !== "string") {
        return false;
    }

    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value
    );
};

/*
 * Admin creates requests through the owner-side
 * workflow when submission_context is omitted.
 */
const resolveSubmissionContext = req => {
    if (
        req.user &&
        req.user.role === "admin"
    ) {
        return req.body.submission_context ||
            "owner";
    }

    return req.body.submission_context;
};

/*
 * POST /api/maintenance/requests
 */
const createMaintenanceRequestValidator = [

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
                "submission_context",
                "owner_public_id",
                "property_public_id",
                "request_scope",
                "unit_public_id",
                "lease_public_id",
                "title",
                "description",
                "category",
                "priority",
                "impact_level",
                "location_details",
                "problem_started_at",
                "preferred_visit_at",
                "access_instruction",
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
                    `Unsupported fields: ${unsupportedFields.join(", ")}.`
                );
            }

            return true;
        }),

    /*
     * Regular users must state whether they are
     * submitting through owner or tenant access.
     */
    body("submission_context")
        .custom((value, { req }) => {
            if (
                req.user &&
                req.user.role === "admin" &&
                value === undefined
            ) {
                return true;
            }

            if (
                typeof value !== "string" ||
                value.trim().length === 0
            ) {
                throw new Error(
                    "Submission context is required."
                );
            }

            if (
                ![
                    "owner",
                    "tenant"
                ].includes(value.trim())
            ) {
                throw new Error(
                    "Submission context must be owner or tenant."
                );
            }

            if (
                req.user &&
                req.user.role === "admin" &&
                value.trim() !== "owner"
            ) {
                throw new Error(
                    "Admin maintenance requests must use owner submission context."
                );
            }

            return true;
        })
        .customSanitizer(value => {
            if (typeof value !== "string") {
                return value;
            }

            return value.trim();
        }),

    /*
     * Owner identifier is supplied only through
     * the owner-side workflow.
     */
    body("owner_public_id")
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

    /*
     * Property identifier is supplied only through
     * the owner-side workflow.
     */
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

    /*
     * Request scope is selected by owner-side
     * requests and derived for tenant requests.
     */
    body("request_scope")
        .optional()
        .isString()
        .withMessage(
            "Request scope must be a string."
        )
        .trim()
        .isIn(
            maintenanceRequestScopes
        )
        .withMessage(
            "Request scope must be unit or property_common_area."
        ),

    /*
     * Unit identifier for owner-side unit requests.
     */
    body("unit_public_id")
        .optional()
        .isString()
        .withMessage(
            "Unit public ID must be a string."
        )
        .trim()
        .isLength({
            min: 6,
            max: 50
        })
        .withMessage(
            "Unit public ID must contain between 6 and 50 characters."
        )
        .matches(
            /^unit_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid unit public ID format."
        ),

    /*
     * Tenant context requires an active lease.
     * Owner context may optionally link a unit request
     * to an active lease.
     */
    body("lease_public_id")
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

    /*
     * Validate context-dependent references and
     * request-scope combinations.
     */
    body()
        .custom((value, { req }) => {
            if (
                !value ||
                typeof value !== "object" ||
                Array.isArray(value)
            ) {
                return true;
            }

            const submissionContext =
                resolveSubmissionContext(req);

            if (submissionContext === "tenant") {
                const forbiddenTenantFields = [
                    "owner_public_id",
                    "property_public_id",
                    "request_scope",
                    "unit_public_id",
                    "currency_code"
                ].filter(
                    field =>
                        Object.prototype.hasOwnProperty.call(
                            value,
                            field
                        )
                );

                if (
                    forbiddenTenantFields.length > 0
                ) {
                    throw new Error(
                        `Tenant submissions cannot include: ${forbiddenTenantFields.join(", ")}.`
                    );
                }

                if (
                    typeof value.lease_public_id !==
                        "string" ||
                    value.lease_public_id
                        .trim().length === 0
                ) {
                    throw new Error(
                        "Lease public ID is required for tenant maintenance requests."
                    );
                }

                return true;
            }

            if (submissionContext === "owner") {
                if (
                    typeof value.owner_public_id !==
                        "string" ||
                    value.owner_public_id
                        .trim().length === 0
                ) {
                    throw new Error(
                        "Owner public ID is required for owner maintenance requests."
                    );
                }

                if (
                    typeof value.property_public_id !==
                        "string" ||
                    value.property_public_id
                        .trim().length === 0
                ) {
                    throw new Error(
                        "Property public ID is required for owner maintenance requests."
                    );
                }

                if (
                    !maintenanceRequestScopes.includes(
                        value.request_scope
                    )
                ) {
                    throw new Error(
                        "Request scope is required for owner maintenance requests."
                    );
                }

                if (value.request_scope === "unit") {
                    if (
                        typeof value.unit_public_id !==
                            "string" ||
                        value.unit_public_id
                            .trim().length === 0
                    ) {
                        throw new Error(
                            "Unit public ID is required for unit maintenance requests."
                        );
                    }

                    return true;
                }

                const forbiddenCommonAreaFields = [
                    "unit_public_id",
                    "lease_public_id"
                ].filter(
                    field =>
                        Object.prototype.hasOwnProperty.call(
                            value,
                            field
                        )
                );

                if (
                    forbiddenCommonAreaFields.length > 0
                ) {
                    throw new Error(
                        `Property common-area requests cannot include: ${forbiddenCommonAreaFields.join(", ")}.`
                    );
                }

                if (
                    typeof value.location_details !==
                        "string" ||
                    value.location_details
                        .trim().length === 0
                ) {
                    throw new Error(
                        "Location details are required for property common-area requests."
                    );
                }
            }

            return true;
        }),

    /*
     * Human-readable request title.
     */
    body("title")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance request title is required."
        )
        .isString()
        .withMessage(
            "Maintenance request title must be a string."
        )
        .trim()
        .isLength({
            min: 3,
            max: 255
        })
        .withMessage(
            "Maintenance request title must contain between 3 and 255 characters."
        ),

    /*
     * Full problem description.
     */
    body("description")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance request description is required."
        )
        .isString()
        .withMessage(
            "Maintenance request description must be a string."
        )
        .trim()
        .isLength({
            min: 10,
            max: 5000
        })
        .withMessage(
            "Maintenance request description must contain between 10 and 5000 characters."
        ),

    /*
     * Supported maintenance category.
     */
    body("category")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance category is required."
        )
        .isString()
        .withMessage(
            "Maintenance category must be a string."
        )
        .trim()
        .isIn(
            maintenanceCategories
        )
        .withMessage(
            "Invalid maintenance category."
        ),

    /*
     * Optional priority. Database default is medium.
     */
    body("priority")
        .optional()
        .isString()
        .withMessage(
            "Maintenance priority must be a string."
        )
        .trim()
        .isIn(
            maintenancePriorities
        )
        .withMessage(
            "Maintenance priority must be low, medium, high or emergency."
        ),

    /*
     * Optional impact level. Database default is
     * no_operational_impact.
     */
    body("impact_level")
        .optional()
        .isString()
        .withMessage(
            "Maintenance impact level must be a string."
        )
        .trim()
        .isIn(
            maintenanceImpactLevels
        )
        .withMessage(
            "Invalid maintenance impact level."
        ),

    /*
     * Optional precise location within the unit or
     * required common-area location description.
     */
    body("location_details")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Location details must be a string or null."
        )
        .trim()
        .notEmpty()
        .withMessage(
            "Location details cannot be blank."
        )
        .isLength({
            max: 500
        })
        .withMessage(
            "Location details cannot exceed 500 characters."
        ),

    /*
     * Optional time when the problem began. It cannot
     * be in the future.
     */
    body("problem_started_at")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Problem start date and time must be a string or null."
        )
        .trim()
        .isISO8601({
            strict: true,
            strictSeparator: true
        })
        .withMessage(
            "Problem start date and time must be a valid ISO 8601 timestamp."
        )
        .bail()
        .custom(value => {
            if (!isFullIsoTimestamp(value)) {
                throw new Error(
                    "Problem start date and time must include time and timezone information."
                );
            }

            return true;
        })
        .bail()
        .custom(value => {
            if (
                new Date(value).getTime() >
                    Date.now()
            ) {
                throw new Error(
                    "Problem start date and time cannot be in the future."
                );
            }

            return true;
        }),

    /*
     * Optional requested visit time. It must be later
     * than the current time.
     */
    body("preferred_visit_at")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Preferred visit date and time must be a string or null."
        )
        .trim()
        .isISO8601({
            strict: true,
            strictSeparator: true
        })
        .withMessage(
            "Preferred visit date and time must be a valid ISO 8601 timestamp."
        )
        .bail()
        .custom(value => {
            if (!isFullIsoTimestamp(value)) {
                throw new Error(
                    "Preferred visit date and time must include time and timezone information."
                );
            }

            return true;
        })
        .bail()
        .custom(value => {
            if (
                new Date(value).getTime() <=
                    Date.now()
            ) {
                throw new Error(
                    "Preferred visit date and time must be in the future."
                );
            }

            return true;
        }),

    /*
     * Optional property-access instruction.
     */
    body("access_instruction")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Access instruction must be a string or null."
        )
        .trim()
        .isIn(
            maintenanceAccessInstructions
        )
        .withMessage(
            "Invalid maintenance access instruction."
        ),

    /*
     * Owner/admin may select a currency. Tenant-linked
     * requests derive it from the lease.
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
        )
];


/*
 * Supported GET /api/maintenance/requests
 * filtering and ordering values.
 */
const maintenanceStatuses = [
    "reported",
    "under_review",
    "assigned",
    "in_progress",
    "on_hold",
    "resolved",
    "closed",
    "rejected",
    "cancelled"
];

const maintenanceRequestSources = [
    "manual",
    "preventive_schedule",
    "system_generated"
];

const maintenanceReporterTypes = [
    "admin",
    "owner_user",
    "tenant_user",
    "system"
];

const maintenanceSlaStatuses = [
    "overdue",
    "on_track",
    "review_overdue",
    "work_start_overdue",
    "resolution_overdue"
];

const maintenanceSortFields = [
    "reported_at",
    "updated_at",
    "priority",
    "target_review_at",
    "target_work_start_at",
    "target_resolution_at"
];

/*
 * GET /api/maintenance/requests
 */
const getMaintenanceRequestsValidator = [

    /*
     * Only documented query parameters are accepted.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "access_context",
                "search",
                "owner_public_id",
                "property_public_id",
                "unit_public_id",
                "tenant_public_id",
                "lease_public_id",
                "status",
                "priority",
                "category",
                "request_scope",
                "request_source",
                "impact_level",
                "reporter_type",
                "sla_status",
                "reported_from",
                "reported_to",
                "sort_by",
                "sort_order",
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
     * GET requests must not contain a request body.
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
        }),

    /*
     * Regular users must identify whether they are
     * reading through owner-side or tenant-side access.
     * Admin may omit this value.
     */
    query("access_context")
        .custom((value, { req }) => {
            if (
                req.user &&
                req.user.role === "admin" &&
                value === undefined
            ) {
                return true;
            }

            if (
                typeof value !== "string" ||
                value.trim().length === 0
            ) {
                throw new Error(
                    "Access context is required."
                );
            }

            if (
                ![
                    "owner",
                    "tenant"
                ].includes(value.trim())
            ) {
                throw new Error(
                    "Access context must be owner or tenant."
                );
            }

            return true;
        })
        .customSanitizer(value => {
            if (typeof value !== "string") {
                return value;
            }

            return value.trim();
        }),

    /*
     * Case-insensitive free-text search.
     */
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

    /*
     * Optional relational public-ID filters.
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

    query("unit_public_id")
        .optional()
        .isString()
        .withMessage(
            "Unit public ID must be a string."
        )
        .trim()
        .isLength({
            min: 6,
            max: 50
        })
        .withMessage(
            "Unit public ID must contain between 6 and 50 characters."
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

    /*
     * Lifecycle and classification filters.
     */
    query("status")
        .optional()
        .isString()
        .withMessage(
            "Maintenance status must be a string."
        )
        .trim()
        .isIn(
            maintenanceStatuses
        )
        .withMessage(
            "Invalid maintenance status."
        ),

    query("priority")
        .optional()
        .isString()
        .withMessage(
            "Maintenance priority must be a string."
        )
        .trim()
        .isIn(
            maintenancePriorities
        )
        .withMessage(
            "Maintenance priority must be low, medium, high or emergency."
        ),

    query("category")
        .optional()
        .isString()
        .withMessage(
            "Maintenance category must be a string."
        )
        .trim()
        .isIn(
            maintenanceCategories
        )
        .withMessage(
            "Invalid maintenance category."
        ),

    query("request_scope")
        .optional()
        .isString()
        .withMessage(
            "Request scope must be a string."
        )
        .trim()
        .isIn(
            maintenanceRequestScopes
        )
        .withMessage(
            "Request scope must be unit or property_common_area."
        ),

    query("request_source")
        .optional()
        .isString()
        .withMessage(
            "Request source must be a string."
        )
        .trim()
        .isIn(
            maintenanceRequestSources
        )
        .withMessage(
            "Request source must be manual, preventive_schedule or system_generated."
        ),

    query("impact_level")
        .optional()
        .isString()
        .withMessage(
            "Impact level must be a string."
        )
        .trim()
        .isIn(
            maintenanceImpactLevels
        )
        .withMessage(
            "Invalid maintenance impact level."
        ),

    query("reporter_type")
        .optional()
        .isString()
        .withMessage(
            "Reporter type must be a string."
        )
        .trim()
        .isIn(
            maintenanceReporterTypes
        )
        .withMessage(
            "Reporter type must be admin, owner_user, tenant_user or system."
        ),

    query("sla_status")
        .optional()
        .isString()
        .withMessage(
            "SLA status must be a string."
        )
        .trim()
        .isIn(
            maintenanceSlaStatuses
        )
        .withMessage(
            "Invalid maintenance SLA status."
        ),

    /*
     * Optional report-time boundaries. Both require
     * a complete ISO 8601 timestamp and timezone.
     */
    query("reported_from")
        .optional()
        .isString()
        .withMessage(
            "Reported-from date and time must be a string."
        )
        .trim()
        .isISO8601({
            strict: true,
            strictSeparator: true
        })
        .withMessage(
            "Reported-from date and time must be a valid ISO 8601 timestamp."
        )
        .bail()
        .custom(value => {
            if (!isFullIsoTimestamp(value)) {
                throw new Error(
                    "Reported-from date and time must include time and timezone information."
                );
            }

            return true;
        }),

    query("reported_to")
        .optional()
        .isString()
        .withMessage(
            "Reported-to date and time must be a string."
        )
        .trim()
        .isISO8601({
            strict: true,
            strictSeparator: true
        })
        .withMessage(
            "Reported-to date and time must be a valid ISO 8601 timestamp."
        )
        .bail()
        .custom(value => {
            if (!isFullIsoTimestamp(value)) {
                throw new Error(
                    "Reported-to date and time must include time and timezone information."
                );
            }

            return true;
        }),

    /*
     * The beginning of the report window cannot be
     * later than its ending.
     */
    query()
        .custom(value => {
            if (
                !value ||
                typeof value !== "object"
            ) {
                return true;
            }

            const {
                reported_from,
                reported_to
            } = value;

            if (
                typeof reported_from !== "string" ||
                typeof reported_to !== "string" ||
                !isFullIsoTimestamp(reported_from) ||
                !isFullIsoTimestamp(reported_to)
            ) {
                return true;
            }

            if (
                new Date(reported_from).getTime() >
                    new Date(reported_to).getTime()
            ) {
                throw new Error(
                    "Reported-from date and time cannot be after reported-to date and time."
                );
            }

            return true;
        }),

    /*
     * Ordering uses a fixed whitelist in the service.
     */
    query("sort_by")
        .optional()
        .isString()
        .withMessage(
            "Sort field must be a string."
        )
        .trim()
        .isIn(
            maintenanceSortFields
        )
        .withMessage(
            "Invalid maintenance request sort field."
        ),

    query("sort_order")
        .optional()
        .isString()
        .withMessage(
            "Sort order must be a string."
        )
        .trim()
        .isIn([
            "asc",
            "desc"
        ])
        .withMessage(
            "Sort order must be asc or desc."
        ),

    /*
     * Pagination defaults are applied by the service.
     */
    query("page")
        .optional()
        .isInt({
            min: 1,
            max: 1000000
        })
        .withMessage(
            "Page must be an integer between 1 and 1000000."
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
 * GET /api/maintenance/requests/:maintenance_request_public_id
 */
const getSingleMaintenanceRequestValidator = [

    /*
     * Only access_context is accepted as a query parameter.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "access_context"
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
     * GET requests must not contain a request body.
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
        }),

    /*
     * Public identifier of the maintenance request.
     */
    param("maintenance_request_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance request public ID is required."
        )
        .isString()
        .withMessage(
            "Maintenance request public ID must be a string."
        )
        .trim()
        .isLength({
            min: 13,
            max: 50
        })
        .withMessage(
            "Maintenance request public ID must contain between 13 and 50 characters."
        )
        .matches(
            /^maintenance_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid maintenance request public ID format."
        ),

    /*
     * Regular users must identify whether access is
     * through an owner or tenant relationship.
     * Admin may omit the context.
     */
    query("access_context")
        .custom((value, { req }) => {
            if (
                req.user &&
                req.user.role === "admin" &&
                value === undefined
            ) {
                return true;
            }

            if (
                typeof value !== "string" ||
                value.trim().length === 0
            ) {
                throw new Error(
                    "Access context is required."
                );
            }

            if (
                ![
                    "owner",
                    "tenant"
                ].includes(value.trim())
            ) {
                throw new Error(
                    "Access context must be owner or tenant."
                );
            }

            return true;
        })
        .customSanitizer(value => {
            if (typeof value !== "string") {
                return value;
            }

            return value.trim();
        })
];


/*
 * PATCH
 * /api/maintenance/requests/:maintenance_request_public_id/status
 */
const changeMaintenanceRequestStatusValidator = [

    /*
     * Only access_context is accepted in the query string.
     */
    query()
        .custom(value => {
            const allowedFields = [
                "access_context"
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
     * Only the optimistic-lock status, target status and
     * transition reason may be supplied.
     */
    body()
        .custom(value => {
            const allowedFields = [
                "expected_status",
                "status",
                "reason"
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
                    `Unsupported request fields: ${unsupportedFields.join(", ")}.`
                );
            }

            return true;
        }),

    /*
     * Public maintenance request identifier.
     */
    param("maintenance_request_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance request public ID is required."
        )
        .isString()
        .withMessage(
            "Maintenance request public ID must be a string."
        )
        .trim()
        .isLength({
            min: 13,
            max: 50
        })
        .withMessage(
            "Maintenance request public ID must contain between 13 and 50 characters."
        )
        .matches(
            /^maintenance_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid maintenance request public ID format."
        ),

    /*
     * Admin may omit access_context. A regular user may only
     * perform this operation through an owner relationship.
     */
    query("access_context")
        .custom((value, { req }) => {
            if (
                req.user &&
                req.user.role === "admin" &&
                value === undefined
            ) {
                return true;
            }

            if (
                typeof value !== "string" ||
                value.trim().length === 0
            ) {
                throw new Error(
                    "Access context is required."
                );
            }

            if (value.trim() !== "owner") {
                throw new Error(
                    "Access context must be owner."
                );
            }

            return true;
        })
        .customSanitizer(value => {
            if (typeof value !== "string") {
                return value;
            }

            return value.trim();
        }),

    /*
     * Current status expected by the caller. This is used for
     * optimistic concurrency protection.
     */
    body("expected_status")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Expected maintenance status is required."
        )
        .isString()
        .withMessage(
            "Expected maintenance status must be a string."
        )
        .trim()
        .isIn([
            "reported",
            "under_review",
            "assigned",
            "in_progress",
            "on_hold",
            "resolved",
            "closed",
            "rejected",
            "cancelled"
        ])
        .withMessage(
            "Invalid expected maintenance status."
        ),

    /*
     * Direct lifecycle target. Assignment, resolution,
     * closure and reopening use their dedicated APIs.
     */
    body("status")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "New maintenance status is required."
        )
        .isString()
        .withMessage(
            "New maintenance status must be a string."
        )
        .trim()
        .isIn([
            "under_review",
            "in_progress",
            "on_hold",
            "rejected",
            "cancelled"
        ])
        .withMessage(
            "This maintenance status must be changed through its dedicated API."
        )
        .custom((value, { req }) => {
            const expectedStatus =
                typeof req.body.expected_status ===
                    "string"
                    ? req.body.expected_status.trim()
                    : null;

            if (!expectedStatus) {
                return true;
            }

            if (expectedStatus === value) {
                throw new Error(
                    "New maintenance status must differ from the expected status."
                );
            }

            const allowedTransitions = {
                reported: [
                    "under_review",
                    "rejected",
                    "cancelled"
                ],

                under_review: [
                    "in_progress",
                    "rejected",
                    "cancelled"
                ],

                assigned: [
                    "in_progress",
                    "cancelled"
                ],

                in_progress: [
                    "on_hold"
                ],

                on_hold: [
                    "in_progress",
                    "cancelled"
                ],

                resolved: [
                    "in_progress"
                ]
            };

            if (
                !allowedTransitions[
                    expectedStatus
                ] ||
                !allowedTransitions[
                    expectedStatus
                ].includes(value)
            ) {
                throw new Error(
                    `Invalid direct maintenance status transition from ${expectedStatus} to ${value}.`
                );
            }

            return true;
        }),

    /*
     * Human-readable audit reason for the transition.
     */
    body("reason")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance status change reason is required."
        )
        .isString()
        .withMessage(
            "Maintenance status change reason must be a string."
        )
        .trim()
        .isLength({
            min: 5,
            max: 2000
        })
        .withMessage(
            "Maintenance status change reason must contain between 5 and 2000 characters."
        )
];

module.exports = {
    createMaintenanceRequestValidator,
    getMaintenanceRequestsValidator,
    getSingleMaintenanceRequestValidator,
    changeMaintenanceRequestStatusValidator
};

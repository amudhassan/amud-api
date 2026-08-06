const {
    body,
    param,
    query
} = require("express-validator");

/*
 * Shared maintenance request values.
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

const maintenanceActivityTypes = [
    "request_created",
    "request_updated",
    "status_changed",
    "assignment_created",
    "assignment_changed",
    "assignment_declined",
    "assignment_revoked",
    "visit_scheduled",
    "visit_rescheduled",
    "visit_started",
    "visit_completed",
    "visit_missed",
    "visit_cancelled",
    "cost_created",
    "cost_submitted",
    "cost_approved",
    "cost_rejected",
    "cost_cancelled",
    "cost_incurred",
    "responsibility_determined",
    "responsibility_allocated",
    "attachment_added",
    "attachment_revoked",
    "comment_added",
    "comment_hidden",
    "request_resolved",
    "resolution_confirmed",
    "resolution_disputed",
    "request_closed",
    "request_cancelled",
    "request_rejected",
    "request_reopened",
    "unit_status_applied",
    "unit_status_released",
    "sla_target_changed",
    "maintenance_overdue",
    "emergency_escalated",
    "preventive_request_created"
];

/*
 * Require a complete ISO 8601 timestamp with both time and
 * timezone information.
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
 * Strictly reject undocumented query parameters.
 */
const strictQueryValidator = allowedFields =>
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

/*
 * Require a JSON object and reject undocumented body fields.
 */
const strictBodyValidator = allowedFields => [
    body().custom(value => {
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

    body().custom(value => {
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
    })
];

/*
 * GET operations must not contain a request body.
 */
const noRequestBodyValidator = () =>
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

/*
 * Public maintenance request identifier.
 */
const maintenanceRequestPublicIdValidator = () =>
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
        );

/*
 * Read access supports owner, tenant and assigned technician
 * contexts. Admin may omit access_context.
 */
const readAccessContextValidator = () =>
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
                    "tenant",
                    "technician"
                ].includes(value.trim())
            ) {
                throw new Error(
                    "Access context must be owner, tenant or technician."
                );
            }

            return true;
        })
        .customSanitizer(value => {
            if (typeof value !== "string") {
                return value;
            }

            return value.trim();
        });

/*
 * Owner-side mutations require access_context=owner for every
 * non-admin user. Admin may omit the context.
 */
const ownerMutationAccessContextValidator = () =>
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
                    "This maintenance operation requires owner access context."
                );
            }

            return true;
        })
        .customSanitizer(value => {
            if (typeof value !== "string") {
                return value;
            }

            return value.trim();
        });

/*
 * Complete ISO timestamp validator used for optimistic
 * concurrency and history boundaries.
 */
const requiredTimestampValidator = ({
    location,
    field,
    label
}) => {
    const validator =
        location === "query"
            ? query(field)
            : body(field);

    return validator
        .exists({
            checkFalsy: true
        })
        .withMessage(
            `${label} is required.`
        )
        .isString()
        .withMessage(
            `${label} must be a string.`
        )
        .trim()
        .isISO8601({
            strict: true,
            strictSeparator: true
        })
        .withMessage(
            `${label} must be a valid ISO 8601 timestamp.`
        )
        .bail()
        .custom(value => {
            if (!isFullIsoTimestamp(value)) {
                throw new Error(
                    `${label} must include time and timezone information.`
                );
            }

            return true;
        });
};

const optionalTimestampValidator = ({
    location,
    field,
    label,
    nullable = false
}) => {
    const validator =
        location === "query"
            ? query(field)
            : body(field);

    return validator
        .optional({
            nullable
        })
        .isString()
        .withMessage(
            `${label} must be a string${nullable ? " or null" : ""}.`
        )
        .trim()
        .isISO8601({
            strict: true,
            strictSeparator: true
        })
        .withMessage(
            `${label} must be a valid ISO 8601 timestamp.`
        )
        .bail()
        .custom(value => {
            if (!isFullIsoTimestamp(value)) {
                throw new Error(
                    `${label} must include time and timezone information.`
                );
            }

            return true;
        });
};

/*
 * Shared audit-reason validation.
 */
const reasonValidator = label =>
    body("reason")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            `${label} reason is required.`
        )
        .isString()
        .withMessage(
            `${label} reason must be a string.`
        )
        .trim()
        .isLength({
            min: 5,
            max: 2000
        })
        .withMessage(
            `${label} reason must contain between 5 and 2000 characters.`
        );

/*
 * Shared pagination validators.
 */
const paginationValidators = () => [
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
 * PATCH /api/maintenance/requests/:maintenance_request_public_id
 */
const updateMaintenanceRequestDetailsValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_updated_at",
        "title",
        "description",
        "category",
        "priority",
        "impact_level",
        "location_details",
        "problem_started_at",
        "preferred_visit_at",
        "access_instruction",
        "reason"
    ]),

    maintenanceRequestPublicIdValidator(),
    ownerMutationAccessContextValidator(),

    requiredTimestampValidator({
        location: "body",
        field: "expected_updated_at",
        label: "Expected maintenance request update timestamp"
    }),

    body().custom(value => {
        const editableFields = [
            "title",
            "description",
            "category",
            "priority",
            "impact_level",
            "location_details",
            "problem_started_at",
            "preferred_visit_at",
            "access_instruction"
        ];

        const suppliedEditableFields =
            editableFields.filter(
                field =>
                    Object.prototype.hasOwnProperty.call(
                        value || {},
                        field
                    )
            );

        if (suppliedEditableFields.length === 0) {
            throw new Error(
                "At least one editable maintenance request field must be supplied."
            );
        }

        return true;
    }),

    body("title")
        .optional()
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

    body("description")
        .optional()
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

    body("category")
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

    optionalTimestampValidator({
        location: "body",
        field: "problem_started_at",
        label: "Problem start date and time",
        nullable: true
    })
        .bail()
        .custom(value => {
            if (
                value !== null &&
                new Date(value).getTime() >
                    Date.now()
            ) {
                throw new Error(
                    "Problem start date and time cannot be in the future."
                );
            }

            return true;
        }),

    optionalTimestampValidator({
        location: "body",
        field: "preferred_visit_at",
        label: "Preferred visit date and time",
        nullable: true
    })
        .bail()
        .custom(value => {
            if (
                value !== null &&
                new Date(value).getTime() <=
                    Date.now()
            ) {
                throw new Error(
                    "Preferred visit date and time must be in the future."
                );
            }

            return true;
        }),

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

    body().custom(value => {
        if (
            typeof value.problem_started_at ===
                "string" &&
            typeof value.preferred_visit_at ===
                "string" &&
            new Date(
                value.problem_started_at
            ).getTime() >=
                new Date(
                    value.preferred_visit_at
                ).getTime()
        ) {
            throw new Error(
                "Preferred visit date and time must be after the problem start date and time."
            );
        }

        return true;
    }),

    reasonValidator(
        "Maintenance request update"
    )
];

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/status-history
 */
const getMaintenanceStatusHistoryValidator = [
    strictQueryValidator([
        "access_context",
        "old_status",
        "new_status",
        "changed_from",
        "changed_to",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    readAccessContextValidator(),

    query("old_status")
        .optional()
        .isString()
        .withMessage(
            "Old maintenance status must be a string."
        )
        .trim()
        .isIn(
            maintenanceStatuses
        )
        .withMessage(
            "Invalid old maintenance status."
        ),

    query("new_status")
        .optional()
        .isString()
        .withMessage(
            "New maintenance status must be a string."
        )
        .trim()
        .isIn(
            maintenanceStatuses
        )
        .withMessage(
            "Invalid new maintenance status."
        ),

    optionalTimestampValidator({
        location: "query",
        field: "changed_from",
        label: "Changed-from date and time"
    }),

    optionalTimestampValidator({
        location: "query",
        field: "changed_to",
        label: "Changed-to date and time"
    }),

    query().custom(value => {
        if (
            value.changed_from &&
            value.changed_to &&
            new Date(
                value.changed_from
            ).getTime() >
                new Date(
                    value.changed_to
                ).getTime()
        ) {
            throw new Error(
                "Changed-from date and time cannot be after changed-to date and time."
            );
        }

        return true;
    }),

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

    ...paginationValidators()
];

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/activity-history
 */
const getMaintenanceActivityHistoryValidator = [
    strictQueryValidator([
        "access_context",
        "activity_type",
        "created_from",
        "created_to",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    readAccessContextValidator(),

    query("activity_type")
        .optional()
        .isString()
        .withMessage(
            "Maintenance activity type must be a string."
        )
        .trim()
        .isIn(
            maintenanceActivityTypes
        )
        .withMessage(
            "Invalid maintenance activity type."
        ),

    optionalTimestampValidator({
        location: "query",
        field: "created_from",
        label: "Created-from date and time"
    }),

    optionalTimestampValidator({
        location: "query",
        field: "created_to",
        label: "Created-to date and time"
    }),

    query().custom(value => {
        if (
            value.created_from &&
            value.created_to &&
            new Date(
                value.created_from
            ).getTime() >
                new Date(
                    value.created_to
                ).getTime()
        ) {
            throw new Error(
                "Created-from date and time cannot be after created-to date and time."
            );
        }

        return true;
    }),

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

    ...paginationValidators()
];

/*
 * PATCH
 * /api/maintenance/requests/:maintenance_request_public_id/sla-targets
 */
const updateMaintenanceSlaTargetsValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_updated_at",
        "target_review_at",
        "target_work_start_at",
        "target_resolution_at",
        "reason"
    ]),

    maintenanceRequestPublicIdValidator(),
    ownerMutationAccessContextValidator(),

    requiredTimestampValidator({
        location: "body",
        field: "expected_updated_at",
        label: "Expected maintenance request update timestamp"
    }),

    body().custom(value => {
        const targetFields = [
            "target_review_at",
            "target_work_start_at",
            "target_resolution_at"
        ];

        const suppliedTargetFields =
            targetFields.filter(
                field =>
                    Object.prototype.hasOwnProperty.call(
                        value || {},
                        field
                    )
            );

        if (suppliedTargetFields.length === 0) {
            throw new Error(
                "At least one maintenance SLA target must be supplied."
            );
        }

        return true;
    }),

    optionalTimestampValidator({
        location: "body",
        field: "target_review_at",
        label: "Target review date and time"
    })
        .bail()
        .custom(value => {
            if (
                new Date(value).getTime() <=
                    Date.now()
            ) {
                throw new Error(
                    "Target review date and time must be in the future."
                );
            }

            return true;
        }),

    optionalTimestampValidator({
        location: "body",
        field: "target_work_start_at",
        label: "Target work-start date and time"
    })
        .bail()
        .custom(value => {
            if (
                new Date(value).getTime() <=
                    Date.now()
            ) {
                throw new Error(
                    "Target work-start date and time must be in the future."
                );
            }

            return true;
        }),

    optionalTimestampValidator({
        location: "body",
        field: "target_resolution_at",
        label: "Target resolution date and time"
    })
        .bail()
        .custom(value => {
            if (
                new Date(value).getTime() <=
                    Date.now()
            ) {
                throw new Error(
                    "Target resolution date and time must be in the future."
                );
            }

            return true;
        }),

    body().custom(value => {
        const reviewAt =
            value.target_review_at
                ? new Date(
                    value.target_review_at
                ).getTime()
                : null;

        const workStartAt =
            value.target_work_start_at
                ? new Date(
                    value.target_work_start_at
                ).getTime()
                : null;

        const resolutionAt =
            value.target_resolution_at
                ? new Date(
                    value.target_resolution_at
                ).getTime()
                : null;

        if (
            reviewAt !== null &&
            workStartAt !== null &&
            reviewAt > workStartAt
        ) {
            throw new Error(
                "Target review date and time cannot be after target work-start date and time."
            );
        }

        if (
            workStartAt !== null &&
            resolutionAt !== null &&
            workStartAt > resolutionAt
        ) {
            throw new Error(
                "Target work-start date and time cannot be after target resolution date and time."
            );
        }

        if (
            reviewAt !== null &&
            resolutionAt !== null &&
            reviewAt > resolutionAt
        ) {
            throw new Error(
                "Target review date and time cannot be after target resolution date and time."
            );
        }

        return true;
    }),

    reasonValidator(
        "Maintenance SLA target change"
    )
];

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/escalate
 */
const escalateMaintenanceRequestValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_priority",
        "reason"
    ]),

    maintenanceRequestPublicIdValidator(),
    ownerMutationAccessContextValidator(),

    body("expected_priority")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Expected maintenance priority is required."
        )
        .isString()
        .withMessage(
            "Expected maintenance priority must be a string."
        )
        .trim()
        .isIn([
            "low",
            "medium",
            "high"
        ])
        .withMessage(
            "Expected maintenance priority must be low, medium or high."
        ),

    reasonValidator(
        "Maintenance escalation"
    )
];

/*
 * GET /api/maintenance/sla/overdue
 */
const getOverdueMaintenanceRequestsValidator = [
    strictQueryValidator([
        "access_context",
        "owner_public_id",
        "property_public_id",
        "unit_public_id",
        "status",
        "priority",
        "overdue_type",
        "sort_by",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),
    ownerMutationAccessContextValidator(),

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

    query("overdue_type")
        .optional()
        .isString()
        .withMessage(
            "Overdue type must be a string."
        )
        .trim()
        .isIn([
            "any",
            "review",
            "work_start",
            "resolution"
        ])
        .withMessage(
            "Overdue type must be any, review, work_start or resolution."
        ),

    query("sort_by")
        .optional()
        .isString()
        .withMessage(
            "Sort field must be a string."
        )
        .trim()
        .isIn([
            "reported_at",
            "priority",
            "target_review_at",
            "target_work_start_at",
            "target_resolution_at"
        ])
        .withMessage(
            "Invalid overdue maintenance sort field."
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

    ...paginationValidators()
];

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/unit-status-lock
 */
const applyMaintenanceUnitStatusLockValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "reason"
    ]),

    maintenanceRequestPublicIdValidator(),
    ownerMutationAccessContextValidator(),

    reasonValidator(
        "Maintenance unit-status lock"
    )
];

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/unit-status-lock/release
 */
const releaseMaintenanceUnitStatusLockValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "reason"
    ]),

    maintenanceRequestPublicIdValidator(),
    ownerMutationAccessContextValidator(),

    reasonValidator(
        "Maintenance unit-status lock release"
    )
];

module.exports = {
    updateMaintenanceRequestDetailsValidator,
    getMaintenanceStatusHistoryValidator,
    getMaintenanceActivityHistoryValidator,
    updateMaintenanceSlaTargetsValidator,
    escalateMaintenanceRequestValidator,
    getOverdueMaintenanceRequestsValidator,
    applyMaintenanceUnitStatusLockValidator,
    releaseMaintenanceUnitStatusLockValidator
};

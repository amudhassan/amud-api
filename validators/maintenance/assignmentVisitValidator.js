const {
    body,
    param,
    query
} = require("express-validator");

/*
 * Maintenance assignment and visit enum values mirror the
 * database constraints from maintenance migrations 023/027.
 */
const assignmentTypes = [
    "internal_technician",
    "external_vendor"
];

const assignmentStatuses = [
    "pending",
    "accepted",
    "declined",
    "active",
    "completed",
    "revoked"
];

const visitTypes = [
    "inspection",
    "repair",
    "follow_up",
    "completion_check",
    "other"
];

const visitStatuses = [
    "scheduled",
    "confirmed",
    "rescheduled",
    "in_progress",
    "completed",
    "missed",
    "cancelled"
];

const visitAccessInstructions = [
    "contact_first",
    "tenant_must_be_present",
    "authorized_entry"
];

const tenantConfirmationStatuses = [
    "not_required",
    "pending",
    "confirmed",
    "declined",
    "no_response"
];

const visitMissedReasons = [
    "tenant_unavailable",
    "technician_unavailable",
    "access_denied",
    "vendor_delay",
    "weather_or_emergency",
    "other"
];

const activeRequestStatuses = [
    "reported",
    "under_review",
    "assigned",
    "in_progress",
    "on_hold"
];

/*
 * Require a complete ISO 8601 timestamp containing time and
 * timezone information. PostgreSQL TIMESTAMPTZ values must
 * never depend on the server's local timezone.
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
 * Reject every undocumented query parameter.
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
 * Require a JSON object and reject every undocumented field.
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
 * GET operations must not contain request body fields.
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

const maintenanceAssignmentPublicIdValidator = () =>
    param("maintenance_assignment_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance assignment public ID is required."
        )
        .isString()
        .withMessage(
            "Maintenance assignment public ID must be a string."
        )
        .trim()
        .isLength({
            min: 31,
            max: 60
        })
        .withMessage(
            "Maintenance assignment public ID must contain between 31 and 60 characters."
        )
        .matches(
            /^maintenance_assignment_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid maintenance assignment public ID format."
        );

const maintenanceVisitPublicIdValidator = () =>
    param("maintenance_visit_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance visit public ID is required."
        )
        .isString()
        .withMessage(
            "Maintenance visit public ID must be a string."
        )
        .trim()
        .isLength({
            min: 26,
            max: 60
        })
        .withMessage(
            "Maintenance visit public ID must contain between 26 and 60 characters."
        )
        .matches(
            /^maintenance_visit_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid maintenance visit public ID format."
        );

const assignedUserPublicIdBodyValidator = () =>
    body("assigned_user_public_id")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Assigned user public ID must be a string."
        )
        .trim()
        .isLength({
            min: 8,
            max: 50
        })
        .withMessage(
            "Assigned user public ID must contain between 8 and 50 characters."
        )
        .matches(
            /^user_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid assigned user public ID format."
        );

const assignmentPublicIdBodyValidator = () =>
    body("assignment_public_id")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Assignment public ID must be a string."
        )
        .trim()
        .isLength({
            min: 31,
            max: 60
        })
        .withMessage(
            "Assignment public ID must contain between 31 and 60 characters."
        )
        .matches(
            /^maintenance_assignment_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid assignment public ID format."
        );

/*
 * Read endpoints permit owner, tenant and currently assigned
 * internal-technician contexts. Admin may omit the context.
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
 * Assignment/visit management through an owner relationship.
 * Admin may omit access_context.
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

            if (value !== "owner") {
                throw new Error(
                    "Owner access context is required for this operation."
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
 * Owner-side users and the currently assigned technician may
 * perform operational assignment/visit lifecycle actions.
 */
const workActorAccessContextValidator = () =>
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
                ![
                    "owner",
                    "technician"
                ].includes(value)
            ) {
                throw new Error(
                    "Access context must be owner or technician."
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
 * Tenant visit responses are restricted to the tenant context.
 * Admin retains full access and may omit access_context.
 */
const tenantResponseAccessContextValidator = () =>
    query("access_context")
        .custom((value, { req }) => {
            if (
                req.user &&
                req.user.role === "admin" &&
                value === undefined
            ) {
                return true;
            }

            if (value !== "tenant") {
                throw new Error(
                    "Tenant access context is required for this operation."
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

const expectedUpdatedAtValidator = (
    fieldName = "expected_updated_at",
    label = "Expected updated-at timestamp"
) =>
    body(fieldName)
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
        .custom(value => {
            if (!isFullIsoTimestamp(value)) {
                throw new Error(
                    `${label} must be a complete ISO 8601 timestamp with timezone.`
                );
            }

            return true;
        });

const optionalTimestampValidator = (
    fieldName,
    label
) =>
    body(fieldName)
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            `${label} must be a string.`
        )
        .trim()
        .custom(value => {
            if (!isFullIsoTimestamp(value)) {
                throw new Error(
                    `${label} must be a complete ISO 8601 timestamp with timezone.`
                );
            }

            return true;
        });

const requiredTimestampValidator = (
    fieldName,
    label
) =>
    body(fieldName)
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
        .custom(value => {
            if (!isFullIsoTimestamp(value)) {
                throw new Error(
                    `${label} must be a complete ISO 8601 timestamp with timezone.`
                );
            }

            return true;
        });

const requiredReasonValidator = (
    fieldName,
    label,
    maxLength = 2000
) =>
    body(fieldName)
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
        .isLength({
            min: 3,
            max: maxLength
        })
        .withMessage(
            `${label} must contain between 3 and ${maxLength} characters.`
        );

const optionalTextValidator = (
    fieldName,
    label,
    maxLength
) =>
    body(fieldName)
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            `${label} must be a string.`
        )
        .trim()
        .isLength({
            max: maxLength
        })
        .withMessage(
            `${label} cannot exceed ${maxLength} characters.`
        );

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

const queryTimestampValidator = (
    fieldName,
    label
) =>
    query(fieldName)
        .optional()
        .isString()
        .withMessage(
            `${label} must be a string.`
        )
        .trim()
        .custom(value => {
            if (!isFullIsoTimestamp(value)) {
                throw new Error(
                    `${label} must be a complete ISO 8601 timestamp with timezone.`
                );
            }

            return true;
        });

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/assignments
 */
const createMaintenanceAssignmentValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "assignment_type",
        "assigned_user_public_id",
        "vendor_name",
        "company_name",
        "contact_person",
        "phone_number",
        "email",
        "service_description",
        "assignment_notes"
    ]),

    maintenanceRequestPublicIdValidator(),
    ownerMutationAccessContextValidator(),

    body("expected_request_status")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Expected maintenance request status is required."
        )
        .isString()
        .withMessage(
            "Expected maintenance request status must be a string."
        )
        .trim()
        .equals("under_review")
        .withMessage(
            "A new assignment requires expected_request_status to be under_review."
        ),

    expectedUpdatedAtValidator(
        "expected_request_updated_at",
        "Expected maintenance request updated-at timestamp"
    ),

    body("assignment_type")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Assignment type is required."
        )
        .isString()
        .withMessage(
            "Assignment type must be a string."
        )
        .trim()
        .isIn(
            assignmentTypes
        )
        .withMessage(
            "Assignment type must be internal_technician or external_vendor."
        ),

    assignedUserPublicIdBodyValidator(),

    optionalTextValidator(
        "vendor_name",
        "Vendor name",
        255
    ),

    optionalTextValidator(
        "company_name",
        "Company name",
        255
    ),

    optionalTextValidator(
        "contact_person",
        "Contact person",
        255
    ),

    optionalTextValidator(
        "phone_number",
        "Phone number",
        50
    ),

    body("phone_number")
        .optional({
            nullable: true
        })
        .custom(value => {
            if (
                value.trim().length < 5 ||
                value.trim().length > 50
            ) {
                throw new Error(
                    "Phone number must contain between 5 and 50 characters."
                );
            }

            return true;
        }),

    body("email")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Email must be a string."
        )
        .trim()
        .isLength({
            max: 320
        })
        .withMessage(
            "Email cannot exceed 320 characters."
        )
        .isEmail()
        .withMessage(
            "Invalid assignment contact email."
        )
        .normalizeEmail(),

    optionalTextValidator(
        "service_description",
        "Service description",
        5000
    ),

    optionalTextValidator(
        "assignment_notes",
        "Assignment notes",
        5000
    ),

    body().custom(value => {
        const assignmentType =
            value.assignment_type;

        if (
            assignmentType ===
                "internal_technician"
        ) {
            if (
                typeof value
                    .assigned_user_public_id !==
                    "string" ||
                value
                    .assigned_user_public_id
                    .trim()
                    .length === 0
            ) {
                throw new Error(
                    "Assigned user public ID is required for an internal technician assignment."
                );
            }

            const vendorFields = [
                "vendor_name",
                "company_name",
                "contact_person",
                "phone_number",
                "email",
                "service_description"
            ];

            const suppliedVendorFields =
                vendorFields.filter(field =>
                    value[field] !== undefined &&
                    value[field] !== null
                );

            if (
                suppliedVendorFields.length > 0
            ) {
                throw new Error(
                    `Internal technician assignment cannot contain vendor fields: ${suppliedVendorFields.join(", ")}.`
                );
            }
        }

        if (
            assignmentType ===
                "external_vendor"
        ) {
            if (
                value
                    .assigned_user_public_id !==
                    undefined &&
                value
                    .assigned_user_public_id !==
                    null
            ) {
                throw new Error(
                    "External vendor assignment cannot contain assigned_user_public_id."
                );
            }

            if (
                typeof value.vendor_name !==
                    "string" ||
                value.vendor_name.trim().length === 0
            ) {
                throw new Error(
                    "Vendor name is required for an external vendor assignment."
                );
            }

            const hasPhone =
                typeof value.phone_number ===
                    "string" &&
                value.phone_number.trim().length > 0;

            const hasEmail =
                typeof value.email ===
                    "string" &&
                value.email.trim().length > 0;

            if (!hasPhone && !hasEmail) {
                throw new Error(
                    "External vendor assignment requires a phone number or email address."
                );
            }
        }

        return true;
    })
];

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id/assignments
 */
const getMaintenanceAssignmentsValidator = [
    strictQueryValidator([
        "access_context",
        "status",
        "assignment_type",
        "assigned_user_public_id",
        "assigned_from",
        "assigned_to",
        "sort_by",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    readAccessContextValidator(),

    query("status")
        .optional()
        .isString()
        .withMessage(
            "Assignment status must be a string."
        )
        .trim()
        .isIn(
            assignmentStatuses
        )
        .withMessage(
            "Invalid maintenance assignment status."
        ),

    query("assignment_type")
        .optional()
        .isString()
        .withMessage(
            "Assignment type must be a string."
        )
        .trim()
        .isIn(
            assignmentTypes
        )
        .withMessage(
            "Assignment type must be internal_technician or external_vendor."
        ),

    query("assigned_user_public_id")
        .optional()
        .isString()
        .withMessage(
            "Assigned user public ID must be a string."
        )
        .trim()
        .isLength({
            min: 8,
            max: 50
        })
        .withMessage(
            "Assigned user public ID must contain between 8 and 50 characters."
        )
        .matches(
            /^user_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid assigned user public ID format."
        ),

    queryTimestampValidator(
        "assigned_from",
        "Assigned-from timestamp"
    ),

    queryTimestampValidator(
        "assigned_to",
        "Assigned-to timestamp"
    ),

    query().custom(value => {
        if (
            value.assigned_from !== undefined &&
            value.assigned_to !== undefined &&
            new Date(value.assigned_from).getTime() >
                new Date(value.assigned_to).getTime()
        ) {
            throw new Error(
                "Assigned-from timestamp cannot be after assigned-to timestamp."
            );
        }

        return true;
    }),

    query("sort_by")
        .optional()
        .isString()
        .withMessage(
            "Sort field must be a string."
        )
        .trim()
        .isIn([
            "assigned_at",
            "updated_at",
            "status",
            "assignment_type"
        ])
        .withMessage(
            "Invalid maintenance assignment sort field."
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
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id
 */
const getSingleMaintenanceAssignmentValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    maintenanceAssignmentPublicIdValidator(),
    readAccessContextValidator()
];

const assignmentLifecycleBase = ({
    allowedFields,
    accessValidator,
    expectedStatuses
}) => [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_status",
        "expected_updated_at",
        ...allowedFields
    ]),

    maintenanceRequestPublicIdValidator(),
    maintenanceAssignmentPublicIdValidator(),
    accessValidator(),

    body("expected_status")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Expected assignment status is required."
        )
        .isString()
        .withMessage(
            "Expected assignment status must be a string."
        )
        .trim()
        .isIn(
            expectedStatuses
        )
        .withMessage(
            `Expected assignment status must be one of: ${expectedStatuses.join(", ")}.`
        ),

    expectedUpdatedAtValidator()
];

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/accept
 */
const acceptMaintenanceAssignmentValidator = [
    ...assignmentLifecycleBase({
        allowedFields: [
            "reason"
        ],
        accessValidator:
            workActorAccessContextValidator,
        expectedStatuses: [
            "pending"
        ]
    }),

    requiredReasonValidator(
        "reason",
        "Assignment acceptance reason"
    )
];

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/decline
 */
const declineMaintenanceAssignmentValidator = [
    ...assignmentLifecycleBase({
        allowedFields: [
            "decline_reason"
        ],
        accessValidator:
            workActorAccessContextValidator,
        expectedStatuses: [
            "pending"
        ]
    }),

    requiredReasonValidator(
        "decline_reason",
        "Assignment decline reason"
    )
];

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/activate
 */
const activateMaintenanceAssignmentValidator = [
    ...assignmentLifecycleBase({
        allowedFields: [
            "reason"
        ],
        accessValidator:
            workActorAccessContextValidator,
        expectedStatuses: [
            "pending",
            "accepted"
        ]
    }),

    requiredReasonValidator(
        "reason",
        "Assignment activation reason"
    )
];

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/complete
 */
const completeMaintenanceAssignmentValidator = [
    ...assignmentLifecycleBase({
        allowedFields: [
            "completion_notes"
        ],
        accessValidator:
            workActorAccessContextValidator,
        expectedStatuses: [
            "active"
        ]
    }),

    requiredReasonValidator(
        "completion_notes",
        "Assignment completion notes",
        5000
    )
];

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/revoke
 */
const revokeMaintenanceAssignmentValidator = [
    ...assignmentLifecycleBase({
        allowedFields: [
            "revocation_reason"
        ],
        accessValidator:
            ownerMutationAccessContextValidator,
        expectedStatuses: [
            "pending",
            "accepted",
            "active"
        ]
    }),

    requiredReasonValidator(
        "revocation_reason",
        "Assignment revocation reason"
    )
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/visits
 */
const createMaintenanceVisitValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "assignment_public_id",
        "visit_type",
        "scheduled_start_at",
        "scheduled_end_at",
        "visit_purpose",
        "access_instruction",
        "requires_tenant_confirmation"
    ]),

    maintenanceRequestPublicIdValidator(),
    workActorAccessContextValidator(),

    body("expected_request_status")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Expected maintenance request status is required."
        )
        .isString()
        .withMessage(
            "Expected maintenance request status must be a string."
        )
        .trim()
        .isIn(
            activeRequestStatuses
        )
        .withMessage(
            "Expected maintenance request status must be reported, under_review, assigned, in_progress or on_hold."
        ),

    expectedUpdatedAtValidator(
        "expected_request_updated_at",
        "Expected maintenance request updated-at timestamp"
    ),

    assignmentPublicIdBodyValidator(),

    body("visit_type")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Visit type is required."
        )
        .isString()
        .withMessage(
            "Visit type must be a string."
        )
        .trim()
        .isIn(
            visitTypes
        )
        .withMessage(
            "Visit type must be inspection, repair, follow_up, completion_check or other."
        ),

    requiredTimestampValidator(
        "scheduled_start_at",
        "Scheduled start timestamp"
    ),

    requiredTimestampValidator(
        "scheduled_end_at",
        "Scheduled end timestamp"
    ),

    requiredReasonValidator(
        "visit_purpose",
        "Visit purpose",
        5000
    ),

    body("access_instruction")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Access instruction must be a string."
        )
        .trim()
        .isIn(
            visitAccessInstructions
        )
        .withMessage(
            "Access instruction must be contact_first, tenant_must_be_present or authorized_entry."
        ),

    body("requires_tenant_confirmation")
        .exists()
        .withMessage(
            "requires_tenant_confirmation is required."
        )
        .isBoolean({
            strict: true
        })
        .withMessage(
            "requires_tenant_confirmation must be a boolean."
        )
        .toBoolean(),

    body().custom(value => {
        if (
            isFullIsoTimestamp(
                value.scheduled_start_at
            ) &&
            isFullIsoTimestamp(
                value.scheduled_end_at
            ) &&
            new Date(
                value.scheduled_end_at
            ).getTime() <=
                new Date(
                    value.scheduled_start_at
                ).getTime()
        ) {
            throw new Error(
                "Scheduled end timestamp must be after scheduled start timestamp."
            );
        }

        return true;
    })
];

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id/visits
 */
const getMaintenanceVisitsValidator = [
    strictQueryValidator([
        "access_context",
        "status",
        "visit_type",
        "tenant_confirmation_status",
        "assignment_public_id",
        "scheduled_from",
        "scheduled_to",
        "upcoming_only",
        "sort_by",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    readAccessContextValidator(),

    query("status")
        .optional()
        .isString()
        .withMessage(
            "Visit status must be a string."
        )
        .trim()
        .isIn(
            visitStatuses
        )
        .withMessage(
            "Invalid maintenance visit status."
        ),

    query("visit_type")
        .optional()
        .isString()
        .withMessage(
            "Visit type must be a string."
        )
        .trim()
        .isIn(
            visitTypes
        )
        .withMessage(
            "Invalid maintenance visit type."
        ),

    query("tenant_confirmation_status")
        .optional()
        .isString()
        .withMessage(
            "Tenant confirmation status must be a string."
        )
        .trim()
        .isIn(
            tenantConfirmationStatuses
        )
        .withMessage(
            "Invalid tenant confirmation status."
        ),

    query("assignment_public_id")
        .optional()
        .isString()
        .withMessage(
            "Assignment public ID must be a string."
        )
        .trim()
        .isLength({
            min: 31,
            max: 60
        })
        .withMessage(
            "Assignment public ID must contain between 31 and 60 characters."
        )
        .matches(
            /^maintenance_assignment_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid assignment public ID format."
        ),

    queryTimestampValidator(
        "scheduled_from",
        "Scheduled-from timestamp"
    ),

    queryTimestampValidator(
        "scheduled_to",
        "Scheduled-to timestamp"
    ),

    query("upcoming_only")
        .optional()
        .isBoolean({
            strict: true
        })
        .withMessage(
            "upcoming_only must be true or false."
        )
        .toBoolean(),

    query().custom(value => {
        if (
            value.scheduled_from !== undefined &&
            value.scheduled_to !== undefined &&
            new Date(value.scheduled_from).getTime() >
                new Date(value.scheduled_to).getTime()
        ) {
            throw new Error(
                "Scheduled-from timestamp cannot be after scheduled-to timestamp."
            );
        }

        return true;
    }),

    query("sort_by")
        .optional()
        .isString()
        .withMessage(
            "Sort field must be a string."
        )
        .trim()
        .isIn([
            "scheduled_start_at",
            "scheduled_end_at",
            "created_at",
            "updated_at",
            "status"
        ])
        .withMessage(
            "Invalid maintenance visit sort field."
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
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id
 */
const getSingleMaintenanceVisitValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    maintenanceVisitPublicIdValidator(),
    readAccessContextValidator()
];

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/respond
 */
const respondToMaintenanceVisitValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_status",
        "expected_tenant_confirmation_status",
        "expected_updated_at",
        "response",
        "note"
    ]),

    maintenanceRequestPublicIdValidator(),
    maintenanceVisitPublicIdValidator(),
    tenantResponseAccessContextValidator(),

    body("expected_status")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Expected visit status is required."
        )
        .isString()
        .withMessage(
            "Expected visit status must be a string."
        )
        .trim()
        .isIn([
            "scheduled",
            "confirmed",
            "rescheduled"
        ])
        .withMessage(
            "Expected visit status must be scheduled, confirmed or rescheduled."
        ),

    body("expected_tenant_confirmation_status")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Expected tenant confirmation status is required."
        )
        .isString()
        .withMessage(
            "Expected tenant confirmation status must be a string."
        )
        .trim()
        .isIn([
            "pending",
            "confirmed",
            "declined"
        ])
        .withMessage(
            "Expected tenant confirmation status must be pending, confirmed or declined."
        ),

    expectedUpdatedAtValidator(),

    body("response")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Tenant visit response is required."
        )
        .isString()
        .withMessage(
            "Tenant visit response must be a string."
        )
        .trim()
        .isIn([
            "confirmed",
            "declined"
        ])
        .withMessage(
            "Tenant visit response must be confirmed or declined."
        ),

    optionalTextValidator(
        "note",
        "Tenant confirmation note",
        2000
    ),

    body().custom(value => {
        if (
            value.response === "declined" &&
            (
                typeof value.note !== "string" ||
                value.note.trim().length < 3
            )
        ) {
            throw new Error(
                "A tenant confirmation note is required when declining a visit schedule."
            );
        }

        return true;
    })
];

const visitLifecycleBase = ({
    allowedFields,
    expectedStatuses,
    accessValidator =
        workActorAccessContextValidator
}) => [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_status",
        "expected_updated_at",
        ...allowedFields
    ]),

    maintenanceRequestPublicIdValidator(),
    maintenanceVisitPublicIdValidator(),
    accessValidator(),

    body("expected_status")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Expected visit status is required."
        )
        .isString()
        .withMessage(
            "Expected visit status must be a string."
        )
        .trim()
        .isIn(
            expectedStatuses
        )
        .withMessage(
            `Expected visit status must be one of: ${expectedStatuses.join(", ")}.`
        ),

    expectedUpdatedAtValidator()
];

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/reschedule
 */
const rescheduleMaintenanceVisitValidator = [
    ...visitLifecycleBase({
        allowedFields: [
            "scheduled_start_at",
            "scheduled_end_at",
            "reason"
        ],
        expectedStatuses: [
            "scheduled",
            "confirmed",
            "rescheduled"
        ]
    }),

    requiredTimestampValidator(
        "scheduled_start_at",
        "New scheduled start timestamp"
    ),

    requiredTimestampValidator(
        "scheduled_end_at",
        "New scheduled end timestamp"
    ),

    requiredReasonValidator(
        "reason",
        "Visit reschedule reason"
    ),

    body().custom(value => {
        if (
            isFullIsoTimestamp(
                value.scheduled_start_at
            ) &&
            isFullIsoTimestamp(
                value.scheduled_end_at
            ) &&
            new Date(
                value.scheduled_end_at
            ).getTime() <=
                new Date(
                    value.scheduled_start_at
                ).getTime()
        ) {
            throw new Error(
                "New scheduled end timestamp must be after new scheduled start timestamp."
            );
        }

        return true;
    })
];

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/start
 */
const startMaintenanceVisitValidator = [
    ...visitLifecycleBase({
        allowedFields: [
            "arrival_at",
            "reason"
        ],
        expectedStatuses: [
            "scheduled",
            "confirmed",
            "rescheduled"
        ]
    }),

    optionalTimestampValidator(
        "arrival_at",
        "Visit arrival timestamp"
    ),

    requiredReasonValidator(
        "reason",
        "Visit start reason"
    )
];

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/complete
 */
const completeMaintenanceVisitValidator = [
    ...visitLifecycleBase({
        allowedFields: [
            "departure_at",
            "completion_notes"
        ],
        expectedStatuses: [
            "in_progress"
        ]
    }),

    optionalTimestampValidator(
        "departure_at",
        "Visit departure timestamp"
    ),

    requiredReasonValidator(
        "completion_notes",
        "Visit completion notes",
        5000
    )
];

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/missed
 */
const markMaintenanceVisitMissedValidator = [
    ...visitLifecycleBase({
        allowedFields: [
            "missed_reason",
            "missed_notes",
            "reason"
        ],
        expectedStatuses: [
            "scheduled",
            "confirmed",
            "rescheduled"
        ]
    }),

    body("missed_reason")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Missed reason is required."
        )
        .isString()
        .withMessage(
            "Missed reason must be a string."
        )
        .trim()
        .isIn(
            visitMissedReasons
        )
        .withMessage(
            "Invalid maintenance visit missed reason."
        ),

    optionalTextValidator(
        "missed_notes",
        "Missed visit notes",
        5000
    ),

    requiredReasonValidator(
        "reason",
        "Visit missed audit reason"
    )
];

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/cancel
 */
const cancelMaintenanceVisitValidator = [
    ...visitLifecycleBase({
        allowedFields: [
            "cancellation_reason"
        ],
        expectedStatuses: [
            "scheduled",
            "confirmed",
            "rescheduled",
            "in_progress"
        ]
    }),

    requiredReasonValidator(
        "cancellation_reason",
        "Visit cancellation reason"
    )
];

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/history
 */
const getMaintenanceVisitHistoryValidator = [
    strictQueryValidator([
        "access_context",
        "new_status",
        "changed_from",
        "changed_to",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    maintenanceVisitPublicIdValidator(),
    readAccessContextValidator(),

    query("new_status")
        .optional()
        .isString()
        .withMessage(
            "New visit status must be a string."
        )
        .trim()
        .isIn(
            visitStatuses
        )
        .withMessage(
            "Invalid visit-history status filter."
        ),

    queryTimestampValidator(
        "changed_from",
        "Changed-from timestamp"
    ),

    queryTimestampValidator(
        "changed_to",
        "Changed-to timestamp"
    ),

    query().custom(value => {
        if (
            value.changed_from !== undefined &&
            value.changed_to !== undefined &&
            new Date(value.changed_from).getTime() >
                new Date(value.changed_to).getTime()
        ) {
            throw new Error(
                "Changed-from timestamp cannot be after changed-to timestamp."
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

module.exports = {
    createMaintenanceAssignmentValidator,
    getMaintenanceAssignmentsValidator,
    getSingleMaintenanceAssignmentValidator,
    acceptMaintenanceAssignmentValidator,
    declineMaintenanceAssignmentValidator,
    activateMaintenanceAssignmentValidator,
    completeMaintenanceAssignmentValidator,
    revokeMaintenanceAssignmentValidator,
    createMaintenanceVisitValidator,
    getMaintenanceVisitsValidator,
    getSingleMaintenanceVisitValidator,
    respondToMaintenanceVisitValidator,
    rescheduleMaintenanceVisitValidator,
    startMaintenanceVisitValidator,
    completeMaintenanceVisitValidator,
    markMaintenanceVisitMissedValidator,
    cancelMaintenanceVisitValidator,
    getMaintenanceVisitHistoryValidator
};

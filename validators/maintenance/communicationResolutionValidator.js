const {
    body,
    param,
    query
} = require("express-validator");

/*
 * Batch D — Communication and Resolution.
 *
 * Every enum, identifier and length boundary in this file
 * mirrors maintenance migrations 022, 025 and 027. The
 * service layer still performs authorization, ownership,
 * lifecycle and database-integrity checks.
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

const terminalMaintenanceStatuses = [
    "closed",
    "rejected",
    "cancelled"
];

const maintenanceCommentTypes = [
    "public_update",
    "internal_note",
    "tenant_message",
    "technician_update",
    "resolution_feedback"
];

const maintenanceVisibilityValues = [
    "internal",
    "tenant_visible",
    "technician_visible",
    "shared"
];

const maintenanceAttachmentTypes = [
    "problem_evidence",
    "quotation",
    "approval_document",
    "work_progress",
    "purchase_receipt",
    "vendor_invoice",
    "completion_evidence",
    "other"
];

const maintenanceAttachmentMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf"
];

const maintenanceResolutionConfirmationStatuses = [
    "pending",
    "confirmed",
    "disputed",
    "no_response",
    "not_required"
];

const maintenanceReopenStatuses = [
    "pending",
    "approved",
    "rejected",
    "cancelled"
];

const maintenanceReopenTargetStatuses = [
    "reported",
    "under_review"
];

const isFullIsoTimestamp = value => {
    if (typeof value !== "string") {
        return false;
    }

    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value
    );
};

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

const maintenanceCommentPublicIdValidator = () =>
    param("maintenance_comment_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance comment public ID is required."
        )
        .isString()
        .withMessage(
            "Maintenance comment public ID must be a string."
        )
        .trim()
        .isLength({
            min: 21,
            max: 70
        })
        .withMessage(
            "Maintenance comment public ID must contain between 21 and 70 characters."
        )
        .matches(
            /^maintenance_comment_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid maintenance comment public ID format."
        );

const maintenanceAttachmentPublicIdValidator = () =>
    param("maintenance_attachment_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance attachment public ID is required."
        )
        .isString()
        .withMessage(
            "Maintenance attachment public ID must be a string."
        )
        .trim()
        .isLength({
            min: 24,
            max: 80
        })
        .withMessage(
            "Maintenance attachment public ID must contain between 24 and 80 characters."
        )
        .matches(
            /^maintenance_attachment_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid maintenance attachment public ID format."
        );

const maintenanceResolutionPublicIdValidator = () =>
    param("maintenance_resolution_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance resolution public ID is required."
        )
        .isString()
        .withMessage(
            "Maintenance resolution public ID must be a string."
        )
        .trim()
        .isLength({
            min: 24,
            max: 70
        })
        .withMessage(
            "Maintenance resolution public ID must contain between 24 and 70 characters."
        )
        .matches(
            /^maintenance_resolution_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid maintenance resolution public ID format."
        );

const maintenanceReopenPublicIdValidator = () =>
    param("maintenance_reopen_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance reopening public ID is required."
        )
        .isString()
        .withMessage(
            "Maintenance reopening public ID must be a string."
        )
        .trim()
        .isLength({
            min: 20,
            max: 50
        })
        .withMessage(
            "Maintenance reopening public ID must contain between 20 and 50 characters."
        )
        .matches(
            /^maintenance_reopen_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid maintenance reopening public ID format."
        );

const optionalContextPublicIdValidator = ({
    field,
    label,
    minimumLength,
    maximumLength,
    pattern
}) =>
    body(field)
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            `${label} must be a string or null.`
        )
        .trim()
        .notEmpty()
        .withMessage(
            `${label} cannot be blank.`
        )
        .isLength({
            min: minimumLength,
            max: maximumLength
        })
        .withMessage(
            `${label} must contain between ${minimumLength} and ${maximumLength} characters.`
        )
        .matches(pattern)
        .withMessage(
            `Invalid ${label.toLowerCase()} format.`
        );

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

const communicationMutationAccessContextValidator = () =>
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
                    "Communication access context must be owner, tenant or technician."
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

const tenantMutationAccessContextValidator = () =>
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

            if (value.trim() !== "tenant") {
                throw new Error(
                    "This resolution response requires tenant access context."
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

const workMutationAccessContextValidator = () =>
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
                    "technician"
                ].includes(value.trim())
            ) {
                throw new Error(
                    "This maintenance work operation requires owner or technician access context."
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

const reopenRequestAccessContextValidator = () =>
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
                    "A reopening request requires owner or tenant access context."
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

const requiredTimestampValidator = ({
    location = "body",
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
    location = "body",
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

const requiredReasonValidator = ({
    field,
    label,
    minimumLength = 5,
    maximumLength = 2000
}) =>
    body(field)
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
            min: minimumLength,
            max: maximumLength
        })
        .withMessage(
            `${label} must contain between ${minimumLength} and ${maximumLength} characters.`
        );

const optionalTextValidator = ({
    field,
    label,
    maximumLength = 5000,
    nullable = true
}) =>
    body(field)
        .optional({
            nullable
        })
        .isString()
        .withMessage(
            `${label} must be a string${nullable ? " or null" : ""}.`
        )
        .trim()
        .notEmpty()
        .withMessage(
            `${label} cannot be blank.`
        )
        .isLength({
            max: maximumLength
        })
        .withMessage(
            `${label} cannot exceed ${maximumLength} characters.`
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

const sortOrderValidator = () =>
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
        );

const dateRangeConsistencyValidator = ({
    fromField,
    toField,
    label
}) =>
    query().custom(value => {
        if (
            value[fromField] &&
            value[toField] &&
            new Date(value[fromField]).getTime() >
                new Date(value[toField]).getTime()
        ) {
            throw new Error(
                `${label} from date and time cannot be after its to date and time.`
            );
        }

        return true;
    });

const expectedRequestStateValidators = ({
    allowedStatuses = maintenanceStatuses
} = {}) => [
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
        .isIn(allowedStatuses)
        .withMessage(
            "Expected maintenance request status is invalid for this operation."
        ),

    requiredTimestampValidator({
        field: "expected_request_updated_at",
        label: "Expected maintenance request updated-at timestamp"
    })
];

const expectedResolutionPendingValidators = () => [
    body("expected_resolution_status")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Expected resolution confirmation status is required."
        )
        .isString()
        .withMessage(
            "Expected resolution confirmation status must be a string."
        )
        .trim()
        .equals("pending")
        .withMessage(
            "Expected resolution confirmation status must be pending."
        ),

    requiredTimestampValidator({
        field: "expected_resolution_submitted_at",
        label: "Expected maintenance resolution submitted-at timestamp"
    })
];

const expectedReopenPendingValidators = () => [
    body("expected_reopen_status")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Expected reopening status is required."
        )
        .isString()
        .withMessage(
            "Expected reopening status must be a string."
        )
        .trim()
        .equals("pending")
        .withMessage(
            "Expected reopening status must be pending."
        ),

    requiredTimestampValidator({
        field: "expected_reopen_requested_at",
        label: "Expected reopening requested-at timestamp"
    })
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/comments
 */
const createMaintenanceCommentValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "comment_type",
        "visibility",
        "message"
    ]),

    maintenanceRequestPublicIdValidator(),
    communicationMutationAccessContextValidator(),
    ...expectedRequestStateValidators({
        allowedStatuses: [
            "reported",
            "under_review",
            "assigned",
            "in_progress",
            "on_hold",
            "resolved"
        ]
    }),

    body("comment_type")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance comment type is required."
        )
        .isString()
        .withMessage(
            "Maintenance comment type must be a string."
        )
        .trim()
        .isIn(maintenanceCommentTypes)
        .withMessage(
            "Invalid maintenance comment type."
        ),

    body("visibility")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance comment visibility is required."
        )
        .isString()
        .withMessage(
            "Maintenance comment visibility must be a string."
        )
        .trim()
        .isIn(maintenanceVisibilityValues)
        .withMessage(
            "Invalid maintenance comment visibility."
        ),

    body("message")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance comment message is required."
        )
        .isString()
        .withMessage(
            "Maintenance comment message must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 5000
        })
        .withMessage(
            "Maintenance comment message must contain between 1 and 5000 characters."
        ),

    body().custom((value, { req }) => {
        const accessContext =
            req.query &&
            typeof req.query.access_context === "string"
                ? req.query.access_context.trim()
                : null;

        if (accessContext === "tenant") {
            if (
                ![
                    "tenant_message",
                    "resolution_feedback"
                ].includes(value.comment_type)
            ) {
                throw new Error(
                    "Tenant comments must use tenant_message or resolution_feedback comment type."
                );
            }

            if (
                ![
                    "tenant_visible",
                    "shared"
                ].includes(value.visibility)
            ) {
                throw new Error(
                    "Tenant comments must be tenant-visible or shared."
                );
            }
        }

        if (accessContext === "technician") {
            if (
                ![
                    "technician_update",
                    "public_update"
                ].includes(value.comment_type)
            ) {
                throw new Error(
                    "Technician comments must use technician_update or public_update comment type."
                );
            }

            if (
                ![
                    "technician_visible",
                    "shared"
                ].includes(value.visibility)
            ) {
                throw new Error(
                    "Technician comments must be technician-visible or shared."
                );
            }
        }

        return true;
    })
];

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id/comments
 */
const getMaintenanceCommentsValidator = [
    strictQueryValidator([
        "access_context",
        "comment_type",
        "visibility",
        "include_hidden",
        "created_from",
        "created_to",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    readAccessContextValidator(),

    query("comment_type")
        .optional()
        .isString()
        .withMessage(
            "Maintenance comment type must be a string."
        )
        .trim()
        .isIn(maintenanceCommentTypes)
        .withMessage(
            "Invalid maintenance comment type."
        ),

    query("visibility")
        .optional()
        .isString()
        .withMessage(
            "Maintenance comment visibility must be a string."
        )
        .trim()
        .isIn(maintenanceVisibilityValues)
        .withMessage(
            "Invalid maintenance comment visibility."
        ),

    query("include_hidden")
        .optional()
        .isBoolean()
        .withMessage(
            "Include-hidden must be true or false."
        )
        .toBoolean(),

    optionalTimestampValidator({
        location: "query",
        field: "created_from",
        label: "Comment created-from date and time"
    }),

    optionalTimestampValidator({
        location: "query",
        field: "created_to",
        label: "Comment created-to date and time"
    }),

    dateRangeConsistencyValidator({
        fromField: "created_from",
        toField: "created_to",
        label: "Comment creation"
    }),

    sortOrderValidator(),
    ...paginationValidators()
];

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id/comments/:maintenance_comment_public_id
 */
const getSingleMaintenanceCommentValidator = [
    strictQueryValidator([
        "access_context",
        "include_hidden"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    maintenanceCommentPublicIdValidator(),
    readAccessContextValidator(),

    query("include_hidden")
        .optional()
        .isBoolean()
        .withMessage(
            "Include-hidden must be true or false."
        )
        .toBoolean()
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/comments/:maintenance_comment_public_id/hide
 */
const hideMaintenanceCommentValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "moderation_reason"
    ]),

    maintenanceRequestPublicIdValidator(),
    maintenanceCommentPublicIdValidator(),
    ownerMutationAccessContextValidator(),
    ...expectedRequestStateValidators({
        allowedStatuses: [
            "reported",
            "under_review",
            "assigned",
            "in_progress",
            "on_hold",
            "resolved",
            "closed",
            "rejected",
            "cancelled"
        ]
    }),

    requiredReasonValidator({
        field: "moderation_reason",
        label: "Comment moderation reason"
    })
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/attachments
 *
 * This endpoint registers secure storage metadata after the
 * file has passed the configured upload/storage pipeline.
 */
const createMaintenanceAttachmentValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "comment_public_id",
        "cost_public_id",
        "visit_public_id",
        "resolution_public_id",
        "attachment_type",
        "visibility",
        "original_file_name",
        "stored_file_name",
        "storage_path",
        "mime_type",
        "file_size_bytes",
        "file_checksum",
        "description"
    ]),

    maintenanceRequestPublicIdValidator(),
    communicationMutationAccessContextValidator(),
    ...expectedRequestStateValidators({
        allowedStatuses: [
            "reported",
            "under_review",
            "assigned",
            "in_progress",
            "on_hold",
            "resolved"
        ]
    }),

    optionalContextPublicIdValidator({
        field: "comment_public_id",
        label: "Maintenance comment public ID",
        minimumLength: 21,
        maximumLength: 70,
        pattern: /^maintenance_comment_[A-Za-z0-9_-]+$/
    }),

    optionalContextPublicIdValidator({
        field: "cost_public_id",
        label: "Maintenance cost public ID",
        minimumLength: 18,
        maximumLength: 60,
        pattern: /^maintenance_cost_[A-Za-z0-9_-]+$/
    }),

    optionalContextPublicIdValidator({
        field: "visit_public_id",
        label: "Maintenance visit public ID",
        minimumLength: 19,
        maximumLength: 60,
        pattern: /^maintenance_visit_[A-Za-z0-9_-]+$/
    }),

    optionalContextPublicIdValidator({
        field: "resolution_public_id",
        label: "Maintenance resolution public ID",
        minimumLength: 24,
        maximumLength: 70,
        pattern: /^maintenance_resolution_[A-Za-z0-9_-]+$/
    }),

    body().custom(value => {
        const contextFields = [
            "comment_public_id",
            "cost_public_id",
            "visit_public_id",
            "resolution_public_id"
        ];

        const suppliedContextFields =
            contextFields.filter(field =>
                value[field] !== undefined &&
                value[field] !== null
            );

        if (suppliedContextFields.length > 1) {
            throw new Error(
                "A maintenance attachment may reference at most one child context."
            );
        }

        return true;
    }),

    body("attachment_type")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance attachment type is required."
        )
        .isString()
        .withMessage(
            "Maintenance attachment type must be a string."
        )
        .trim()
        .isIn(maintenanceAttachmentTypes)
        .withMessage(
            "Invalid maintenance attachment type."
        ),

    body("visibility")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance attachment visibility is required."
        )
        .isString()
        .withMessage(
            "Maintenance attachment visibility must be a string."
        )
        .trim()
        .isIn(maintenanceVisibilityValues)
        .withMessage(
            "Invalid maintenance attachment visibility."
        ),

    body("original_file_name")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Original file name is required."
        )
        .isString()
        .withMessage(
            "Original file name must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 255
        })
        .withMessage(
            "Original file name must contain between 1 and 255 characters."
        )
        .custom(value => {
            if (
                value.includes("/") ||
                value.includes("\\") ||
                value.includes("\u0000")
            ) {
                throw new Error(
                    "Original file name must not contain path separators or null bytes."
                );
            }

            return true;
        }),

    body("stored_file_name")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Stored file name is required."
        )
        .isString()
        .withMessage(
            "Stored file name must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 255
        })
        .withMessage(
            "Stored file name must contain between 1 and 255 characters."
        )
        .custom(value => {
            if (
                value.includes("/") ||
                value.includes("\\") ||
                value.includes("\u0000")
            ) {
                throw new Error(
                    "Stored file name must not contain path separators or null bytes."
                );
            }

            return true;
        }),

    body("storage_path")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Storage path is required."
        )
        .isString()
        .withMessage(
            "Storage path must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 2000
        })
        .withMessage(
            "Storage path must contain between 1 and 2000 characters."
        )
        .custom(value => {
            if (
                value.includes("\u0000") ||
                /(^|[\\/])\.\.([\\/]|$)/.test(value)
            ) {
                throw new Error(
                    "Storage path contains an unsafe path segment."
                );
            }

            return true;
        }),

    body("mime_type")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Attachment MIME type is required."
        )
        .isString()
        .withMessage(
            "Attachment MIME type must be a string."
        )
        .trim()
        .isIn(maintenanceAttachmentMimeTypes)
        .withMessage(
            "Attachment MIME type must be image/jpeg, image/png, image/webp or application/pdf."
        ),

    body("file_size_bytes")
        .exists()
        .withMessage(
            "Attachment file size is required."
        )
        .isInt({
            min: 1,
            max: 10485760
        })
        .withMessage(
            "Attachment file size must be an integer between 1 and 10485760 bytes."
        )
        .toInt(),

    body("file_checksum")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Attachment SHA-256 checksum is required."
        )
        .isString()
        .withMessage(
            "Attachment SHA-256 checksum must be a string."
        )
        .trim()
        .matches(/^[A-Fa-f0-9]{64}$/)
        .withMessage(
            "Attachment checksum must be a 64-character SHA-256 hexadecimal value."
        )
        .customSanitizer(value =>
            typeof value === "string"
                ? value.toLowerCase()
                : value
        ),

    optionalTextValidator({
        field: "description",
        label: "Attachment description",
        maximumLength: 2000,
        nullable: true
    }),

    body().custom((value, { req }) => {
        const accessContext =
            req.query &&
            typeof req.query.access_context === "string"
                ? req.query.access_context.trim()
                : null;

        if (accessContext === "tenant") {
            if (
                ![
                    "problem_evidence",
                    "work_progress",
                    "completion_evidence",
                    "other"
                ].includes(value.attachment_type)
            ) {
                throw new Error(
                    "Tenant attachments cannot use financial or approval-document attachment types."
                );
            }

            if (
                ![
                    "tenant_visible",
                    "shared"
                ].includes(value.visibility)
            ) {
                throw new Error(
                    "Tenant attachments must be tenant-visible or shared."
                );
            }

            if (
                value.cost_public_id !== undefined &&
                value.cost_public_id !== null
            ) {
                throw new Error(
                    "Tenant attachments cannot be linked directly to a maintenance cost."
                );
            }
        }

        if (accessContext === "technician") {
            if (
                ![
                    "problem_evidence",
                    "work_progress",
                    "completion_evidence",
                    "other"
                ].includes(value.attachment_type)
            ) {
                throw new Error(
                    "Technician attachments cannot use financial or approval-document attachment types."
                );
            }

            if (
                ![
                    "technician_visible",
                    "shared"
                ].includes(value.visibility)
            ) {
                throw new Error(
                    "Technician attachments must be technician-visible or shared."
                );
            }
        }

        return true;
    })
];

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id/attachments
 */
const getMaintenanceAttachmentsValidator = [
    strictQueryValidator([
        "access_context",
        "attachment_type",
        "visibility",
        "include_revoked",
        "comment_public_id",
        "cost_public_id",
        "visit_public_id",
        "resolution_public_id",
        "uploaded_from",
        "uploaded_to",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    readAccessContextValidator(),

    query("attachment_type")
        .optional()
        .isString()
        .withMessage(
            "Maintenance attachment type must be a string."
        )
        .trim()
        .isIn(maintenanceAttachmentTypes)
        .withMessage(
            "Invalid maintenance attachment type."
        ),

    query("visibility")
        .optional()
        .isString()
        .withMessage(
            "Maintenance attachment visibility must be a string."
        )
        .trim()
        .isIn(maintenanceVisibilityValues)
        .withMessage(
            "Invalid maintenance attachment visibility."
        ),

    query("include_revoked")
        .optional()
        .isBoolean()
        .withMessage(
            "Include-revoked must be true or false."
        )
        .toBoolean(),

    query("comment_public_id")
        .optional()
        .isString()
        .withMessage(
            "Maintenance comment public ID must be a string."
        )
        .trim()
        .matches(/^maintenance_comment_[A-Za-z0-9_-]+$/)
        .withMessage(
            "Invalid maintenance comment public ID format."
        ),

    query("cost_public_id")
        .optional()
        .isString()
        .withMessage(
            "Maintenance cost public ID must be a string."
        )
        .trim()
        .matches(/^maintenance_cost_[A-Za-z0-9_-]+$/)
        .withMessage(
            "Invalid maintenance cost public ID format."
        ),

    query("visit_public_id")
        .optional()
        .isString()
        .withMessage(
            "Maintenance visit public ID must be a string."
        )
        .trim()
        .matches(/^maintenance_visit_[A-Za-z0-9_-]+$/)
        .withMessage(
            "Invalid maintenance visit public ID format."
        ),

    query("resolution_public_id")
        .optional()
        .isString()
        .withMessage(
            "Maintenance resolution public ID must be a string."
        )
        .trim()
        .matches(/^maintenance_resolution_[A-Za-z0-9_-]+$/)
        .withMessage(
            "Invalid maintenance resolution public ID format."
        ),

    query().custom(value => {
        const contextFields = [
            "comment_public_id",
            "cost_public_id",
            "visit_public_id",
            "resolution_public_id"
        ];

        const suppliedContextFields =
            contextFields.filter(field =>
                value[field] !== undefined
            );

        if (suppliedContextFields.length > 1) {
            throw new Error(
                "Attachment filtering may use at most one child-context public ID."
            );
        }

        return true;
    }),

    optionalTimestampValidator({
        location: "query",
        field: "uploaded_from",
        label: "Attachment uploaded-from date and time"
    }),

    optionalTimestampValidator({
        location: "query",
        field: "uploaded_to",
        label: "Attachment uploaded-to date and time"
    }),

    dateRangeConsistencyValidator({
        fromField: "uploaded_from",
        toField: "uploaded_to",
        label: "Attachment upload"
    }),

    sortOrderValidator(),
    ...paginationValidators()
];

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id/attachments/:maintenance_attachment_public_id
 */
const getSingleMaintenanceAttachmentValidator = [
    strictQueryValidator([
        "access_context",
        "include_revoked"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    maintenanceAttachmentPublicIdValidator(),
    readAccessContextValidator(),

    query("include_revoked")
        .optional()
        .isBoolean()
        .withMessage(
            "Include-revoked must be true or false."
        )
        .toBoolean()
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/attachments/:maintenance_attachment_public_id/revoke
 */
const revokeMaintenanceAttachmentValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "expected_attachment_uploaded_at",
        "revocation_reason"
    ]),

    maintenanceRequestPublicIdValidator(),
    maintenanceAttachmentPublicIdValidator(),
    ownerMutationAccessContextValidator(),
    ...expectedRequestStateValidators(),

    requiredTimestampValidator({
        field: "expected_attachment_uploaded_at",
        label: "Expected maintenance attachment uploaded-at timestamp"
    }),

    requiredReasonValidator({
        field: "revocation_reason",
        label: "Attachment revocation reason"
    })
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/resolve
 */
const resolveMaintenanceRequestValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "resolution_summary",
        "work_completed_at",
        "actual_cost_summary",
        "evidence_override_reason",
        "confirmation_deadline_at"
    ]),

    maintenanceRequestPublicIdValidator(),
    workMutationAccessContextValidator(),
    ...expectedRequestStateValidators({
        allowedStatuses: [
            "in_progress"
        ]
    }),

    body("resolution_summary")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance resolution summary is required."
        )
        .isString()
        .withMessage(
            "Maintenance resolution summary must be a string."
        )
        .trim()
        .isLength({
            min: 10,
            max: 5000
        })
        .withMessage(
            "Maintenance resolution summary must contain between 10 and 5000 characters."
        ),

    requiredTimestampValidator({
        field: "work_completed_at",
        label: "Maintenance work completion timestamp"
    })
        .bail()
        .custom(value => {
            if (
                new Date(value).getTime() >
                Date.now() + 5 * 60 * 1000
            ) {
                throw new Error(
                    "Maintenance work completion timestamp cannot be more than five minutes in the future."
                );
            }

            return true;
        }),

    optionalTextValidator({
        field: "actual_cost_summary",
        label: "Actual cost summary",
        maximumLength: 5000,
        nullable: true
    }),

    optionalTextValidator({
        field: "evidence_override_reason",
        label: "Completion-evidence override reason",
        maximumLength: 2000,
        nullable: true
    }),

    optionalTimestampValidator({
        field: "confirmation_deadline_at",
        label: "Resolution confirmation deadline",
        nullable: true
    })
        .bail()
        .custom(value => {
            if (
                value !== null &&
                new Date(value).getTime() <= Date.now()
            ) {
                throw new Error(
                    "Resolution confirmation deadline must be in the future."
                );
            }

            return true;
        }),

    body().custom((value, { req }) => {
        const accessContext =
            req.query &&
            typeof req.query.access_context === "string"
                ? req.query.access_context.trim()
                : null;

        if (
            accessContext === "technician" &&
            value.evidence_override_reason !== undefined &&
            value.evidence_override_reason !== null
        ) {
            throw new Error(
                "A technician cannot waive completion evidence."
            );
        }

        return true;
    })
];

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id/resolutions
 */
const getMaintenanceResolutionsValidator = [
    strictQueryValidator([
        "access_context",
        "confirmation_status",
        "submitted_from",
        "submitted_to",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    readAccessContextValidator(),

    query("confirmation_status")
        .optional()
        .isString()
        .withMessage(
            "Resolution confirmation status must be a string."
        )
        .trim()
        .isIn(maintenanceResolutionConfirmationStatuses)
        .withMessage(
            "Invalid resolution confirmation status."
        ),

    optionalTimestampValidator({
        location: "query",
        field: "submitted_from",
        label: "Resolution submitted-from date and time"
    }),

    optionalTimestampValidator({
        location: "query",
        field: "submitted_to",
        label: "Resolution submitted-to date and time"
    }),

    dateRangeConsistencyValidator({
        fromField: "submitted_from",
        toField: "submitted_to",
        label: "Resolution submission"
    }),

    sortOrderValidator(),
    ...paginationValidators()
];

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id/resolutions/:maintenance_resolution_public_id
 */
const getSingleMaintenanceResolutionValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    maintenanceResolutionPublicIdValidator(),
    readAccessContextValidator()
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/resolutions/:maintenance_resolution_public_id/confirm
 */
const confirmMaintenanceResolutionValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "expected_resolution_status",
        "expected_resolution_submitted_at",
        "confirmation_note"
    ]),

    maintenanceRequestPublicIdValidator(),
    maintenanceResolutionPublicIdValidator(),
    tenantMutationAccessContextValidator(),
    ...expectedRequestStateValidators({
        allowedStatuses: [
            "resolved"
        ]
    }),
    ...expectedResolutionPendingValidators(),

    optionalTextValidator({
        field: "confirmation_note",
        label: "Resolution confirmation note",
        maximumLength: 2000,
        nullable: true
    })
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/resolutions/:maintenance_resolution_public_id/dispute
 */
const disputeMaintenanceResolutionValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "expected_resolution_status",
        "expected_resolution_submitted_at",
        "dispute_reason"
    ]),

    maintenanceRequestPublicIdValidator(),
    maintenanceResolutionPublicIdValidator(),
    tenantMutationAccessContextValidator(),
    ...expectedRequestStateValidators({
        allowedStatuses: [
            "resolved"
        ]
    }),
    ...expectedResolutionPendingValidators(),

    requiredReasonValidator({
        field: "dispute_reason",
        label: "Resolution dispute reason",
        minimumLength: 5,
        maximumLength: 2000
    })
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/resolutions/:maintenance_resolution_public_id/no-response
 */
const markMaintenanceResolutionNoResponseValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "expected_resolution_status",
        "expected_resolution_submitted_at",
        "confirmation_note"
    ]),

    maintenanceRequestPublicIdValidator(),
    maintenanceResolutionPublicIdValidator(),
    ownerMutationAccessContextValidator(),
    ...expectedRequestStateValidators({
        allowedStatuses: [
            "resolved"
        ]
    }),
    ...expectedResolutionPendingValidators(),

    requiredReasonValidator({
        field: "confirmation_note",
        label: "No-response confirmation note",
        minimumLength: 5,
        maximumLength: 2000
    })
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/close
 */
const closeMaintenanceRequestValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "reason"
    ]),

    maintenanceRequestPublicIdValidator(),
    ownerMutationAccessContextValidator(),
    ...expectedRequestStateValidators({
        allowedStatuses: [
            "resolved"
        ]
    }),

    requiredReasonValidator({
        field: "reason",
        label: "Maintenance request closure reason"
    })
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/reopen-requests
 */
const createMaintenanceReopenRequestValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "reason"
    ]),

    maintenanceRequestPublicIdValidator(),
    reopenRequestAccessContextValidator(),
    ...expectedRequestStateValidators({
        allowedStatuses: terminalMaintenanceStatuses
    }),

    requiredReasonValidator({
        field: "reason",
        label: "Maintenance reopening reason"
    })
];

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id/reopen-requests
 */
const getMaintenanceReopenRequestsValidator = [
    strictQueryValidator([
        "access_context",
        "status",
        "from_status",
        "target_status",
        "requested_from",
        "requested_to",
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
            "Reopening status must be a string."
        )
        .trim()
        .isIn(maintenanceReopenStatuses)
        .withMessage(
            "Invalid reopening status."
        ),

    query("from_status")
        .optional()
        .isString()
        .withMessage(
            "Reopening source status must be a string."
        )
        .trim()
        .isIn(terminalMaintenanceStatuses)
        .withMessage(
            "Reopening source status must be closed, rejected or cancelled."
        ),

    query("target_status")
        .optional()
        .isString()
        .withMessage(
            "Reopening target status must be a string."
        )
        .trim()
        .isIn(maintenanceReopenTargetStatuses)
        .withMessage(
            "Reopening target status must be reported or under_review."
        ),

    optionalTimestampValidator({
        location: "query",
        field: "requested_from",
        label: "Reopening requested-from date and time"
    }),

    optionalTimestampValidator({
        location: "query",
        field: "requested_to",
        label: "Reopening requested-to date and time"
    }),

    dateRangeConsistencyValidator({
        fromField: "requested_from",
        toField: "requested_to",
        label: "Reopening request"
    }),

    sortOrderValidator(),
    ...paginationValidators()
];

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id/reopen-requests/:maintenance_reopen_public_id
 */
const getSingleMaintenanceReopenRequestValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    maintenanceReopenPublicIdValidator(),
    readAccessContextValidator()
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/reopen-requests/:maintenance_reopen_public_id/approve
 */
const approveMaintenanceReopenRequestValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "expected_reopen_status",
        "expected_reopen_requested_at",
        "decision_note"
    ]),

    maintenanceRequestPublicIdValidator(),
    maintenanceReopenPublicIdValidator(),
    ownerMutationAccessContextValidator(),
    ...expectedRequestStateValidators({
        allowedStatuses: terminalMaintenanceStatuses
    }),
    ...expectedReopenPendingValidators(),

    requiredReasonValidator({
        field: "decision_note",
        label: "Reopening approval decision note"
    })
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/reopen-requests/:maintenance_reopen_public_id/reject
 */
const rejectMaintenanceReopenRequestValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "expected_reopen_status",
        "expected_reopen_requested_at",
        "decision_note"
    ]),

    maintenanceRequestPublicIdValidator(),
    maintenanceReopenPublicIdValidator(),
    ownerMutationAccessContextValidator(),
    ...expectedRequestStateValidators({
        allowedStatuses: terminalMaintenanceStatuses
    }),
    ...expectedReopenPendingValidators(),

    requiredReasonValidator({
        field: "decision_note",
        label: "Reopening rejection decision note"
    })
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/reopen-requests/:maintenance_reopen_public_id/cancel
 */
const cancelMaintenanceReopenRequestValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "expected_reopen_status",
        "expected_reopen_requested_at",
        "decision_note"
    ]),

    maintenanceRequestPublicIdValidator(),
    maintenanceReopenPublicIdValidator(),
    reopenRequestAccessContextValidator(),
    ...expectedRequestStateValidators({
        allowedStatuses: terminalMaintenanceStatuses
    }),
    ...expectedReopenPendingValidators(),

    requiredReasonValidator({
        field: "decision_note",
        label: "Reopening cancellation decision note"
    })
];

module.exports = {
    createMaintenanceCommentValidator,
    getMaintenanceCommentsValidator,
    getSingleMaintenanceCommentValidator,
    hideMaintenanceCommentValidator,
    createMaintenanceAttachmentValidator,
    getMaintenanceAttachmentsValidator,
    getSingleMaintenanceAttachmentValidator,
    revokeMaintenanceAttachmentValidator,
    resolveMaintenanceRequestValidator,
    getMaintenanceResolutionsValidator,
    getSingleMaintenanceResolutionValidator,
    confirmMaintenanceResolutionValidator,
    disputeMaintenanceResolutionValidator,
    markMaintenanceResolutionNoResponseValidator,
    closeMaintenanceRequestValidator,
    createMaintenanceReopenRequestValidator,
    getMaintenanceReopenRequestsValidator,
    getSingleMaintenanceReopenRequestValidator,
    approveMaintenanceReopenRequestValidator,
    rejectMaintenanceReopenRequestValidator,
    cancelMaintenanceReopenRequestValidator
};

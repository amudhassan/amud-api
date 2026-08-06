const {
    body,
    param,
    query
} = require("express-validator");

/*
 * Maintenance cost and responsibility values mirror the
 * database constraints from maintenance migrations 024/027.
 */
const maintenanceCostTypes = [
    "labour",
    "materials",
    "transport",
    "inspection",
    "replacement",
    "service_fee",
    "other"
];

const maintenanceCostStatuses = [
    "draft",
    "submitted",
    "approved",
    "rejected",
    "cancelled",
    "incurred"
];

const maintenanceApprovalTypes = [
    "initial",
    "additional",
    "correction"
];

const maintenanceApprovalDecisions = [
    "pending",
    "approved",
    "rejected",
    "cancelled"
];

const maintenanceCoverageTypes = [
    "none",
    "manufacturer_warranty",
    "vendor_warranty",
    "service_contract",
    "insurance",
    "landlord_responsibility",
    "tenant_responsibility",
    "shared_responsibility",
    "under_investigation"
];

const maintenanceResponsibilityStatuses = [
    "pending_review",
    "owner",
    "tenant",
    "shared",
    "warranty_provider",
    "insurance_provider",
    "external_party",
    "not_applicable"
];

const maintenanceAllocationPartyTypes = [
    "owner",
    "tenant",
    "insurance",
    "warranty_provider",
    "external_party",
    "other"
];

const mutableRequestStatuses = [
    "reported",
    "under_review",
    "assigned",
    "in_progress",
    "on_hold",
    "resolved"
];

const isFullIsoTimestamp = value => {
    if (typeof value !== "string") {
        return false;
    }

    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value
    );
};

const isIsoDate = value => {
    if (typeof value !== "string") {
        return false;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value;
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

const maintenanceCostPublicIdValidator = () =>
    param("maintenance_cost_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance cost public ID is required."
        )
        .isString()
        .withMessage(
            "Maintenance cost public ID must be a string."
        )
        .trim()
        .isLength({
            min: 25,
            max: 60
        })
        .withMessage(
            "Maintenance cost public ID must contain between 25 and 60 characters."
        )
        .matches(
            /^maintenance_cost_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid maintenance cost public ID format."
        );

const maintenanceAllocationPublicIdValidator = () =>
    param("maintenance_responsibility_allocation_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance responsibility allocation public ID is required."
        )
        .isString()
        .withMessage(
            "Maintenance responsibility allocation public ID must be a string."
        )
        .trim()
        .isLength({
            min: 46,
            max: 80
        })
        .withMessage(
            "Maintenance responsibility allocation public ID must contain between 46 and 80 characters."
        )
        .matches(
            /^maintenance_responsibility_allocation_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid maintenance responsibility allocation public ID format."
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
        )
        .custom(value => {
            if (
                value !== null &&
                typeof value === "string" &&
                value.length === 0
            ) {
                throw new Error(
                    `${label} cannot be blank.`
                );
            }

            return true;
        });

const requiredPositiveMoneyValidator = (
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
        .isFloat({
            gt: 0,
            max: 999999999999.99
        })
        .withMessage(
            `${label} must be greater than zero and within the supported monetary range.`
        )
        .custom(value => {
            const stringValue = String(value);

            if (!/^\d+(?:\.\d{1,2})?$/.test(stringValue)) {
                throw new Error(
                    `${label} can contain at most two decimal places.`
                );
            }

            return true;
        })
        .toFloat();

const optionalPositiveMoneyValidator = (
    fieldName,
    label
) =>
    body(fieldName)
        .optional({
            nullable: true
        })
        .isFloat({
            gt: 0,
            max: 999999999999.99
        })
        .withMessage(
            `${label} must be greater than zero and within the supported monetary range.`
        )
        .custom(value => {
            const stringValue = String(value);

            if (!/^\d+(?:\.\d{1,2})?$/.test(stringValue)) {
                throw new Error(
                    `${label} can contain at most two decimal places.`
                );
            }

            return true;
        })
        .toFloat();

const quantityValidator = optional => {
    let validator = body("quantity");

    if (optional) {
        validator = validator.optional();
    } else {
        validator = validator.exists({
            checkFalsy: true
        });
    }

    return validator
        .isFloat({
            gt: 0,
            max: 999999999.999
        })
        .withMessage(
            "Quantity must be greater than zero and within the supported range."
        )
        .custom(value => {
            if (!/^\d+(?:\.\d{1,3})?$/.test(String(value))) {
                throw new Error(
                    "Quantity can contain at most three decimal places."
                );
            }

            return true;
        })
        .toFloat();
};

const currencyCodeValidator = optional => {
    let validator = body("currency_code");

    if (optional) {
        validator = validator.optional();
    } else {
        validator = validator.exists({
            checkFalsy: true
        });
    }

    return validator
        .isString()
        .withMessage(
            "Currency code must be a string."
        )
        .trim()
        .toUpperCase()
        .matches(/^[A-Z]{3}$/)
        .withMessage(
            "Currency code must contain exactly three uppercase letters."
        );
};

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

const tenantPublicIdBodyValidator = () =>
    body("tenant_public_id")
        .optional({
            nullable: true
        })
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
        );

const responsibilityPublicIdBodyValidator = () =>
    body("responsibility_public_id")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Maintenance responsibility public ID must be a string."
        )
        .trim()
        .isLength({
            min: 35,
            max: 70
        })
        .withMessage(
            "Maintenance responsibility public ID must contain between 35 and 70 characters."
        )
        .matches(
            /^maintenance_responsibility_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid maintenance responsibility public ID format."
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

const optionalDateBodyValidator = (
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
            if (!isIsoDate(value)) {
                throw new Error(
                    `${label} must use YYYY-MM-DD format.`
                );
            }

            return true;
        });

const expectedRequestStateValidators = () => [
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
            mutableRequestStatuses
        )
        .withMessage(
            `Expected maintenance request status must be one of: ${mutableRequestStatuses.join(", ")}.`
        ),

    expectedUpdatedAtValidator(
        "expected_request_updated_at",
        "Expected maintenance request updated-at timestamp"
    )
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/costs
 */
const createMaintenanceCostValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "assignment_public_id",
        "cost_type",
        "description",
        "quantity",
        "unit_cost",
        "currency_code",
        "vendor_reference",
        "quotation_reference"
    ]),

    maintenanceRequestPublicIdValidator(),
    ownerMutationAccessContextValidator(),
    ...expectedRequestStateValidators(),
    assignmentPublicIdBodyValidator(),

    body("cost_type")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance cost type is required."
        )
        .isString()
        .withMessage(
            "Maintenance cost type must be a string."
        )
        .trim()
        .isIn(
            maintenanceCostTypes
        )
        .withMessage(
            `Maintenance cost type must be one of: ${maintenanceCostTypes.join(", ")}.`
        ),

    body("description")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance cost description is required."
        )
        .isString()
        .withMessage(
            "Maintenance cost description must be a string."
        )
        .trim()
        .isLength({
            min: 3,
            max: 3000
        })
        .withMessage(
            "Maintenance cost description must contain between 3 and 3000 characters."
        ),

    quantityValidator(false),
    requiredPositiveMoneyValidator(
        "unit_cost",
        "Unit cost"
    ),
    currencyCodeValidator(false),
    optionalTextValidator(
        "vendor_reference",
        "Vendor reference",
        255
    ),
    optionalTextValidator(
        "quotation_reference",
        "Quotation reference",
        255
    )
];

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id/costs
 */
const getMaintenanceCostsValidator = [
    strictQueryValidator([
        "access_context",
        "status",
        "cost_type",
        "assignment_public_id",
        "currency_code",
        "created_from",
        "created_to",
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
            "Maintenance cost status must be a string."
        )
        .trim()
        .isIn(
            maintenanceCostStatuses
        )
        .withMessage(
            "Invalid maintenance cost status filter."
        ),

    query("cost_type")
        .optional()
        .isString()
        .withMessage(
            "Maintenance cost type must be a string."
        )
        .trim()
        .isIn(
            maintenanceCostTypes
        )
        .withMessage(
            "Invalid maintenance cost type filter."
        ),

    query("assignment_public_id")
        .optional()
        .isString()
        .withMessage(
            "Assignment public ID must be a string."
        )
        .trim()
        .matches(
            /^maintenance_assignment_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid assignment public ID format."
        ),

    query("currency_code")
        .optional()
        .isString()
        .withMessage(
            "Currency code must be a string."
        )
        .trim()
        .toUpperCase()
        .matches(/^[A-Z]{3}$/)
        .withMessage(
            "Currency code must contain exactly three uppercase letters."
        ),

    queryTimestampValidator(
        "created_from",
        "Created-from timestamp"
    ),

    queryTimestampValidator(
        "created_to",
        "Created-to timestamp"
    ),

    query().custom(value => {
        if (
            value.created_from !== undefined &&
            value.created_to !== undefined &&
            new Date(value.created_from).getTime() >
                new Date(value.created_to).getTime()
        ) {
            throw new Error(
                "Created-from timestamp cannot be after created-to timestamp."
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
            "created_at",
            "updated_at",
            "status",
            "cost_type",
            "estimated_amount",
            "approved_amount",
            "actual_amount",
            "incurred_at"
        ])
        .withMessage(
            "Invalid maintenance cost sort field."
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
 * GET /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id
 */
const getSingleMaintenanceCostValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    maintenanceCostPublicIdValidator(),
    readAccessContextValidator()
];

/*
 * PATCH /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id
 */
const updateMaintenanceCostValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_status",
        "expected_updated_at",
        "description",
        "quantity",
        "unit_cost",
        "currency_code",
        "vendor_reference",
        "quotation_reference"
    ]),

    maintenanceRequestPublicIdValidator(),
    maintenanceCostPublicIdValidator(),
    ownerMutationAccessContextValidator(),

    body("expected_status")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Expected maintenance cost status is required."
        )
        .isString()
        .withMessage(
            "Expected maintenance cost status must be a string."
        )
        .trim()
        .equals("draft")
        .withMessage(
            "Only a draft maintenance cost can be updated."
        ),

    expectedUpdatedAtValidator(),

    body().custom(value => {
        const editableFields = [
            "description",
            "quantity",
            "unit_cost",
            "currency_code",
            "vendor_reference",
            "quotation_reference"
        ];

        if (
            !editableFields.some(
                field =>
                    Object.prototype.hasOwnProperty.call(
                        value || {},
                        field
                    )
            )
        ) {
            throw new Error(
                "At least one maintenance cost field must be supplied for update."
            );
        }

        return true;
    }),

    body("description")
        .optional()
        .isString()
        .withMessage(
            "Maintenance cost description must be a string."
        )
        .trim()
        .isLength({
            min: 3,
            max: 3000
        })
        .withMessage(
            "Maintenance cost description must contain between 3 and 3000 characters."
        ),

    quantityValidator(true),
    optionalPositiveMoneyValidator(
        "unit_cost",
        "Unit cost"
    ),
    currencyCodeValidator(true),
    optionalTextValidator(
        "vendor_reference",
        "Vendor reference",
        255
    ),
    optionalTextValidator(
        "quotation_reference",
        "Quotation reference",
        255
    )
];

const costLifecycleBase = ({
    allowedFields,
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
    maintenanceCostPublicIdValidator(),
    ownerMutationAccessContextValidator(),

    body("expected_status")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Expected maintenance cost status is required."
        )
        .isString()
        .withMessage(
            "Expected maintenance cost status must be a string."
        )
        .trim()
        .isIn(
            expectedStatuses
        )
        .withMessage(
            `Expected maintenance cost status must be one of: ${expectedStatuses.join(", ")}.`
        ),

    expectedUpdatedAtValidator()
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/submit
 */
const submitMaintenanceCostValidator = [
    ...costLifecycleBase({
        allowedFields: [
            "submitted_amount",
            "submission_note"
        ],
        expectedStatuses: [
            "draft"
        ]
    }),

    requiredPositiveMoneyValidator(
        "submitted_amount",
        "Submitted approval amount"
    ),

    optionalTextValidator(
        "submission_note",
        "Cost approval submission note",
        2000
    )
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/approve
 */
const approveMaintenanceCostValidator = [
    ...costLifecycleBase({
        allowedFields: [
            "decision_note"
        ],
        expectedStatuses: [
            "submitted",
            "approved"
        ]
    }),

    requiredReasonValidator(
        "decision_note",
        "Cost approval decision note"
    )
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/reject
 */
const rejectMaintenanceCostValidator = [
    ...costLifecycleBase({
        allowedFields: [
            "decision_note"
        ],
        expectedStatuses: [
            "submitted",
            "approved"
        ]
    }),

    requiredReasonValidator(
        "decision_note",
        "Cost rejection decision note"
    )
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/cancel
 */
const cancelMaintenanceCostValidator = [
    ...costLifecycleBase({
        allowedFields: [
            "cancellation_reason"
        ],
        expectedStatuses: [
            "draft",
            "submitted",
            "approved"
        ]
    }),

    requiredReasonValidator(
        "cancellation_reason",
        "Maintenance cost cancellation reason"
    )
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/incur
 */
const incurMaintenanceCostValidator = [
    ...costLifecycleBase({
        allowedFields: [
            "actual_amount",
            "incurred_at",
            "reason"
        ],
        expectedStatuses: [
            "approved"
        ]
    }),

    requiredPositiveMoneyValidator(
        "actual_amount",
        "Actual incurred amount"
    ),

    requiredTimestampValidator(
        "incurred_at",
        "Incurred-at timestamp"
    ),

    requiredReasonValidator(
        "reason",
        "Maintenance cost incurrence reason"
    )
];

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/approval-history
 */
const getMaintenanceCostApprovalHistoryValidator = [
    strictQueryValidator([
        "access_context",
        "approval_type",
        "decision",
        "submitted_from",
        "submitted_to",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    maintenanceCostPublicIdValidator(),
    readAccessContextValidator(),

    query("approval_type")
        .optional()
        .isString()
        .withMessage(
            "Approval type must be a string."
        )
        .trim()
        .isIn(
            maintenanceApprovalTypes
        )
        .withMessage(
            "Invalid maintenance cost approval type filter."
        ),

    query("decision")
        .optional()
        .isString()
        .withMessage(
            "Approval decision must be a string."
        )
        .trim()
        .isIn(
            maintenanceApprovalDecisions
        )
        .withMessage(
            "Invalid maintenance cost approval decision filter."
        ),

    queryTimestampValidator(
        "submitted_from",
        "Submitted-from timestamp"
    ),

    queryTimestampValidator(
        "submitted_to",
        "Submitted-to timestamp"
    ),

    query().custom(value => {
        if (
            value.submitted_from !== undefined &&
            value.submitted_to !== undefined &&
            new Date(value.submitted_from).getTime() >
                new Date(value.submitted_to).getTime()
        ) {
            throw new Error(
                "Submitted-from timestamp cannot be after submitted-to timestamp."
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
 * POST /api/maintenance/requests/:maintenance_request_public_id/responsibility/determine
 */
const determineMaintenanceResponsibilityValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "responsibility_public_id",
        "expected_responsibility_updated_at",
        "coverage_type",
        "provider_name",
        "contract_or_policy_reference",
        "coverage_start_date",
        "coverage_end_date",
        "claim_reference",
        "coverage_notes",
        "responsibility_status"
    ]),

    maintenanceRequestPublicIdValidator(),
    ownerMutationAccessContextValidator(),
    ...expectedRequestStateValidators(),
    responsibilityPublicIdBodyValidator(),

    optionalTimestampValidator(
        "expected_responsibility_updated_at",
        "Expected maintenance responsibility updated-at timestamp"
    ),

    body().custom(value => {
        const hasResponsibilityPublicId =
            value.responsibility_public_id !== undefined &&
            value.responsibility_public_id !== null;

        const hasExpectedUpdatedAt =
            value.expected_responsibility_updated_at !== undefined &&
            value.expected_responsibility_updated_at !== null;

        if (hasResponsibilityPublicId !== hasExpectedUpdatedAt) {
            throw new Error(
                "Responsibility public ID and expected responsibility updated-at timestamp must be supplied together when updating an existing determination."
            );
        }

        return true;
    }),

    body("coverage_type")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance coverage type is required."
        )
        .isString()
        .withMessage(
            "Maintenance coverage type must be a string."
        )
        .trim()
        .isIn(
            maintenanceCoverageTypes
        )
        .withMessage(
            `Maintenance coverage type must be one of: ${maintenanceCoverageTypes.join(", ")}.`
        ),

    optionalTextValidator(
        "provider_name",
        "Coverage provider name",
        255
    ),

    optionalTextValidator(
        "contract_or_policy_reference",
        "Contract or policy reference",
        255
    ),

    optionalDateBodyValidator(
        "coverage_start_date",
        "Coverage start date"
    ),

    optionalDateBodyValidator(
        "coverage_end_date",
        "Coverage end date"
    ),

    optionalTextValidator(
        "claim_reference",
        "Coverage claim reference",
        255
    ),

    optionalTextValidator(
        "coverage_notes",
        "Coverage notes",
        3000
    ),

    body("responsibility_status")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance responsibility status is required."
        )
        .isString()
        .withMessage(
            "Maintenance responsibility status must be a string."
        )
        .trim()
        .isIn(
            maintenanceResponsibilityStatuses
        )
        .withMessage(
            `Maintenance responsibility status must be one of: ${maintenanceResponsibilityStatuses.join(", ")}.`
        ),

    body().custom(value => {
        const providerRequiredCoverageTypes = [
            "manufacturer_warranty",
            "vendor_warranty",
            "service_contract",
            "insurance"
        ];

        if (
            providerRequiredCoverageTypes.includes(
                value.coverage_type
            ) &&
            (
                typeof value.provider_name !== "string" ||
                value.provider_name.trim().length === 0
            )
        ) {
            throw new Error(
                "Provider name is required for warranty, service-contract or insurance coverage."
            );
        }

        if (
            value.coverage_start_date !== undefined &&
            value.coverage_start_date !== null &&
            value.coverage_end_date !== undefined &&
            value.coverage_end_date !== null &&
            value.coverage_start_date >
                value.coverage_end_date
        ) {
            throw new Error(
                "Coverage start date cannot be after coverage end date."
            );
        }

        return true;
    })
];

/*
 * POST /api/maintenance/requests/:maintenance_request_public_id/responsibility/allocations
 */
const createMaintenanceResponsibilityAllocationValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "responsibility_public_id",
        "expected_responsibility_updated_at",
        "party_type",
        "tenant_public_id",
        "provider_name",
        "allocated_amount",
        "allocation_percentage",
        "reason"
    ]),

    maintenanceRequestPublicIdValidator(),
    ownerMutationAccessContextValidator(),
    ...expectedRequestStateValidators(),

    body("responsibility_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance responsibility public ID is required."
        )
        .isString()
        .withMessage(
            "Maintenance responsibility public ID must be a string."
        )
        .trim()
        .isLength({
            min: 35,
            max: 70
        })
        .withMessage(
            "Maintenance responsibility public ID must contain between 35 and 70 characters."
        )
        .matches(
            /^maintenance_responsibility_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid maintenance responsibility public ID format."
        ),

    expectedUpdatedAtValidator(
        "expected_responsibility_updated_at",
        "Expected maintenance responsibility updated-at timestamp"
    ),

    body("party_type")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Responsibility allocation party type is required."
        )
        .isString()
        .withMessage(
            "Responsibility allocation party type must be a string."
        )
        .trim()
        .isIn(
            maintenanceAllocationPartyTypes
        )
        .withMessage(
            `Responsibility allocation party type must be one of: ${maintenanceAllocationPartyTypes.join(", ")}.`
        ),

    tenantPublicIdBodyValidator(),

    optionalTextValidator(
        "provider_name",
        "Responsibility allocation provider name",
        255
    ),

    optionalPositiveMoneyValidator(
        "allocated_amount",
        "Allocated amount"
    ),

    body("allocation_percentage")
        .optional({
            nullable: true
        })
        .isFloat({
            gt: 0,
            max: 100
        })
        .withMessage(
            "Allocation percentage must be greater than zero and cannot exceed 100."
        )
        .custom(value => {
            if (!/^\d+(?:\.\d{1,4})?$/.test(String(value))) {
                throw new Error(
                    "Allocation percentage can contain at most four decimal places."
                );
            }

            return true;
        })
        .toFloat(),

    requiredReasonValidator(
        "reason",
        "Responsibility allocation reason"
    ),

    body().custom(value => {
        const hasAmount =
            value.allocated_amount !== undefined &&
            value.allocated_amount !== null;

        const hasPercentage =
            value.allocation_percentage !== undefined &&
            value.allocation_percentage !== null;

        if (hasAmount === hasPercentage) {
            throw new Error(
                "Supply either allocated_amount or allocation_percentage, but not both."
            );
        }

        if (
            value.party_type === "tenant" &&
            (
                typeof value.tenant_public_id !== "string" ||
                value.tenant_public_id.trim().length === 0
            )
        ) {
            throw new Error(
                "Tenant public ID is required for a tenant responsibility allocation."
            );
        }

        if (
            [
                "owner",
                "insurance",
                "warranty_provider",
                "external_party",
                "other"
            ].includes(value.party_type) &&
            value.tenant_public_id !== undefined &&
            value.tenant_public_id !== null
        ) {
            throw new Error(
                "Tenant public ID is only allowed for a tenant responsibility allocation."
            );
        }

        const providerRequiredPartyTypes = [
            "insurance",
            "warranty_provider",
            "external_party",
            "other"
        ];

        if (
            providerRequiredPartyTypes.includes(
                value.party_type
            ) &&
            (
                typeof value.provider_name !== "string" ||
                value.provider_name.trim().length === 0
            )
        ) {
            throw new Error(
                "Provider name is required for insurance, warranty-provider, external-party or other allocations."
            );
        }

        if (
            [
                "owner",
                "tenant"
            ].includes(value.party_type) &&
            value.provider_name !== undefined &&
            value.provider_name !== null
        ) {
            throw new Error(
                "Provider name is not allowed for owner or tenant allocations."
            );
        }

        return true;
    })
];

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id/responsibility/allocations
 */
const getMaintenanceResponsibilityAllocationsValidator = [
    strictQueryValidator([
        "access_context",
        "party_type",
        "allocation_method",
        "include_revoked",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),
    maintenanceRequestPublicIdValidator(),
    readAccessContextValidator(),

    query("party_type")
        .optional()
        .isString()
        .withMessage(
            "Responsibility allocation party type must be a string."
        )
        .trim()
        .isIn(
            maintenanceAllocationPartyTypes
        )
        .withMessage(
            "Invalid responsibility allocation party-type filter."
        ),

    query("allocation_method")
        .optional()
        .isString()
        .withMessage(
            "Allocation method must be a string."
        )
        .trim()
        .isIn([
            "amount",
            "percentage"
        ])
        .withMessage(
            "Allocation method must be amount or percentage."
        ),

    query("include_revoked")
        .optional()
        .isBoolean()
        .withMessage(
            "Include-revoked must be true or false."
        )
        .toBoolean(),

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
 * POST /api/maintenance/requests/:maintenance_request_public_id/responsibility/allocations/:maintenance_responsibility_allocation_public_id/revoke
 */
const revokeMaintenanceResponsibilityAllocationValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_request_status",
        "expected_request_updated_at",
        "responsibility_public_id",
        "expected_responsibility_updated_at",
        "revocation_reason"
    ]),

    maintenanceRequestPublicIdValidator(),
    maintenanceAllocationPublicIdValidator(),
    ownerMutationAccessContextValidator(),
    ...expectedRequestStateValidators(),

    body("responsibility_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Maintenance responsibility public ID is required."
        )
        .isString()
        .withMessage(
            "Maintenance responsibility public ID must be a string."
        )
        .trim()
        .isLength({
            min: 35,
            max: 70
        })
        .withMessage(
            "Maintenance responsibility public ID must contain between 35 and 70 characters."
        )
        .matches(
            /^maintenance_responsibility_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid maintenance responsibility public ID format."
        ),

    expectedUpdatedAtValidator(
        "expected_responsibility_updated_at",
        "Expected maintenance responsibility updated-at timestamp"
    ),

    requiredReasonValidator(
        "revocation_reason",
        "Responsibility allocation revocation reason"
    )
];

module.exports = {
    createMaintenanceCostValidator,
    getMaintenanceCostsValidator,
    getSingleMaintenanceCostValidator,
    updateMaintenanceCostValidator,
    submitMaintenanceCostValidator,
    approveMaintenanceCostValidator,
    rejectMaintenanceCostValidator,
    cancelMaintenanceCostValidator,
    incurMaintenanceCostValidator,
    getMaintenanceCostApprovalHistoryValidator,
    determineMaintenanceResponsibilityValidator,
    createMaintenanceResponsibilityAllocationValidator,
    getMaintenanceResponsibilityAllocationsValidator,
    revokeMaintenanceResponsibilityAllocationValidator
};

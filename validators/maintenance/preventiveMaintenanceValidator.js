const {
    body,
    param,
    query
} = require("express-validator");

/*
 * Batch E — Preventive Maintenance.
 *
 * Validation mirrors migrations 026 and 027. The service
 * layer remains responsible for authorization, ownership,
 * current property/unit relationships, lifecycle checks,
 * row locking, idempotency and transaction boundaries.
 */

const requestScopes = [
    "unit",
    "property_common_area"
];

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

const impactLevels = [
    "no_operational_impact",
    "partially_restricted",
    "uninhabitable"
];

const accessInstructions = [
    "contact_first",
    "tenant_must_be_present",
    "authorized_entry"
];

const preventiveFrequencies = [
    "one_time",
    "weekly",
    "monthly",
    "quarterly",
    "semi_annual",
    "annual",
    "custom"
];

const preventivePlanStatuses = [
    "active",
    "paused",
    "completed",
    "cancelled"
];

const preventiveOccurrenceStatuses = [
    "pending",
    "generated",
    "skipped",
    "failed",
    "cancelled"
];

const assignmentTypes = [
    "internal_technician",
    "external_vendor"
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
 * Owners may read plans they control. An internal technician
 * may read a plan only when assigned_user_id matches them.
 * Admin may omit access_context.
 */
const preventiveReadAccessContextValidator = () =>
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

const adminOnlyValidator = () =>
    body().custom((value, { req }) => {
        if (
            !req.user ||
            req.user.role !== "admin"
        ) {
            throw new Error(
                "Administrator access is required for this operation."
            );
        }

        return true;
    });

const preventivePlanPublicIdValidator = () =>
    param("preventive_plan_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Preventive plan public ID is required."
        )
        .isString()
        .withMessage(
            "Preventive plan public ID must be a string."
        )
        .trim()
        .isLength({
            min: 18,
            max: 50
        })
        .withMessage(
            "Preventive plan public ID must contain between 18 and 50 characters."
        )
        .matches(
            /^preventive_plan_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid preventive plan public ID format."
        );

const preventiveOccurrencePublicIdValidator = () =>
    param("preventive_occurrence_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Preventive occurrence public ID is required."
        )
        .isString()
        .withMessage(
            "Preventive occurrence public ID must be a string."
        )
        .trim()
        .isLength({
            min: 24,
            max: 50
        })
        .withMessage(
            "Preventive occurrence public ID must contain between 24 and 50 characters."
        )
        .matches(
            /^preventive_occurrence_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid preventive occurrence public ID format."
        );

const ownerPublicIdBodyValidator = () =>
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
        );

const propertyPublicIdBodyValidator = () =>
    body("property_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Property public ID is required."
        )
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
        );

const optionalUnitPublicIdBodyValidator = () =>
    body("unit_public_id")
        .optional({
            nullable: true
        })
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
        );

const optionalAssignedUserPublicIdValidator = () =>
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

const expectedUpdatedAtValidator = (
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

const requiredTimestampBodyValidator = (
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

const optionalTimestampBodyValidator = (
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

const optionalTimestampQueryValidator = (
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

const requiredTextValidator = (
    fieldName,
    label,
    minimumLength,
    maximumLength
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
            min: minimumLength,
            max: maximumLength
        })
        .withMessage(
            `${label} must contain between ${minimumLength} and ${maximumLength} characters.`
        );


const textFieldValidator = ({
    fieldName,
    label,
    minimumLength,
    maximumLength,
    required
}) => {
    const chain = body(fieldName);

    if (required) {
        chain
            .exists({
                checkFalsy: true
            })
            .withMessage(
                `${label} is required.`
            );
    } else {
        chain.optional({
            nullable: true
        });
    }

    return chain
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
};

const optionalTextValidator = (
    fieldName,
    label,
    maximumLength,
    minimumLength = 1
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
            min: minimumLength,
            max: maximumLength
        })
        .withMessage(
            `${label} must contain between ${minimumLength} and ${maximumLength} characters.`
        );

const optionalMoneyValidator = (
    fieldName,
    label
) =>
    body(fieldName)
        .optional()
        .custom(value => {
            if (
                typeof value !== "number" &&
                typeof value !== "string"
            ) {
                throw new Error(
                    `${label} must be a valid non-negative monetary amount.`
                );
            }

            const normalizedValue =
                String(value).trim();

            if (
                !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(
                    normalizedValue
                )
            ) {
                throw new Error(
                    `${label} must be a non-negative amount with no more than two decimal places.`
                );
            }

            return true;
        });

const optionalCurrencyCodeValidator = () =>
    body("currency_code")
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

const ownerPublicIdQueryValidator = () =>
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
        );

const propertyPublicIdQueryValidator = () =>
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
        );

const unitPublicIdQueryValidator = () =>
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
        );

const assignedUserPublicIdQueryValidator = () =>
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
        );

const validateScopeFields = value => {
    if (value.request_scope === "unit") {
        if (
            typeof value.unit_public_id !==
                "string" ||
            value.unit_public_id.trim().length === 0
        ) {
            throw new Error(
                "Unit public ID is required for a unit preventive plan."
            );
        }
    }

    if (
        value.request_scope ===
            "property_common_area"
    ) {
        if (
            value.unit_public_id !== undefined &&
            value.unit_public_id !== null
        ) {
            throw new Error(
                "Property common-area preventive plans cannot contain unit_public_id."
            );
        }

        if (
            typeof value.location_details !==
                "string" ||
            value.location_details.trim().length === 0
        ) {
            throw new Error(
                "Location details are required for a property common-area preventive plan."
            );
        }
    }

    return true;
};

const validateFrequencyFields = value => {
    const frequency = value.frequency;

    if (frequency === "custom") {
        if (
            !Number.isInteger(
                Number(value.custom_interval_days)
            ) ||
            Number(value.custom_interval_days) < 1 ||
            Number(value.custom_interval_days) > 3650
        ) {
            throw new Error(
                "Custom interval days must be an integer between 1 and 3650 for a custom frequency."
            );
        }
    } else if (
        value.custom_interval_days !== undefined &&
        value.custom_interval_days !== null
    ) {
        throw new Error(
            "custom_interval_days is allowed only when frequency is custom."
        );
    }

    if (
        frequency === "one_time" &&
        value.interval_value !== undefined &&
        Number(value.interval_value) !== 1
    ) {
        throw new Error(
            "One-time preventive plans require interval_value to be 1."
        );
    }

    return true;
};

const validateAssignmentFields = value => {
    const assignmentType =
        value.default_assignment_type;

    const vendorFields = [
        "vendor_name",
        "company_name",
        "contact_person",
        "phone_number",
        "email",
        "service_description"
    ];

    if (
        assignmentType === undefined ||
        assignmentType === null
    ) {
        const suppliedAssignmentFields = [
            "assigned_user_public_id",
            ...vendorFields
        ].filter(field =>
            value[field] !== undefined &&
            value[field] !== null
        );

        if (suppliedAssignmentFields.length > 0) {
            throw new Error(
                `Assignment details require default_assignment_type. Unsupported fields: ${suppliedAssignmentFields.join(", ")}.`
            );
        }

        return true;
    }

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
                "Assigned user public ID is required for an internal technician default assignment."
            );
        }

        const suppliedVendorFields =
            vendorFields.filter(field =>
                value[field] !== undefined &&
                value[field] !== null
            );

        if (suppliedVendorFields.length > 0) {
            throw new Error(
                `Internal technician default assignment cannot contain vendor fields: ${suppliedVendorFields.join(", ")}.`
            );
        }

        return true;
    }

    if (
        assignmentType ===
            "external_vendor"
    ) {
        if (
            value.assigned_user_public_id !==
                undefined &&
            value.assigned_user_public_id !==
                null
        ) {
            throw new Error(
                "External vendor default assignment cannot contain assigned_user_public_id."
            );
        }

        if (
            typeof value.vendor_name !==
                "string" ||
            value.vendor_name.trim().length === 0
        ) {
            throw new Error(
                "Vendor name is required for an external vendor default assignment."
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
                "External vendor default assignment requires a phone number or email address."
            );
        }
    }

    return true;
};

const requiredOrOptionalBodyValidator = ({
    fieldName,
    required,
    requiredMessage
}) => {
    const chain = body(fieldName);

    if (required) {
        chain
            .exists({
                checkFalsy: true
            })
            .withMessage(requiredMessage);
    } else {
        chain.optional();
    }

    return chain;
};

const planTemplateFieldValidators = ({
    requireCoreFields
}) => [
    requiredOrOptionalBodyValidator({
        fieldName: "request_scope",
        required: requireCoreFields,
        requiredMessage:
            "Request scope is required."
    })
        .isString()
        .withMessage(
            "Request scope must be a string."
        )
        .trim()
        .isIn(requestScopes)
        .withMessage(
            "Request scope must be unit or property_common_area."
        ),

    textFieldValidator({
        fieldName: "title",
        label: "Title",
        minimumLength: 3,
        maximumLength: 255,
        required: requireCoreFields
    }),

    textFieldValidator({
        fieldName: "description",
        label: "Description",
        minimumLength: 10,
        maximumLength: 5000,
        required: requireCoreFields
    }),

    requiredOrOptionalBodyValidator({
        fieldName: "category",
        required: requireCoreFields,
        requiredMessage:
            "Category is required."
    })
        .isString()
        .withMessage(
            "Category must be a string."
        )
        .trim()
        .isIn(maintenanceCategories)
        .withMessage(
            "Invalid preventive maintenance category."
        ),

    body("priority")
        .optional()
        .isString()
        .withMessage(
            "Priority must be a string."
        )
        .trim()
        .isIn(maintenancePriorities)
        .withMessage(
            "Priority must be low, medium, high or emergency."
        ),

    body("impact_level")
        .optional()
        .isString()
        .withMessage(
            "Impact level must be a string."
        )
        .trim()
        .isIn(impactLevels)
        .withMessage(
            "Invalid impact level."
        ),

    optionalTextValidator(
        "location_details",
        "Location details",
        500
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
        .isIn(accessInstructions)
        .withMessage(
            "Invalid access instruction."
        ),

    requiredOrOptionalBodyValidator({
        fieldName: "frequency",
        required: requireCoreFields,
        requiredMessage:
            "Frequency is required."
    })
        .isString()
        .withMessage(
            "Frequency must be a string."
        )
        .trim()
        .isIn(preventiveFrequencies)
        .withMessage(
            "Invalid preventive maintenance frequency."
        ),

    body("interval_value")
        .optional()
        .isInt({
            min: 1,
            max: 1000
        })
        .withMessage(
            "Interval value must be an integer between 1 and 1000."
        )
        .toInt(),

    body("custom_interval_days")
        .optional({
            nullable: true
        })
        .isInt({
            min: 1,
            max: 3650
        })
        .withMessage(
            "Custom interval days must be an integer between 1 and 3650."
        )
        .toInt(),

    optionalTimestampBodyValidator(
        "next_due_at",
        "Next due timestamp"
    ),

    body("default_assignment_type")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Default assignment type must be a string."
        )
        .trim()
        .isIn(assignmentTypes)
        .withMessage(
            "Default assignment type must be internal_technician or external_vendor."
        ),

    optionalAssignedUserPublicIdValidator(),

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
        50,
        5
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
        .isLength({
            max: 255
        })
        .withMessage(
            "Email cannot exceed 255 characters."
        )
        .isEmail()
        .withMessage(
            "Invalid preventive plan contact email."
        )
        .normalizeEmail(),

    optionalTextValidator(
        "service_description",
        "Service description",
        1000
    ),

    optionalMoneyValidator(
        "estimated_cost",
        "Estimated cost"
    ),

    optionalCurrencyCodeValidator()
];

/*
 * POST /api/maintenance/preventive-plans
 */
const createPreventiveMaintenancePlanValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "owner_public_id",
        "property_public_id",
        "unit_public_id",
        "request_scope",
        "title",
        "description",
        "category",
        "priority",
        "impact_level",
        "location_details",
        "access_instruction",
        "frequency",
        "interval_value",
        "custom_interval_days",
        "next_due_at",
        "default_assignment_type",
        "assigned_user_public_id",
        "vendor_name",
        "company_name",
        "contact_person",
        "phone_number",
        "email",
        "service_description",
        "estimated_cost",
        "currency_code"
    ]),

    ownerMutationAccessContextValidator(),
    ownerPublicIdBodyValidator(),
    propertyPublicIdBodyValidator(),
    optionalUnitPublicIdBodyValidator(),

    ...planTemplateFieldValidators({
        requireCoreFields: true
    }),

    requiredTimestampBodyValidator(
        "next_due_at",
        "Next due timestamp"
    ),

    body().custom(validateScopeFields),
    body().custom(validateFrequencyFields),
    body().custom(validateAssignmentFields)
];

/*
 * GET /api/maintenance/preventive-plans
 */
const getPreventiveMaintenancePlansValidator = [
    strictQueryValidator([
        "access_context",
        "owner_public_id",
        "property_public_id",
        "unit_public_id",
        "request_scope",
        "category",
        "priority",
        "impact_level",
        "frequency",
        "status",
        "default_assignment_type",
        "assigned_user_public_id",
        "due_from",
        "due_to",
        "search",
        "sort_by",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),
    preventiveReadAccessContextValidator(),
    ownerPublicIdQueryValidator(),
    propertyPublicIdQueryValidator(),
    unitPublicIdQueryValidator(),
    assignedUserPublicIdQueryValidator(),

    query("request_scope")
        .optional()
        .isString()
        .withMessage(
            "Request scope must be a string."
        )
        .trim()
        .isIn(requestScopes)
        .withMessage(
            "Request scope must be unit or property_common_area."
        ),

    query("category")
        .optional()
        .isString()
        .withMessage(
            "Category must be a string."
        )
        .trim()
        .isIn(maintenanceCategories)
        .withMessage(
            "Invalid preventive maintenance category."
        ),

    query("priority")
        .optional()
        .isString()
        .withMessage(
            "Priority must be a string."
        )
        .trim()
        .isIn(maintenancePriorities)
        .withMessage(
            "Invalid preventive maintenance priority."
        ),

    query("impact_level")
        .optional()
        .isString()
        .withMessage(
            "Impact level must be a string."
        )
        .trim()
        .isIn(impactLevels)
        .withMessage(
            "Invalid preventive maintenance impact level."
        ),

    query("frequency")
        .optional()
        .isString()
        .withMessage(
            "Frequency must be a string."
        )
        .trim()
        .isIn(preventiveFrequencies)
        .withMessage(
            "Invalid preventive maintenance frequency."
        ),

    query("status")
        .optional()
        .isString()
        .withMessage(
            "Plan status must be a string."
        )
        .trim()
        .isIn(preventivePlanStatuses)
        .withMessage(
            "Invalid preventive maintenance plan status."
        ),

    query("default_assignment_type")
        .optional()
        .isString()
        .withMessage(
            "Default assignment type must be a string."
        )
        .trim()
        .isIn(assignmentTypes)
        .withMessage(
            "Invalid default assignment type."
        ),

    optionalTimestampQueryValidator(
        "due_from",
        "Due-from timestamp"
    ),

    optionalTimestampQueryValidator(
        "due_to",
        "Due-to timestamp"
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

    query("sort_by")
        .optional()
        .isString()
        .withMessage(
            "Sort-by must be a string."
        )
        .trim()
        .isIn([
            "created_at",
            "updated_at",
            "next_due_at",
            "title",
            "priority",
            "status"
        ])
        .withMessage(
            "Invalid preventive plan sort field."
        ),

    query("sort_order")
        .optional()
        .isString()
        .withMessage(
            "Sort order must be a string."
        )
        .trim()
        .toLowerCase()
        .isIn([
            "asc",
            "desc"
        ])
        .withMessage(
            "Sort order must be asc or desc."
        ),

    ...paginationValidators(),

    query().custom(value => {
        if (
            value.due_from &&
            value.due_to &&
            new Date(value.due_from) >
                new Date(value.due_to)
        ) {
            throw new Error(
                "Due-from timestamp cannot be later than due-to timestamp."
            );
        }

        return true;
    })
];

/*
 * GET /api/maintenance/preventive-plans/due
 */
const getDuePreventiveMaintenancePlansValidator = [
    strictQueryValidator([
        "access_context",
        "owner_public_id",
        "property_public_id",
        "unit_public_id",
        "due_through",
        "include_overdue_only",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),
    ownerMutationAccessContextValidator(),
    ownerPublicIdQueryValidator(),
    propertyPublicIdQueryValidator(),
    unitPublicIdQueryValidator(),

    optionalTimestampQueryValidator(
        "due_through",
        "Due-through timestamp"
    ),

    query("include_overdue_only")
        .optional()
        .isBoolean()
        .withMessage(
            "include_overdue_only must be true or false."
        )
        .toBoolean(),

    query("sort_order")
        .optional()
        .isString()
        .withMessage(
            "Sort order must be a string."
        )
        .trim()
        .toLowerCase()
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
 * GET /api/maintenance/preventive-plans/:preventive_plan_public_id
 */
const getSinglePreventiveMaintenancePlanValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    noRequestBodyValidator(),
    preventivePlanPublicIdValidator(),
    preventiveReadAccessContextValidator()
];

/*
 * PATCH /api/maintenance/preventive-plans/:preventive_plan_public_id
 */
const updatePreventiveMaintenancePlanValidator = [
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
        "access_instruction",
        "frequency",
        "interval_value",
        "custom_interval_days",
        "next_due_at",
        "default_assignment_type",
        "assigned_user_public_id",
        "vendor_name",
        "company_name",
        "contact_person",
        "phone_number",
        "email",
        "service_description",
        "estimated_cost",
        "currency_code"
    ]),

    preventivePlanPublicIdValidator(),
    ownerMutationAccessContextValidator(),

    expectedUpdatedAtValidator(
        "expected_updated_at",
        "Expected preventive plan updated-at timestamp"
    ),

    ...planTemplateFieldValidators({
        requireCoreFields: false
    }),

    body().custom(value => {
        const mutableFields = [
            "title",
            "description",
            "category",
            "priority",
            "impact_level",
            "location_details",
            "access_instruction",
            "frequency",
            "interval_value",
            "custom_interval_days",
            "next_due_at",
            "default_assignment_type",
            "assigned_user_public_id",
            "vendor_name",
            "company_name",
            "contact_person",
            "phone_number",
            "email",
            "service_description",
            "estimated_cost",
            "currency_code"
        ];

        if (
            !mutableFields.some(field =>
                Object.prototype.hasOwnProperty.call(
                    value,
                    field
                )
            )
        ) {
            throw new Error(
                "At least one preventive plan field must be supplied for update."
            );
        }

        return true;
    }),

    body().custom(value => {
        if (
            value.frequency !== undefined ||
            value.interval_value !== undefined ||
            value.custom_interval_days !== undefined
        ) {
            if (
                value.frequency === undefined &&
                value.custom_interval_days !== undefined
            ) {
                throw new Error(
                    "Frequency must be supplied when custom_interval_days is updated."
                );
            }

            return validateFrequencyFields(value);
        }

        return true;
    }),

    body().custom(value => {
        const assignmentFields = [
            "default_assignment_type",
            "assigned_user_public_id",
            "vendor_name",
            "company_name",
            "contact_person",
            "phone_number",
            "email",
            "service_description"
        ];

        if (
            assignmentFields.some(field =>
                Object.prototype.hasOwnProperty.call(
                    value,
                    field
                )
            )
        ) {
            if (
                value.default_assignment_type ===
                    undefined
            ) {
                throw new Error(
                    "default_assignment_type must be supplied when default assignment details are updated."
                );
            }

            return validateAssignmentFields(value);
        }

        return true;
    })
];

/*
 * POST /api/maintenance/preventive-plans/:preventive_plan_public_id/pause
 */
const pausePreventiveMaintenancePlanValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_updated_at",
        "pause_reason"
    ]),

    preventivePlanPublicIdValidator(),
    ownerMutationAccessContextValidator(),

    expectedUpdatedAtValidator(
        "expected_updated_at",
        "Expected preventive plan updated-at timestamp"
    ),

    requiredTextValidator(
        "pause_reason",
        "Pause reason",
        5,
        2000
    )
];

/*
 * POST /api/maintenance/preventive-plans/:preventive_plan_public_id/resume
 */
const resumePreventiveMaintenancePlanValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_updated_at"
    ]),

    preventivePlanPublicIdValidator(),
    ownerMutationAccessContextValidator(),

    expectedUpdatedAtValidator(
        "expected_updated_at",
        "Expected preventive plan updated-at timestamp"
    )
];

/*
 * POST /api/maintenance/preventive-plans/:preventive_plan_public_id/complete
 */
const completePreventiveMaintenancePlanValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_updated_at"
    ]),

    preventivePlanPublicIdValidator(),
    ownerMutationAccessContextValidator(),

    expectedUpdatedAtValidator(
        "expected_updated_at",
        "Expected preventive plan updated-at timestamp"
    )
];

/*
 * POST /api/maintenance/preventive-plans/:preventive_plan_public_id/cancel
 */
const cancelPreventiveMaintenancePlanValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_updated_at",
        "cancellation_reason"
    ]),

    preventivePlanPublicIdValidator(),
    ownerMutationAccessContextValidator(),

    expectedUpdatedAtValidator(
        "expected_updated_at",
        "Expected preventive plan updated-at timestamp"
    ),

    requiredTextValidator(
        "cancellation_reason",
        "Cancellation reason",
        5,
        2000
    )
];

/*
 * POST /api/maintenance/preventive-plans/:preventive_plan_public_id/occurrences
 */
const createPreventiveMaintenanceOccurrenceValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_plan_updated_at",
        "due_at"
    ]),

    preventivePlanPublicIdValidator(),
    ownerMutationAccessContextValidator(),

    expectedUpdatedAtValidator(
        "expected_plan_updated_at",
        "Expected preventive plan updated-at timestamp"
    ),

    requiredTimestampBodyValidator(
        "due_at",
        "Occurrence due timestamp"
    )
];

/*
 * GET /api/maintenance/preventive-plans/:preventive_plan_public_id/occurrences
 */
const getPreventiveMaintenanceOccurrencesValidator = [
    strictQueryValidator([
        "access_context",
        "status",
        "due_from",
        "due_to",
        "created_from",
        "created_to",
        "sort_by",
        "sort_order",
        "page",
        "limit"
    ]),

    noRequestBodyValidator(),
    preventivePlanPublicIdValidator(),
    preventiveReadAccessContextValidator(),

    query("status")
        .optional()
        .isString()
        .withMessage(
            "Occurrence status must be a string."
        )
        .trim()
        .isIn(preventiveOccurrenceStatuses)
        .withMessage(
            "Invalid preventive occurrence status."
        ),

    optionalTimestampQueryValidator(
        "due_from",
        "Due-from timestamp"
    ),

    optionalTimestampQueryValidator(
        "due_to",
        "Due-to timestamp"
    ),

    optionalTimestampQueryValidator(
        "created_from",
        "Created-from timestamp"
    ),

    optionalTimestampQueryValidator(
        "created_to",
        "Created-to timestamp"
    ),

    query("sort_by")
        .optional()
        .isString()
        .withMessage(
            "Sort-by must be a string."
        )
        .trim()
        .isIn([
            "due_at",
            "created_at",
            "updated_at",
            "status",
            "generated_at"
        ])
        .withMessage(
            "Invalid preventive occurrence sort field."
        ),

    query("sort_order")
        .optional()
        .isString()
        .withMessage(
            "Sort order must be a string."
        )
        .trim()
        .toLowerCase()
        .isIn([
            "asc",
            "desc"
        ])
        .withMessage(
            "Sort order must be asc or desc."
        ),

    ...paginationValidators(),

    query().custom(value => {
        if (
            value.due_from &&
            value.due_to &&
            new Date(value.due_from) >
                new Date(value.due_to)
        ) {
            throw new Error(
                "Due-from timestamp cannot be later than due-to timestamp."
            );
        }

        if (
            value.created_from &&
            value.created_to &&
            new Date(value.created_from) >
                new Date(value.created_to)
        ) {
            throw new Error(
                "Created-from timestamp cannot be later than created-to timestamp."
            );
        }

        return true;
    })
];

/*
 * GET /api/maintenance/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id
 */
const getSinglePreventiveMaintenanceOccurrenceValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    noRequestBodyValidator(),
    preventivePlanPublicIdValidator(),
    preventiveOccurrencePublicIdValidator(),
    preventiveReadAccessContextValidator()
];

/*
 * POST /api/maintenance/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id/generate
 */
const generatePreventiveMaintenanceOccurrenceValidator = [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_occurrence_updated_at",
        "expected_plan_updated_at"
    ]),

    preventivePlanPublicIdValidator(),
    preventiveOccurrencePublicIdValidator(),
    ownerMutationAccessContextValidator(),

    expectedUpdatedAtValidator(
        "expected_occurrence_updated_at",
        "Expected preventive occurrence updated-at timestamp"
    ),

    expectedUpdatedAtValidator(
        "expected_plan_updated_at",
        "Expected preventive plan updated-at timestamp"
    )
];

const occurrenceReasonValidator = ({
    endpointName,
    bodyField
}) => [
    strictQueryValidator([
        "access_context"
    ]),

    ...strictBodyValidator([
        "expected_occurrence_updated_at",
        bodyField
    ]),

    preventivePlanPublicIdValidator(),
    preventiveOccurrencePublicIdValidator(),
    ownerMutationAccessContextValidator(),

    expectedUpdatedAtValidator(
        "expected_occurrence_updated_at",
        "Expected preventive occurrence updated-at timestamp"
    ),

    requiredTextValidator(
        bodyField,
        endpointName,
        5,
        2000
    )
];

/*
 * POST /api/maintenance/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id/skip
 */
const skipPreventiveMaintenanceOccurrenceValidator =
    occurrenceReasonValidator({
        endpointName: "Skip reason",
        bodyField: "skip_reason"
    });

/*
 * POST /api/maintenance/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id/fail
 */
const failPreventiveMaintenanceOccurrenceValidator =
    occurrenceReasonValidator({
        endpointName: "Failure reason",
        bodyField: "failure_reason"
    });

/*
 * POST /api/maintenance/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id/cancel
 */
const cancelPreventiveMaintenanceOccurrenceValidator =
    occurrenceReasonValidator({
        endpointName: "Cancellation reason",
        bodyField: "cancellation_reason"
    });

/*
 * POST /api/maintenance/preventive-plans/process-due
 *
 * This route is an authenticated administrative trigger for
 * the same idempotent service used by the cron scheduler.
 */
const processDuePreventiveMaintenancePlansValidator = [
    strictQueryValidator([]),

    ...strictBodyValidator([
        "due_through",
        "limit"
    ]),

    adminOnlyValidator(),

    optionalTimestampBodyValidator(
        "due_through",
        "Due-through timestamp"
    ),

    body("limit")
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

module.exports = {
    createPreventiveMaintenancePlanValidator,
    getPreventiveMaintenancePlansValidator,
    getDuePreventiveMaintenancePlansValidator,
    getSinglePreventiveMaintenancePlanValidator,
    updatePreventiveMaintenancePlanValidator,
    pausePreventiveMaintenancePlanValidator,
    resumePreventiveMaintenancePlanValidator,
    completePreventiveMaintenancePlanValidator,
    cancelPreventiveMaintenancePlanValidator,
    createPreventiveMaintenanceOccurrenceValidator,
    getPreventiveMaintenanceOccurrencesValidator,
    getSinglePreventiveMaintenanceOccurrenceValidator,
    generatePreventiveMaintenanceOccurrenceValidator,
    skipPreventiveMaintenanceOccurrenceValidator,
    failPreventiveMaintenanceOccurrenceValidator,
    cancelPreventiveMaintenanceOccurrenceValidator,
    processDuePreventiveMaintenancePlansValidator
};

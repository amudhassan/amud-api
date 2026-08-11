const {
    body,
    query,
    param
} = require("express-validator");

const leaseClauseTemplateStatuses = [
    "active",
    "inactive"
];

const leaseClauseCategories = [
    "pets",
    "subletting",
    "utilities",
    "maintenance",
    "occupancy",
    "property_use",
    "alterations",
    "notice",
    "termination",
    "deposit",
    "access_inspection",
    "smoking",
    "noise",
    "parking",
    "insurance_liability",
    "custom"
];

const rejectQueryFieldsExcept =
    allowedFields =>
        query()
            .custom(value => {
                const suppliedFields =
                    Object.keys(value || {});

                const unsupportedFields =
                    suppliedFields.filter(
                        field =>
                            !allowedFields.includes(
                                field
                            )
                    );

                if (
                    unsupportedFields.length > 0
                ) {
                    throw new Error(
                        `Unsupported query parameters: ${unsupportedFields.join(", ")}.`
                    );
                }

                return true;
            });

const rejectAllQueryFields =
    rejectQueryFieldsExcept([]);

const rejectRequestBody =
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
        });

const requireJsonObject =
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
        });

const ownerPublicIdQuery =
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
        );

const ownerPublicIdBody =
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
        );

const templatePublicIdParam =
    param("template_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Template public ID is required."
        )
        .isString()
        .withMessage(
            "Template public ID must be a string."
        )
        .trim()
        .isLength({
            min: 24,
            max: 90
        })
        .withMessage(
            "Invalid template public ID length."
        )
        .matches(
            /^lease_clause_template_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid template public ID format."
        );

const templateItemPublicIdParam =
    param("item_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Template item public ID is required."
        )
        .isString()
        .withMessage(
            "Template item public ID must be a string."
        )
        .trim()
        .isLength({
            min: 29,
            max: 100
        })
        .withMessage(
            "Invalid template item public ID length."
        )
        .matches(
            /^lease_clause_template_item_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid template item public ID format."
        );

const leasePublicIdParam =
    param("lease_public_id")
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
            max: 70
        })
        .withMessage(
            "Invalid lease public ID length."
        )
        .matches(
            /^lease_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid lease public ID format."
        );

const templateNameBody =
    body("name")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Template name is required."
        )
        .isString()
        .withMessage(
            "Template name must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 200
        })
        .withMessage(
            "Template name must contain between 1 and 200 characters."
        );

const optionalTemplateNameBody =
    body("name")
        .optional()
        .isString()
        .withMessage(
            "Template name must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 200
        })
        .withMessage(
            "Template name must contain between 1 and 200 characters."
        );

const optionalDescriptionBody =
    body("description")
        .optional({
            nullable: true
        })
        .custom(value => {
            if (value === null) {
                return true;
            }

            if (typeof value !== "string") {
                throw new Error(
                    "Template description must be a string or null."
                );
            }

            const trimmed =
                value.trim();

            if (
                trimmed.length < 1 ||
                trimmed.length > 2000
            ) {
                throw new Error(
                    "Template description must contain between 1 and 2000 characters when supplied."
                );
            }

            return true;
        })
        .customSanitizer(value => {
            if (value === null) {
                return null;
            }

            if (
                typeof value === "string"
            ) {
                return value.trim();
            }

            return value;
        });

const optionalStatusBody =
    body("status")
        .optional()
        .isString()
        .withMessage(
            "Template status must be a string."
        )
        .trim()
        .isIn(
            leaseClauseTemplateStatuses
        )
        .withMessage(
            "Template status must be active or inactive."
        );

const itemCategoryBody =
    body("clause_category")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Clause category is required."
        )
        .isString()
        .withMessage(
            "Clause category must be a string."
        )
        .trim()
        .isIn(
            leaseClauseCategories
        )
        .withMessage(
            "Invalid clause category."
        );

const optionalItemCategoryBody =
    body("clause_category")
        .optional()
        .isString()
        .withMessage(
            "Clause category must be a string."
        )
        .trim()
        .isIn(
            leaseClauseCategories
        )
        .withMessage(
            "Invalid clause category."
        );

const itemTitleBody =
    body("title")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Clause title is required."
        )
        .isString()
        .withMessage(
            "Clause title must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 200
        })
        .withMessage(
            "Clause title must contain between 1 and 200 characters."
        );

const optionalItemTitleBody =
    body("title")
        .optional()
        .isString()
        .withMessage(
            "Clause title must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 200
        })
        .withMessage(
            "Clause title must contain between 1 and 200 characters."
        );

const itemTextBody =
    body("clause_text")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Clause text is required."
        )
        .isString()
        .withMessage(
            "Clause text must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 10000
        })
        .withMessage(
            "Clause text must contain between 1 and 10000 characters."
        );

const optionalItemTextBody =
    body("clause_text")
        .optional()
        .isString()
        .withMessage(
            "Clause text must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 10000
        })
        .withMessage(
            "Clause text must contain between 1 and 10000 characters."
        );

const optionalMandatoryBody =
    body("is_mandatory")
        .optional()
        .isBoolean()
        .withMessage(
            "is_mandatory must be a boolean."
        )
        .toBoolean();

const optionalDisplayOrderBody =
    body("display_order")
        .optional()
        .isInt({
            min: 1,
            max: 10000
        })
        .withMessage(
            "Display order must be an integer between 1 and 10000."
        )
        .toInt();

/*
 * GET /api/lease-clause-templates
 */
const getLeaseClauseTemplatesValidator = [
    rejectQueryFieldsExcept([
        "owner_public_id",
        "status"
    ]),
    rejectRequestBody,
    ownerPublicIdQuery,

    query("status")
        .optional()
        .isString()
        .withMessage(
            "Template status must be a string."
        )
        .trim()
        .isIn(
            leaseClauseTemplateStatuses
        )
        .withMessage(
            "Template status must be active or inactive."
        )
];

/*
 * POST /api/lease-clause-templates
 */
const createLeaseClauseTemplateValidator = [
    rejectAllQueryFields,
    requireJsonObject,

    body()
        .custom(value => {
            const allowedFields = [
                "owner_public_id",
                "name",
                "description",
                "status"
            ];

            const suppliedFields =
                Object.keys(value || {});

            const unsupportedFields =
                suppliedFields.filter(
                    field =>
                        !allowedFields.includes(
                            field
                        )
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

    ownerPublicIdBody,
    templateNameBody,
    optionalDescriptionBody,
    optionalStatusBody
];

/*
 * GET /api/lease-clause-templates/:template_public_id
 */
const getSingleLeaseClauseTemplateValidator = [
    rejectAllQueryFields,
    rejectRequestBody,
    templatePublicIdParam
];

/*
 * PATCH /api/lease-clause-templates/:template_public_id
 */
const updateLeaseClauseTemplateValidator = [
    rejectAllQueryFields,
    templatePublicIdParam,
    requireJsonObject,

    body()
        .custom(value => {
            const allowedFields = [
                "name",
                "description",
                "status"
            ];

            const suppliedFields =
                Object.keys(value || {});

            const unsupportedFields =
                suppliedFields.filter(
                    field =>
                        !allowedFields.includes(
                            field
                        )
                );

            if (
                unsupportedFields.length > 0
            ) {
                throw new Error(
                    `Unsupported fields: ${unsupportedFields.join(", ")}.`
                );
            }

            if (
                suppliedFields.length === 0
            ) {
                throw new Error(
                    "At least one template field must be supplied."
                );
            }

            return true;
        }),

    optionalTemplateNameBody,
    optionalDescriptionBody,
    optionalStatusBody
];

/*
 * DELETE /api/lease-clause-templates/:template_public_id
 */
const deleteLeaseClauseTemplateValidator = [
    rejectAllQueryFields,
    templatePublicIdParam,
    rejectRequestBody
];

/*
 * POST
 * /api/lease-clause-templates/:template_public_id/items
 */
const createLeaseClauseTemplateItemValidator = [
    rejectAllQueryFields,
    templatePublicIdParam,
    requireJsonObject,

    body()
        .custom(value => {
            const allowedFields = [
                "clause_category",
                "title",
                "clause_text",
                "is_mandatory",
                "display_order"
            ];

            const suppliedFields =
                Object.keys(value || {});

            const unsupportedFields =
                suppliedFields.filter(
                    field =>
                        !allowedFields.includes(
                            field
                        )
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

    itemCategoryBody,
    itemTitleBody,
    itemTextBody,
    optionalMandatoryBody,
    optionalDisplayOrderBody
];

/*
 * PATCH
 * /api/lease-clause-templates/:template_public_id/items/:item_public_id
 */
const updateLeaseClauseTemplateItemValidator = [
    rejectAllQueryFields,
    templatePublicIdParam,
    templateItemPublicIdParam,
    requireJsonObject,

    body()
        .custom(value => {
            const allowedFields = [
                "clause_category",
                "title",
                "clause_text",
                "is_mandatory",
                "display_order"
            ];

            const suppliedFields =
                Object.keys(value || {});

            const unsupportedFields =
                suppliedFields.filter(
                    field =>
                        !allowedFields.includes(
                            field
                        )
                );

            if (
                unsupportedFields.length > 0
            ) {
                throw new Error(
                    `Unsupported fields: ${unsupportedFields.join(", ")}.`
                );
            }

            if (
                suppliedFields.length === 0
            ) {
                throw new Error(
                    "At least one template item field must be supplied."
                );
            }

            return true;
        }),

    optionalItemCategoryBody,
    optionalItemTitleBody,
    optionalItemTextBody,
    optionalMandatoryBody,
    optionalDisplayOrderBody
];

/*
 * DELETE
 * /api/lease-clause-templates/:template_public_id/items/:item_public_id
 */
const deleteLeaseClauseTemplateItemValidator = [
    rejectAllQueryFields,
    templatePublicIdParam,
    templateItemPublicIdParam,
    rejectRequestBody
];

/*
 * POST /api/leases/:lease_public_id/apply-clause-template
 */
const applyLeaseClauseTemplateValidator = [
    rejectAllQueryFields,
    leasePublicIdParam,
    requireJsonObject,

    body()
        .custom(value => {
            const allowedFields = [
                "template_public_id"
            ];

            const suppliedFields =
                Object.keys(value || {});

            const unsupportedFields =
                suppliedFields.filter(
                    field =>
                        !allowedFields.includes(
                            field
                        )
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

    body("template_public_id")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Template public ID is required."
        )
        .isString()
        .withMessage(
            "Template public ID must be a string."
        )
        .trim()
        .isLength({
            min: 24,
            max: 90
        })
        .withMessage(
            "Invalid template public ID length."
        )
        .matches(
            /^lease_clause_template_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid template public ID format."
        )
];

module.exports = {
    getLeaseClauseTemplatesValidator,
    createLeaseClauseTemplateValidator,
    getSingleLeaseClauseTemplateValidator,
    updateLeaseClauseTemplateValidator,
    deleteLeaseClauseTemplateValidator,
    createLeaseClauseTemplateItemValidator,
    updateLeaseClauseTemplateItemValidator,
    deleteLeaseClauseTemplateItemValidator,
    applyLeaseClauseTemplateValidator
};

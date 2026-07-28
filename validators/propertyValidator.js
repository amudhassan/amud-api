const {
    query,
    body,
    param
} = require("express-validator");

const getPropertiesValidator = [
    query()
        .custom(value => {
            const allowedQueryFields = [
                "search",
                "property_type",
                "usage_category",
                "operational_status",
                "is_multi_unit",
                "city",
                "region",
                "country",
                "owner_public_id",
                "page",
                "limit"
            ];

            const suppliedFields =
                Object.keys(value || {});

            const unsupportedFields =
                suppliedFields.filter(
                    field =>
                        !allowedQueryFields.includes(
                            field
                        )
                );

            if (unsupportedFields.length > 0) {
                throw new Error(
                    `Unsupported query parameters: ${unsupportedFields.join(", ")}.`
                );
            }

            return true;
        }),

    query("search")
        .optional()
        .isString()
        .withMessage(
            "Search must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 150
        })
        .withMessage(
            "Search must contain between 1 and 150 characters."
        ),

    query("property_type")
        .optional()
        .isString()
        .withMessage(
            "Property type must be a string."
        )
        .trim()
        .isLength({
            min: 2,
            max: 60
        })
        .withMessage(
            "Property type must contain between 2 and 60 characters."
        )
        .matches(
            /^[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Property type may only contain letters, numbers, underscores and hyphens."
        ),

    query("usage_category")
        .optional()
        .isIn([
            "residential",
            "commercial",
            "mixed",
            "industrial",
            "land",
            "hospitality",
            "institutional",
            "agricultural",
            "other"
        ])
        .withMessage(
            "Invalid property usage category."
        ),

    query("operational_status")
        .optional()
        .isIn([
            "inactive",
            "active",
            "maintenance",
            "under_construction",
            "sold"
        ])
        .withMessage(
            "Invalid property operational status."
        ),

    query("is_multi_unit")
        .optional()
        .isBoolean()
        .withMessage(
            "is_multi_unit must be true or false."
        )
        .toBoolean(),

    query("city")
        .optional()
        .isString()
        .withMessage(
            "City must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 100
        })
        .withMessage(
            "City cannot exceed 100 characters."
        ),

    query("region")
        .optional()
        .isString()
        .withMessage(
            "Region must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 100
        })
        .withMessage(
            "Region cannot exceed 100 characters."
        ),

    query("country")
        .optional()
        .isString()
        .withMessage(
            "Country must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 100
        })
        .withMessage(
            "Country cannot exceed 100 characters."
        ),

    query("owner_public_id")
        .optional()
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

    query("page")
        .optional()
        .isInt({
            min: 1
        })
        .withMessage(
            "Page must be an integer greater than or equal to 1."
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
const createPropertyValidator = [
    body()
        .custom(value => {
            const allowedFields = [
                "property_name",
                "property_type",
                "usage_category",
                "description",
                "address",
                "city",
                "region",
                "country",
                "latitude",
                "longitude",
                "year_built",
                "is_multi_unit",
                "ownerships"
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

            const ownerships =
                value.ownerships || [];

            const ownerIds =
                ownerships.map(
                    ownership =>
                        ownership.owner_public_id
                );

            if (
                new Set(ownerIds).size !==
                ownerIds.length
            ) {
                throw new Error(
                    "The same owner cannot appear more than once in property ownerships."
                );
            }

            const totalOwnership =
                ownerships.reduce(
                    (total, ownership) =>
                        total +
                        Number(
                            ownership
                                .ownership_percentage ||
                            0
                        ),
                    0
                );

            if (totalOwnership > 100) {
                throw new Error(
                    "Total property ownership cannot exceed 100%."
                );
            }

            const primaryCount =
                ownerships.filter(
                    ownership =>
                        ownership
                            .is_primary_contact ===
                        true
                ).length;

            if (primaryCount > 1) {
                throw new Error(
                    "Only one property owner can be the primary contact."
                );
            }

            return true;
        }),

    body("property_name")
        .exists({ checkFalsy: true })
        .withMessage(
            "Property name is required."
        )
        .isString()
        .trim()
        .isLength({
            min: 2,
            max: 150
        })
        .withMessage(
            "Property name must contain between 2 and 150 characters."
        ),

    body("property_type")
        .exists({ checkFalsy: true })
        .withMessage(
            "Property type is required."
        )
        .isString()
        .trim()
        .isLength({
            min: 2,
            max: 60
        })
        .matches(
            /^[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Property type may only contain letters, numbers, underscores and hyphens."
        ),

    body("usage_category")
        .exists({ checkFalsy: true })
        .withMessage(
            "Usage category is required."
        )
        .isIn([
            "residential",
            "commercial",
            "mixed",
            "industrial",
            "land",
            "hospitality",
            "institutional",
            "agricultural",
            "other"
        ])
        .withMessage(
            "Invalid property usage category."
        ),

    body("description")
        .optional({
            nullable: true
        })
        .isString()
        .trim()
        .isLength({ max: 2000 })
        .withMessage(
            "Description cannot exceed 2000 characters."
        ),

    body("address")
        .optional({
            nullable: true
        })
        .isString()
        .trim()
        .isLength({ max: 255 })
        .withMessage(
            "Address cannot exceed 255 characters."
        ),

    body("city")
        .optional({
            nullable: true
        })
        .isString()
        .trim()
        .isLength({ max: 100 })
        .withMessage(
            "City cannot exceed 100 characters."
        ),

    body("region")
        .optional({
            nullable: true
        })
        .isString()
        .trim()
        .isLength({ max: 100 })
        .withMessage(
            "Region cannot exceed 100 characters."
        ),

    body("country")
        .exists({ checkFalsy: true })
        .withMessage(
            "Country is required."
        )
        .isString()
        .trim()
        .isLength({
            min: 2,
            max: 100
        })
        .withMessage(
            "Country must contain between 2 and 100 characters."
        ),

    body("latitude")
        .optional({
            nullable: true
        })
        .isFloat({
            min: -90,
            max: 90
        })
        .withMessage(
            "Latitude must be between -90 and 90."
        )
        .toFloat(),

    body("longitude")
        .optional({
            nullable: true
        })
        .isFloat({
            min: -180,
            max: 180
        })
        .withMessage(
            "Longitude must be between -180 and 180."
        )
        .toFloat(),

    body("year_built")
        .optional({
            nullable: true
        })
        .isInt({
            min: 1000,
            max: 2100
        })
        .withMessage(
            "Year built must be between 1000 and 2100."
        )
        .toInt(),

    body("is_multi_unit")
        .exists({
            checkNull: true
        })
        .withMessage(
            "is_multi_unit is required."
        )
        .isBoolean()
        .withMessage(
            "is_multi_unit must be true or false."
        )
        .toBoolean(),

    body("ownerships")
        .isArray({
            min: 1,
            max: 100
        })
        .withMessage(
            "At least one property owner is required."
        ),

    body("ownerships.*.owner_public_id")
        .exists({ checkFalsy: true })
        .withMessage(
            "Owner public ID is required for every ownership."
        )
        .isString()
        .trim()
        .matches(
            /^owner_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid owner public ID format."
        ),

    body(
        "ownerships.*.ownership_percentage"
    )
        .exists({
            checkNull: true,
            checkFalsy: false
        })
        .withMessage(
            "Ownership percentage is required."
        )
        .isFloat({
            gt: 0,
            max: 100
        })
        .withMessage(
            "Ownership percentage must be greater than 0 and cannot exceed 100."
        )
        .custom(value => {
            if (
                !/^\d+(\.\d{1,4})?$/.test(
                    String(value)
                )
            ) {
                throw new Error(
                    "Ownership percentage cannot contain more than four decimal places."
                );
            }

            return true;
        })
        .toFloat(),

    body("ownerships.*.ownership_type")
        .optional()
        .isIn([
            "legal",
            "beneficial",
            "trustee",
            "nominee",
            "customary",
            "government",
            "other"
        ])
        .withMessage(
            "Invalid property ownership type."
        ),

    body(
        "ownerships.*.is_primary_contact"
    )
        .optional()
        .isBoolean()
        .withMessage(
            "is_primary_contact must be true or false."
        )
        .toBoolean(),

    body("ownerships.*.effective_from")
        .optional({
            nullable: true,
            checkFalsy: true
        })
        .isISO8601({
            strict: true
        })
        .withMessage(
            "Effective-from date must use YYYY-MM-DD format."
        )
];
const getSinglePropertyValidator = [
    param("property_public_id")
        .exists({ checkFalsy: true })
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
        )
];
module.exports = {
    getPropertiesValidator,
    createPropertyValidator,
    getSinglePropertyValidator
};
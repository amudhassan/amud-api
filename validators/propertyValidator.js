const {
    query
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

module.exports = {
    getPropertiesValidator
};
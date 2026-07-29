const {
    body,
    param,
    query
} = require("express-validator");

const allowedUnitTypes = [
    "apartment",
    "house",
    "room",
    "shop",
    "office",
    "warehouse",
    "studio",
    "villa",
    "land_section",
    "commercial_space",
    "other"
];

const allowedUnitStatuses = [
    "inactive",
    "available",
    "reserved",
    "occupied",
    "maintenance"
];

const getPropertyUnitsValidator = [
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
            max: 100
        })
        .withMessage(
            "Search must contain between 1 and 100 characters."
        ),

    query("unit_type")
        .optional()
        .isIn(allowedUnitTypes)
        .withMessage(
            "Invalid unit type."
        ),

    query("operational_status")
        .optional()
        .isIn(allowedUnitStatuses)
        .withMessage(
            "Invalid unit operational status."
        ),

    query("floor_number")
        .optional()
        .isInt({
            min: -20,
            max: 300
        })
        .withMessage(
            "Floor number must be between -20 and 300."
        )
        .toInt(),

    query("bedrooms")
        .optional()
        .isInt({
            min: 0,
            max: 100
        })
        .withMessage(
            "Bedrooms must be between 0 and 100."
        )
        .toInt(),

    query("bathrooms")
        .optional()
        .isFloat({
            min: 0,
            max: 100
        })
        .withMessage(
            "Bathrooms must be between 0 and 100."
        )
        .toFloat(),

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
const createUnitValidator = [
    param("property_public_id")
        .exists({ checkFalsy: true })
        .withMessage(
            "Property public ID is required."
        )
        .isString()
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

    body()
        .custom(value => {
            const allowedFields = [
                "unit_code",
                "unit_name",
                "unit_type",
                "floor_number",
                "bedrooms",
                "bathrooms",
                "area_size",
                "area_unit",
                "description"
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

            const hasAreaSize =
                value.area_size !== undefined &&
                value.area_size !== null;

            const hasAreaUnit =
                value.area_unit !== undefined &&
                value.area_unit !== null;

            if (hasAreaSize !== hasAreaUnit) {
                throw new Error(
                    "area_size and area_unit must be supplied together."
                );
            }

            return true;
        }),

    body("unit_code")
        .exists({ checkFalsy: true })
        .withMessage(
            "Unit code is required."
        )
        .isString()
        .withMessage(
            "Unit code must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 50
        })
        .withMessage(
            "Unit code must contain between 1 and 50 characters."
        ),

    body("unit_name")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Unit name must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 150
        })
        .withMessage(
            "Unit name must contain between 1 and 150 characters."
        ),

    body("unit_type")
        .exists({ checkFalsy: true })
        .withMessage(
            "Unit type is required."
        )
        .isIn(allowedUnitTypes)
        .withMessage(
            "Invalid unit type."
        ),

    body("floor_number")
        .optional({
            nullable: true
        })
        .isInt({
            min: -20,
            max: 300
        })
        .withMessage(
            "Floor number must be between -20 and 300."
        )
        .toInt(),

    body("bedrooms")
        .optional()
        .isInt({
            min: 0,
            max: 100
        })
        .withMessage(
            "Bedrooms must be between 0 and 100."
        )
        .toInt(),

    body("bathrooms")
        .optional()
        .isFloat({
            min: 0,
            max: 100
        })
        .withMessage(
            "Bathrooms must be between 0 and 100."
        )
        .custom(value => {
            if (
                !/^\d+(\.\d{1,2})?$/.test(
                    String(value)
                )
            ) {
                throw new Error(
                    "Bathrooms cannot contain more than two decimal places."
                );
            }

            return true;
        })
        .toFloat(),

    body("area_size")
        .optional({
            nullable: true
        })
        .isFloat({
            gt: 0,
            max: 999999999999.99
        })
        .withMessage(
            "Area size must be greater than 0."
        )
        .custom(value => {
            if (
                !/^\d+(\.\d{1,2})?$/.test(
                    String(value)
                )
            ) {
                throw new Error(
                    "Area size cannot contain more than two decimal places."
                );
            }

            return true;
        })
        .toFloat(),

    body("area_unit")
        .optional({
            nullable: true
        })
        .isIn([
            "square_meter",
            "square_foot",
            "acre",
            "hectare",
            "other"
        ])
        .withMessage(
            "Invalid area unit."
        ),

    body("description")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Description must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 5000
        })
        .withMessage(
            "Description cannot exceed 5000 characters."
        )
];
const getSingleUnitValidator = [
    param("unit_public_id")
        .exists({ checkFalsy: true })
        .withMessage(
            "Unit public ID is required."
        )

        .isString()
        .withMessage(
            "Unit public ID must be a string."
        )

        .trim()

        .isLength({
            min: 10,
            max: 50
        })
        .withMessage(
            "Unit public ID must contain between 10 and 50 characters."
        )

        .matches(
            /^unit_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid unit public ID format."
        )
];
const updateUnitValidator = [
    param("unit_public_id")
        .exists({ checkFalsy: true })
        .withMessage(
            "Unit public ID is required."
        )
        .isString()
        .withMessage(
            "Unit public ID must be a string."
        )
        .trim()
        .isLength({
            min: 10,
            max: 50
        })
        .withMessage(
            "Unit public ID must contain between 10 and 50 characters."
        )
        .matches(
            /^unit_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid unit public ID format."
        ),

    body()
        .custom(value => {
            const allowedFields = [
                "unit_code",
                "unit_name",
                "unit_type",
                "floor_number",
                "bedrooms",
                "bathrooms",
                "area_size",
                "area_unit",
                "description"
            ];

            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length === 0) {
                throw new Error(
                    "At least one unit field is required for update."
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

            const hasAreaSize =
                Object.prototype
                    .hasOwnProperty.call(
                        value,
                        "area_size"
                    );

            const hasAreaUnit =
                Object.prototype
                    .hasOwnProperty.call(
                        value,
                        "area_unit"
                    );

            /*
             * Kama zote zimetumwa pamoja,
             * haziwezi kuwa moja null na nyingine value.
             */
            if (hasAreaSize && hasAreaUnit) {
                const areaSizeIsNull =
                    value.area_size === null;

                const areaUnitIsNull =
                    value.area_unit === null;

                if (
                    areaSizeIsNull !==
                    areaUnitIsNull
                ) {
                    throw new Error(
                        "area_size and area_unit must either both have values or both be null."
                    );
                }
            }

            return true;
        }),

    body("unit_code")
        .optional()
        .isString()
        .withMessage(
            "Unit code must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 50
        })
        .withMessage(
            "Unit code must contain between 1 and 50 characters."
        ),

    body("unit_name")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Unit name must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 150
        })
        .withMessage(
            "Unit name must contain between 1 and 150 characters."
        ),

    body("unit_type")
        .optional()
        .isIn(allowedUnitTypes)
        .withMessage(
            "Invalid unit type."
        ),

    body("floor_number")
        .optional({
            nullable: true
        })
        .isInt({
            min: -20,
            max: 300
        })
        .withMessage(
            "Floor number must be between -20 and 300."
        )
        .toInt(),

    body("bedrooms")
        .optional()
        .isInt({
            min: 0,
            max: 100
        })
        .withMessage(
            "Bedrooms must be between 0 and 100."
        )
        .toInt(),

    body("bathrooms")
        .optional()
        .isFloat({
            min: 0,
            max: 100
        })
        .withMessage(
            "Bathrooms must be between 0 and 100."
        )
        .custom(value => {
            if (
                !/^\d+(\.\d{1,2})?$/.test(
                    String(value)
                )
            ) {
                throw new Error(
                    "Bathrooms cannot contain more than two decimal places."
                );
            }

            return true;
        })
        .toFloat(),

    body("area_size")
        .optional({
            nullable: true
        })
        .isFloat({
            gt: 0,
            max: 999999999999.99
        })
        .withMessage(
            "Area size must be greater than 0."
        )
        .custom(value => {
            if (
                !/^\d+(\.\d{1,2})?$/.test(
                    String(value)
                )
            ) {
                throw new Error(
                    "Area size cannot contain more than two decimal places."
                );
            }

            return true;
        })
        .toFloat(),

    body("area_unit")
        .optional({
            nullable: true
        })
        .isIn([
            "square_meter",
            "square_foot",
            "acre",
            "hectare",
            "other"
        ])
        .withMessage(
            "Invalid area unit."
        ),

    body("description")
        .optional({
            nullable: true
        })
        .isString()
        .withMessage(
            "Description must be a string."
        )
        .trim()
        .isLength({
            min: 1,
            max: 5000
        })
        .withMessage(
            "Description cannot exceed 5000 characters."
        )
];
const activateUnitValidator = [
    param("unit_public_id")
        .exists({ checkFalsy: true })
        .withMessage(
            "Unit public ID is required."
        )
        .isString()
        .withMessage(
            "Unit public ID must be a string."
        )
        .trim()
        .isLength({
            min: 10,
            max: 50
        })
        .withMessage(
            "Unit public ID must contain between 10 and 50 characters."
        )
        .matches(
            /^unit_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid unit public ID format."
        ),

    body()
        .custom(value => {
            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length > 0) {
                throw new Error(
                    "Activate unit request does not accept body fields."
                );
            }

            return true;
        })
];
module.exports = {
    getPropertyUnitsValidator,
    createUnitValidator,
    getSingleUnitValidator,
    updateUnitValidator,
    activateUnitValidator
};
const {
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

module.exports = {
    getPropertyUnitsValidator
};
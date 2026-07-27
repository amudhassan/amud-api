const { body,
    query,
    param
 } = require("express-validator");

const createOwnerValidator = [
    body("owner_type")
        .exists({ checkFalsy: true })
        .withMessage("Owner type is required.")
        .isIn([
            "individual",
            "company",
            "government",
            "organization",
            "partnership"
        ])
        .withMessage("Invalid owner type."),

    body("display_name")
        .exists({ checkFalsy: true })
        .withMessage("Display name is required.")
        .isString()
        .withMessage("Display name must be a string.")
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage(
            "Display name must contain between 2 and 255 characters."
        ),

    body("registration_number")
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .withMessage("Registration number must be a string.")
        .trim()
        .isLength({ max: 100 })
        .withMessage(
            "Registration number cannot exceed 100 characters."
        ),

    body("tax_identification_number")
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .withMessage(
            "Tax identification number must be a string."
        )
        .trim()
        .isLength({ max: 100 })
        .withMessage(
            "Tax identification number cannot exceed 100 characters."
        ),

    body("email")
        .optional({ nullable: true, checkFalsy: true })
        .isEmail()
        .withMessage("A valid email address is required.")
        .normalizeEmail(),

    body("phone_number")
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .withMessage("Phone number must be a string.")
        .trim()
        .isLength({ max: 30 })
        .withMessage(
            "Phone number cannot exceed 30 characters."
        ),

    body("alternative_phone")
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .withMessage("Alternative phone must be a string.")
        .trim()
        .isLength({ max: 30 })
        .withMessage(
            "Alternative phone cannot exceed 30 characters."
        )
        .custom((value, { req }) => {
            if (
                value &&
                req.body.phone_number &&
                value.trim() === req.body.phone_number.trim()
            ) {
                throw new Error(
                    "Alternative phone must be different from the primary phone number."
                );
            }

            return true;
        }),

    body("address")
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .withMessage("Address must be a string.")
        .trim(),

    body("city")
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .withMessage("City must be a string.")
        .trim()
        .isLength({ max: 100 })
        .withMessage("City cannot exceed 100 characters."),

    body("region")
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .withMessage("Region must be a string.")
        .trim()
        .isLength({ max: 100 })
        .withMessage("Region cannot exceed 100 characters."),

    body("country")
        .exists({ checkFalsy: true })
        .withMessage("Country is required.")
        .isString()
        .withMessage("Country must be a string.")
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage(
            "Country must contain between 2 and 100 characters."
        )
];

const getOwnersValidator = [
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            "Page must be an integer greater than zero."
        )
        .toInt(),

    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage(
            "Limit must be an integer between 1 and 100."
        )
        .toInt(),

    query("search")
        .optional({ checkFalsy: true })
        .isString()
        .withMessage("Search must be a string.")
        .trim()
        .isLength({ max: 100 })
        .withMessage(
            "Search cannot exceed 100 characters."
        ),

    query("owner_type")
        .optional({ checkFalsy: true })
        .isIn([
            "individual",
            "company",
            "government",
            "organization",
            "partnership"
        ])
        .withMessage("Invalid owner type."),

    query("status")
        .optional({ checkFalsy: true })
        .isIn([
            "active",
            "inactive",
            "blocked"
        ])
        .withMessage("Invalid owner status."),

    query("country")
        .optional({ checkFalsy: true })
        .isString()
        .withMessage("Country must be a string.")
        .trim()
        .isLength({ max: 100 })
        .withMessage(
            "Country cannot exceed 100 characters."
        )
];

const getSingleOwnerValidator = [
    param("public_id")
        .exists({ checkFalsy: true })
        .withMessage("Owner public ID is required.")
        .isString()
        .withMessage("Owner public ID must be a string.")
        .trim()
        .isLength({ min: 7, max: 40 })
        .withMessage(
            "Owner public ID must contain between 7 and 40 characters."
        )
        .matches(/^owner_[A-Za-z0-9_-]+$/)
        .withMessage("Invalid owner public ID format.")
];

module.exports = {
    createOwnerValidator,
    getOwnersValidator,
    getSingleOwnerValidator
};
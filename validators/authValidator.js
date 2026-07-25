const { body } = require("express-validator");

const registerValidation = [

    body("full_name")
        .trim()
        .notEmpty()
        .withMessage("Full name is required")
        .bail()
        .isLength({ min: 3 })
        .withMessage("Full name must be at least 3 characters"),

    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .bail()
        .isEmail()
        .withMessage("Please provide a valid email"),

    body("password")
        .notEmpty()
        .withMessage("Password is required")
        .bail()
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters")

];

const loginValidation = [

    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .bail()
        .isEmail()
        .withMessage("Please provide a valid email"),

    body("password")
        .notEmpty()
        .withMessage("Password is required")

];

const updateProfileValidation = [

    body("full_name")
        .trim()
        .notEmpty()
        .withMessage("Full name is required")
        .bail()
        .isLength({ min: 3, max: 100 })
        .withMessage(
            "Full name must be between 3 and 100 characters"
        )

];

module.exports = {
    registerValidation,
    loginValidation,
    updateProfileValidation
};
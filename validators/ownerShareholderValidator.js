const {
    param
} = require("express-validator");

const getOwnerShareholdersValidator = [
    param("company_public_id")
        .exists({ checkFalsy: true })
        .withMessage(
            "Company owner public ID is required."
        )

        .isString()
        .withMessage(
            "Company owner public ID must be a string."
        )

        .trim()

        .isLength({
            min: 7,
            max: 40
        })
        .withMessage(
            "Company owner public ID must contain between 7 and 40 characters."
        )

        .matches(
            /^owner_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid company owner public ID format."
        )
];

module.exports = {
    getOwnerShareholdersValidator
};
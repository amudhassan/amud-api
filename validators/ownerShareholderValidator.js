const {
    param,
    body
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
const addOwnerShareholderValidator = [
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
        ),

    body()
        .custom(value => {
            const allowedFields = [
                "shareholder_public_id",
                "share_percentage",
                "shareholder_type",
                "effective_from"
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

            return true;
        }),

    body("shareholder_public_id")
        .exists({ checkFalsy: true })
        .withMessage(
            "Shareholder public ID is required."
        )
        .isString()
        .withMessage(
            "Shareholder public ID must be a string."
        )
        .trim()
        .isLength({
            min: 7,
            max: 40
        })
        .withMessage(
            "Shareholder public ID must contain between 7 and 40 characters."
        )
        .matches(
            /^owner_[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid shareholder public ID format."
        ),

    body("share_percentage")
        .exists({
            checkNull: true,
            checkFalsy: false
        })
        .withMessage(
            "Share percentage is required."
        )
        .isFloat({
            gt: 0,
            max: 100
        })
        .withMessage(
            "Share percentage must be greater than 0 and cannot exceed 100."
        )
        .custom(value => {
            const valueText =
                String(value);

            if (
                !/^\d+(\.\d{1,4})?$/.test(
                    valueText
                )
            ) {
                throw new Error(
                    "Share percentage cannot contain more than four decimal places."
                );
            }

            return true;
        })
        .toFloat(),

    body("shareholder_type")
        .optional()
        .isIn([
            "ordinary",
            "preferred",
            "founder",
            "institutional",
            "government",
            "partner"
        ])
        .withMessage(
            "Invalid shareholder type."
        ),

    body("effective_from")
        .optional({
            nullable: true,
            checkFalsy: true
        })
        .isISO8601({
            strict: true
        })
        .withMessage(
            "Effective-from date must use the YYYY-MM-DD format."
        )
];

module.exports = {
    getOwnerShareholdersValidator,
    addOwnerShareholderValidator
};
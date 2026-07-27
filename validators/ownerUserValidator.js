const {
    param,
    body
} = require("express-validator");

const getOwnerUsersValidator = [
    param("owner_public_id")
        .exists({ checkFalsy: true })
        .withMessage("Owner public ID is required.")

        .isString()
        .withMessage("Owner public ID must be a string.")

        .trim()

        .isLength({
            min: 7,
            max: 40
        })
        .withMessage(
            "Owner public ID must contain between 7 and 40 characters."
        )

        .matches(/^owner_[A-Za-z0-9_-]+$/)
        .withMessage(
            "Invalid owner public ID format."
        )
];

const addOwnerUserValidator = [
    param("owner_public_id")
        .exists({ checkFalsy: true })
        .withMessage("Owner public ID is required.")
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
        .matches(/^owner_[A-Za-z0-9_-]+$/)
        .withMessage(
            "Invalid owner public ID format."
        ),

    body()
        .custom(value => {
            const allowedFields = [
                "user_public_id",
                "relationship_role",
                "is_primary",
                "can_manage_properties",
                "can_manage_finances"
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

    body("user_public_id")
        .exists({ checkFalsy: true })
        .withMessage(
            "User public ID is required."
        )
        .isString()
        .withMessage(
            "User public ID must be a string."
        )
        .trim()
        .isLength({
            min: 10,
            max: 40
        })
        .withMessage(
            "User public ID must contain between 10 and 40 characters."
        )
        .matches(/^[A-Za-z0-9_-]+$/)
        .withMessage(
            "Invalid user public ID format."
        ),

    body("relationship_role")
        .optional()
        .isIn([
            "owner",
            "representative",
            "manager",
            "accountant",
            "viewer"
        ])
        .withMessage(
            "Invalid owner-user relationship role."
        ),

    body("is_primary")
        .optional()
        .isBoolean()
        .withMessage(
            "is_primary must be a boolean."
        )
        .toBoolean(),

    body("can_manage_properties")
        .optional()
        .isBoolean()
        .withMessage(
            "can_manage_properties must be a boolean."
        )
        .toBoolean(),

    body("can_manage_finances")
        .optional()
        .isBoolean()
        .withMessage(
            "can_manage_finances must be a boolean."
        )
        .toBoolean()
];

const updateOwnerUserValidator = [
    param("owner_public_id")
        .exists({ checkFalsy: true })
        .withMessage("Owner public ID is required.")
        .isString()
        .trim()
        .isLength({ min: 7, max: 40 })
        .withMessage(
            "Owner public ID must contain between 7 and 40 characters."
        )
        .matches(/^owner_[A-Za-z0-9_-]+$/)
        .withMessage(
            "Invalid owner public ID format."
        ),

    param("link_public_id")
        .exists({ checkFalsy: true })
        .withMessage(
            "Owner-user link public ID is required."
        )
        .isString()
        .trim()
        .isLength({ min: 12, max: 40 })
        .withMessage(
            "Owner-user link public ID must contain between 12 and 40 characters."
        )
        .matches(/^owner_user_[A-Za-z0-9_-]+$/)
        .withMessage(
            "Invalid owner-user link public ID format."
        ),

    body()
        .custom(value => {
            const allowedFields = [
                "relationship_role",
                "is_primary",
                "can_manage_properties",
                "can_manage_finances"
            ];

            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length === 0) {
                throw new Error(
                    "At least one owner-user field must be supplied."
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

            return true;
        }),

    body("relationship_role")
        .optional()
        .isIn([
            "owner",
            "representative",
            "manager",
            "accountant",
            "viewer"
        ])
        .withMessage(
            "Invalid owner-user relationship role."
        ),

    body("is_primary")
        .optional()
        .isBoolean()
        .withMessage(
            "is_primary must be a boolean."
        )
        .toBoolean(),

    body("can_manage_properties")
        .optional()
        .isBoolean()
        .withMessage(
            "can_manage_properties must be a boolean."
        )
        .toBoolean(),

    body("can_manage_finances")
        .optional()
        .isBoolean()
        .withMessage(
            "can_manage_finances must be a boolean."
        )
        .toBoolean()
];

module.exports = {
    getOwnerUsersValidator,
    addOwnerUserValidator,
    updateOwnerUserValidator
};
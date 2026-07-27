const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

const {
    getOwnerUsers,
    addOwnerUser
} = require("../services/ownerUserService");

const getOwnerUsersController = asyncHandler(
    async (req, res, next) => {
        const result = await getOwnerUsers({
            ownerPublicId: req.params.owner_public_id,
            authenticatedUser: req.user
        });

        if (!result) {
            return next(
                new AppError(
                    "Owner not found.",
                    404
                )
            );
        }

        return res.status(200).json({
            success: true,
            message: "Owner users retrieved successfully.",
            count: result.users.length,
            data: {
                owner: result.owner,
                users: result.users
            }
        });
    }
);

const addOwnerUserController = asyncHandler(
    async (req, res, next) => {
        try {
            const result = await addOwnerUser({
                ownerPublicId:
                    req.params.owner_public_id,

                userData: req.body,

                authenticatedUser: req.user
            });

            if (!result) {
                return next(
                    new AppError(
                        "Owner not found.",
                        404
                    )
                );
            }

            if (result.forbidden) {
                return next(
                    new AppError(
                        result.reason ||
                            "You are not authorized to add users to this owner.",
                        403
                    )
                );
            }

            if (result.userNotFound) {
                return next(
                    new AppError(
                        "Verified active user not found.",
                        404
                    )
                );
            }

            if (result.duplicateRelationship) {
                return next(
                    new AppError(
                        "This user already has an active relationship with the owner.",
                        409
                    )
                );
            }

            if (result.primaryConflict) {
                return next(
                    new AppError(
                        "This owner already has an active primary representative.",
                        409
                    )
                );
            }

            return res.status(201).json({
                success: true,
                message:
                    "User added to owner successfully.",
                data: result
            });
        } catch (error) {
            /*
             * Race-condition protection kutoka partial
             * unique indexes za owner_users.
             */
            if (error.code === "23505") {
                return next(
                    new AppError(
                        "The owner-user relationship conflicts with an existing active relationship.",
                        409
                    )
                );
            }

            if (error.code === "23514") {
                return next(
                    new AppError(
                        "The supplied owner-user relationship violates a business rule.",
                        422
                    )
                );
            }

            return next(error);
        }
    }
);

module.exports = {
    getOwnerUsersController,
    addOwnerUserController
};
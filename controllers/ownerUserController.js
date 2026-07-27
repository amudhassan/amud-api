const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

const {
    getOwnerUsers,
    addOwnerUser,
    updateOwnerUser
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

const updateOwnerUserController = asyncHandler(
    async (req, res, next) => {
        try {
            const result = await updateOwnerUser({
                ownerPublicId:
                    req.params.owner_public_id,

                linkPublicId:
                    req.params.link_public_id,

                linkData: req.body,

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

            if (result.linkNotFound) {
                return next(
                    new AppError(
                        "Active owner-user relationship not found.",
                        404
                    )
                );
            }

            if (result.forbidden) {
                return next(
                    new AppError(
                        result.reason ||
                            "You are not authorized to update this owner-user relationship.",
                        403
                    )
                );
            }

            if (result.invalidPrimaryRole) {
                return next(
                    new AppError(
                        "A primary representative must have the owner, representative or manager role.",
                        422
                    )
                );
            }

            if (result.primaryRemovalBlocked) {
                return next(
                    new AppError(
                        "The current primary representative cannot be removed directly. Promote another active user to primary instead.",
                        409
                    )
                );
            }

            if (result.noChanges) {
                return next(
                    new AppError(
                        "No valid owner-user fields were supplied.",
                        400
                    )
                );
            }

            return res.status(200).json({
                success: true,
                message:
                    "Owner user updated successfully.",
                data: result
            });
        } catch (error) {
            if (error.code === "23505") {
                return next(
                    new AppError(
                        "The updated relationship conflicts with an existing active relationship.",
                        409
                    )
                );
            }

            if (error.code === "23514") {
                return next(
                    new AppError(
                        "The updated owner-user relationship violates a business rule.",
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
    addOwnerUserController,
    updateOwnerUserController
};
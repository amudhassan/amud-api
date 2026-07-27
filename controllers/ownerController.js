const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

const {
    createOwner,
    getOwners,
    getOwnerByPublicId,
    updateOwner,
    softDeleteOwner,
    restoreOwner
} = require("../services/ownerService");

const createOwnerController = asyncHandler(
    async (req, res, next) => {
        try {
            const result = await createOwner({
                ownerData: req.body,
                authenticatedUser: req.user
            });

            return res.status(201).json({
                success: true,
                message: "Owner created successfully.",
                data: result
            });
        } catch (error) {
            /*
             * 23505 = PostgreSQL unique violation.
             * Inaweza kutoka registration number, TIN au public_id.
             */
            if (error.code === "23505") {
                return next(
                    new AppError(
                        "An owner with the supplied registration or tax identification number already exists.",
                        409
                    )
                );
            }

            /*
             * 23514 = CHECK constraint violation.
             */
            if (error.code === "23514") {
                return next(
                    new AppError(
                        "The supplied owner information violates a business rule.",
                        422
                    )
                );
            }

            return next(error);
        }
    }
);

const getOwnersController = asyncHandler(
    async (req, res) => {
        const result = await getOwners({
            authenticatedUser: req.user,
            filters: req.query
        });

        return res.status(200).json({
            success: true,
            message: "Owners retrieved successfully.",
            count: result.owners.length,
            pagination: result.pagination,
            data: result.owners
        });
    }
);

const getSingleOwnerController = asyncHandler(
    async (req, res, next) => {
        const owner = await getOwnerByPublicId({
            ownerPublicId: req.params.public_id,
            authenticatedUser: req.user
        });

        if (!owner) {
            return next(
                new AppError(
                    "Owner not found.",
                    404
                )
            );
        }

        return res.status(200).json({
            success: true,
            message: "Owner retrieved successfully.",
            data: owner
        });
    }
);

const updateOwnerController = asyncHandler(
    async (req, res, next) => {
        /*
         * owner_type na status ni fields za admin pekee.
         */
        const adminOnlyFields = [
            "owner_type",
            "status"
        ];

        if (req.user.role !== "admin") {
            const forbiddenFields = adminOnlyFields.filter(
                field =>
                    Object.prototype.hasOwnProperty.call(
                        req.body,
                        field
                    )
            );

            if (forbiddenFields.length > 0) {
                return next(
                    new AppError(
                        `You are not authorized to update: ${forbiddenFields.join(", ")}.`,
                        403
                    )
                );
            }
        }

        try {
            const result = await updateOwner({
                ownerPublicId: req.params.public_id,
                ownerData: req.body,
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

            if (result.noChanges) {
                return next(
                    new AppError(
                        "No valid owner fields were supplied.",
                        400
                    )
                );
            }

            return res.status(200).json({
                success: true,
                message: "Owner updated successfully.",
                data: result.owner
            });
        } catch (error) {
            if (error.code === "23505") {
                return next(
                    new AppError(
                        "The supplied registration or tax identification number is already in use.",
                        409
                    )
                );
            }

            if (error.code === "23514") {
                return next(
                    new AppError(
                        "The supplied owner information violates a business rule.",
                        422
                    )
                );
            }

            return next(error);
        }
    }
);

const softDeleteOwnerController = asyncHandler(
    async (req, res, next) => {
        const result = await softDeleteOwner({
            ownerPublicId: req.params.public_id,
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

        if (result.blocked) {
            return next(
                new AppError(
                    "Owner cannot be deleted while active property ownership or shareholder relationships exist. Close or transfer those relationships first.",
                    409
                )
            );
        }

        return res.status(200).json({
            success: true,
            message: "Owner deleted successfully.",
            data: {
                owner: result.owner,
                revoked_user_links:
                    result.revoked_user_links
            }
        });
    }
);

const restoreOwnerController = asyncHandler(
    async (req, res, next) => {
        if (req.user.role !== "admin") {
            return next(
                new AppError(
                    "Only administrators can restore owners.",
                    403
                )
            );
        }

        try {
            const result = await restoreOwner({
                ownerPublicId: req.params.public_id,
                authenticatedUser: req.user
            });

            if (!result) {
                return next(
                    new AppError(
                        "Deleted owner not found.",
                        404
                    )
                );
            }

            if (result.forbidden) {
                return next(
                    new AppError(
                        "Only administrators can restore owners.",
                        403
                    )
                );
            }

            return res.status(200).json({
                success: true,
                message: "Owner restored successfully.",
                data: {
                    owner: result.owner,
                    reactivated_user_links:
                        result.reactivated_user_links,
                    historical_revoked_user_links:
                        result.historical_revoked_user_links
                }
            });
        } catch (error) {
            /*
             * Restore inaweza kugonga partial unique indexes
             * ikiwa registration number au TIN imetumiwa na
             * active owner mwingine baada ya deletion.
             */
            if (error.code === "23505") {
                return next(
                    new AppError(
                        "Owner cannot be restored because the registration or tax identification number is already in use.",
                        409
                    )
                );
            }

            if (error.code === "23514") {
                return next(
                    new AppError(
                        "Owner cannot be restored because the restored information violates a business rule.",
                        422
                    )
                );
            }

            return next(error);
        }
    }
);

module.exports = {
    createOwnerController,
    getOwnersController,
    getSingleOwnerController,
    updateOwnerController,
    softDeleteOwnerController,
    restoreOwnerController
};
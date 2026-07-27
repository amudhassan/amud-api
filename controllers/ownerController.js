const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

const {
    createOwner
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

module.exports = {
    createOwnerController
};
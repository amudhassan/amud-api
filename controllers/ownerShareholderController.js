const asyncHandler =
    require("../utils/asyncHandler");

const AppError =
    require("../utils/AppError");

const {
    getOwnerShareholders
} = require(
    "../services/ownerShareholderService"
);

const getOwnerShareholdersController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getOwnerShareholders({
                    companyPublicId:
                        req.params.company_public_id,

                    authenticatedUser:
                        req.user
                });

            if (!result) {
                return next(
                    new AppError(
                        "Company owner not found.",
                        404
                    )
                );
            }

            if (result.invalidOwnerType) {
                return next(
                    new AppError(
                        "Shareholders can only be managed for company or partnership owners.",
                        422
                    )
                );
            }

            return res.status(200).json({
                success: true,

                message:
                    "Owner shareholders retrieved successfully.",

                count:
                    result.shareholders.length,

                data: {
                    company:
                        result.company,

                    summary:
                        result.summary,

                    shareholders:
                        result.shareholders
                }
            });
        }
    );

module.exports = {
    getOwnerShareholdersController
};
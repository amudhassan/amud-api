const asyncHandler = require(
    "../../utils/asyncHandler"
);

const AppError = require(
    "../../utils/AppError"
);

const {
    getDashboard
} = require(
    "../../services/reports/dashboardService"
);

const getDashboardController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getDashboard({
                    filters: req.query,
                    authenticatedUser:
                        req.user
                });

            if (result.ownerNotFound) {
                return next(
                    new AppError(
                        "Owner not found.",
                        404
                    )
                );
            }

            if (result.propertyNotFound) {
                return next(
                    new AppError(
                        "Property not found.",
                        404
                    )
                );
            }

            if (result.forbidden) {
                return next(
                    new AppError(
                        "You do not have dashboard reporting access.",
                        403
                    )
                );
            }

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Management dashboard generated successfully.",
                    data:
                        result.dashboard
                });
        }
    );

module.exports = {
    getDashboardController
};

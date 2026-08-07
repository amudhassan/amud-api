const asyncHandler = require(
    "../../utils/asyncHandler"
);

const AppError = require(
    "../../utils/AppError"
);

const {
    getReportContext
} = require(
    "../../services/reports/reportContextService"
);

const getReportContextController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getReportContext({
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
                        "You do not have access to management reports.",
                        403
                    )
                );
            }

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Report context resolved successfully.",
                    data: result.context
                });
        }
    );

module.exports = {
    getReportContextController
};

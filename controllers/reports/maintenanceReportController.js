const asyncHandler = require(
    "../../utils/asyncHandler"
);

const AppError = require(
    "../../utils/AppError"
);

const {
    getMaintenanceSummary,
    getMaintenancePerformance,
    getMaintenanceCosts
} = require(
    "../../services/reports/maintenanceReportService"
);

const handleAccessFailure = ({
    result,
    next
}) => {
    if (result.ownerNotFound) {
        next(
            new AppError(
                "Owner not found.",
                404
            )
        );

        return true;
    }

    if (result.propertyNotFound) {
        next(
            new AppError(
                "Property not found.",
                404
            )
        );

        return true;
    }

    if (result.forbidden) {
        next(
            new AppError(
                "You do not have maintenance reporting access.",
                403
            )
        );

        return true;
    }

    return false;
};

const getMaintenanceSummaryController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getMaintenanceSummary({
                    filters: req.query,
                    authenticatedUser:
                        req.user
                });

            if (
                handleAccessFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Maintenance summary generated successfully.",
                    data: result.report
                });
        }
    );

const getMaintenancePerformanceController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getMaintenancePerformance({
                    filters: req.query,
                    authenticatedUser:
                        req.user
                });

            if (
                handleAccessFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Maintenance performance report generated successfully.",
                    data: result.report
                });
        }
    );

const getMaintenanceCostsController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getMaintenanceCosts({
                    filters: req.query,
                    authenticatedUser:
                        req.user
                });

            if (
                handleAccessFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Maintenance cost report generated successfully.",
                    data: result.report
                });
        }
    );

module.exports = {
    getMaintenanceSummaryController,
    getMaintenancePerformanceController,
    getMaintenanceCostsController
};

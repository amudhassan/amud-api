const asyncHandler = require(
    "../../utils/asyncHandler"
);

const AppError = require(
    "../../utils/AppError"
);

const {
    getOccupancyReport,
    getLeaseReport,
    getExpiringLeasesReport
} = require(
    "../../services/reports/occupancyLeaseReportService"
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
                "You do not have property reporting access.",
                403
            )
        );

        return true;
    }

    return false;
};

const getOccupancyReportController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getOccupancyReport({
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
                        "Occupancy report generated successfully.",
                    data: result.report
                });
        }
    );

const getLeaseReportController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getLeaseReport({
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
                        "Lease report generated successfully.",
                    data: result.report
                });
        }
    );

const getExpiringLeasesReportController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getExpiringLeasesReport({
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
                        "Expiring lease report generated successfully.",
                    data: result.report
                });
        }
    );

module.exports = {
    getOccupancyReportController,
    getLeaseReportController,
    getExpiringLeasesReportController
};

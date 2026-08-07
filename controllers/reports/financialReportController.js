const asyncHandler = require(
    "../../utils/asyncHandler"
);

const AppError = require(
    "../../utils/AppError"
);

const {
    getFinancialSummary,
    getRevenueReport,
    getOutstandingReport,
    getCollectionsReport
} = require(
    "../../services/reports/financialReportService"
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
                "You do not have financial reporting access.",
                403
            )
        );
        return true;
    }

    return false;
};

const getFinancialSummaryController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getFinancialSummary({
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
                        "Financial summary generated successfully.",
                    data: result.report
                });
        }
    );

const getRevenueReportController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getRevenueReport({
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
                        "Revenue report generated successfully.",
                    data: result.report
                });
        }
    );

const getOutstandingReportController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getOutstandingReport({
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
                        "Outstanding balance report generated successfully.",
                    data: result.report
                });
        }
    );

const getCollectionsReportController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getCollectionsReport({
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
                        "Collections report generated successfully.",
                    data: result.report
                });
        }
    );

module.exports = {
    getFinancialSummaryController,
    getRevenueReportController,
    getOutstandingReportController,
    getCollectionsReportController
};

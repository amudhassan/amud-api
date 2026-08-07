const asyncHandler = require(
    "../../utils/asyncHandler"
);

const AppError = require(
    "../../utils/AppError"
);

const {
    exportReport
} = require(
    "../../services/reports/reportExportService"
);

const handleExportFailure = ({
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
                "You do not have access to export this report.",
                403
            )
        );

        return true;
    }

    if (result.unsupportedReportType) {
        next(
            new AppError(
                "Unsupported report type.",
                400
            )
        );

        return true;
    }

    if (result.unsupportedFormat) {
        next(
            new AppError(
                "Unsupported export format.",
                400
            )
        );

        return true;
    }

    return false;
};

const createReportExportController =
    reportType =>
        asyncHandler(
            async (req, res, next) => {
                const {
                    format,
                    ...filters
                } = req.query;

                const result =
                    await exportReport({
                        reportType,
                        format,
                        filters,
                        authenticatedUser:
                            req.user
                    });

                if (
                    handleExportFailure({
                        result,
                        next
                    })
                ) {
                    return;
                }

                res.setHeader(
                    "Content-Type",
                    result.export
                        .content_type
                );

                res.setHeader(
                    "Content-Disposition",
                    `attachment; filename="${result.export.file_name}"`
                );

                res.setHeader(
                    "X-Report-Row-Count",
                    String(
                        result.export
                            .row_count
                    )
                );

                return res
                    .status(200)
                    .send(
                        result.export
                            .content
                    );
            }
        );

module.exports = {
    createReportExportController
};

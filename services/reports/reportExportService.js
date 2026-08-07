const {
    nanoid
} = require("nanoid");

const PDFDocument = require("pdfkit");

const pool = require("../../config/db");

const {
    getFinancialSummary,
    getRevenueReport,
    getOutstandingReport,
    getCollectionsReport
} = require(
    "./financialReportService"
);

const {
    getOccupancyReport,
    getLeaseReport,
    getExpiringLeasesReport
} = require(
    "./occupancyLeaseReportService"
);

const {
    getMaintenanceSummary,
    getMaintenancePerformance,
    getMaintenanceCosts
} = require(
    "./maintenanceReportService"
);

const {
    getDashboard
} = require(
    "./dashboardService"
);

const REPORT_LOADERS = Object.freeze({
    financial_summary:
        getFinancialSummary,
    financial_revenue:
        getRevenueReport,
    financial_outstanding:
        getOutstandingReport,
    financial_collections:
        getCollectionsReport,
    occupancy:
        getOccupancyReport,
    leases:
        getLeaseReport,
    expiring_leases:
        getExpiringLeasesReport,
    maintenance_summary:
        getMaintenanceSummary,
    maintenance_performance:
        getMaintenancePerformance,
    maintenance_costs:
        getMaintenanceCosts,
    dashboard:
        getDashboard
});

const REPORT_TITLES = Object.freeze({
    financial_summary:
        "Financial Summary",
    financial_revenue:
        "Revenue Report",
    financial_outstanding:
        "Outstanding Balance Report",
    financial_collections:
        "Collections Report",
    occupancy:
        "Occupancy Report",
    leases:
        "Lease Report",
    expiring_leases:
        "Expiring Leases Report",
    maintenance_summary:
        "Maintenance Summary",
    maintenance_performance:
        "Maintenance Performance Report",
    maintenance_costs:
        "Maintenance Cost Report",
    dashboard:
        "Management Dashboard"
});

const isPrimitive = value => (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
);

const flattenReport = (
    value,
    path = "report",
    rows = []
) => {
    if (rows.length >= 10000) {
        return rows;
    }

    if (
        isPrimitive(value) ||
        value instanceof Date
    ) {
        rows.push({
            path,
            value:
                value instanceof Date
                    ? value.toISOString()
                    : (
                        value === null ||
                        value === undefined
                            ? ""
                            : String(value)
                    )
        });

        return rows;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            rows.push({
                path,
                value: "[]"
            });

            return rows;
        }

        value.forEach(
            (item, index) => {
                if (rows.length < 10000) {
                    flattenReport(
                        item,
                        `${path}[${index}]`,
                        rows
                    );
                }
            }
        );

        return rows;
    }

    if (
        typeof value === "object"
    ) {
        const entries =
            Object.entries(value);

        if (entries.length === 0) {
            rows.push({
                path,
                value: "{}"
            });

            return rows;
        }

        for (
            const [key, nestedValue]
            of entries
        ) {
            if (rows.length >= 10000) {
                break;
            }

            flattenReport(
                nestedValue,
                `${path}.${key}`,
                rows
            );
        }

        return rows;
    }

    rows.push({
        path,
        value: String(value)
    });

    return rows;
};

const sanitizeSpreadsheetValue = value => {
    const stringValue =
        String(value ?? "");

    if (
        /^[=+\-@]/.test(
            stringValue
        )
    ) {
        return `'${stringValue}`;
    }

    return stringValue;
};

const escapeCsvValue = value => {
    const stringValue =
        sanitizeSpreadsheetValue(value)
            .replace(/"/g, '""');

    return `"${stringValue}"`;
};

const generateCsv = rows => {
    const lines = [
        [
            "path",
            "value"
        ]
            .map(escapeCsvValue)
            .join(",")
    ];

    for (const row of rows) {
        lines.push(
            [
                row.path,
                row.value
            ]
                .map(escapeCsvValue)
                .join(",")
        );
    }

    return `${lines.join("\r\n")}\r\n`;
};

const generatePdf = ({
    title,
    rows,
    generatedAt
}) => {
    return new Promise(
        (resolve, reject) => {
            const document =
                new PDFDocument({
                    size: "A4",
                    margins: {
                        top: 45,
                        right: 45,
                        bottom: 45,
                        left: 45
                    },
                    info: {
                        Title: title,
                        Subject:
                            "Real estate management report",
                        Creator:
                            "Real Estate Management System"
                    }
                });

            const chunks = [];

            document.on(
                "data",
                chunk => {
                    chunks.push(chunk);
                }
            );

            document.on(
                "end",
                () => {
                    resolve(
                        Buffer.concat(
                            chunks
                        )
                    );
                }
            );

            document.on(
                "error",
                reject
            );

            document
                .font("Helvetica-Bold")
                .fontSize(18)
                .text(
                    title,
                    {
                        align: "center"
                    }
                );

            document
                .moveDown(0.4)
                .font("Helvetica")
                .fontSize(9)
                .text(
                    `Generated at: ${generatedAt.toISOString()}`,
                    {
                        align: "center"
                    }
                )
                .moveDown(1);

            for (const row of rows) {
                document
                    .font("Helvetica-Bold")
                    .fontSize(8)
                    .text(
                        row.path,
                        {
                            continued: true,
                            width: 500
                        }
                    )
                    .font("Helvetica")
                    .text(
                        `: ${row.value}`,
                        {
                            width: 500
                        }
                    )
                    .moveDown(0.2);
            }

            document.end();
        }
    );
};

const getLoadedReport = result => {
    if (
        result.forbidden ||
        result.ownerNotFound ||
        result.propertyNotFound
    ) {
        return result;
    }

    if (result.report) {
        return {
            report:
                result.report
        };
    }

    if (result.dashboard) {
        return {
            report:
                result.dashboard
        };
    }

    return {
        report: result
    };
};

const buildExportFileName = ({
    reportType,
    format,
    generatedAt
}) => {
    const timestamp =
        generatedAt
            .toISOString()
            .replace(
                /[-:]/g,
                ""
            )
            .replace(
                /\.\d{3}Z$/,
                "Z"
            );

    return `${reportType}-${timestamp}.${format}`;
};

const recordExportAudit = async ({
    reportType,
    format,
    filters,
    authenticatedUser,
    rowCount,
    fileName
}) => {
    const publicId =
        `report_export_${nanoid(24)}`;

    await pool.query(
        `
        INSERT INTO report_exports (
            public_id,
            report_type,
            export_format,
            owner_public_id,
            property_public_id,
            filters,
            row_count,
            file_name,
            generated_by
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6::JSONB,
            $7,
            $8,
            $9
        )
        `,
        [
            publicId,
            reportType,
            format,
            filters.owner_public_id ||
                null,
            filters.property_public_id ||
                null,
            JSON.stringify(filters),
            rowCount,
            fileName,
            authenticatedUser.id
        ]
    );
};

const exportReport = async ({
    reportType,
    format,
    filters,
    authenticatedUser
}) => {
    const loader =
        REPORT_LOADERS[reportType];

    if (!loader) {
        return {
            unsupportedReportType: true
        };
    }

    const result = await loader({
        filters,
        authenticatedUser
    });

    const loaded =
        getLoadedReport(result);

    if (
        loaded.forbidden ||
        loaded.ownerNotFound ||
        loaded.propertyNotFound
    ) {
        return loaded;
    }

    const generatedAt =
        new Date();

    const rows =
        flattenReport(
            loaded.report
        );

    const title =
        REPORT_TITLES[reportType] ||
        "Management Report";

    const fileName =
        buildExportFileName({
            reportType,
            format,
            generatedAt
        });

    let content;
    let contentType;

    if (format === "csv") {
        content =
            generateCsv(rows);

        contentType =
            "text/csv; charset=utf-8";
    } else if (format === "pdf") {
        content =
            await generatePdf({
                title,
                rows,
                generatedAt
            });

        contentType =
            "application/pdf";
    } else {
        return {
            unsupportedFormat: true
        };
    }

    await recordExportAudit({
        reportType,
        format,
        filters,
        authenticatedUser,
        rowCount:
            rows.length,
        fileName
    });

    return {
        forbidden: false,
        export: {
            report_type:
                reportType,
            format,
            file_name:
                fileName,
            content_type:
                contentType,
            content,
            row_count:
                rows.length,
            generated_at:
                generatedAt.toISOString()
        }
    };
};

module.exports = {
    REPORT_LOADERS,
    REPORT_TITLES,
    flattenReport,
    generateCsv,
    generatePdf,
    exportReport
};

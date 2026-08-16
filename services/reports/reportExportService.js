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

const OMITTED_KEYS = new Set([
    "public_id",
    "owner_public_id",
    "property_public_id",
    "unit_public_id",
    "tenant_public_id",
    "lease_public_id",
    "maintenance_request_public_id",
    "section_access"
]);

const isPrimitive = value => (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
);

/*
 * Kept for backward compatibility with existing tests/imports.
 * New exports no longer expose these technical paths to users.
 */
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

    if (typeof value === "object") {
        const entries =
            Object.entries(value);

        if (entries.length === 0) {
            rows.push({
                path,
                value: "{}"
            });

            return rows;
        }

        for (const [key, nestedValue] of entries) {
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

const humanizeKey = key => {
    const special = {
        id: "ID",
        sla: "SLA",
        kpi: "KPI",
        csv: "CSV",
        pdf: "PDF",
        vat: "VAT"
    };

    return String(key || "")
        .replace(/\./g, " ")
        .replace(/_/g, " ")
        .replace(/\b\w+\b/g, word => {
            const normalized = word.toLowerCase();

            if (special[normalized]) {
                return special[normalized];
            }

            return normalized.charAt(0).toUpperCase() +
                normalized.slice(1);
        });
};

const isIsoDateTime = value => (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
);

const isDateOnly = value => (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
);

const formatDate = value => {
    if (!value) {
        return "-";
    }

    if (isDateOnly(value)) {
        const [year, month, day] =
            value.split("-").map(Number);

        const date = new Date(
            Date.UTC(year, month - 1, day)
        );

        return new Intl.DateTimeFormat(
            "en-GB",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                timeZone: "UTC"
            }
        ).format(date);
    }

    const date = value instanceof Date
        ? value
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "UTC"
        }
    ).format(date) + " UTC";
};

const looksNumeric = value => (
    typeof value === "number" ||
    typeof value === "bigint" ||
    (
        typeof value === "string" &&
        value.trim() !== "" &&
        /^-?\d+(\.\d+)?$/.test(
            value.trim()
        )
    )
);

const formatNumber = (
    value,
    maximumFractionDigits = 2
) => {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
        return String(value ?? "-");
    }

    return new Intl.NumberFormat(
        "en-US",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits
        }
    ).format(numeric);
};

const isAmountKey = key => (
    /(amount|balance|revenue|collected|invoiced|cost|rent|expense|total_value|gross|net)/i
        .test(String(key || "")) &&
    !/(count|rate|percent|hours|days)/i
        .test(String(key || ""))
);

const formatBusinessValue = ({
    key,
    value
}) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "-";
    }

    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }

    if (
        value instanceof Date ||
        isIsoDateTime(value)
    ) {
        return formatDate(value);
    }

    if (
        isDateOnly(value) ||
        /(date|_at$|occurred_at|period_start)/i
            .test(String(key || "")) &&
            typeof value === "string" &&
            /^\d{4}-\d{2}-\d{2}/.test(value)
    ) {
        return formatDate(value);
    }

    if (
        /percent|rate_percent/i.test(
            String(key || "")
        ) &&
        looksNumeric(value)
    ) {
        return `${formatNumber(value, 2)}%`;
    }

    if (
        /hours$/i.test(String(key || "")) &&
        looksNumeric(value)
    ) {
        return `${formatNumber(value, 2)} hrs`;
    }

    if (
        /days(_remaining)?$/i.test(
            String(key || "")
        ) &&
        looksNumeric(value)
    ) {
        return `${formatNumber(value, 0)} days`;
    }

    if (
        isAmountKey(key) &&
        looksNumeric(value)
    ) {
        return formatNumber(value, 2);
    }

    if (looksNumeric(value)) {
        return formatNumber(value, 2);
    }

    return String(value)
        .replace(/_/g, " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );
};

const preferredObjectLabel = value => {
    if (!value || typeof value !== "object") {
        return null;
    }

    const candidates = [
        "display_name",
        "property_name",
        "unit_name",
        "title",
        "request_number",
        "lease_number",
        "property_code",
        "unit_code",
        "name",
        "code"
    ];

    for (const candidate of candidates) {
        if (
            value[candidate] !== null &&
            value[candidate] !== undefined &&
            value[candidate] !== ""
        ) {
            return String(value[candidate]);
        }
    }

    return null;
};

const buildScope = ({
    report,
    filters
}) => {
    const context = report?.context || {};
    const contextFilters = context.filters || {};
    const mergedFilters = {
        ...contextFilters,
        ...(filters || {})
    };

    const ownerLabel =
        preferredObjectLabel(
            context.selected_owner
        ) ||
        (
            typeof context.selected_owner === "string"
                ? context.selected_owner
                : null
        ) ||
        "All Owners";

    const propertyLabel =
        preferredObjectLabel(
            context.selected_property
        ) ||
        (
            typeof context.selected_property === "string"
                ? context.selected_property
                : null
        ) ||
        "All Properties";

    const dateFrom =
        mergedFilters.date_from || null;
    const dateTo =
        mergedFilters.date_to || null;

    let period = "All Dates";

    if (dateFrom && dateTo) {
        period = `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
    } else if (dateFrom) {
        period = `From ${formatDate(dateFrom)}`;
    } else if (dateTo) {
        period = `Up to ${formatDate(dateTo)}`;
    }

    const scope = [
        {
            label: "Owner",
            value: ownerLabel
        },
        {
            label: "Property",
            value: propertyLabel
        },
        {
            label: "Period",
            value: period
        }
    ];

    if (mergedFilters.currency_code) {
        scope.push({
            label: "Currency",
            value:
                mergedFilters.currency_code
        });
    }

    if (mergedFilters.period) {
        scope.push({
            label: "Grouping",
            value: humanizeKey(
                mergedFilters.period
            )
        });
    }

    const additionalFilterKeys = [
        "status",
        "lease_status",
        "maintenance_status",
        "priority",
        "category",
        "days",
        "limit"
    ];

    for (const key of additionalFilterKeys) {
        const value = mergedFilters[key];

        if (
            value !== undefined &&
            value !== null &&
            value !== ""
        ) {
            scope.push({
                label: humanizeKey(key),
                value: formatBusinessValue({
                    key,
                    value
                })
            });
        }
    }

    return scope;
};

const flattenTableObject = (
    value,
    prefix = "",
    target = {}
) => {
    if (!value || typeof value !== "object") {
        return target;
    }

    for (const [key, nestedValue] of Object.entries(value)) {
        if (OMITTED_KEYS.has(key)) {
            continue;
        }

        const nextKey = prefix
            ? `${prefix} ${humanizeKey(key)}`
            : humanizeKey(key);

        if (
            nestedValue &&
            typeof nestedValue === "object" &&
            !Array.isArray(nestedValue) &&
            !(nestedValue instanceof Date)
        ) {
            const preferredLabel =
                preferredObjectLabel(
                    nestedValue
                );

            if (preferredLabel) {
                target[humanizeKey(key)] =
                    preferredLabel;
            } else {
                flattenTableObject(
                    nestedValue,
                    nextKey,
                    target
                );
            }
            continue;
        }

        if (!Array.isArray(nestedValue)) {
            target[nextKey] =
                formatBusinessValue({
                    key,
                    value: nestedValue
                });
        }
    }

    return target;
};

const buildTableSection = ({
    title,
    rows
}) => {
    const preparedRows = rows
        .filter(row =>
            row !== null &&
            row !== undefined
        )
        .map(row => {
            if (
                isPrimitive(row) ||
                row instanceof Date
            ) {
                return {
                    Value: formatBusinessValue({
                        key: "value",
                        value: row
                    })
                };
            }

            return flattenTableObject(row);
        });

    const columns = [];

    for (const row of preparedRows) {
        for (const key of Object.keys(row)) {
            if (!columns.includes(key)) {
                columns.push(key);
            }
        }
    }

    return {
        type: "table",
        title,
        columns,
        rows: preparedRows
    };
};

const buildMetricSection = ({
    title,
    value
}) => {
    const items = [];

    for (const [key, nestedValue] of Object.entries(value || {})) {
        if (
            OMITTED_KEYS.has(key) ||
            nestedValue === null ||
            nestedValue === undefined ||
            Array.isArray(nestedValue) ||
            (
                typeof nestedValue === "object" &&
                !(nestedValue instanceof Date)
            )
        ) {
            continue;
        }

        items.push({
            label: humanizeKey(key),
            value: formatBusinessValue({
                key,
                value: nestedValue
            })
        });
    }

    return {
        type: "metrics",
        title,
        items
    };
};

const buildPresentationSections = (
    value,
    titlePrefix = "",
    sections = [],
    depth = 0
) => {
    if (
        !value ||
        typeof value !== "object" ||
        depth > 4
    ) {
        return sections;
    }

    const primitiveValues = {};

    for (const [key, nestedValue] of Object.entries(value)) {
        if (
            key === "context" ||
            OMITTED_KEYS.has(key) ||
            nestedValue === null ||
            nestedValue === undefined
        ) {
            continue;
        }

        const sectionTitle = titlePrefix
            ? `${titlePrefix} - ${humanizeKey(key)}`
            : humanizeKey(key);

        if (
            isPrimitive(nestedValue) ||
            nestedValue instanceof Date
        ) {
            primitiveValues[key] = nestedValue;
            continue;
        }

        if (Array.isArray(nestedValue)) {
            if (nestedValue.length > 0) {
                sections.push(
                    buildTableSection({
                        title: sectionTitle,
                        rows: nestedValue
                    })
                );
            }
            continue;
        }

        if (typeof nestedValue === "object") {
            buildPresentationSections(
                nestedValue,
                sectionTitle,
                sections,
                depth + 1
            );
        }
    }

    if (Object.keys(primitiveValues).length > 0) {
        const section = buildMetricSection({
            title:
                titlePrefix ||
                "Summary",
            value: primitiveValues
        });

        if (section.items.length > 0) {
            sections.unshift(section);
        }
    }

    return sections;
};

const normalizeSectionTitles = sections => {
    const replacements = {
        "Currencies": "Financial Overview",
        "By Status": "Requests by Status",
        "By Category": "Requests by Category",
        "By Priority": "Requests by Priority",
        "By Payment Method": "Collections by Payment Method",
        "Trend": "Trend",
        "Leases": "Lease Details",
        "Portfolio": "Portfolio Overview",
        "Maintenance": "Maintenance Overview",
        "Financial": "Financial Overview",
        "Recent Activity": "Recent Activity",
        "Expiring Leases 30 Days": "Leases Expiring Within 30 Days"
    };

    return sections.map(section => ({
        ...section,
        title:
            replacements[section.title] ||
            section.title
    }));
};

const buildPresentation = ({
    reportType,
    report,
    filters,
    generatedAt
}) => ({
    title:
        REPORT_TITLES[reportType] ||
        "Management Report",
    generatedAt,
    scope: buildScope({
        report,
        filters
    }),
    sections: normalizeSectionTitles(
        buildPresentationSections(report)
    )
});

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

const csvLine = values =>
    values
        .map(escapeCsvValue)
        .join(",");

/*
 * Accepts the new presentation object. For compatibility, an old
 * [{path,value}] array is still exported using the legacy schema.
 */
const generateCsv = input => {
    if (Array.isArray(input)) {
        const lines = [
            csvLine([
                "path",
                "value"
            ])
        ];

        for (const row of input) {
            lines.push(
                csvLine([
                    row.path,
                    row.value
                ])
            );
        }

        return `${lines.join("\r\n")}\r\n`;
    }

    const presentation = input;
    const lines = [];

    lines.push(
        csvLine([presentation.title])
    );
    lines.push(
        csvLine([
            "Generated",
            formatDate(
                presentation.generatedAt
            )
        ])
    );
    lines.push("");
    lines.push(
        csvLine(["Report Scope"])
    );
    lines.push(
        csvLine([
            "Field",
            "Value"
        ])
    );

    for (const item of presentation.scope) {
        lines.push(
            csvLine([
                item.label,
                item.value
            ])
        );
    }

    for (const section of presentation.sections) {
        lines.push("");
        lines.push(
            csvLine([section.title])
        );

        if (section.type === "metrics") {
            lines.push(
                csvLine([
                    "Metric",
                    "Value"
                ])
            );

            for (const item of section.items) {
                lines.push(
                    csvLine([
                        item.label,
                        item.value
                    ])
                );
            }
            continue;
        }

        if (section.type === "table") {
            if (section.columns.length === 0) {
                lines.push(
                    csvLine(["No data"])
                );
                continue;
            }

            lines.push(
                csvLine(section.columns)
            );

            for (const row of section.rows) {
                lines.push(
                    csvLine(
                        section.columns.map(
                            column =>
                                row[column] ?? "-"
                        )
                    )
                );
            }
        }
    }

    return `${lines.join("\r\n")}\r\n`;
};

const PDF_FOOTER_RESERVE = 20;

const pdfContentBottom = document =>
    document.page.height -
    document.page.margins.bottom -
    PDF_FOOTER_RESERVE;

const ensurePdfSpace = (
    document,
    height = 60
) => {
    if (
        document.y + height >
        pdfContentBottom(document)
    ) {
        document.addPage();
    }
};

const drawPdfHeader = ({
    document,
    presentation
}) => {
    document
        .font("Helvetica-Bold")
        .fontSize(19)
        .fillColor("#0f172a")
        .text(
            presentation.title,
            {
                align: "left"
            }
        );

    document
        .moveDown(0.2)
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#475569")
        .text(
            "Real Estate / House Rental Management System"
        )
        .text(
            `Generated: ${formatDate(
                presentation.generatedAt
            )}`
        );

    document
        .moveDown(0.7)
        .strokeColor("#cbd5e1")
        .lineWidth(1)
        .moveTo(
            document.page.margins.left,
            document.y
        )
        .lineTo(
            document.page.width -
                document.page.margins.right,
            document.y
        )
        .stroke()
        .moveDown(0.8);
};

const drawPdfSectionTitle = ({
    document,
    title
}) => {
    ensurePdfSpace(document, 45);

    document
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#0f172a")
        .text(title)
        .moveDown(0.35);
};

const drawPdfKeyValueRows = ({
    document,
    rows
}) => {
    const left =
        document.page.margins.left;
    const width =
        document.page.width -
        document.page.margins.left -
        document.page.margins.right;
    const labelWidth =
        Math.min(185, width * 0.38);
    const valueWidth =
        width - labelWidth - 12;

    for (const row of rows) {
        ensurePdfSpace(document, 30);

        const y = document.y;
        const labelHeight =
            document.heightOfString(
                row.label,
                {
                    width: labelWidth
                }
            );
        const valueHeight =
            document.heightOfString(
                String(row.value),
                {
                    width: valueWidth
                }
            );
        const rowHeight =
            Math.max(
                20,
                labelHeight,
                valueHeight
            ) + 8;

        document
            .rect(
                left,
                y,
                width,
                rowHeight
            )
            .fillAndStroke(
                "#f8fafc",
                "#e2e8f0"
            );

        document
            .font("Helvetica-Bold")
            .fontSize(8.5)
            .fillColor("#334155")
            .text(
                row.label,
                left + 8,
                y + 7,
                {
                    width: labelWidth
                }
            );

        document
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#0f172a")
            .text(
                String(row.value),
                left + labelWidth + 12,
                y + 7,
                {
                    width: valueWidth
                }
            );

        document.y = y + rowHeight + 3;
    }
};

const fitPdfColumns = ({
    columns,
    totalWidth
}) => {
    if (columns.length === 0) {
        return [];
    }

    const weights = columns.map(column => {
        const length = String(column).length;
        return Math.min(
            2.2,
            Math.max(1, length / 12)
        );
    });

    const weightTotal =
        weights.reduce(
            (sum, weight) =>
                sum + weight,
            0
        );

    return weights.map(weight =>
        totalWidth * (weight / weightTotal)
    );
};

const drawPdfTable = ({
    document,
    section
}) => {
    if (
        section.columns.length === 0 ||
        section.rows.length === 0
    ) {
        document
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#64748b")
            .text("No data available.")
            .moveDown(0.6);
        return;
    }

    const maxColumns = 8;
    let columns = section.columns;

    if (columns.length > maxColumns) {
        columns = columns.slice(0, maxColumns);
    }

    const left =
        document.page.margins.left;
    const totalWidth =
        document.page.width -
        document.page.margins.left -
        document.page.margins.right;
    const columnWidths =
        fitPdfColumns({
            columns,
            totalWidth
        });

    const drawHeader = () => {
        ensurePdfSpace(document, 40);
        const y = document.y;
        const headerHeight = 28;

        document
            .rect(
                left,
                y,
                totalWidth,
                headerHeight
            )
            .fill("#e2e8f0");

        let x = left;

        columns.forEach((column, index) => {
            document
                .font("Helvetica-Bold")
                .fontSize(7.2)
                .fillColor("#0f172a")
                .text(
                    column,
                    x + 4,
                    y + 7,
                    {
                        width:
                            columnWidths[index] - 8,
                        height:
                            headerHeight - 10,
                        ellipsis: true
                    }
                );

            x += columnWidths[index];
        });

        document.y = y + headerHeight;
    };

    drawHeader();

    for (const row of section.rows) {
        const cellTexts = columns.map(
            column =>
                String(row[column] ?? "-")
        );

        const heights = cellTexts.map(
            (text, index) =>
                document.heightOfString(
                    text,
                    {
                        width:
                            columnWidths[index] - 8
                    }
                )
        );

        const rowHeight = Math.min(
            56,
            Math.max(
                24,
                ...heights.map(height =>
                    height + 10
                )
            )
        );

        if (
            document.y + rowHeight >
            pdfContentBottom(document)
        ) {
            document.addPage();
            drawHeader();
        }

        const y = document.y;

        document
            .rect(
                left,
                y,
                totalWidth,
                rowHeight
            )
            .fillAndStroke(
                "#ffffff",
                "#e2e8f0"
            );

        let x = left;

        cellTexts.forEach((text, index) => {
            document
                .font("Helvetica")
                .fontSize(7.5)
                .fillColor("#334155")
                .text(
                    text,
                    x + 4,
                    y + 6,
                    {
                        width:
                            columnWidths[index] - 8,
                        height:
                            rowHeight - 10,
                        ellipsis: true
                    }
                );

            x += columnWidths[index];
        });

        document.y = y + rowHeight;
    }

    document.moveDown(0.6);
};

/*
 * Accepts the new presentation object. The old {title,rows,generatedAt}
 * signature remains supported for compatibility with existing tests.
 */
const generatePdf = ({
    title,
    rows,
    generatedAt,
    presentation
}) => {
    const resolvedPresentation =
        presentation || {
            title,
            generatedAt,
            scope: [],
            sections: [
                {
                    type: "metrics",
                    title: "Report Details",
                    items: (rows || []).map(row => ({
                        label: humanizeKey(row.path),
                        value: row.value
                    }))
                }
            ]
        };

    return new Promise(
        (resolve, reject) => {
            const document =
                new PDFDocument({
                    size: "A4",
                    margins: {
                        top: 42,
                        right: 42,
                        bottom: 42,
                        left: 42
                    },
                    info: {
                        Title:
                            resolvedPresentation.title,
                        Subject:
                            "Real estate management report",
                        Creator:
                            "Real Estate Management System"
                    },
                    bufferPages: true
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
                        Buffer.concat(chunks)
                    );
                }
            );

            document.on(
                "error",
                reject
            );

            drawPdfHeader({
                document,
                presentation:
                    resolvedPresentation
            });

            if (
                resolvedPresentation.scope &&
                resolvedPresentation.scope.length > 0
            ) {
                drawPdfSectionTitle({
                    document,
                    title: "Report Scope"
                });

                drawPdfKeyValueRows({
                    document,
                    rows:
                        resolvedPresentation.scope
                });

                document.moveDown(0.5);
            }

            for (
                const section of
                resolvedPresentation.sections || []
            ) {
                drawPdfSectionTitle({
                    document,
                    title: section.title
                });

                if (section.type === "metrics") {
                    drawPdfKeyValueRows({
                        document,
                        rows: section.items
                    });
                } else if (
                    section.type === "table"
                ) {
                    drawPdfTable({
                        document,
                        section
                    });
                }

                document.moveDown(0.55);
            }

            const pageRange =
                document.bufferedPageRange();

            for (
                let index = pageRange.start;
                index <
                    pageRange.start +
                    pageRange.count;
                index += 1
            ) {
                document.switchToPage(index);

                const footerY =
                    document.page.height -
                    document.page.margins.bottom -
                    10;

                document
                    .font("Helvetica")
                    .fontSize(7)
                    .fillColor("#64748b")
                    .text(
                        `Page ${index + 1} of ${pageRange.count}`,
                        document.page.margins.left,
                        footerY,
                        {
                            width:
                                document.page.width -
                                document.page.margins.left -
                                document.page.margins.right,
                            align: "right"
                        }
                    );
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
            .replace(/[-:]/g, "")
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

    /*
     * Retain the historical row-count calculation for audit/test
     * compatibility. It is no longer shown to end users.
     */
    const auditRows =
        flattenReport(
            loaded.report
        );

    const presentation =
        buildPresentation({
            reportType,
            report: loaded.report,
            filters,
            generatedAt
        });

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
            generateCsv(presentation);

        contentType =
            "text/csv; charset=utf-8";
    } else if (format === "pdf") {
        content =
            await generatePdf({
                presentation
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
            auditRows.length,
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
                auditRows.length,
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
    exportReport,
    buildPresentation
};

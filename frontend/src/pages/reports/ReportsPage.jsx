import {
    BarChart3,
    Building2,
    CalendarDays,
    Download,
    FileSpreadsheet,
    FileText,
    RefreshCw,
    Search,
    Wallet,
    Wrench
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

const REPORTS = [
    {
        key: "financial_summary",
        category: "Financial",
        label: "Financial Summary",
        description:
            "Invoice, collection and outstanding position by currency.",
        endpoint: "/reports/financial/summary",
        exportEndpoint:
            "/reports/financial/summary/export",
        fields: [
            "owner_public_id",
            "property_public_id",
            "date_from",
            "date_to",
            "currency_code"
        ]
    },
    {
        key: "financial_revenue",
        category: "Financial",
        label: "Revenue",
        description:
            "Collected revenue trend and property contribution.",
        endpoint: "/reports/financial/revenue",
        exportEndpoint:
            "/reports/financial/revenue/export",
        fields: [
            "owner_public_id",
            "property_public_id",
            "date_from",
            "date_to",
            "currency_code",
            "period"
        ]
    },
    {
        key: "financial_outstanding",
        category: "Financial",
        label: "Outstanding",
        description:
            "Open and overdue balances requiring follow-up.",
        endpoint: "/reports/financial/outstanding",
        exportEndpoint:
            "/reports/financial/outstanding/export",
        fields: [
            "owner_public_id",
            "property_public_id",
            "date_from",
            "date_to",
            "currency_code",
            "limit"
        ]
    },
    {
        key: "financial_collections",
        category: "Financial",
        label: "Collections",
        description:
            "Collections by payment method and reporting period.",
        endpoint: "/reports/financial/collections",
        exportEndpoint:
            "/reports/financial/collections/export",
        fields: [
            "owner_public_id",
            "property_public_id",
            "date_from",
            "date_to",
            "currency_code",
            "period"
        ]
    },
    {
        key: "occupancy",
        category: "Property",
        label: "Occupancy",
        description:
            "Unit availability, occupancy and property-level utilization.",
        endpoint: "/reports/occupancy",
        exportEndpoint: "/reports/occupancy/export",
        fields: [
            "owner_public_id",
            "property_public_id"
        ]
    },
    {
        key: "leases",
        category: "Property",
        label: "Leases",
        description:
            "Lease lifecycle summary and filtered lease detail.",
        endpoint: "/reports/leases",
        exportEndpoint: "/reports/leases/export",
        fields: [
            "owner_public_id",
            "property_public_id",
            "date_from",
            "date_to",
            "lease_status",
            "limit"
        ]
    },
    {
        key: "expiring_leases",
        category: "Property",
        label: "Expiring Leases",
        description:
            "Active leases approaching their end date.",
        endpoint: "/reports/leases/expiring",
        exportEndpoint:
            "/reports/leases/expiring/export",
        fields: [
            "owner_public_id",
            "property_public_id",
            "days",
            "limit"
        ]
    },
    {
        key: "maintenance_summary",
        category: "Maintenance",
        label: "Maintenance Summary",
        description:
            "Maintenance workload by lifecycle, priority and category.",
        endpoint: "/reports/maintenance/summary",
        exportEndpoint:
            "/reports/maintenance/summary/export",
        fields: [
            "owner_public_id",
            "property_public_id",
            "date_from",
            "date_to",
            "maintenance_status",
            "priority",
            "category"
        ]
    },
    {
        key: "maintenance_performance",
        category: "Maintenance",
        label: "Maintenance Performance",
        description:
            "Operational response and completion performance.",
        endpoint: "/reports/maintenance/performance",
        exportEndpoint:
            "/reports/maintenance/performance/export",
        fields: [
            "owner_public_id",
            "property_public_id",
            "date_from",
            "date_to",
            "maintenance_status",
            "priority",
            "category",
            "limit"
        ]
    },
    {
        key: "maintenance_costs",
        category: "Maintenance",
        label: "Maintenance Costs",
        description:
            "Estimated, approved and actual maintenance costs.",
        endpoint: "/reports/maintenance/costs",
        exportEndpoint:
            "/reports/maintenance/costs/export",
        fields: [
            "owner_public_id",
            "property_public_id",
            "date_from",
            "date_to",
            "maintenance_status",
            "priority",
            "category",
            "currency_code"
        ]
    }
];

const PERIODS = [
    "daily",
    "weekly",
    "monthly",
    "quarterly",
    "yearly"
];

const LEASE_STATUSES = [
    "draft",
    "scheduled",
    "active",
    "expired",
    "terminated",
    "cancelled"
];

const MAINTENANCE_STATUSES = [
    "reported",
    "under_review",
    "assigned",
    "in_progress",
    "on_hold",
    "resolved",
    "closed",
    "rejected",
    "cancelled"
];

const MAINTENANCE_PRIORITIES = [
    "low",
    "medium",
    "high",
    "emergency"
];

const MAINTENANCE_CATEGORIES = [
    "plumbing",
    "electrical",
    "appliance",
    "structural",
    "roofing",
    "painting",
    "doors_windows",
    "security",
    "water_supply",
    "sanitation",
    "pest_control",
    "internet_communication",
    "cleaning",
    "common_area",
    "other"
];

const INITIAL_FILTERS = {
    owner_public_id: "",
    property_public_id: "",
    date_from: "",
    date_to: "",
    currency_code: "",
    period: "monthly",
    lease_status: "",
    maintenance_status: "",
    priority: "",
    category: "",
    days: "30",
    limit: "50"
};

const humanize = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replaceAll(".", " · ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );

const formatNumber = value => {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return String(value ?? "—");
    }

    return new Intl.NumberFormat().format(
        numericValue
    );
};

const formatDecimal = value => {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return String(value ?? "—");
    }

    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numericValue);
};

const isDateKey = key =>
    key.endsWith("_date") ||
    key.endsWith("_at") ||
    key.includes("period_start");

const isMoneyKey = key =>
    [
        "amount",
        "balance",
        "cost",
        "revenue",
        "collected",
        "invoiced",
        "outstanding",
        "paid",
        "rent"
    ].some(fragment => key.includes(fragment));

const formatValue = (key, value) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }

    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }

    if (isDateKey(key)) {
        const parsed = new Date(value);

        if (!Number.isNaN(parsed.getTime())) {
            if (key.endsWith("_date")) {
                return parsed.toLocaleDateString();
            }

            return parsed.toLocaleString();
        }
    }

    if (
        key.includes("percent") ||
        key.endsWith("_rate")
    ) {
        return `${formatDecimal(value)}%`;
    }

    if (isMoneyKey(key)) {
        return formatDecimal(value);
    }

    if (
        typeof value === "number" ||
        /^-?\d+(?:\.\d+)?$/.test(
            String(value)
        )
    ) {
        return formatNumber(value);
    }

    return humanize(value);
};

const flattenObject = (
    object,
    prefix = "",
    depth = 0
) => {
    const result = {};

    if (
        !object ||
        typeof object !== "object" ||
        Array.isArray(object)
    ) {
        return result;
    }

    Object.entries(object).forEach(
        ([key, value]) => {
            const finalKey = prefix
                ? `${prefix}.${key}`
                : key;

            if (
                value &&
                typeof value === "object" &&
                !Array.isArray(value) &&
                depth < 1
            ) {
                Object.assign(
                    result,
                    flattenObject(
                        value,
                        finalKey,
                        depth + 1
                    )
                );
                return;
            }

            if (!Array.isArray(value)) {
                result[finalKey] = value;
            }
        }
    );

    return result;
};

const buildParams = ({
    report,
    filters,
    exportFormat
}) => {
    const params = {};

    report.fields.forEach(field => {
        const backendField =
            field === "lease_status" ||
            field === "maintenance_status"
                ? "status"
                : field;

        const value = filters[field];

        if (
            value === "" ||
            value === null ||
            value === undefined
        ) {
            return;
        }

        if (field === "currency_code") {
            params[backendField] =
                String(value).toUpperCase();
            return;
        }

        params[backendField] = value;
    });

    if (exportFormat) {
        params.format = exportFormat;
    }

    return params;
};

const getDownloadName = ({
    contentDisposition,
    reportKey,
    format
}) => {
    const match = String(
        contentDisposition || ""
    ).match(
        /filename\*?=(?:UTF-8''|\")?([^\";]+)/i
    );

    if (match?.[1]) {
        try {
            return decodeURIComponent(
                match[1].trim()
            );
        } catch {
            return match[1].trim();
        }
    }

    return `${reportKey}.${format}`;
};

function FilterField({
    field,
    value,
    onChange,
    owners = [],
    properties = [],
    ownersLoading = false,
    propertiesLoading = false
}) {
    const commonClassName =
        "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

    if (field === "owner_public_id") {
        return (
            <select
                className={commonClassName}
                value={value}
                onChange={event =>
                    onChange(event.target.value)
                }
                disabled={ownersLoading}
            >
                <option value="">
                    {ownersLoading
                        ? "Loading owners..."
                        : "All Owners"}
                </option>
                {owners.map(owner => {
                    const displayName =
                        owner.display_name ||
                        owner.owner_name ||
                        owner.name ||
                        owner.public_id;

                    const statusSuffix =
                        owner.status &&
                        owner.status !== "active"
                            ? ` (${humanize(owner.status)})`
                            : "";

                    return (
                        <option
                            key={owner.public_id}
                            value={owner.public_id}
                        >
                            {displayName}{statusSuffix}
                        </option>
                    );
                })}
            </select>
        );
    }

    if (field === "property_public_id") {
        return (
            <select
                className={commonClassName}
                value={value}
                onChange={event =>
                    onChange(event.target.value)
                }
                disabled={propertiesLoading}
            >
                <option value="">
                    {propertiesLoading
                        ? "Loading properties..."
                        : "All Properties"}
                </option>
                {properties.map(property => {
                    const propertyName =
                        property.property_name ||
                        property.name ||
                        property.property_code ||
                        property.public_id;

                    const codeSuffix =
                        property.property_code &&
                        property.property_name
                            ? ` (${property.property_code})`
                            : "";

                    return (
                        <option
                            key={property.public_id}
                            value={property.public_id}
                        >
                            {propertyName}{codeSuffix}
                        </option>
                    );
                })}
            </select>
        );
    }

    if (field === "period") {
        return (
            <select
                className={commonClassName}
                value={value}
                onChange={event =>
                    onChange(event.target.value)
                }
            >
                {PERIODS.map(option => (
                    <option
                        key={option}
                        value={option}
                    >
                        {humanize(option)}
                    </option>
                ))}
            </select>
        );
    }

    if (field === "lease_status") {
        return (
            <select
                className={commonClassName}
                value={value}
                onChange={event =>
                    onChange(event.target.value)
                }
            >
                <option value="">All statuses</option>
                {LEASE_STATUSES.map(option => (
                    <option
                        key={option}
                        value={option}
                    >
                        {humanize(option)}
                    </option>
                ))}
            </select>
        );
    }

    if (field === "maintenance_status") {
        return (
            <select
                className={commonClassName}
                value={value}
                onChange={event =>
                    onChange(event.target.value)
                }
            >
                <option value="">All statuses</option>
                {MAINTENANCE_STATUSES.map(
                    option => (
                        <option
                            key={option}
                            value={option}
                        >
                            {humanize(option)}
                        </option>
                    )
                )}
            </select>
        );
    }

    if (field === "priority") {
        return (
            <select
                className={commonClassName}
                value={value}
                onChange={event =>
                    onChange(event.target.value)
                }
            >
                <option value="">All priorities</option>
                {MAINTENANCE_PRIORITIES.map(
                    option => (
                        <option
                            key={option}
                            value={option}
                        >
                            {humanize(option)}
                        </option>
                    )
                )}
            </select>
        );
    }

    if (field === "category") {
        return (
            <select
                className={commonClassName}
                value={value}
                onChange={event =>
                    onChange(event.target.value)
                }
            >
                <option value="">All categories</option>
                {MAINTENANCE_CATEGORIES.map(
                    option => (
                        <option
                            key={option}
                            value={option}
                        >
                            {humanize(option)}
                        </option>
                    )
                )}
            </select>
        );
    }

    const inputType =
        field === "date_from" ||
        field === "date_to"
            ? "date"
            : field === "days" ||
              field === "limit"
              ? "number"
              : "text";

    const placeholders = {
        currency_code: "TZS",
        days: "30",
        limit: "50"
    };

    return (
        <input
            className={commonClassName}
            type={inputType}
            value={value}
            min={
                field === "days" ||
                field === "limit"
                    ? 1
                    : undefined
            }
            max={
                field === "days"
                    ? 365
                    : field === "limit"
                      ? 100
                      : undefined
            }
            maxLength={
                field === "currency_code"
                    ? 3
                    : undefined
            }
            placeholder={placeholders[field]}
            onChange={event =>
                onChange(
                    field === "currency_code"
                        ? event.target.value.toUpperCase()
                        : event.target.value
                )
            }
        />
    );
}

function SummaryGrid({
    title,
    object
}) {
    const entries = Object.entries(
        flattenObject(object)
    ).filter(
        ([, value]) =>
            !Array.isArray(value) &&
            typeof value !== "object"
    );

    if (entries.length === 0) {
        return null;
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">
                {humanize(title)}
            </h3>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {entries.map(([key, value]) => (
                    <div
                        key={key}
                        className="rounded-xl bg-slate-50 p-4"
                    >
                        <p className="text-xs font-medium text-slate-500">
                            {humanize(key)}
                        </p>
                        <p className="mt-2 break-words text-lg font-bold text-slate-900">
                            {formatValue(
                                key,
                                value
                            )}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}

function DataTable({
    title,
    rows
}) {
    const flattenedRows = useMemo(
        () =>
            rows.map(row =>
                flattenObject(row)
            ),
        [rows]
    );

    const columns = useMemo(() => {
        const discovered = [];

        flattenedRows
            .slice(0, 25)
            .forEach(row => {
                Object.keys(row).forEach(key => {
                    if (
                        !discovered.includes(key)
                    ) {
                        discovered.push(key);
                    }
                });
            });

        return discovered;
    }, [flattenedRows]);

    if (rows.length === 0) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-bold text-slate-900">
                    {humanize(title)}
                </h3>
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    No records found for the selected filters.
                </div>
            </section>
        );
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-bold text-slate-900">
                        {humanize(title)}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {formatNumber(rows.length)} row(s)
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            {columns.map(column => (
                                <th
                                    key={column}
                                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                                >
                                    {humanize(column)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {flattenedRows.map(
                            (row, index) => (
                                <tr
                                    key={
                                        row.public_id ||
                                        row.id ||
                                        index
                                    }
                                    className="align-top hover:bg-slate-50/70"
                                >
                                    {columns.map(
                                        column => (
                                            <td
                                                key={column}
                                                className="max-w-[320px] whitespace-nowrap px-4 py-3 text-slate-700"
                                            >
                                                {formatValue(
                                                    column,
                                                    row[
                                                        column
                                                    ]
                                                )}
                                            </td>
                                        )
                                    )}
                                </tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function ReportResult({
    reportData
}) {
    if (!reportData) {
        return null;
    }

    const rootEntries = Object.entries(
        reportData
    );

    const primitiveEntries = rootEntries.filter(
        ([key, value]) =>
            key !== "context" &&
            !Array.isArray(value) &&
            (
                value === null ||
                typeof value !== "object"
            )
    );

    const objectEntries = rootEntries.filter(
        ([key, value]) =>
            key !== "context" &&
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
    );

    const arrayEntries = rootEntries.filter(
        ([, value]) => Array.isArray(value)
    );

    return (
        <div className="space-y-5">
            {reportData.context ? (
                <SummaryGrid
                    title="Reporting Scope"
                    object={reportData.context}
                />
            ) : null}

            {primitiveEntries.length > 0 ? (
                <SummaryGrid
                    title="Overview"
                    object={Object.fromEntries(
                        primitiveEntries
                    )}
                />
            ) : null}

            {objectEntries.map(
                ([key, value]) => (
                    <SummaryGrid
                        key={key}
                        title={key}
                        object={value}
                    />
                )
            )}

            {arrayEntries.map(
                ([key, value]) => (
                    <DataTable
                        key={key}
                        title={key}
                        rows={value}
                    />
                )
            )}
        </div>
    );
}

const categoryIcon = category => {
    if (category === "Financial") {
        return Wallet;
    }

    if (category === "Property") {
        return Building2;
    }

    return Wrench;
};

function ReportsPage() {
    const [selectedKey, setSelectedKey] =
        useState(REPORTS[0].key);
    const [filters, setFilters] = useState(
        INITIAL_FILTERS
    );
    const [reportData, setReportData] =
        useState(null);
    const [loading, setLoading] =
        useState(false);
    const [exporting, setExporting] =
        useState("");
    const [error, setError] =
        useState("");
    const [lastUpdatedAt, setLastUpdatedAt] =
        useState(null);

    const [ownerOptions, setOwnerOptions] =
        useState([]);
    const [propertyOptions, setPropertyOptions] =
        useState([]);
    const [ownersLoading, setOwnersLoading] =
        useState(false);
    const [propertiesLoading, setPropertiesLoading] =
        useState(false);
    const [selectorError, setSelectorError] =
        useState("");

    const selectedReport = useMemo(
        () =>
            REPORTS.find(
                report =>
                    report.key === selectedKey
            ) || REPORTS[0],
        [selectedKey]
    );

    const categories = useMemo(
        () =>
            [
                "Financial",
                "Property",
                "Maintenance"
            ].map(category => ({
                category,
                reports: REPORTS.filter(
                    report =>
                        report.category === category
                )
            })),
        []
    );

    const loadOwners = useCallback(
        async () => {
            try {
                setOwnersLoading(true);
                setSelectorError("");

                const response =
                    await apiClient.get(
                        "/owners",
                        {
                            params: {
                                page: 1,
                                limit: 100
                            }
                        }
                    );

                const payload =
                    response?.data?.data;

                const rows =
                    Array.isArray(payload)
                        ? payload
                        : Array.isArray(
                            payload?.owners
                        )
                          ? payload.owners
                          : [];

                setOwnerOptions(
                    [...rows].sort(
                        (left, right) =>
                            String(
                                left.display_name ||
                                left.owner_name ||
                                left.name ||
                                left.public_id ||
                                ""
                            ).localeCompare(
                                String(
                                    right.display_name ||
                                    right.owner_name ||
                                    right.name ||
                                    right.public_id ||
                                    ""
                                )
                            )
                    )
                );
            } catch (requestError) {
                setOwnerOptions([]);
                setSelectorError(
                    requestError.response?.data
                        ?.message ||
                        "Unable to load owner selector options."
                );
            } finally {
                setOwnersLoading(false);
            }
        },
        []
    );

    const loadProperties = useCallback(
        async ownerPublicId => {
            try {
                setPropertiesLoading(true);
                setSelectorError("");

                const params = {
                    page: 1,
                    limit: 100
                };

                if (ownerPublicId) {
                    params.owner_public_id =
                        ownerPublicId;
                }

                const response =
                    await apiClient.get(
                        "/properties",
                        { params }
                    );

                const payload =
                    response?.data?.data;

                const rows =
                    Array.isArray(payload)
                        ? payload
                        : Array.isArray(
                            payload?.properties
                        )
                          ? payload.properties
                          : [];

                setPropertyOptions(
                    [...rows].sort(
                        (left, right) =>
                            String(
                                left.property_name ||
                                left.property_code ||
                                left.public_id ||
                                ""
                            ).localeCompare(
                                String(
                                    right.property_name ||
                                    right.property_code ||
                                    right.public_id ||
                                    ""
                                )
                            )
                    )
                );
            } catch (requestError) {
                setPropertyOptions([]);
                setSelectorError(
                    requestError.response?.data
                        ?.message ||
                        "Unable to load property selector options."
                );
            } finally {
                setPropertiesLoading(false);
            }
        },
        []
    );

    useEffect(() => {
        loadOwners();
        loadProperties("");
    }, [loadOwners, loadProperties]);

    const updateFilter = useCallback(
        (field, value) => {
            setFilters(current => {
                const next = {
                    ...current,
                    [field]: value
                };

                if (field === "owner_public_id") {
                    next.property_public_id = "";
                }

                return next;
            });

            if (field === "owner_public_id") {
                loadProperties(value);
            }
        },
        [loadProperties]
    );

    const loadReport = useCallback(
        async report => {
            try {
                setLoading(true);
                setError("");

                const response =
                    await apiClient.get(
                        report.endpoint,
                        {
                            params: buildParams({
                                report,
                                filters
                            })
                        }
                    );

                setReportData(
                    response.data?.data || null
                );
                setLastUpdatedAt(new Date());
            } catch (requestError) {
                setReportData(null);
                setError(
                    requestError.response?.data
                        ?.message ||
                        "Unable to generate the selected report."
                );
            } finally {
                setLoading(false);
            }
        },
        [filters]
    );

    useEffect(() => {
        loadReport(selectedReport);
    }, [selectedKey]); // intentionally reload only when report changes

    const selectReport = report => {
        setSelectedKey(report.key);
        setReportData(null);
        setError("");
    };

    const resetFilters = () => {
        setFilters(INITIAL_FILTERS);
        setReportData(null);
        setError("");
        loadProperties("");
    };

    const exportReport = async format => {
        try {
            setExporting(format);
            setError("");

            const response = await apiClient.get(
                selectedReport.exportEndpoint,
                {
                    params: buildParams({
                        report: selectedReport,
                        filters,
                        exportFormat: format
                    }),
                    responseType: "blob"
                }
            );

            const blob =
                response.data instanceof Blob
                    ? response.data
                    : new Blob([response.data]);

            const objectUrl =
                window.URL.createObjectURL(blob);
            const anchor =
                document.createElement("a");

            anchor.href = objectUrl;
            anchor.download = getDownloadName({
                contentDisposition:
                    response.headers?.[
                        "content-disposition"
                    ],
                reportKey: selectedReport.key,
                format
            });

            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(
                objectUrl
            );
        } catch (requestError) {
            setError(
                requestError.response?.data
                    ?.message ||
                    `Unable to export the report as ${format.toUpperCase()}.`
            );
        } finally {
            setExporting("");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                            <BarChart3 size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">
                                Reports
                            </h1>
                            <p className="mt-1 text-sm text-slate-500">
                                Financial, property, lease and maintenance management reporting.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() =>
                            loadReport(selectedReport)
                        }
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw
                            size={16}
                            className={
                                loading
                                    ? "animate-spin"
                                    : ""
                            }
                        />
                        Refresh
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            exportReport("csv")
                        }
                        disabled={
                            Boolean(exporting) ||
                            loading
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FileSpreadsheet size={16} />
                        {exporting === "csv"
                            ? "Exporting..."
                            : "CSV"}
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            exportReport("pdf")
                        }
                        disabled={
                            Boolean(exporting) ||
                            loading
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FileText size={16} />
                        {exporting === "pdf"
                            ? "Exporting..."
                            : "PDF"}
                    </button>
                </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="space-y-4">
                    {categories.map(
                        ({ category, reports }) => {
                            const Icon =
                                categoryIcon(category);

                            return (
                                <div
                                    key={category}
                                    className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                                >
                                    <div className="flex items-center gap-2 px-2 py-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                                        <Icon size={15} />
                                        {category}
                                    </div>

                                    <div className="space-y-1">
                                        {reports.map(
                                            report => {
                                                const active =
                                                    report.key ===
                                                    selectedKey;

                                                return (
                                                    <button
                                                        key={
                                                            report.key
                                                        }
                                                        type="button"
                                                        onClick={() =>
                                                            selectReport(
                                                                report
                                                            )
                                                        }
                                                        className={`w-full rounded-xl px-3 py-3 text-left transition ${
                                                            active
                                                                ? "bg-slate-900 text-white"
                                                                : "text-slate-700 hover:bg-slate-50"
                                                        }`}
                                                    >
                                                        <p className="text-sm font-semibold">
                                                            {
                                                                report.label
                                                            }
                                                        </p>
                                                        <p
                                                            className={`mt-1 text-xs leading-5 ${
                                                                active
                                                                    ? "text-slate-300"
                                                                    : "text-slate-400"
                                                            }`}
                                                        >
                                                            {
                                                                report.description
                                                            }
                                                        </p>
                                                    </button>
                                                );
                                            }
                                        )}
                                    </div>
                                </div>
                            );
                        }
                    )}
                </aside>

                <main className="min-w-0 space-y-5">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                    {selectedReport.category}
                                </p>
                                <h2 className="mt-1 text-xl font-bold text-slate-900">
                                    {selectedReport.label}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {selectedReport.description}
                                </p>
                            </div>

                            {lastUpdatedAt ? (
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <CalendarDays size={15} />
                                    Updated{" "}
                                    {lastUpdatedAt.toLocaleString()}
                                </div>
                            ) : null}
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {selectedReport.fields.map(
                                field => (
                                    <label
                                        key={field}
                                        className="block"
                                    >
                                        <span className="text-xs font-semibold text-slate-600">
                                            {field ===
                                            "owner_public_id"
                                                ? "Owner"
                                                : field ===
                                                    "property_public_id"
                                                  ? "Property"
                                                  : humanize(
                                                      field
                                                  )}
                                        </span>
                                        <FilterField
                                            field={field}
                                            value={
                                                filters[
                                                    field
                                                ]
                                            }
                                            owners={
                                                ownerOptions
                                            }
                                            properties={
                                                propertyOptions
                                            }
                                            ownersLoading={
                                                ownersLoading
                                            }
                                            propertiesLoading={
                                                propertiesLoading
                                            }
                                            onChange={value =>
                                                updateFilter(
                                                    field,
                                                    value
                                                )
                                            }
                                        />
                                    </label>
                                )
                            )}
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                            <button
                                type="button"
                                onClick={() =>
                                    loadReport(
                                        selectedReport
                                    )
                                }
                                disabled={loading}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Search size={16} />
                                {loading
                                    ? "Generating..."
                                    : "Apply Filters"}
                            </button>

                            <button
                                type="button"
                                onClick={resetFilters}
                                disabled={loading}
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Reset Filters
                            </button>

                            <p className="text-xs text-slate-400">
                                Choose an owner to narrow the Property list, or keep All Owners / All Properties for the full reporting scope allowed by the backend.
                            </p>
                        </div>

                        {selectorError ? (
                            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                                {selectorError}
                            </div>
                        ) : null}
                    </section>

                    {error ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                            {error}
                        </div>
                    ) : null}

                    {loading ? (
                        <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
                                <RefreshCw
                                    className="animate-spin"
                                    size={18}
                                />
                                Generating report...
                            </div>
                        </div>
                    ) : reportData ? (
                        <ReportResult
                            reportData={reportData}
                        />
                    ) : !error ? (
                        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                            <Download
                                size={30}
                                className="text-slate-300"
                            />
                            <p className="mt-3 text-sm font-semibold text-slate-600">
                                Select filters and generate a report.
                            </p>
                        </div>
                    ) : null}
                </main>
            </div>
        </div>
    );
}

export default ReportsPage;

import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Eye,
    RefreshCw
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

const OVERDUE_TYPES = [
    ["any", "Any SLA"],
    ["review", "Review"],
    ["work_start", "Work Start"],
    ["resolution", "Resolution"]
];

const PRIORITIES = [
    ["", "All Priorities"],
    ["low", "Low"],
    ["medium", "Medium"],
    ["high", "High"],
    ["emergency", "Emergency"]
];

const SORT_FIELDS = [
    ["reported_at", "Reported At"],
    ["priority", "Priority"],
    ["target_review_at", "Target Review"],
    ["target_work_start_at", "Target Work Start"],
    ["target_resolution_at", "Target Resolution"]
];

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

const formatDateTime = value => {
    if (!value) {
        return "—";
    }

    const parsed =
        new Date(value);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return String(value);
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(parsed);
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load overdue maintenance requests.";

const getRows = response => {
    const body =
        response?.data || {};

    const data =
        body?.data || {};

    const candidates = [
        data.maintenance_requests,
        data.overdue_maintenance_requests,
        data.maintenance_overdue_requests,
        data.overdue_requests,
        body.maintenance_requests,
        body.overdue_maintenance_requests,
        body.maintenance_overdue_requests,
        body.overdue_requests
    ];

    return (
        candidates.find(
            Array.isArray
        ) || []
    );
};

const getPagination = response => {
    const body =
        response?.data || {};

    const data =
        body?.data || {};

    const pagination =
        body.pagination ||
        data.pagination ||
        {};

    return {
        page:
            Number(
                pagination.page
            ) || 1,
        limit:
            Number(
                pagination.limit
            ) || 20,
        total_records:
            Number(
                pagination.total_records ??
                    pagination.total ??
                    body.count
            ) || 0,
        total_pages:
            Number(
                pagination.total_pages
            ) || 0
    };
};

const isFlagTrue = value =>
    value === true ||
    value === "true" ||
    value === 1 ||
    value === "1";

const overdueFlags = request => {
    const sla =
        request?.sla || {};

    return {
        review:
            isFlagTrue(
                sla.review_overdue
            ) ||
            isFlagTrue(
                request?.review_overdue
            ) ||
            isFlagTrue(
                request
                    ?.calculated_review_overdue
            ),
        workStart:
            isFlagTrue(
                sla.work_start_overdue
            ) ||
            isFlagTrue(
                request
                    ?.work_start_overdue
            ) ||
            isFlagTrue(
                request
                    ?.calculated_work_start_overdue
            ),
        resolution:
            isFlagTrue(
                sla.resolution_overdue
            ) ||
            isFlagTrue(
                request
                    ?.resolution_overdue
            ) ||
            isFlagTrue(
                request
                    ?.calculated_resolution_overdue
            )
    };
};

const getPropertyName = request =>
    request?.property?.property_name ||
    request?.property?.name ||
    request?.property_name ||
    request?.property_code ||
    "—";

const getUnitName = request =>
    request?.unit?.unit_name ||
    request?.unit?.unit_code ||
    request?.unit_name ||
    request?.unit_code ||
    "—";

function MaintenanceOverduePanel({
    accessContext,
    onOpenRequest
}) {
    const [
        rows,
        setRows
    ] = useState([]);

    const [
        pagination,
        setPagination
    ] = useState({
        page: 1,
        limit: 20,
        total_records: 0,
        total_pages: 0
    });

    const [
        overdueType,
        setOverdueType
    ] = useState("any");

    const [
        priority,
        setPriority
    ] = useState("");

    const [
        sortBy,
        setSortBy
    ] = useState(
        "target_resolution_at"
    );

    const [
        sortOrder,
        setSortOrder
    ] = useState("asc");

    const [
        loading,
        setLoading
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const loadOverdue =
        useCallback(
            async ({
                page = 1
            } = {}) => {
                try {
                    setLoading(true);
                    setError("");

                    const params = {
                        overdue_type:
                            overdueType,
                        sort_by:
                            sortBy,
                        sort_order:
                            sortOrder,
                        page,
                        limit: 20
                    };

                    if (
                        accessContext
                    ) {
                        params.access_context =
                            accessContext;
                    }

                    if (priority) {
                        params.priority =
                            priority;
                    }

                    const response =
                        await apiClient.get(
                            "/maintenance/sla/overdue",
                            {
                                params
                            }
                        );

                    setRows(
                        getRows(
                            response
                        )
                    );

                    setPagination(
                        getPagination(
                            response
                        )
                    );
                } catch (
                    requestError
                ) {
                    setRows([]);
                    setPagination({
                        page: 1,
                        limit: 20,
                        total_records: 0,
                        total_pages: 0
                    });
                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            [
                accessContext,
                overdueType,
                priority,
                sortBy,
                sortOrder
            ]
        );

    useEffect(() => {
        loadOverdue({
            page: 1
        });
    }, [
        loadOverdue
    ]);

    return (
        <section className="rounded-3xl border border-rose-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-rose-100 bg-rose-50/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-rose-100 p-2.5 text-rose-700">
                        <AlertTriangle className="h-5 w-5" />
                    </div>

                    <div>
                        <h2 className="text-base font-bold text-slate-950">
                            Overdue SLA Queue
                        </h2>

                        <p className="mt-1 text-xs text-slate-600">
                            Dedicated owner/admin queue for requests that have exceeded review, work-start or resolution targets.
                        </p>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="secondary"
                    leftIcon={RefreshCw}
                    disabled={loading}
                    onClick={() =>
                        loadOverdue({
                            page:
                                pagination.page
                        })
                    }
                >
                    Refresh Queue
                </Button>
            </div>

            <div className="space-y-4 p-5">
                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Overdue Type
                        </span>

                        <select
                            value={
                                overdueType
                            }
                            disabled={loading}
                            onChange={
                                event =>
                                    setOverdueType(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                        >
                            {OVERDUE_TYPES.map(
                                ([
                                    value,
                                    label
                                ]) => (
                                    <option
                                        key={
                                            value
                                        }
                                        value={
                                            value
                                        }
                                    >
                                        {label}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Priority
                        </span>

                        <select
                            value={
                                priority
                            }
                            disabled={loading}
                            onChange={
                                event =>
                                    setPriority(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                        >
                            {PRIORITIES.map(
                                ([
                                    value,
                                    label
                                ]) => (
                                    <option
                                        key={
                                            value ||
                                            "all"
                                        }
                                        value={
                                            value
                                        }
                                    >
                                        {label}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Sort By
                        </span>

                        <select
                            value={sortBy}
                            disabled={loading}
                            onChange={
                                event =>
                                    setSortBy(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                        >
                            {SORT_FIELDS.map(
                                ([
                                    value,
                                    label
                                ]) => (
                                    <option
                                        key={
                                            value
                                        }
                                        value={
                                            value
                                        }
                                    >
                                        {label}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Sort Order
                        </span>

                        <select
                            value={
                                sortOrder
                            }
                            disabled={loading}
                            onChange={
                                event =>
                                    setSortOrder(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                        >
                            <option value="asc">
                                Earliest First
                            </option>

                            <option value="desc">
                                Latest First
                            </option>
                        </select>
                    </label>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>
                        Total overdue:{" "}
                        <strong className="text-slate-800">
                            {
                                pagination
                                    .total_records
                            }
                        </strong>
                    </span>

                    <span>
                        Page{" "}
                        {
                            pagination.page
                        }
                        {pagination.total_pages
                            ? ` of ${pagination.total_pages}`
                            : ""}
                    </span>
                </div>

                {loading && (
                    <div className="rounded-2xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        Loading overdue maintenance requests...
                    </div>
                )}

                {!loading &&
                    rows.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                            No overdue maintenance requests found for the selected filters.
                        </div>
                    )}

                {!loading &&
                    rows.length > 0 && (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="w-full min-w-[980px] border-collapse">
                                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">
                                            Request
                                        </th>
                                        <th className="px-4 py-3">
                                            Property / Unit
                                        </th>
                                        <th className="px-4 py-3">
                                            Status
                                        </th>
                                        <th className="px-4 py-3">
                                            Priority
                                        </th>
                                        <th className="px-4 py-3">
                                            Overdue
                                        </th>
                                        <th className="px-4 py-3">
                                            Resolution Target
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {rows.map(
                                        request => {
                                            const flags =
                                                overdueFlags(
                                                    request
                                                );

                                            const labels =
                                                [
                                                    flags.review &&
                                                        "Review",
                                                    flags.workStart &&
                                                        "Work Start",
                                                    flags.resolution &&
                                                        "Resolution"
                                                ].filter(
                                                    Boolean
                                                );

                                            return (
                                                <tr
                                                    key={
                                                        request.public_id
                                                    }
                                                    className="align-top"
                                                >
                                                    <td className="px-4 py-4">
                                                        <p className="text-sm font-semibold text-slate-900">
                                                            {request.request_number ||
                                                                request.public_id}
                                                        </p>

                                                        <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                                                            {request.title ||
                                                                "—"}
                                                        </p>
                                                    </td>

                                                    <td className="px-4 py-4">
                                                        <p className="text-sm text-slate-800">
                                                            {getPropertyName(
                                                                request
                                                            )}
                                                        </p>

                                                        <p className="mt-1 text-xs text-slate-500">
                                                            Unit:{" "}
                                                            {getUnitName(
                                                                request
                                                            )}
                                                        </p>
                                                    </td>

                                                    <td className="px-4 py-4 text-sm text-slate-700">
                                                        {formatLabel(
                                                            request.status
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-4">
                                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                                            {formatLabel(
                                                                request.priority
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {(labels.length
                                                                ? labels
                                                                : [
                                                                      "SLA"
                                                                  ]
                                                            ).map(
                                                                label => (
                                                                    <span
                                                                        key={
                                                                            label
                                                                        }
                                                                        className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
                                                                    >
                                                                        {
                                                                            label
                                                                        }
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-4 text-sm text-slate-700">
                                                        {formatDateTime(
                                                            request
                                                                ?.sla
                                                                ?.target_resolution_at ||
                                                                request.target_resolution_at
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-4 text-right">
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            leftIcon={Eye}
                                                            onClick={() =>
                                                                onOpenRequest?.(
                                                                    request.public_id
                                                                )
                                                            }
                                                        >
                                                            View
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                <div className="flex items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        leftIcon={
                            ChevronLeft
                        }
                        disabled={
                            loading ||
                            pagination.page <=
                                1
                        }
                        onClick={() =>
                            loadOverdue({
                                page:
                                    pagination.page -
                                    1
                            })
                        }
                    >
                        Previous
                    </Button>

                    <Button
                        type="button"
                        variant="secondary"
                        leftIcon={
                            ChevronRight
                        }
                        disabled={
                            loading ||
                            (
                                pagination.total_pages >
                                    0 &&
                                pagination.page >=
                                    pagination.total_pages
                            ) ||
                            (
                                pagination.total_pages ===
                                    0 &&
                                rows.length <
                                    pagination.limit
                            )
                        }
                        onClick={() =>
                            loadOverdue({
                                page:
                                    pagination.page +
                                    1
                            })
                        }
                    >
                        Next
                    </Button>
                </div>
            </div>
        </section>
    );
}

export default MaintenanceOverduePanel;

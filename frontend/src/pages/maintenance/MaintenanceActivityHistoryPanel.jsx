import {
    Activity,
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

const ACTIVITY_TYPES = [
    "",
    "request_created",
    "request_updated",
    "status_changed",
    "assignment_created",
    "assignment_changed",
    "assignment_declined",
    "assignment_revoked",
    "visit_scheduled",
    "visit_rescheduled",
    "visit_started",
    "visit_completed",
    "visit_missed",
    "visit_cancelled",
    "cost_created",
    "cost_submitted",
    "cost_approved",
    "cost_rejected",
    "cost_cancelled",
    "cost_incurred",
    "responsibility_determined",
    "responsibility_allocated",
    "attachment_added",
    "attachment_revoked",
    "comment_added",
    "comment_hidden",
    "request_resolved",
    "resolution_confirmed",
    "resolution_disputed",
    "request_closed",
    "request_cancelled",
    "request_rejected",
    "request_reopened",
    "unit_status_applied",
    "unit_status_released",
    "sla_target_changed",
    "maintenance_overdue",
    "emergency_escalated",
    "preventive_request_created"
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

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
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

const toIsoOrEmpty = value => {
    if (!value) {
        return "";
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return "";
    }

    return parsed.toISOString();
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load maintenance activity history.";

const isEmptyObject = value =>
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0;

const looksLikeTimestampKey = key =>
    /(_at|_date|_time|timestamp)$/i.test(
        String(key || "")
    );

const looksLikeTimestampValue = value =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(
        value
    ) &&
    !Number.isNaN(
        new Date(value).getTime()
    );

const formatAuditPrimitive = (
    key,
    value
) => {
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

    if (
        looksLikeTimestampKey(key) ||
        looksLikeTimestampValue(value)
    ) {
        const formatted =
            formatDateTime(value);

        if (formatted !== String(value)) {
            return formatted;
        }
    }

    if (
        typeof value === "string" &&
        /^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(
            value
        )
    ) {
        return formatLabel(value);
    }

    return String(value);
};

const AuditValue = ({
    field,
    value,
    depth = 0
}) => {
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return (
                <span className="text-slate-400">
                    None
                </span>
            );
        }

        return (
            <div className="flex flex-wrap gap-1.5">
                {value.map(
                    (
                        item,
                        index
                    ) => (
                        <span
                            key={`${field}-${index}`}
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                        >
                            {typeof item ===
                                "object"
                                ? `Item ${
                                      index +
                                      1
                                  }`
                                : formatAuditPrimitive(
                                      field,
                                      item
                                  )}
                        </span>
                    )
                )}
            </div>
        );
    }

    if (
        value &&
        typeof value === "object"
    ) {
        if (depth >= 2) {
            return (
                <span className="text-slate-600">
                    Details available
                </span>
            );
        }

        return (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                {Object.entries(
                    value
                ).map(
                    ([
                        childKey,
                        childValue
                    ]) => (
                        <div
                            key={
                                childKey
                            }
                            className="grid gap-1 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-start"
                        >
                            <span className="text-xs font-semibold text-slate-500">
                                {formatLabel(
                                    childKey
                                )}
                            </span>

                            <div className="min-w-0 break-words text-sm text-slate-800">
                                <AuditValue
                                    field={
                                        childKey
                                    }
                                    value={
                                        childValue
                                    }
                                    depth={
                                        depth +
                                        1
                                    }
                                />
                            </div>
                        </div>
                    )
                )}
            </div>
        );
    }

    return (
        <span className="break-words text-sm text-slate-800">
            {formatAuditPrimitive(
                field,
                value
            )}
        </span>
    );
};

const AuditDetailsBox = ({
    label,
    value
}) => {
    if (
        value === null ||
        value === undefined ||
        isEmptyObject(value) ||
        (
            Array.isArray(value) &&
            value.length === 0
        )
    ) {
        return null;
    }

    if (
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                </p>

                <div className="mt-2">
                    <AuditValue
                        field={label}
                        value={value}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </p>

            <div className="mt-3 space-y-3">
                {Object.entries(
                    value
                ).map(
                    ([
                        key,
                        item
                    ]) => (
                        <div
                            key={key}
                            className="grid gap-1 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start"
                        >
                            <span className="text-xs font-semibold text-slate-500">
                                {formatLabel(
                                    key
                                )}
                            </span>

                            <div className="min-w-0">
                                <AuditValue
                                    field={key}
                                    value={item}
                                />
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

function MaintenanceActivityHistoryPanel({
    maintenanceRequest,
    accessContext
}) {
    const [
        activityHistory,
        setActivityHistory
    ] = useState([]);

    const [
        loading,
        setLoading
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const [
        activityType,
        setActivityType
    ] = useState("");

    const [
        createdFrom,
        setCreatedFrom
    ] = useState("");

    const [
        createdTo,
        setCreatedTo
    ] = useState("");

    const [
        sortOrder,
        setSortOrder
    ] = useState("desc");

    const [
        pagination,
        setPagination
    ] = useState(null);

    const loadHistory =
        useCallback(
            async () => {
                if (
                    !maintenanceRequest
                        ?.public_id
                ) {
                    return;
                }

                try {
                    setLoading(true);
                    setError("");

                    const fromIso =
                        toIsoOrEmpty(
                            createdFrom
                        );

                    const toIso =
                        toIsoOrEmpty(
                            createdTo
                        );

                    if (
                        createdFrom &&
                        !fromIso
                    ) {
                        throw new Error(
                            "Created-from date and time is invalid."
                        );
                    }

                    if (
                        createdTo &&
                        !toIso
                    ) {
                        throw new Error(
                            "Created-to date and time is invalid."
                        );
                    }

                    if (
                        fromIso &&
                        toIso &&
                        new Date(
                            fromIso
                        ).getTime() >
                            new Date(
                                toIso
                            ).getTime()
                    ) {
                        throw new Error(
                            "Created-from date and time cannot be after created-to date and time."
                        );
                    }

                    const params = {
                        sort_order:
                            sortOrder,
                        page: 1,
                        limit: 50
                    };

                    if (accessContext) {
                        params.access_context =
                            accessContext;
                    }

                    if (activityType) {
                        params.activity_type =
                            activityType;
                    }

                    if (fromIso) {
                        params.created_from =
                            fromIso;
                    }

                    if (toIso) {
                        params.created_to =
                            toIso;
                    }

                    const response =
                        await apiClient.get(
                            `/maintenance/requests/${encodeURIComponent(
                                maintenanceRequest.public_id
                            )}/activity-history`,
                            {
                                params
                            }
                        );

                    const data =
                        response?.data?.data ||
                        {};

                    const rows =
                        data.maintenance_activity_history ||
                        data.activity_history ||
                        data.maintenance_activities ||
                        [];

                    setActivityHistory(
                        Array.isArray(rows)
                            ? rows
                            : []
                    );

                    setPagination(
                        response?.data
                            ?.pagination ||
                            null
                    );
                } catch (
                    requestError
                ) {
                    setActivityHistory([]);
                    setPagination(null);
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
                activityType,
                createdFrom,
                createdTo,
                maintenanceRequest
                    ?.public_id,
                sortOrder
            ]
        );

    useEffect(() => {
        loadHistory();
    }, [
        loadHistory
    ]);

    return (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-slate-100 p-2 text-slate-600">
                        <Activity className="h-5 w-5" />
                    </span>

                    <div>
                        <h3 className="text-base font-bold text-slate-900">
                            Activity History
                        </h3>

                        <p className="mt-0.5 text-xs text-slate-500">
                            Detailed append-only audit stream across maintenance operations.
                        </p>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="secondary"
                    leftIcon={RefreshCw}
                    disabled={loading}
                    onClick={
                        loadHistory
                    }
                >
                    Refresh Activity
                </Button>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Activity Type
                        </span>

                        <select
                            value={
                                activityType
                            }
                            onChange={
                                event =>
                                    setActivityType(
                                        event.target.value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            {ACTIVITY_TYPES.map(
                                item => (
                                    <option
                                        key={
                                            item ||
                                            "all"
                                        }
                                        value={
                                            item
                                        }
                                    >
                                        {item
                                            ? formatLabel(
                                                  item
                                              )
                                            : "All Activity Types"}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Created From
                        </span>

                        <input
                            type="datetime-local"
                            value={
                                createdFrom
                            }
                            onChange={
                                event =>
                                    setCreatedFrom(
                                        event.target.value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Created To
                        </span>

                        <input
                            type="datetime-local"
                            value={
                                createdTo
                            }
                            onChange={
                                event =>
                                    setCreatedTo(
                                        event.target.value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Sort Order
                        </span>

                        <select
                            value={
                                sortOrder
                            }
                            onChange={
                                event =>
                                    setSortOrder(
                                        event.target.value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="desc">
                                Newest First
                            </option>

                            <option value="asc">
                                Oldest First
                            </option>
                        </select>
                    </label>
                </div>

                {pagination && (
                    <p className="text-xs text-slate-400">
                        Total records:{" "}
                        {pagination.total_records ??
                            activityHistory.length}
                    </p>
                )}

                {loading && (
                    <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        Loading activity history...
                    </div>
                )}

                {!loading &&
                    activityHistory.length ===
                        0 && (
                        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                            No maintenance activity history found.
                        </div>
                    )}

                {!loading &&
                    activityHistory.map(
                        entry => (
                            <article
                                key={
                                    entry.public_id ||
                                    `${entry.activity_type}-${entry.created_at}`
                                }
                                className="rounded-2xl border border-slate-200 bg-white p-4"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                            {formatLabel(
                                                entry.activity_type
                                            ) ||
                                                "Unknown Activity"}
                                        </span>

                                        {entry.performed_by && (
                                            <p className="mt-2 text-xs text-slate-500">
                                                Performed by{" "}
                                                <strong className="text-slate-700">
                                                    {entry.performed_by.full_name ||
                                                        entry.performed_by.public_id ||
                                                        "System"}
                                                </strong>
                                            </p>
                                        )}
                                    </div>

                                    <span className="text-xs text-slate-400">
                                        {formatDateTime(
                                            entry.created_at
                                        )}
                                    </span>
                                </div>

                                {entry.reason && (
                                    <div className="mt-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Reason
                                        </p>

                                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                                            {
                                                entry.reason
                                            }
                                        </p>
                                    </div>
                                )}

                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                    <AuditDetailsBox
                                        label="Old Value"
                                        value={
                                            entry.old_value
                                        }
                                    />

                                    <AuditDetailsBox
                                        label="New Value"
                                        value={
                                            entry.new_value
                                        }
                                    />
                                </div>

                                <div className="mt-3">
                                    <AuditDetailsBox
                                        label="Metadata"
                                        value={
                                            entry.metadata
                                        }
                                    />
                                </div>
                            </article>
                        )
                    )}
            </div>
        </section>
    );
}

export default MaintenanceActivityHistoryPanel;

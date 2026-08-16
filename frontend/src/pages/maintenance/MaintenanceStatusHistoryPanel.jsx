import {
    ArrowRight,
    History,
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

const MAINTENANCE_STATUSES = [
    "",
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

const toIsoOrEmpty = value => {
    if (!value) {
        return "";
    }

    const parsed = new Date(value);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return "";
    }

    return parsed.toISOString();
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load maintenance status history.";

function MaintenanceStatusHistoryPanel({
    maintenanceRequest,
    accessContext
}) {
    const [
        history,
        setHistory
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
        oldStatus,
        setOldStatus
    ] = useState("");

    const [
        newStatus,
        setNewStatus
    ] = useState("");

    const [
        changedFrom,
        setChangedFrom
    ] = useState("");

    const [
        changedTo,
        setChangedTo
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
                            changedFrom
                        );

                    const toIso =
                        toIsoOrEmpty(
                            changedTo
                        );

                    if (
                        changedFrom &&
                        !fromIso
                    ) {
                        throw new Error(
                            "Changed-from date and time is invalid."
                        );
                    }

                    if (
                        changedTo &&
                        !toIso
                    ) {
                        throw new Error(
                            "Changed-to date and time is invalid."
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
                            "Changed-from date and time cannot be after changed-to date and time."
                        );
                    }

                    const params = {
                        sort_order:
                            sortOrder,
                        page: 1,
                        limit: 50
                    };

                    if (
                        accessContext
                    ) {
                        params.access_context =
                            accessContext;
                    }

                    if (oldStatus) {
                        params.old_status =
                            oldStatus;
                    }

                    if (newStatus) {
                        params.new_status =
                            newStatus;
                    }

                    if (fromIso) {
                        params.changed_from =
                            fromIso;
                    }

                    if (toIso) {
                        params.changed_to =
                            toIso;
                    }

                    const response =
                        await apiClient.get(
                            `/maintenance/requests/${encodeURIComponent(
                                maintenanceRequest.public_id
                            )}/status-history`,
                            {
                                params
                            }
                        );

                    const rows =
                        response?.data?.data
                            ?.maintenance_status_history;

                    setHistory(
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
                    setHistory([]);
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
                changedFrom,
                changedTo,
                maintenanceRequest
                    ?.public_id,
                newStatus,
                oldStatus,
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
                        <History className="h-5 w-5" />
                    </span>

                    <div>
                        <h3 className="text-base font-bold text-slate-900">
                            Status History
                        </h3>

                        <p className="mt-0.5 text-xs text-slate-500">
                            Append-only maintenance lifecycle transitions.
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
                    Refresh History
                </Button>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Old Status
                        </span>

                        <select
                            value={
                                oldStatus
                            }
                            onChange={
                                event =>
                                    setOldStatus(
                                        event.target.value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            {MAINTENANCE_STATUSES.map(
                                status => (
                                    <option
                                        key={
                                            status ||
                                            "all-old"
                                        }
                                        value={
                                            status
                                        }
                                    >
                                        {status
                                            ? formatLabel(
                                                  status
                                              )
                                            : "All Old Statuses"}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            New Status
                        </span>

                        <select
                            value={
                                newStatus
                            }
                            onChange={
                                event =>
                                    setNewStatus(
                                        event.target.value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            {MAINTENANCE_STATUSES.map(
                                status => (
                                    <option
                                        key={
                                            status ||
                                            "all-new"
                                        }
                                        value={
                                            status
                                        }
                                    >
                                        {status
                                            ? formatLabel(
                                                  status
                                              )
                                            : "All New Statuses"}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Changed From
                        </span>

                        <input
                            type="datetime-local"
                            value={
                                changedFrom
                            }
                            onChange={
                                event =>
                                    setChangedFrom(
                                        event.target.value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Changed To
                        </span>

                        <input
                            type="datetime-local"
                            value={
                                changedTo
                            }
                            onChange={
                                event =>
                                    setChangedTo(
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
                            history.length}
                    </p>
                )}

                {loading && (
                    <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        Loading status history...
                    </div>
                )}

                {!loading &&
                    history.length ===
                        0 && (
                        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                            No maintenance status history found.
                        </div>
                    )}

                {!loading &&
                    history.map(
                        entry => (
                            <article
                                key={
                                    entry.public_id
                                }
                                className="rounded-2xl border border-slate-200 bg-white p-4"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                                            {entry.old_status
                                                ? formatLabel(
                                                      entry.old_status
                                                  )
                                                : "Initial"}
                                        </span>

                                        <ArrowRight className="h-4 w-4 text-slate-400" />

                                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700">
                                            {formatLabel(
                                                entry.new_status
                                            )}
                                        </span>
                                    </div>

                                    <span className="text-xs text-slate-400">
                                        {formatDateTime(
                                            entry.changed_at
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

                                {entry.changed_by && (
                                    <div className="mt-3 text-xs text-slate-500">
                                        Changed by:{" "}
                                        <span className="font-semibold text-slate-700">
                                            {entry.changed_by.full_name ||
                                                entry.changed_by.public_id ||
                                                "System"}
                                        </span>
                                    </div>
                                )}
                            </article>
                        )
                    )}
            </div>
        </section>
    );
}

export default MaintenanceStatusHistoryPanel;

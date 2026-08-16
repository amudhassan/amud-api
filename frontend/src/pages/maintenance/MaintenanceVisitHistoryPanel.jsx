import {
    CalendarDays,
    RefreshCw
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

const VISIT_STATUSES = [
    "",
    "scheduled",
    "confirmed",
    "rescheduled",
    "in_progress",
    "completed",
    "missed",
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
    "Unable to load maintenance visit history.";

const getChangedByLabel = entry =>
    entry?.changed_by?.full_name ||
    entry?.changed_by?.public_id ||
    entry?.changed_by_full_name ||
    entry?.changed_by_public_id ||
    "System";

function MaintenanceVisitHistoryPanel({
    maintenanceRequest,
    accessContext
}) {
    const [
        visits,
        setVisits
    ] = useState([]);

    const [
        selectedVisitId,
        setSelectedVisitId
    ] = useState("");

    const [
        history,
        setHistory
    ] = useState([]);

    const [
        loadingVisits,
        setLoadingVisits
    ] = useState(false);

    const [
        loadingHistory,
        setLoadingHistory
    ] = useState(false);

    const [
        error,
        setError
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

    const selectedVisit =
        useMemo(
            () =>
                visits.find(
                    visit =>
                        visit.public_id ===
                        selectedVisitId
                ) || null,
            [
                selectedVisitId,
                visits
            ]
        );

    const loadVisits =
        useCallback(
            async () => {
                if (
                    !maintenanceRequest
                        ?.public_id
                ) {
                    return;
                }

                try {
                    setLoadingVisits(true);
                    setError("");

                    const params = {
                        sort_by:
                            "scheduled_start_at",
                        sort_order:
                            "desc",
                        page: 1,
                        limit: 100
                    };

                    if (accessContext) {
                        params.access_context =
                            accessContext;
                    }

                    const response =
                        await apiClient.get(
                            `/maintenance/requests/${encodeURIComponent(
                                maintenanceRequest.public_id
                            )}/visits`,
                            {
                                params
                            }
                        );

                    const data =
                        response?.data?.data ||
                        {};

                    const rows =
                        data.maintenance_visits ||
                        data.visits ||
                        [];

                    const normalized =
                        Array.isArray(rows)
                            ? rows
                            : [];

                    setVisits(normalized);

                    setSelectedVisitId(
                        current =>
                            normalized.some(
                                visit =>
                                    visit.public_id ===
                                    current
                            )
                                ? current
                                : normalized[0]
                                    ?.public_id ||
                                  ""
                    );
                } catch (
                    requestError
                ) {
                    setVisits([]);
                    setSelectedVisitId("");
                    setHistory([]);
                    setPagination(null);
                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLoadingVisits(false);
                }
            },
            [
                accessContext,
                maintenanceRequest
                    ?.public_id
            ]
        );

    const loadHistory =
        useCallback(
            async () => {
                if (
                    !maintenanceRequest
                        ?.public_id ||
                    !selectedVisitId
                ) {
                    setHistory([]);
                    setPagination(null);
                    return;
                }

                try {
                    setLoadingHistory(true);
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

                    if (accessContext) {
                        params.access_context =
                            accessContext;
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
                            )}/visits/${encodeURIComponent(
                                selectedVisitId
                            )}/history`,
                            {
                                params
                            }
                        );

                    const data =
                        response?.data?.data ||
                        {};

                    const rows =
                        data.maintenance_visit_history ||
                        data.visit_history ||
                        data.maintenance_visit_histories ||
                        [];

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
                    setLoadingHistory(false);
                }
            },
            [
                accessContext,
                changedFrom,
                changedTo,
                maintenanceRequest
                    ?.public_id,
                newStatus,
                selectedVisitId,
                sortOrder
            ]
        );

    useEffect(() => {
        loadVisits();
    }, [loadVisits]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    return (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-slate-100 p-2 text-slate-600">
                        <CalendarDays className="h-5 w-5" />
                    </span>

                    <div>
                        <h3 className="text-base font-bold text-slate-900">
                            Visit History
                        </h3>

                        <p className="mt-0.5 text-xs text-slate-500">
                            Append-only lifecycle and rescheduling history for each maintenance visit.
                        </p>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="secondary"
                    leftIcon={RefreshCw}
                    disabled={
                        loadingVisits ||
                        loadingHistory
                    }
                    onClick={async () => {
                        await loadVisits();
                    }}
                >
                    Refresh Visits
                </Button>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}

                {loadingVisits && (
                    <div className="rounded-xl border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                        Loading maintenance visits...
                    </div>
                )}

                {!loadingVisits &&
                    visits.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                            No maintenance visits found for this request.
                        </div>
                    )}

                {!loadingVisits &&
                    visits.length > 0 && (
                        <>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                <label className="block xl:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Visit
                                    </span>

                                    <select
                                        value={
                                            selectedVisitId
                                        }
                                        onChange={
                                            event =>
                                                setSelectedVisitId(
                                                    event
                                                        .target
                                                        .value
                                                )
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        {visits.map(
                                            visit => (
                                                <option
                                                    key={
                                                        visit.public_id
                                                    }
                                                    value={
                                                        visit.public_id
                                                    }
                                                >
                                                    {formatLabel(
                                                        visit.visit_type
                                                    )} · {formatLabel(
                                                        visit.status
                                                    )} · {formatDateTime(
                                                        visit.scheduled_start_at
                                                    )}
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
                                                    event
                                                        .target
                                                        .value
                                                )
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        {VISIT_STATUSES.map(
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
                                                        : "All Statuses"}
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
                                                    event
                                                        .target
                                                        .value
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
                                                    event
                                                        .target
                                                        .value
                                                )
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </label>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-xs text-slate-500">
                                    {selectedVisit && (
                                        <>
                                            Selected: {formatLabel(
                                                selectedVisit.visit_type
                                            )} · {formatLabel(
                                                selectedVisit.status
                                            )}
                                        </>
                                    )}
                                </div>

                                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Sort

                                    <select
                                        value={
                                            sortOrder
                                        }
                                        onChange={
                                            event =>
                                                setSortOrder(
                                                    event
                                                        .target
                                                        .value
                                                )
                                        }
                                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                                    Total history records:{" "}
                                    {pagination.total_records ??
                                        history.length}
                                </p>
                            )}

                            {loadingHistory && (
                                <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                                    Loading visit history...
                                </div>
                            )}

                            {!loadingHistory &&
                                history.length ===
                                    0 && (
                                    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                                        No history records found for the selected visit.
                                    </div>
                                )}

                            {!loadingHistory &&
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

                                                    <span className="text-slate-400">
                                                        →
                                                    </span>

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

                                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Previous Schedule
                                                    </p>

                                                    <p className="mt-1 text-sm text-slate-700">
                                                        {entry.old_schedule_start_at
                                                            ? `${formatDateTime(
                                                                  entry.old_schedule_start_at
                                                              )} → ${formatDateTime(
                                                                  entry.old_schedule_end_at
                                                              )}`
                                                            : "—"}
                                                    </p>
                                                </div>

                                                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                                                        New Schedule
                                                    </p>

                                                    <p className="mt-1 text-sm text-blue-800">
                                                        {formatDateTime(
                                                            entry.new_schedule_start_at
                                                        )} → {formatDateTime(
                                                            entry.new_schedule_end_at
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            {entry.reason && (
                                                <div className="mt-4">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Reason
                                                    </p>

                                                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                                                        {entry.reason}
                                                    </p>
                                                </div>
                                            )}

                                            <p className="mt-3 text-xs text-slate-500">
                                                Changed by:{" "}
                                                <strong className="text-slate-700">
                                                    {getChangedByLabel(
                                                        entry
                                                    )}
                                                </strong>
                                            </p>
                                        </article>
                                    )
                                )}
                        </>
                    )}
            </div>
        </section>
    );
}

export default MaintenanceVisitHistoryPanel;

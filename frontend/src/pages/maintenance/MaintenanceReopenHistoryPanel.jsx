import {
    RefreshCw,
    RotateCcw
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

const REOPEN_STATUSES = [
    "",
    "pending",
    "approved",
    "rejected",
    "cancelled"
];

const FROM_STATUSES = [
    "",
    "closed",
    "rejected",
    "cancelled"
];

const TARGET_STATUSES = [
    "",
    "reported",
    "under_review"
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

const statusClassName = status => {
    switch (status) {
        case "approved":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";

        case "rejected":
            return "border-rose-200 bg-rose-50 text-rose-700";

        case "cancelled":
            return "border-slate-300 bg-slate-100 text-slate-700";

        case "pending":
            return "border-blue-200 bg-blue-50 text-blue-700";

        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load maintenance reopening history.";

function MaintenanceReopenHistoryPanel({
    maintenanceRequest,
    accessContext
}) {
    const [
        reopenRequests,
        setReopenRequests
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
        status,
        setStatus
    ] = useState("");

    const [
        fromStatus,
        setFromStatus
    ] = useState("");

    const [
        targetStatus,
        setTargetStatus
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

                    if (status) {
                        params.status =
                            status;
                    }

                    if (fromStatus) {
                        params.from_status =
                            fromStatus;
                    }

                    if (targetStatus) {
                        params.target_status =
                            targetStatus;
                    }

                    const response =
                        await apiClient.get(
                            `/maintenance/requests/${encodeURIComponent(
                                maintenanceRequest.public_id
                            )}/reopen-requests`,
                            {
                                params
                            }
                        );

                    const rows =
                        response?.data?.data
                            ?.maintenance_reopen_requests;

                    setReopenRequests(
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
                    setReopenRequests([]);
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
                fromStatus,
                maintenanceRequest
                    ?.public_id,
                sortOrder,
                status,
                targetStatus
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
                        <RotateCcw className="h-5 w-5" />
                    </span>

                    <div>
                        <h3 className="text-base font-bold text-slate-900">
                            Reopening History
                        </h3>

                        <p className="mt-0.5 text-xs text-slate-500">
                            Audit trail of reopening requests and their decisions.
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

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Decision Status
                        </span>

                        <select
                            value={status}
                            onChange={
                                event =>
                                    setStatus(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            {REOPEN_STATUSES.map(
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
                            From Status
                        </span>

                        <select
                            value={
                                fromStatus
                            }
                            onChange={
                                event =>
                                    setFromStatus(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            {FROM_STATUSES.map(
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
                                            : "All Sources"}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Target Status
                        </span>

                        <select
                            value={
                                targetStatus
                            }
                            onChange={
                                event =>
                                    setTargetStatus(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            {TARGET_STATUSES.map(
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
                                            : "All Targets"}
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
                            onChange={
                                event =>
                                    setSortOrder(
                                        event
                                            .target
                                            .value
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
                            reopenRequests.length}
                    </p>
                )}

                {loading && (
                    <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        Loading reopening history...
                    </div>
                )}

                {!loading &&
                    reopenRequests.length ===
                        0 && (
                        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                            No reopening history found.
                        </div>
                    )}

                {!loading &&
                    reopenRequests.map(
                        reopenRequest => (
                            <article
                                key={
                                    reopenRequest.public_id
                                }
                                className="rounded-2xl border border-slate-200 bg-white p-4"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">
                                            {formatLabel(
                                                reopenRequest.from_status
                                            )}{" "}
                                            →{" "}
                                            {formatLabel(
                                                reopenRequest.target_status
                                            )}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-400">
                                            Requested{" "}
                                            {formatDateTime(
                                                reopenRequest.requested_at
                                            )}
                                        </p>
                                    </div>

                                    <span
                                        className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(
                                            reopenRequest.status
                                        )}`}
                                    >
                                        {formatLabel(
                                            reopenRequest.status
                                        ) ||
                                            "Unknown"}
                                    </span>
                                </div>

                                <div className="mt-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Reopening Reason
                                    </p>

                                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                                        {reopenRequest.reason ||
                                            "—"}
                                    </p>
                                </div>

                                {reopenRequest.decision_note && (
                                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Decision Note
                                        </p>

                                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                                            {
                                                reopenRequest.decision_note
                                            }
                                        </p>

                                        {reopenRequest.decided_at && (
                                            <p className="mt-2 text-xs text-slate-400">
                                                Decided{" "}
                                                {formatDateTime(
                                                    reopenRequest.decided_at
                                                )}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </article>
                        )
                    )}
            </div>
        </section>
    );
}

export default MaintenanceReopenHistoryPanel;

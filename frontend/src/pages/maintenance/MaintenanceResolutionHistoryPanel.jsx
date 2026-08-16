import {
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

const CONFIRMATION_STATUSES = [
    "",
    "pending",
    "confirmed",
    "disputed",
    "no_response",
    "not_required"
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
        case "confirmed":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";

        case "disputed":
            return "border-rose-200 bg-rose-50 text-rose-700";

        case "no_response":
            return "border-amber-200 bg-amber-50 text-amber-700";

        case "pending":
            return "border-blue-200 bg-blue-50 text-blue-700";

        case "not_required":
            return "border-slate-200 bg-slate-50 text-slate-700";

        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load maintenance resolution history.";

function MaintenanceResolutionHistoryPanel({
    maintenanceRequest,
    accessContext
}) {
    const [
        resolutions,
        setResolutions
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
        confirmationStatus,
        setConfirmationStatus
    ] = useState("");

    const [
        sortOrder,
        setSortOrder
    ] = useState("desc");

    const [
        pagination,
        setPagination
    ] = useState(null);

    const loadResolutions =
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

                    if (
                        confirmationStatus
                    ) {
                        params.confirmation_status =
                            confirmationStatus;
                    }

                    const response =
                        await apiClient.get(
                            `/maintenance/requests/${encodeURIComponent(
                                maintenanceRequest.public_id
                            )}/resolutions`,
                            {
                                params
                            }
                        );

                    const rows =
                        response?.data?.data
                            ?.maintenance_resolutions;

                    setResolutions(
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
                    setResolutions([]);
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
                confirmationStatus,
                maintenanceRequest
                    ?.public_id,
                sortOrder
            ]
        );

    useEffect(() => {
        loadResolutions();
    }, [
        loadResolutions
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
                            Resolution History
                        </h3>

                        <p className="mt-0.5 text-xs text-slate-500">
                            Permanent resolution attempts and their confirmation outcomes.
                        </p>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="secondary"
                    leftIcon={RefreshCw}
                    disabled={loading}
                    onClick={
                        loadResolutions
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

                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Confirmation Status
                        </span>

                        <select
                            value={
                                confirmationStatus
                            }
                            onChange={
                                event =>
                                    setConfirmationStatus(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            {CONFIRMATION_STATUSES.map(
                                status => (
                                    <option
                                        key={
                                            status ||
                                            "all"
                                        }
                                        value={
                                            status
                                        }
                                    >
                                        {status
                                            ? formatLabel(
                                                  status
                                              )
                                            : "All Statuses"}
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
                            resolutions.length}
                    </p>
                )}

                {loading && (
                    <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        Loading resolution history...
                    </div>
                )}

                {!loading &&
                    resolutions.length ===
                        0 && (
                        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                            No maintenance resolution history found.
                        </div>
                    )}

                {!loading &&
                    resolutions.map(
                        resolution => (
                            <article
                                key={
                                    resolution.public_id
                                }
                                className="rounded-2xl border border-slate-200 bg-white p-4"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">
                                            Resolution{" "}
                                            {resolution.sequence_number
                                                ? `#${resolution.sequence_number}`
                                                : ""}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-400">
                                            Submitted{" "}
                                            {formatDateTime(
                                                resolution.submitted_at
                                            )}
                                        </p>
                                    </div>

                                    <span
                                        className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(
                                            resolution.confirmation_status
                                        )}`}
                                    >
                                        {formatLabel(
                                            resolution.confirmation_status
                                        ) ||
                                            "Unknown"}
                                    </span>
                                </div>

                                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                                    {resolution.resolution_summary ||
                                        "—"}
                                </p>

                                <div className="mt-4 grid gap-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                                    <div>
                                        <span className="font-semibold text-slate-500">
                                            Work Completed
                                        </span>

                                        <p className="mt-1">
                                            {formatDateTime(
                                                resolution.work_completed_at
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <span className="font-semibold text-slate-500">
                                            Confirmation Deadline
                                        </span>

                                        <p className="mt-1">
                                            {formatDateTime(
                                                resolution.confirmation_deadline_at
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <span className="font-semibold text-slate-500">
                                            Confirmed
                                        </span>

                                        <p className="mt-1">
                                            {formatDateTime(
                                                resolution.confirmed_at
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <span className="font-semibold text-slate-500">
                                            Disputed
                                        </span>

                                        <p className="mt-1">
                                            {formatDateTime(
                                                resolution.disputed_at
                                            )}
                                        </p>
                                    </div>

                                    {resolution.confirmation_note && (
                                        <div className="sm:col-span-2">
                                            <span className="font-semibold text-slate-500">
                                                Confirmation Note
                                            </span>

                                            <p className="mt-1 whitespace-pre-wrap break-words">
                                                {
                                                    resolution.confirmation_note
                                                }
                                            </p>
                                        </div>
                                    )}

                                    {resolution.dispute_reason && (
                                        <div className="sm:col-span-2">
                                            <span className="font-semibold text-slate-500">
                                                Dispute Reason
                                            </span>

                                            <p className="mt-1 whitespace-pre-wrap break-words">
                                                {
                                                    resolution.dispute_reason
                                                }
                                            </p>
                                        </div>
                                    )}

                                    {resolution.actual_cost_summary && (
                                        <div className="sm:col-span-2">
                                            <span className="font-semibold text-slate-500">
                                                Actual Cost Summary
                                            </span>

                                            <p className="mt-1 whitespace-pre-wrap break-words">
                                                {
                                                    resolution.actual_cost_summary
                                                }
                                            </p>
                                        </div>
                                    )}

                                    {resolution.evidence_override_reason && (
                                        <div className="sm:col-span-2">
                                            <span className="font-semibold text-slate-500">
                                                Evidence Override Reason
                                            </span>

                                            <p className="mt-1 whitespace-pre-wrap break-words">
                                                {
                                                    resolution.evidence_override_reason
                                                }
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </article>
                        )
                    )}
            </div>
        </section>
    );
}

export default MaintenanceResolutionHistoryPanel;

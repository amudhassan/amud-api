import {
    AlertTriangle,
    Ban,
    CalendarClock,
    CalendarPlus,
    CalendarX2,
    Eye,
    RefreshCw,
    Wrench,
    X
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";
import { Button } from "../../components/ui/Button";
import CreatePreventiveMaintenanceOccurrenceModal from "./CreatePreventiveMaintenanceOccurrenceModal";
import PreventiveMaintenanceOccurrenceDetailModal from "./PreventiveMaintenanceOccurrenceDetailModal";
import PreventiveMaintenanceOccurrenceLifecycleModal from "./PreventiveMaintenanceOccurrenceLifecycleModal";

const occurrenceStatuses = [
    "pending",
    "generated",
    "skipped",
    "failed",
    "cancelled"
];

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load preventive maintenance occurrences.";

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character => character.toUpperCase());

const formatDateTime = value => {
    if (!value) return "—";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);

    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    }).format(parsed);
};

const statusClassName = status => {
    switch (status) {
        case "pending":
            return "border-amber-200 bg-amber-50 text-amber-700";
        case "generated":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        case "skipped":
            return "border-slate-200 bg-slate-100 text-slate-700";
        case "failed":
            return "border-rose-200 bg-rose-50 text-rose-700";
        case "cancelled":
            return "border-red-200 bg-red-50 text-red-700";
        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
};

const normalizeOccurrences = response => {
    const body = response?.data || {};
    const data = body?.data || {};

    const occurrences = Array.isArray(
        data.preventive_occurrences
    )
        ? data.preventive_occurrences
        : [];

    const pagination = data.pagination || body.pagination || {};

    const total = Number(
        pagination.total ??
            pagination.total_records ??
            occurrences.length
    );

    return {
        occurrences,
        pagination: {
            page: Number(pagination.page) || 1,
            limit: Number(pagination.limit) || 10,
            total: Number.isFinite(total) ? total : occurrences.length,
            total_pages:
                Number(pagination.total_pages) ||
                (occurrences.length > 0 ? 1 : 0)
        }
    };
};

function PreventiveMaintenanceOccurrencesModal({
    open,
    planPublicId,
    isAdmin = false,
    onClose
}) {
    const [plan, setPlan] = useState(null);
    const [occurrences, setOccurrences] = useState([]);
    const [statusFilter, setStatusFilter] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [lifecycleOpen, setLifecycleOpen] = useState(false);
    const [lifecycleAction, setLifecycleAction] = useState("");
    const [selectedOccurrencePublicId, setSelectedOccurrencePublicId] =
        useState("");
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        total_pages: 0
    });

    const requestParams = useCallback(
        extra => {
            const params = { ...extra };
            if (!isAdmin) {
                params.access_context = "owner";
            }
            return params;
        },
        [isAdmin]
    );

    const loadPlan = useCallback(async () => {
        if (!open || !planPublicId) return null;

        const response = await apiClient.get(
            `/maintenance/preventive-plans/${encodeURIComponent(
                planPublicId
            )}`,
            {
                params: requestParams({})
            }
        );

        const latest =
            response?.data?.data?.preventive_plan || null;
        setPlan(latest);
        return latest;
    }, [open, planPublicId, requestParams]);

    const loadOccurrences = useCallback(
        async ({
            page = 1,
            status = statusFilter
        } = {}) => {
            if (!open || !planPublicId) return;

            try {
                setLoading(true);
                setError("");

                const params = {
                    page,
                    limit: pagination.limit
                };

                if (status) {
                    params.status = status;
                }

                const response = await apiClient.get(
                    `/maintenance/preventive-plans/${encodeURIComponent(
                        planPublicId
                    )}/occurrences`,
                    {
                        params: requestParams(params)
                    }
                );

                const normalized =
                    normalizeOccurrences(response);

                setOccurrences(normalized.occurrences);
                setPagination(normalized.pagination);
            } catch (requestError) {
                setOccurrences([]);
                setError(getErrorMessage(requestError));
            } finally {
                setLoading(false);
            }
        },
        [
            open,
            pagination.limit,
            planPublicId,
            requestParams,
            statusFilter
        ]
    );

    const refreshAll = useCallback(async () => {
        if (!open || !planPublicId) return;

        try {
            setError("");
            await loadPlan();
            await loadOccurrences({
                page: pagination.page,
                status: statusFilter
            });
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        }
    }, [
        loadOccurrences,
        loadPlan,
        open,
        pagination.page,
        planPublicId,
        statusFilter
    ]);

    useEffect(() => {
        if (!open || !planPublicId) return;

        setPlan(null);
        setOccurrences([]);
        setStatusFilter("");
        setPagination({
            page: 1,
            limit: 10,
            total: 0,
            total_pages: 0
        });
        setError("");

        (async () => {
            try {
                setLoading(true);
                await loadPlan();

                const response = await apiClient.get(
                    `/maintenance/preventive-plans/${encodeURIComponent(
                        planPublicId
                    )}/occurrences`,
                    {
                        params: requestParams({
                            page: 1,
                            limit: 10
                        })
                    }
                );

                const normalized =
                    normalizeOccurrences(response);
                setOccurrences(normalized.occurrences);
                setPagination(normalized.pagination);
            } catch (requestError) {
                setError(getErrorMessage(requestError));
            } finally {
                setLoading(false);
            }
        })();
    }, [open, planPublicId, requestParams, loadPlan]);

    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !createOpen &&
                !detailOpen &&
                !lifecycleOpen
            ) {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () =>
            window.removeEventListener("keydown", handleKeyDown);
    }, [
        createOpen,
        detailOpen,
        lifecycleOpen,
        onClose,
        open
    ]);

    const pendingCount = useMemo(
        () =>
            occurrences.filter(
                occurrence => occurrence.status === "pending"
            ).length,
        [occurrences]
    );

    if (!open || !planPublicId) return null;

    const changeStatus = value => {
        setStatusFilter(value);
        loadOccurrences({
            page: 1,
            status: value
        });
    };

    return (
        <>
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
                <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                    <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <CalendarClock className="h-5 w-5 text-emerald-600" />
                                <h2 className="text-xl font-bold text-slate-950">
                                    Preventive Maintenance Occurrences
                                </h2>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">
                                {plan?.title || "Preventive plan"}
                            </p>
                            <p className="mt-2 text-xs font-medium text-slate-500">
                                {pagination.total} occurrence(s) · {pendingCount} pending on this page
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {plan?.status === "active" && (
                                <Button
                                    type="button"
                                    leftIcon={CalendarPlus}
                                    onClick={() => setCreateOpen(true)}
                                >
                                    Create Occurrence
                                </Button>
                            )}

                            <Button
                                type="button"
                                variant="secondary"
                                leftIcon={RefreshCw}
                                disabled={loading}
                                onClick={refreshAll}
                            >
                                Refresh
                            </Button>

                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-4">
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label
                                    htmlFor="preventive-occurrence-status-filter"
                                    className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                                >
                                    Status
                                </label>
                                <select
                                    id="preventive-occurrence-status-filter"
                                    value={statusFilter}
                                    onChange={event =>
                                        changeStatus(event.target.value)
                                    }
                                    disabled={loading}
                                    className="mt-1 block min-w-44 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                >
                                    <option value="">All statuses</option>
                                    {occurrenceStatuses.map(status => (
                                        <option key={status} value={status}>
                                            {formatLabel(status)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {plan && (
                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                                    Plan status: <span className="font-semibold text-slate-900">{formatLabel(plan.status)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="min-h-0 flex-1 overflow-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-left">
                            <thead className="sticky top-0 z-10 bg-slate-50">
                                <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <th className="px-5 py-3">Due At</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Maintenance Request</th>
                                    <th className="px-5 py-3">Generated / Attempted</th>
                                    <th className="px-5 py-3">Created</th>
                                    <th className="px-5 py-3 text-right">Action</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100 bg-white">
                                {loading && occurrences.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="6"
                                            className="px-5 py-14 text-center text-sm text-slate-500"
                                        >
                                            Loading preventive occurrences...
                                        </td>
                                    </tr>
                                ) : occurrences.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="6"
                                            className="px-5 py-14 text-center"
                                        >
                                            <p className="font-semibold text-slate-800">
                                                No preventive occurrences found.
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {statusFilter
                                                    ? "No occurrence matches the selected status."
                                                    : plan?.status === "active"
                                                      ? "Create the first occurrence for this active plan."
                                                      : "This plan does not currently have occurrence records."}
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    occurrences.map(occurrence => (
                                        <tr
                                            key={occurrence.public_id}
                                            className="align-top hover:bg-slate-50/70"
                                        >
                                            <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-900">
                                                {formatDateTime(occurrence.due_at)}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(
                                                        occurrence.status
                                                    )}`}
                                                >
                                                    {formatLabel(occurrence.status)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                {occurrence.maintenance_request ? (
                                                    <div>
                                                        <p className="font-semibold text-slate-900">
                                                            {occurrence.maintenance_request.request_number || "Generated request"}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {formatLabel(
                                                                occurrence.maintenance_request.status
                                                            )}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                <p>
                                                    Generated: {formatDateTime(occurrence.generated_at)}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Attempted: {formatDateTime(occurrence.generation_attempted_at)}
                                                </p>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                                                {formatDateTime(occurrence.created_at)}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex min-w-max flex-wrap justify-end gap-2">
                                                    {occurrence.status ===
                                                        "pending" &&
                                                        plan?.status ===
                                                            "active" && (
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                leftIcon={Wrench}
                                                                onClick={() => {
                                                                    setSelectedOccurrencePublicId(
                                                                        occurrence.public_id
                                                                    );
                                                                    setLifecycleAction(
                                                                        "generate"
                                                                    );
                                                                    setLifecycleOpen(
                                                                        true
                                                                    );
                                                                }}
                                                            >
                                                                Generate
                                                            </Button>
                                                        )}

                                                    {occurrence.status ===
                                                        "pending" && (
                                                        <>
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                leftIcon={CalendarX2}
                                                                onClick={() => {
                                                                    setSelectedOccurrencePublicId(
                                                                        occurrence.public_id
                                                                    );
                                                                    setLifecycleAction(
                                                                        "skip"
                                                                    );
                                                                    setLifecycleOpen(
                                                                        true
                                                                    );
                                                                }}
                                                            >
                                                                Skip
                                                            </Button>

                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                leftIcon={AlertTriangle}
                                                                onClick={() => {
                                                                    setSelectedOccurrencePublicId(
                                                                        occurrence.public_id
                                                                    );
                                                                    setLifecycleAction(
                                                                        "fail"
                                                                    );
                                                                    setLifecycleOpen(
                                                                        true
                                                                    );
                                                                }}
                                                            >
                                                                Fail
                                                            </Button>

                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                leftIcon={Ban}
                                                                onClick={() => {
                                                                    setSelectedOccurrencePublicId(
                                                                        occurrence.public_id
                                                                    );
                                                                    setLifecycleAction(
                                                                        "cancel"
                                                                    );
                                                                    setLifecycleOpen(
                                                                        true
                                                                    );
                                                                }}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </>
                                                    )}

                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        leftIcon={Eye}
                                                        onClick={() => {
                                                            setSelectedOccurrencePublicId(
                                                                occurrence.public_id
                                                            );
                                                            setDetailOpen(true);
                                                        }}
                                                    >
                                                        View
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={loading || pagination.page <= 1}
                            onClick={() =>
                                loadOccurrences({
                                    page: pagination.page - 1
                                })
                            }
                        >
                            Previous
                        </Button>

                        <p className="text-sm text-slate-500">
                            Page {pagination.page} of {Math.max(
                                pagination.total_pages,
                                1
                            )}
                        </p>

                        <Button
                            type="button"
                            variant="secondary"
                            disabled={
                                loading ||
                                pagination.total_pages === 0 ||
                                pagination.page >= pagination.total_pages
                            }
                            onClick={() =>
                                loadOccurrences({
                                    page: pagination.page + 1
                                })
                            }
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>

            <CreatePreventiveMaintenanceOccurrenceModal
                open={createOpen}
                planPublicId={planPublicId}
                isAdmin={isAdmin}
                onClose={() => setCreateOpen(false)}
                onCreated={() => {
                    setCreateOpen(false);
                    loadPlan();
                    loadOccurrences({ page: 1 });
                }}
            />

            <PreventiveMaintenanceOccurrenceDetailModal
                open={detailOpen}
                planPublicId={planPublicId}
                occurrencePublicId={selectedOccurrencePublicId}
                isAdmin={isAdmin}
                onClose={() => {
                    setDetailOpen(false);
                    setSelectedOccurrencePublicId("");
                }}
            />

            <PreventiveMaintenanceOccurrenceLifecycleModal
                open={lifecycleOpen}
                planPublicId={planPublicId}
                occurrencePublicId={selectedOccurrencePublicId}
                action={lifecycleAction}
                isAdmin={isAdmin}
                onClose={() => {
                    setLifecycleOpen(false);
                    setLifecycleAction("");
                    setSelectedOccurrencePublicId("");
                }}
                onUpdated={() => {
                    setLifecycleOpen(false);
                    setLifecycleAction("");
                    setSelectedOccurrencePublicId("");
                    refreshAll();
                }}
            />
        </>
    );
}

export default PreventiveMaintenanceOccurrencesModal;

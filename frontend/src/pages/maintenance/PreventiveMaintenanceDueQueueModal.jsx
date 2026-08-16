import {
    CalendarClock,
    CheckCircle2,
    CircleAlert,
    Clock3,
    PlayCircle,
    RefreshCw,
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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load due preventive maintenance plans.";

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

const normalizePlans = response => {
    const body = response?.data || {};
    const data = body?.data || {};
    const plans = Array.isArray(data.preventive_plans)
        ? data.preventive_plans
        : Array.isArray(data.preventive_maintenance_plans)
          ? data.preventive_maintenance_plans
          : [];
    const pagination = data.pagination || body.pagination || {};

    const total = Number(
        pagination.total ??
            pagination.total_records ??
            plans.length
    );

    return {
        plans,
        pagination: {
            page: Number(pagination.page) || 1,
            limit: Number(pagination.limit) || 10,
            total: Number.isFinite(total) ? total : plans.length,
            total_pages:
                Number(pagination.total_pages) ||
                (plans.length > 0 ? 1 : 0)
        }
    };
};

const normalizeProcessResult = response => {
    const data = response?.data?.data || {};

    return {
        due_through: data.due_through || null,
        summary: {
            total: Number(data.summary?.total) || 0,
            generated: Number(data.summary?.generated) || 0,
            already_processed:
                Number(data.summary?.already_processed) || 0,
            not_due: Number(data.summary?.not_due) || 0,
            failed: Number(data.summary?.failed) || 0
        },
        results: Array.isArray(data.results) ? data.results : []
    };
};

const outcomeClassName = outcome => {
    switch (outcome) {
        case "generated":
        case "already_generated":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        case "already_processed":
            return "border-blue-200 bg-blue-50 text-blue-700";
        case "not_due":
            return "border-amber-200 bg-amber-50 text-amber-700";
        case "failed":
            return "border-rose-200 bg-rose-50 text-rose-700";
        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
};

function PreventiveMaintenanceDueQueueModal({
    open,
    isAdmin = false,
    onClose,
    onProcessed
}) {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");
    const [processResult, setProcessResult] = useState(null);
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

    const loadDuePlans = useCallback(
        async ({ page = 1 } = {}) => {
            if (!open) return;

            try {
                setLoading(true);
                setError("");

                const response = await apiClient.get(
                    "/maintenance/preventive-plans/due",
                    {
                        params: requestParams({
                            page,
                            limit: pagination.limit
                        })
                    }
                );

                const normalized = normalizePlans(response);
                setPlans(normalized.plans);
                setPagination(normalized.pagination);
            } catch (requestError) {
                setPlans([]);
                setError(getErrorMessage(requestError));
            } finally {
                setLoading(false);
            }
        },
        [open, pagination.limit, requestParams]
    );

    useEffect(() => {
        if (!open) return;

        setProcessResult(null);
        setError("");
        setPagination({
            page: 1,
            limit: 10,
            total: 0,
            total_pages: 0
        });
        loadDuePlans({ page: 1 });
    }, [open, isAdmin]);

    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = event => {
            if (event.key === "Escape" && !processing) {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () =>
            window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, open, processing]);

    const dueCount = useMemo(
        () => pagination.total,
        [pagination.total]
    );

    const handleProcessDue = async () => {
        if (!isAdmin || processing) return;

        try {
            setProcessing(true);
            setError("");
            setProcessResult(null);

            const response = await apiClient.post(
                "/maintenance/preventive-plans/process-due",
                {}
            );

            const normalized = normalizeProcessResult(response);
            setProcessResult(normalized);

            await loadDuePlans({ page: 1 });
            onProcessed?.(normalized);
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setProcessing(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <CalendarClock className="h-5 w-5 text-emerald-600" />
                            <h2 className="text-xl font-bold text-slate-950">
                                Preventive Maintenance Due Queue
                            </h2>
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                            Active preventive plans whose next due time has arrived.
                        </p>

                        <p className="mt-2 text-xs font-medium text-slate-500">
                            {dueCount} due plan(s)
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {isAdmin && (
                            <Button
                                type="button"
                                leftIcon={PlayCircle}
                                disabled={processing || loading || dueCount === 0}
                                onClick={handleProcessDue}
                            >
                                {processing ? "Processing..." : "Process Due"}
                            </Button>
                        )}

                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={RefreshCw}
                            disabled={loading || processing}
                            onClick={() =>
                                loadDuePlans({
                                    page: pagination.page
                                })
                            }
                        >
                            Refresh
                        </Button>

                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={X}
                            disabled={processing}
                            onClick={onClose}
                        >
                            Close
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}

                {!isAdmin && (
                    <div className="border-b border-blue-200 bg-blue-50 px-6 py-3 text-sm text-blue-700">
                        Owner access can view the due queue. Automatic due processing is restricted to administrators.
                    </div>
                )}

                {processResult && (
                    <div className="border-b border-emerald-100 bg-emerald-50/50 px-6 py-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Processing Summary
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                            Due through {formatDateTime(processResult.due_through)}
                        </p>

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                            <SummaryCard label="Total" value={processResult.summary.total} />
                            <SummaryCard label="Generated" value={processResult.summary.generated} />
                            <SummaryCard label="Already Processed" value={processResult.summary.already_processed} />
                            <SummaryCard label="Not Due" value={processResult.summary.not_due} />
                            <SummaryCard label="Failed" value={processResult.summary.failed} />
                        </div>

                        {processResult.results.length > 0 && (
                            <div className="mt-4 max-h-40 overflow-auto rounded-2xl border border-emerald-100 bg-white">
                                <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500">
                                        <tr>
                                            <th className="px-3 py-2">Plan</th>
                                            <th className="px-3 py-2">Outcome</th>
                                            <th className="px-3 py-2">Request</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {processResult.results.map((result, index) => (
                                            <tr key={`${result.preventive_plan_public_id || "plan"}-${index}`}>
                                                <td className="px-3 py-2 font-mono text-slate-600">
                                                    {result.preventive_plan_public_id || "—"}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className={`inline-flex rounded-full border px-2 py-1 font-semibold ${outcomeClassName(result.outcome)}`}>
                                                        {formatLabel(result.outcome || "unknown")}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-slate-600">
                                                    {result.preventive_occurrence?.maintenance_request?.request_number ||
                                                        result.preventive_occurrence?.maintenance_request?.public_id ||
                                                        result.message ||
                                                        result.error ||
                                                        "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                <div className="min-h-0 flex-1 overflow-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left">
                        <thead className="sticky top-0 bg-slate-50">
                            <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <th className="px-6 py-3">Plan</th>
                                <th className="px-6 py-3">Property / Unit</th>
                                <th className="px-6 py-3">Schedule</th>
                                <th className="px-6 py-3">Next Due</th>
                                <th className="px-6 py-3">Status</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                                        Loading due preventive plans...
                                    </td>
                                </tr>
                            ) : plans.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <Clock3 className="mx-auto h-7 w-7 text-emerald-600" />
                                        <p className="mt-3 font-semibold text-slate-800">
                                            No plans are due now
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            The queue is clear for the current due-through time.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                plans.map(plan => (
                                    <tr key={plan.public_id} className="align-top hover:bg-slate-50/70">
                                        <td className="px-6 py-4">
                                            <p className="font-semibold text-slate-900">
                                                {plan.title || "Untitled plan"}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {formatLabel(plan.category)} · {formatLabel(plan.priority)}
                                            </p>
                                        </td>

                                        <td className="px-6 py-4">
                                            <p className="text-sm font-semibold text-slate-800">
                                                {plan.property?.property_name ||
                                                    plan.property?.property_code ||
                                                    "—"}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {plan.request_scope === "property_common_area"
                                                    ? "Property Common Area"
                                                    : plan.unit?.unit_name ||
                                                      plan.unit?.unit_code ||
                                                      "Unit"}
                                            </p>
                                        </td>

                                        <td className="px-6 py-4 text-sm text-slate-700">
                                            {formatLabel(plan.schedule?.frequency)}
                                            {Number(plan.schedule?.interval_value) > 1
                                                ? ` × ${plan.schedule.interval_value}`
                                                : ""}
                                        </td>

                                        <td className="px-6 py-4">
                                            <p className="text-sm font-semibold text-rose-700">
                                                {formatDateTime(plan.schedule?.next_due_at)}
                                            </p>
                                        </td>

                                        <td className="px-6 py-4">
                                            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                                Active
                                            </span>
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
                        disabled={loading || processing || pagination.page <= 1}
                        onClick={() =>
                            loadDuePlans({
                                page: pagination.page - 1
                            })
                        }
                    >
                        Previous
                    </Button>

                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        {processResult?.summary.failed > 0 && (
                            <CircleAlert className="h-4 w-4 text-rose-500" />
                        )}
                        Page {pagination.page} of {Math.max(pagination.total_pages, 1)}
                    </div>

                    <Button
                        type="button"
                        variant="secondary"
                        disabled={
                            loading ||
                            processing ||
                            pagination.total_pages === 0 ||
                            pagination.page >= pagination.total_pages
                        }
                        onClick={() =>
                            loadDuePlans({
                                page: pagination.page + 1
                            })
                        }
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ label, value }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
                {value}
            </p>
        </div>
    );
}

export default PreventiveMaintenanceDueQueueModal;

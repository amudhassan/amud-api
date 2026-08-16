import {
    Ban,
    CalendarClock,
    CalendarDays,
    CheckCircle2,
    Pause,
    Pencil,
    Play,
    RefreshCw,
    X
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";
import { Button } from "../../components/ui/Button";

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

const formatMoney = (amount, currencyCode) => {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric)) return "—";

    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: currencyCode || "TZS",
            maximumFractionDigits: 2
        }).format(numeric);
    } catch {
        return `${currencyCode || "TZS"} ${numeric.toLocaleString()}`;
    }
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load preventive maintenance plan.";

function DetailItem({ label, value, wide = false }) {
    return (
        <div className={wide ? "sm:col-span-2" : ""}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </p>
            <div className="mt-1.5 text-sm font-medium leading-6 text-slate-900">
                {value ?? "—"}
            </div>
        </div>
    );
}

function PreventiveMaintenancePlanDetailModal({
    open,
    planPublicId,
    isAdmin = false,
    onClose,
    onEdit,
    onLifecycle,
    onOccurrences
}) {
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const loadPlan = useCallback(async () => {
        if (!open || !planPublicId) return;

        try {
            setLoading(true);
            setError("");

            const params = {};
            if (!isAdmin) {
                params.access_context = "owner";
            }

            const response = await apiClient.get(
                `/maintenance/preventive-plans/${planPublicId}`,
                { params }
            );

            setPlan(
                response?.data?.data?.preventive_plan || null
            );
        } catch (requestError) {
            setPlan(null);
            setError(getErrorMessage(requestError));
        } finally {
            setLoading(false);
        }
    }, [isAdmin, open, planPublicId]);

    useEffect(() => {
        if (open) {
            loadPlan();
        } else {
            setPlan(null);
            setError("");
        }
    }, [loadPlan, open]);

    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = event => {
            if (event.key === "Escape") onClose();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, open]);

    if (!open) return null;

    const schedule = plan?.schedule || {};
    const assignment = plan?.default_assignment;
    const editable = plan && !["completed", "cancelled"].includes(plan.status);

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 px-4 py-6">
            <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                            <CalendarClock className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-950">
                                Preventive Plan Detail
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {plan?.public_id || planPublicId}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="max-h-[calc(92vh-82px)] overflow-y-auto px-6 py-5">
                    {error && (
                        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="py-16 text-center text-sm text-slate-500">
                            Loading preventive maintenance plan...
                        </div>
                    ) : !plan ? (
                        <div className="py-16 text-center">
                            <p className="font-semibold text-slate-800">Plan detail is unavailable.</p>
                            <Button
                                type="button"
                                variant="secondary"
                                leftIcon={RefreshCw}
                                className="mt-4"
                                onClick={loadPlan}
                            >
                                Retry
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-950">
                                        {plan.title}
                                    </h3>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                        {plan.description}
                                    </p>
                                </div>

                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                                    {formatLabel(plan.status)}
                                </span>
                            </div>

                            <div className="mt-6 grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 sm:grid-cols-2">
                                <DetailItem label="Owner" value={plan.owner?.display_name} />
                                <DetailItem label="Property" value={plan.property?.property_name || plan.property?.property_code} />
                                <DetailItem label="Scope" value={formatLabel(plan.request_scope)} />
                                <DetailItem label="Unit" value={plan.unit?.unit_name || plan.unit?.unit_code || "—"} />
                                <DetailItem label="Category" value={formatLabel(plan.category)} />
                                <DetailItem label="Priority" value={formatLabel(plan.priority)} />
                                <DetailItem label="Impact Level" value={formatLabel(plan.impact_level)} />
                                <DetailItem label="Access Instruction" value={formatLabel(plan.access_instruction) || "—"} />
                                <DetailItem label="Location Details" value={plan.location_details || "—"} wide />
                            </div>

                            <div className="mt-5 rounded-2xl border border-slate-200 p-5">
                                <h4 className="font-bold text-slate-900">Schedule</h4>
                                <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                    <DetailItem label="Frequency" value={formatLabel(schedule.frequency)} />
                                    <DetailItem label="Interval" value={schedule.interval_value ?? "—"} />
                                    <DetailItem label="Custom Interval Days" value={schedule.custom_interval_days ?? "—"} />
                                    <DetailItem label="Next Due" value={formatDateTime(schedule.next_due_at)} />
                                    <DetailItem label="Last Generated" value={formatDateTime(schedule.last_generated_at)} />
                                    <DetailItem label="Last Completed" value={formatDateTime(schedule.last_completed_at)} />
                                </div>
                            </div>

                            <div className="mt-5 grid gap-5 rounded-2xl border border-slate-200 p-5 sm:grid-cols-2">
                                <DetailItem
                                    label="Estimated Cost"
                                    value={formatMoney(plan.estimated_cost, plan.currency_code)}
                                />
                                <DetailItem label="Currency" value={plan.currency_code || "—"} />
                                <DetailItem
                                    label="Default Assignment"
                                    value={assignment ? formatLabel(assignment.assignment_type) : "None"}
                                />
                                <DetailItem
                                    label="Assigned Technician / Vendor"
                                    value={
                                        assignment?.assigned_user?.full_name ||
                                        assignment?.vendor?.vendor_name ||
                                        assignment?.vendor?.company_name ||
                                        "—"
                                    }
                                />
                                <DetailItem label="Created At" value={formatDateTime(plan.created_at)} />
                                <DetailItem label="Updated At" value={formatDateTime(plan.updated_at)} />
                            </div>

                            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-5">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    leftIcon={RefreshCw}
                                    onClick={loadPlan}
                                >
                                    Refresh
                                </Button>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    leftIcon={CalendarDays}
                                    onClick={() => onOccurrences?.(plan)}
                                >
                                    Occurrences
                                </Button>

                                {plan.status === "active" && (
                                    <>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            leftIcon={Pause}
                                            onClick={() =>
                                                onLifecycle?.("pause", plan)
                                            }
                                        >
                                            Pause
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="secondary"
                                            leftIcon={CheckCircle2}
                                            onClick={() =>
                                                onLifecycle?.("complete", plan)
                                            }
                                        >
                                            Complete
                                        </Button>
                                    </>
                                )}

                                {plan.status === "paused" && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        leftIcon={Play}
                                        onClick={() =>
                                            onLifecycle?.("resume", plan)
                                        }
                                    >
                                        Resume
                                    </Button>
                                )}

                                {["active", "paused"].includes(plan.status) && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        leftIcon={Ban}
                                        onClick={() =>
                                            onLifecycle?.("cancel", plan)
                                        }
                                    >
                                        Cancel
                                    </Button>
                                )}

                                {editable && (
                                    <Button
                                        type="button"
                                        leftIcon={Pencil}
                                        onClick={() => onEdit?.(plan)}
                                    >
                                        Edit Plan
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PreventiveMaintenancePlanDetailModal;

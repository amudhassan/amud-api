import {
    Ban,
    CheckCircle2,
    Pause,
    Play,
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
    "Unable to update preventive maintenance plan lifecycle.";

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

const lifecycleDefinitions = {
    pause: {
        title: "Pause Preventive Plan",
        successLabel: "Pause Plan",
        submittingLabel: "Pausing...",
        icon: Pause,
        allowedStatuses: ["active"],
        endpoint: "pause",
        reasonField: "pause_reason",
        reasonLabel: "Pause Reason",
        reasonPlaceholder:
            "Explain why this preventive maintenance plan is being paused...",
        helper:
            "Paused plans remain in the schedule history and can be resumed later."
    },
    resume: {
        title: "Resume Preventive Plan",
        successLabel: "Resume Plan",
        submittingLabel: "Resuming...",
        icon: Play,
        allowedStatuses: ["paused"],
        endpoint: "resume",
        helper:
            "Resuming returns the paused preventive maintenance plan to active status."
    },
    complete: {
        title: "Complete Preventive Plan",
        successLabel: "Complete Plan",
        submittingLabel: "Completing...",
        icon: CheckCircle2,
        allowedStatuses: ["active"],
        endpoint: "complete",
        helper:
            "Completion is terminal for this plan. The plan remains preserved for audit and history."
    },
    cancel: {
        title: "Cancel Preventive Plan",
        successLabel: "Cancel Plan",
        submittingLabel: "Cancelling...",
        icon: Ban,
        allowedStatuses: ["active", "paused"],
        endpoint: "cancel",
        reasonField: "cancellation_reason",
        reasonLabel: "Cancellation Reason",
        reasonPlaceholder:
            "Explain why this preventive maintenance plan is being cancelled...",
        helper:
            "Cancellation is terminal. The plan is preserved and cannot be edited or resumed afterwards."
    }
};

function PreventiveMaintenancePlanLifecycleModal({
    open,
    planPublicId,
    action,
    isAdmin = false,
    onClose,
    onUpdated
}) {
    const [plan, setPlan] = useState(null);
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const definition = useMemo(
        () => lifecycleDefinitions[action] || null,
        [action]
    );

    const loadPlan = useCallback(async () => {
        if (!open || !planPublicId || !definition) return;

        try {
            setLoading(true);
            setError("");
            setPlan(null);

            const params = {};
            if (!isAdmin) {
                params.access_context = "owner";
            }

            const response = await apiClient.get(
                `/maintenance/preventive-plans/${encodeURIComponent(
                    planPublicId
                )}`,
                { params }
            );

            const latest =
                response?.data?.data?.preventive_plan || null;

            if (!latest) {
                throw new Error(
                    "Preventive maintenance plan detail is unavailable."
                );
            }

            if (
                !definition.allowedStatuses.includes(
                    latest.status
                )
            ) {
                throw new Error(
                    `This plan cannot be ${action}d from ${formatLabel(
                        latest.status
                    )} status.`
                );
            }

            if (!latest.updated_at) {
                throw new Error(
                    "Preventive plan concurrency timestamp is missing."
                );
            }

            setPlan(latest);
        } catch (requestError) {
            setPlan(null);
            setError(getErrorMessage(requestError));
        } finally {
            setLoading(false);
        }
    }, [action, definition, isAdmin, open, planPublicId]);

    useEffect(() => {
        if (!open) return;

        setReason("");
        setSubmitting(false);
        setError("");
        setPlan(null);
        loadPlan();
    }, [loadPlan, open]);

    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = event => {
            if (event.key === "Escape" && !submitting) {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () =>
            window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, open, submitting]);

    if (!open || !planPublicId || !definition) return null;

    const Icon = definition.icon;

    const submit = async event => {
        event.preventDefault();

        if (!plan) {
            setError(
                "Load the latest preventive maintenance plan before continuing."
            );
            return;
        }

        if (
            !definition.allowedStatuses.includes(plan.status)
        ) {
            setError(
                "The preventive maintenance plan lifecycle changed. Refresh and try again."
            );
            return;
        }

        if (!plan.updated_at) {
            setError(
                "Preventive plan concurrency timestamp is missing. Refresh and try again."
            );
            return;
        }

        const body = {
            expected_updated_at: plan.updated_at
        };

        if (definition.reasonField) {
            const normalizedReason = reason.trim();

            if (
                normalizedReason.length < 5 ||
                normalizedReason.length > 2000
            ) {
                setError(
                    `${definition.reasonLabel} must contain between 5 and 2000 characters.`
                );
                return;
            }

            body[definition.reasonField] = normalizedReason;
        }

        try {
            setSubmitting(true);
            setError("");

            const config = {};
            if (!isAdmin) {
                config.params = {
                    access_context: "owner"
                };
            }

            const response = await apiClient.post(
                `/maintenance/preventive-plans/${encodeURIComponent(
                    plan.public_id
                )}/${definition.endpoint}`,
                body,
                config
            );

            onUpdated?.(
                response?.data?.data?.preventive_plan || null
            );
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                            <Icon className="h-5 w-5" />
                        </div>

                        <div>
                            <h3 className="text-xl font-bold text-slate-950">
                                {definition.title}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                                {plan?.title || planPublicId}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        aria-label="Close preventive lifecycle modal"
                        disabled={submitting}
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                    <div className="space-y-5">
                        {error && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {error}
                            </div>
                        )}

                        {loading ? (
                            <div className="py-12 text-center text-sm text-slate-500">
                                Loading latest plan state...
                            </div>
                        ) : plan ? (
                            <>
                                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Current Status
                                        </p>
                                        <p className="mt-1 font-semibold text-slate-900">
                                            {formatLabel(plan.status)}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Last Updated
                                        </p>
                                        <p className="mt-1 font-semibold text-slate-900">
                                            {formatDateTime(plan.updated_at)}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                                    {definition.helper}
                                </div>

                                {definition.reasonField && (
                                    <label className="block">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            {definition.reasonLabel}{" "}
                                            <span className="text-rose-500">*</span>
                                        </span>

                                        <textarea
                                            value={reason}
                                            disabled={submitting}
                                            minLength={5}
                                            maxLength={2000}
                                            rows={6}
                                            placeholder={definition.reasonPlaceholder}
                                            onChange={event => {
                                                setReason(event.target.value);
                                                if (error) setError("");
                                            }}
                                            className="mt-2 min-h-36 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />

                                        <p className="mt-1 text-right text-xs text-slate-400">
                                            {reason.length}/2000
                                        </p>
                                    </label>
                                )}
                            </>
                        ) : (
                            <div className="py-10 text-center">
                                <p className="text-sm text-slate-500">
                                    Latest plan state could not be loaded.
                                </p>

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
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={submitting}
                        onClick={onClose}
                    >
                        Back
                    </Button>

                    <Button
                        type="submit"
                        leftIcon={Icon}
                        disabled={loading || submitting || !plan}
                    >
                        {submitting
                            ? definition.submittingLabel
                            : definition.successLabel}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default PreventiveMaintenancePlanLifecycleModal;

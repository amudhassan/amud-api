import {
    AlertTriangle,
    Ban,
    CalendarClock,
    CalendarX2,
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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to update preventive maintenance occurrence.";

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
    generate: {
        title: "Generate Maintenance Request",
        successLabel: "Generate Request",
        submittingLabel: "Generating...",
        icon: Wrench,
        endpoint: "generate",
        requiresActivePlan: true,
        helper:
            "This creates the real maintenance request linked to this occurrence. Any configured default assignment and estimated cost are copied by the backend."
    },
    skip: {
        title: "Skip Preventive Occurrence",
        successLabel: "Skip Occurrence",
        submittingLabel: "Skipping...",
        icon: CalendarX2,
        endpoint: "skip",
        reasonField: "skip_reason",
        reasonLabel: "Skip Reason",
        reasonPlaceholder:
            "Explain why this scheduled preventive occurrence is being skipped...",
        helper:
            "Skipping is terminal for this occurrence. For recurring plans, the backend advances the schedule and counts the skipped occurrence as missed."
    },
    fail: {
        title: "Mark Preventive Occurrence Failed",
        successLabel: "Mark Failed",
        submittingLabel: "Saving...",
        icon: AlertTriangle,
        endpoint: "fail",
        reasonField: "failure_reason",
        reasonLabel: "Failure Reason",
        reasonPlaceholder:
            "Explain why generation or execution of this preventive occurrence failed...",
        helper:
            "Failure is terminal for this occurrence and records a generation-attempt timestamp. For recurring plans, the schedule advances and the missed counter increases."
    },
    cancel: {
        title: "Cancel Preventive Occurrence",
        successLabel: "Cancel Occurrence",
        submittingLabel: "Cancelling...",
        icon: Ban,
        endpoint: "cancel",
        reasonField: "cancellation_reason",
        reasonLabel: "Cancellation Reason",
        reasonPlaceholder:
            "Explain why this preventive occurrence is being cancelled...",
        helper:
            "Cancellation is terminal for this occurrence. The occurrence remains preserved in the permanent schedule ledger."
    }
};

function PreventiveMaintenanceOccurrenceLifecycleModal({
    open,
    planPublicId,
    occurrencePublicId,
    action,
    isAdmin = false,
    onClose,
    onUpdated
}) {
    const [plan, setPlan] = useState(null);
    const [occurrence, setOccurrence] = useState(null);
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const definition = useMemo(
        () => lifecycleDefinitions[action] || null,
        [action]
    );

    const requestParams = useCallback(() => {
        const params = {};
        if (!isAdmin) {
            params.access_context = "owner";
        }
        return params;
    }, [isAdmin]);

    const loadLatestState = useCallback(async () => {
        if (
            !open ||
            !planPublicId ||
            !occurrencePublicId ||
            !definition
        ) {
            return;
        }

        try {
            setLoading(true);
            setError("");
            setPlan(null);
            setOccurrence(null);

            const params = requestParams();

            const [planResponse, occurrenceResponse] =
                await Promise.all([
                    apiClient.get(
                        `/maintenance/preventive-plans/${encodeURIComponent(
                            planPublicId
                        )}`,
                        { params }
                    ),
                    apiClient.get(
                        `/maintenance/preventive-plans/${encodeURIComponent(
                            planPublicId
                        )}/occurrences/${encodeURIComponent(
                            occurrencePublicId
                        )}`,
                        { params }
                    )
                ]);

            const latestPlan =
                planResponse?.data?.data?.preventive_plan || null;
            const latestOccurrence =
                occurrenceResponse?.data?.data
                    ?.preventive_occurrence || null;

            if (!latestPlan) {
                throw new Error(
                    "Preventive maintenance plan detail is unavailable."
                );
            }

            if (!latestOccurrence) {
                throw new Error(
                    "Preventive maintenance occurrence detail is unavailable."
                );
            }

            if (latestOccurrence.status !== "pending") {
                throw new Error(
                    `Only a Pending occurrence can use this action. Current status: ${formatLabel(
                        latestOccurrence.status
                    )}.`
                );
            }

            if (
                definition.requiresActivePlan &&
                latestPlan.status !== "active"
            ) {
                throw new Error(
                    `A maintenance request can only be generated while the preventive plan is Active. Current plan status: ${formatLabel(
                        latestPlan.status
                    )}.`
                );
            }

            if (!latestOccurrence.updated_at) {
                throw new Error(
                    "Preventive occurrence concurrency timestamp is missing."
                );
            }

            if (
                definition.requiresActivePlan &&
                !latestPlan.updated_at
            ) {
                throw new Error(
                    "Preventive plan concurrency timestamp is missing."
                );
            }

            setPlan(latestPlan);
            setOccurrence(latestOccurrence);
        } catch (requestError) {
            setPlan(null);
            setOccurrence(null);
            setError(getErrorMessage(requestError));
        } finally {
            setLoading(false);
        }
    }, [
        definition,
        occurrencePublicId,
        open,
        planPublicId,
        requestParams
    ]);

    useEffect(() => {
        if (!open) return;

        setReason("");
        setSubmitting(false);
        setError("");
        setPlan(null);
        setOccurrence(null);
        loadLatestState();
    }, [loadLatestState, open]);

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

    if (
        !open ||
        !planPublicId ||
        !occurrencePublicId ||
        !definition
    ) {
        return null;
    }

    const Icon = definition.icon;

    const submit = async event => {
        event.preventDefault();

        if (!plan || !occurrence) {
            setError(
                "Load the latest preventive plan and occurrence state before continuing."
            );
            return;
        }

        if (occurrence.status !== "pending") {
            setError(
                "The preventive occurrence lifecycle changed. Refresh and try again."
            );
            return;
        }

        if (!occurrence.updated_at) {
            setError(
                "Preventive occurrence concurrency timestamp is missing. Refresh and try again."
            );
            return;
        }

        const body = {
            expected_occurrence_updated_at:
                occurrence.updated_at
        };

        if (definition.requiresActivePlan) {
            if (plan.status !== "active") {
                setError(
                    "Only an Active preventive plan can generate a maintenance request."
                );
                return;
            }

            if (!plan.updated_at) {
                setError(
                    "Preventive plan concurrency timestamp is missing. Refresh and try again."
                );
                return;
            }

            body.expected_plan_updated_at =
                plan.updated_at;
        }

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

            body[definition.reasonField] =
                normalizedReason;
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
                )}/occurrences/${encodeURIComponent(
                    occurrence.public_id
                )}/${definition.endpoint}`,
                body,
                config
            );

            onUpdated?.({
                occurrence:
                    response?.data?.data
                        ?.preventive_occurrence || null,
                idempotent:
                    response?.data?.data?.idempotent === true
            });
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
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
                        aria-label="Close preventive occurrence lifecycle modal"
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
                                Loading latest occurrence state...
                            </div>
                        ) : plan && occurrence ? (
                            <>
                                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Occurrence Status
                                        </p>
                                        <p className="mt-1 font-semibold text-slate-900">
                                            {formatLabel(
                                                occurrence.status
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Plan Status
                                        </p>
                                        <p className="mt-1 font-semibold text-slate-900">
                                            {formatLabel(plan.status)}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Due At
                                        </p>
                                        <p className="mt-1 font-semibold text-slate-900">
                                            {formatDateTime(
                                                occurrence.due_at
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Last Updated
                                        </p>
                                        <p className="mt-1 font-semibold text-slate-900">
                                            {formatDateTime(
                                                occurrence.updated_at
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                                    {definition.helper}
                                </div>

                                {action === "generate" && (
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                        <div className="flex items-start gap-2">
                                            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                                            <p>
                                                The generated request will be linked permanently to this occurrence. This action is idempotent at the backend.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {definition.reasonField && (
                                    <label className="block">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            {definition.reasonLabel}{" "}
                                            <span className="text-rose-500">
                                                *
                                            </span>
                                        </span>

                                        <textarea
                                            value={reason}
                                            disabled={submitting}
                                            minLength={5}
                                            maxLength={2000}
                                            rows={6}
                                            placeholder={
                                                definition.reasonPlaceholder
                                            }
                                            onChange={event => {
                                                setReason(
                                                    event.target.value
                                                );
                                                if (error) {
                                                    setError("");
                                                }
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
                                    Latest preventive occurrence state could not be loaded.
                                </p>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    leftIcon={RefreshCw}
                                    className="mt-4"
                                    onClick={loadLatestState}
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
                        disabled={
                            loading ||
                            submitting ||
                            !plan ||
                            !occurrence
                        }
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

export default PreventiveMaintenanceOccurrenceLifecycleModal;

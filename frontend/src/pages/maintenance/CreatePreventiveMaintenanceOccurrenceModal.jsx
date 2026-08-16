import {
    CalendarPlus,
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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to create preventive maintenance occurrence.";

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

const toDateTimeLocal = value => {
    if (!value) return "";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";

    const pad = part => String(part).padStart(2, "0");

    return [
        parsed.getFullYear(),
        "-",
        pad(parsed.getMonth() + 1),
        "-",
        pad(parsed.getDate()),
        "T",
        pad(parsed.getHours()),
        ":",
        pad(parsed.getMinutes())
    ].join("");
};

function CreatePreventiveMaintenanceOccurrenceModal({
    open,
    planPublicId,
    isAdmin = false,
    onClose,
    onCreated
}) {
    const [plan, setPlan] = useState(null);
    const [dueAt, setDueAt] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const loadPlan = useCallback(async () => {
        if (!open || !planPublicId) return;

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

            setPlan(latest);
            setDueAt(
                toDateTimeLocal(
                    latest?.schedule?.next_due_at
                )
            );
        } catch (requestError) {
            setPlan(null);
            setDueAt("");
            setError(getErrorMessage(requestError));
        } finally {
            setLoading(false);
        }
    }, [isAdmin, open, planPublicId]);

    useEffect(() => {
        if (open) {
            setSubmitting(false);
            setError("");
            loadPlan();
        } else {
            setPlan(null);
            setDueAt("");
            setError("");
        }
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

    if (!open || !planPublicId) return null;

    const submit = async event => {
        event.preventDefault();

        if (!plan) {
            setError(
                "Load the latest preventive maintenance plan before continuing."
            );
            return;
        }

        if (plan.status !== "active") {
            setError(
                "Only an active preventive maintenance plan can receive a new occurrence."
            );
            return;
        }

        if (!plan.updated_at) {
            setError(
                "Preventive plan concurrency timestamp is missing. Refresh and try again."
            );
            return;
        }

        if (!dueAt) {
            setError("Occurrence due date and time is required.");
            return;
        }

        const parsedDueAt = new Date(dueAt);
        if (Number.isNaN(parsedDueAt.getTime())) {
            setError("Occurrence due date and time is invalid.");
            return;
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
                )}/occurrences`,
                {
                    expected_plan_updated_at:
                        plan.updated_at,
                    due_at: parsedDueAt.toISOString()
                },
                config
            );

            onCreated?.(
                response?.data?.data?.preventive_occurrence || null
            );
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div>
                        <div className="flex items-center gap-2 text-emerald-700">
                            <CalendarPlus className="h-5 w-5" />
                            <h2 className="text-lg font-bold text-slate-950">
                                Create Preventive Occurrence
                            </h2>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                            Create one pending schedule occurrence for this preventive plan.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-y-auto px-6 py-5">
                    {error && (
                        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="py-12 text-center text-sm text-slate-500">
                            Loading latest preventive plan...
                        </div>
                    ) : !plan ? (
                        <div className="py-10 text-center">
                            <p className="text-sm font-medium text-slate-700">
                                Preventive plan detail is unavailable.
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
                    ) : (
                        <>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Preventive Plan
                                </p>
                                <p className="mt-1 font-bold text-slate-950">
                                    {plan.title}
                                </p>
                                <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                                    <p>
                                        Status: <span className="font-semibold text-slate-900">{formatLabel(plan.status)}</span>
                                    </p>
                                    <p>
                                        Next Due: <span className="font-semibold text-slate-900">{formatDateTime(plan?.schedule?.next_due_at)}</span>
                                    </p>
                                </div>
                            </div>

                            {plan.status !== "active" && (
                                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    New occurrences can only be created while the preventive plan is Active.
                                </div>
                            )}

                            <div className="mt-5">
                                <label
                                    htmlFor="preventive-occurrence-due-at"
                                    className="text-sm font-semibold text-slate-700"
                                >
                                    Due Date &amp; Time
                                </label>
                                <input
                                    id="preventive-occurrence-due-at"
                                    type="datetime-local"
                                    value={dueAt}
                                    onChange={event =>
                                        setDueAt(event.target.value)
                                    }
                                    disabled={
                                        submitting ||
                                        plan.status !== "active"
                                    }
                                    required
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                                />
                                <p className="mt-2 text-xs leading-5 text-slate-500">
                                    The plan&apos;s current Next Due value is prefilled. You can change it when creating a manual occurrence.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-6 py-4">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={submitting}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        leftIcon={CalendarPlus}
                        disabled={
                            loading ||
                            submitting ||
                            !plan ||
                            plan.status !== "active"
                        }
                    >
                        {submitting
                            ? "Creating..."
                            : "Create Occurrence"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default CreatePreventiveMaintenanceOccurrenceModal;

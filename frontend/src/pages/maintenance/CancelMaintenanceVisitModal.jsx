import {
    CalendarX,
    X
} from "lucide-react";

import {
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to cancel maintenance visit.";

function CancelMaintenanceVisitModal({
    open,
    maintenanceRequestPublicId,
    visit,
    accessContext,
    onClose,
    onCancelled
}) {
    const [
        cancellationReason,
        setCancellationReason
    ] = useState("");

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }

        setCancellationReason("");
        setSubmitting(false);
        setError("");
    }, [
        open,
        visit?.public_id
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown =
            event => {
                if (
                    event.key ===
                        "Escape" &&
                    !submitting
                ) {
                    onClose();
                }
            };

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () =>
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
    }, [
        onClose,
        open,
        submitting
    ]);

    if (
        !open ||
        !maintenanceRequestPublicId ||
        !visit
    ) {
        return null;
    }

    const submit =
        async event => {
            event.preventDefault();

            if (
                ![
                    "scheduled",
                    "confirmed",
                    "rescheduled",
                    "in_progress"
                ].includes(
                    visit.status
                )
            ) {
                setError(
                    "This visit is no longer eligible for cancellation."
                );
                return;
            }

            if (
                !visit.public_id ||
                !visit.updated_at
            ) {
                setError(
                    "Visit concurrency data is missing. Close and reopen the maintenance request."
                );
                return;
            }

            const reason =
                cancellationReason.trim();

            if (
                reason.length < 3 ||
                reason.length > 2000
            ) {
                setError(
                    "Visit cancellation reason must contain between 3 and 2000 characters."
                );
                return;
            }

            try {
                setSubmitting(true);
                setError("");

                const config = {};

                if (accessContext) {
                    config.params = {
                        access_context:
                            accessContext
                    };
                }

                await apiClient.post(
                    `/maintenance/requests/${encodeURIComponent(
                        maintenanceRequestPublicId
                    )}/visits/${encodeURIComponent(
                        visit.public_id
                    )}/cancel`,
                    {
                        expected_status:
                            visit.status,
                        expected_updated_at:
                            visit.updated_at,
                        cancellation_reason:
                            reason
                    },
                    config
                );

                onCancelled();
            } catch (
                requestError
            ) {
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setSubmitting(false);
            }
        };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Cancel Maintenance Visit
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            {formatLabel(
                                visit.visit_type
                            )}{" "}
                            ·{" "}
                            {formatDateTime(
                                visit.scheduled_start_at
                            )}
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close cancel visit modal"
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

                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                            Cancelling the visit preserves it in the visit lifecycle history instead of deleting it.
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Cancellation Reason{" "}
                                <span className="text-rose-500">
                                    *
                                </span>
                            </span>

                            <textarea
                                value={
                                    cancellationReason
                                }
                                disabled={
                                    submitting
                                }
                                minLength={3}
                                maxLength={2000}
                                rows={6}
                                placeholder="Explain why this maintenance visit is being cancelled..."
                                onChange={
                                    event => {
                                        setCancellationReason(
                                            event.target.value
                                        );

                                        if (error) {
                                            setError("");
                                        }
                                    }
                                }
                                className="mt-2 min-h-36 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {cancellationReason.length}/2000
                            </p>
                        </label>
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
                        leftIcon={CalendarX}
                        disabled={submitting}
                    >
                        {submitting
                            ? "Cancelling..."
                            : "Cancel Visit"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default CancelMaintenanceVisitModal;

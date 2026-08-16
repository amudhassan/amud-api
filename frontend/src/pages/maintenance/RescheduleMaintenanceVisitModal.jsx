import {
    CalendarClock,
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

const toLocalDateTimeValue = value => {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const local = new Date(
        date.getTime() -
        date.getTimezoneOffset() *
            60 *
            1000
    );

    return local
        .toISOString()
        .slice(0, 16);
};

const toIsoTimestamp = value => {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toISOString();
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to reschedule maintenance visit.";

function RescheduleMaintenanceVisitModal({
    open,
    maintenanceRequestPublicId,
    visit,
    accessContext,
    onClose,
    onRescheduled
}) {
    const [
        scheduledStartAt,
        setScheduledStartAt
    ] = useState("");

    const [
        scheduledEndAt,
        setScheduledEndAt
    ] = useState("");

    const [
        reason,
        setReason
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

        setScheduledStartAt(
            toLocalDateTimeValue(
                visit?.scheduled_start_at
            )
        );

        setScheduledEndAt(
            toLocalDateTimeValue(
                visit?.scheduled_end_at
            )
        );

        setReason("");
        setSubmitting(false);
        setError("");
    }, [
        open,
        visit?.public_id,
        visit?.scheduled_start_at,
        visit?.scheduled_end_at
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown =
            event => {
                if (
                    event.key === "Escape" &&
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
                    "rescheduled"
                ].includes(
                    visit.status
                )
            ) {
                setError(
                    "This visit is no longer eligible for rescheduling."
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

            const startIso =
                toIsoTimestamp(
                    scheduledStartAt
                );

            const endIso =
                toIsoTimestamp(
                    scheduledEndAt
                );

            if (
                !startIso ||
                !endIso
            ) {
                setError(
                    "New scheduled start and end date/time are required."
                );
                return;
            }

            if (
                new Date(
                    endIso
                ).getTime() <=
                new Date(
                    startIso
                ).getTime()
            ) {
                setError(
                    "New scheduled end date/time must be after the new scheduled start date/time."
                );
                return;
            }

            const cleanReason =
                reason.trim();

            if (
                cleanReason.length < 3 ||
                cleanReason.length > 2000
            ) {
                setError(
                    "Visit reschedule reason must contain between 3 and 2000 characters."
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
                    )}/reschedule`,
                    {
                        expected_status:
                            visit.status,
                        expected_updated_at:
                            visit.updated_at,
                        scheduled_start_at:
                            startIso,
                        scheduled_end_at:
                            endIso,
                        reason:
                            cleanReason
                    },
                    config
                );

                onRescheduled();
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
                            Reschedule Maintenance Visit
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Change the existing visit schedule without deleting its history.
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close reschedule visit modal"
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

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    New Start{" "}
                                    <span className="text-rose-500">
                                        *
                                    </span>
                                </span>

                                <input
                                    type="datetime-local"
                                    value={
                                        scheduledStartAt
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event => {
                                            setScheduledStartAt(
                                                event.target.value
                                            );

                                            if (error) {
                                                setError("");
                                            }
                                        }
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>

                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    New End{" "}
                                    <span className="text-rose-500">
                                        *
                                    </span>
                                </span>

                                <input
                                    type="datetime-local"
                                    value={
                                        scheduledEndAt
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event => {
                                            setScheduledEndAt(
                                                event.target.value
                                            );

                                            if (error) {
                                                setError("");
                                            }
                                        }
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Reschedule Reason{" "}
                                <span className="text-rose-500">
                                    *
                                </span>
                            </span>

                            <textarea
                                value={reason}
                                disabled={
                                    submitting
                                }
                                minLength={3}
                                maxLength={2000}
                                rows={5}
                                placeholder="Explain why the visit schedule is being changed..."
                                onChange={
                                    event => {
                                        setReason(
                                            event.target.value
                                        );

                                        if (error) {
                                            setError("");
                                        }
                                    }
                                }
                                className="mt-2 min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {reason.length}/2000
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
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        leftIcon={CalendarClock}
                        disabled={submitting}
                    >
                        {submitting
                            ? "Rescheduling..."
                            : "Reschedule Visit"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default RescheduleMaintenanceVisitModal;

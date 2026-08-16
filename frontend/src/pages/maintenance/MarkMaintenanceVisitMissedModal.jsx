import {
    CalendarX2,
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

const MISSED_REASONS = [
    "tenant_unavailable",
    "technician_unavailable",
    "access_denied",
    "vendor_delay",
    "weather_or_emergency",
    "other"
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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to mark maintenance visit as missed.";

function MarkMaintenanceVisitMissedModal({
    open,
    maintenanceRequestPublicId,
    visit,
    accessContext,
    onClose,
    onMissed
}) {
    const [
        missedReason,
        setMissedReason
    ] = useState(
        "tenant_unavailable"
    );

    const [
        missedNotes,
        setMissedNotes
    ] = useState("");

    const [
        auditReason,
        setAuditReason
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

        setMissedReason(
            "tenant_unavailable"
        );
        setMissedNotes("");
        setAuditReason("");
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
                    "rescheduled"
                ].includes(
                    visit.status
                )
            ) {
                setError(
                    "This visit is no longer eligible to be marked missed."
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

            if (
                !MISSED_REASONS.includes(
                    missedReason
                )
            ) {
                setError(
                    "Select a valid missed reason."
                );
                return;
            }

            const notes =
                missedNotes.trim();

            if (
                notes.length > 5000
            ) {
                setError(
                    "Missed visit notes cannot exceed 5000 characters."
                );
                return;
            }

            const reason =
                auditReason.trim();

            if (
                reason.length < 3 ||
                reason.length > 2000
            ) {
                setError(
                    "Visit missed audit reason must contain between 3 and 2000 characters."
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

                const body = {
                    expected_status:
                        visit.status,
                    expected_updated_at:
                        visit.updated_at,
                    missed_reason:
                        missedReason,
                    reason
                };

                if (notes) {
                    body.missed_notes =
                        notes;
                }

                await apiClient.post(
                    `/maintenance/requests/${encodeURIComponent(
                        maintenanceRequestPublicId
                    )}/visits/${encodeURIComponent(
                        visit.public_id
                    )}/missed`,
                    body,
                    config
                );

                onMissed();
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
                            Mark Visit Missed
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
                        aria-label="Close mark missed visit modal"
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
                            This changes the visit lifecycle to Missed and preserves the reason in visit history.
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Missed Reason{" "}
                                <span className="text-rose-500">
                                    *
                                </span>
                            </span>

                            <select
                                value={
                                    missedReason
                                }
                                disabled={
                                    submitting
                                }
                                onChange={
                                    event =>
                                        setMissedReason(
                                            event.target.value
                                        )
                                }
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                {MISSED_REASONS.map(
                                    item => (
                                        <option
                                            key={
                                                item
                                            }
                                            value={
                                                item
                                            }
                                        >
                                            {formatLabel(
                                                item
                                            )}
                                        </option>
                                    )
                                )}
                            </select>
                        </label>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Missed Notes
                            </span>

                            <textarea
                                value={
                                    missedNotes
                                }
                                disabled={
                                    submitting
                                }
                                maxLength={5000}
                                rows={4}
                                placeholder="Optional additional details about the missed visit..."
                                onChange={
                                    event => {
                                        setMissedNotes(
                                            event.target.value
                                        );

                                        if (error) {
                                            setError("");
                                        }
                                    }
                                }
                                className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {missedNotes.length}/5000
                            </p>
                        </label>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Audit Reason{" "}
                                <span className="text-rose-500">
                                    *
                                </span>
                            </span>

                            <textarea
                                value={
                                    auditReason
                                }
                                disabled={
                                    submitting
                                }
                                minLength={3}
                                maxLength={2000}
                                rows={4}
                                placeholder="Reason recorded for this visit lifecycle change..."
                                onChange={
                                    event => {
                                        setAuditReason(
                                            event.target.value
                                        );

                                        if (error) {
                                            setError("");
                                        }
                                    }
                                }
                                className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {auditReason.length}/2000
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
                        leftIcon={CalendarX2}
                        disabled={submitting}
                    >
                        {submitting
                            ? "Marking..."
                            : "Mark Visit Missed"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default MarkMaintenanceVisitMissedModal;

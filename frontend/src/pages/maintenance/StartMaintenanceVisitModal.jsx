import {
    Play,
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

const inputClassName = `
    mt-2 w-full rounded-xl
    border border-slate-300
    bg-white px-3 py-2.5
    text-sm text-slate-900
    outline-none transition
    placeholder:text-slate-400
    focus:border-blue-500
    focus:ring-2
    focus:ring-blue-100
    disabled:cursor-not-allowed
    disabled:bg-slate-100
    disabled:text-slate-500
`;

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
    "Unable to start maintenance visit.";

const toIsoTimestamp = value => {
    if (!value) {
        return null;
    }

    const parsed =
        new Date(value);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return null;
    }

    return parsed.toISOString();
};

function StartMaintenanceVisitModal({
    open,
    maintenanceRequestPublicId,
    visit,
    accessContext,
    onClose,
    onStarted
}) {
    const [
        reason,
        setReason
    ] = useState("");

    const [
        arrivalAt,
        setArrivalAt
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

        setReason("");
        setArrivalAt("");
        setError("");
        setSubmitting(false);
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
        !visit ||
        !maintenanceRequestPublicId
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
                    "This visit is no longer eligible to start. Close and reopen the maintenance request."
                );
                return;
            }

            if (!visit.updated_at) {
                setError(
                    "Visit updated-at timestamp is missing. Close and reopen the maintenance request."
                );
                return;
            }

            const trimmedReason =
                reason.trim();

            if (
                trimmedReason.length < 3 ||
                trimmedReason.length > 2000
            ) {
                setError(
                    "Visit start reason must contain between 3 and 2000 characters."
                );
                return;
            }

            const payload = {
                expected_status:
                    visit.status,
                expected_updated_at:
                    visit.updated_at,
                reason:
                    trimmedReason
            };

            if (arrivalAt) {
                const parsedArrival =
                    toIsoTimestamp(
                        arrivalAt
                    );

                if (!parsedArrival) {
                    setError(
                        "Arrival date and time is invalid."
                    );
                    return;
                }

                payload.arrival_at =
                    parsedArrival;
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
                    )}/start`,
                    payload,
                    config
                );

                onStarted();
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

    const confirmationPending =
        visit.tenant_confirmation_status ===
        "pending";

    const confirmationDeclined =
        visit.tenant_confirmation_status ===
        "declined";

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Start Maintenance Visit
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            {formatLabel(
                                visit.visit_type
                            )} •{" "}
                            {visit.public_id}
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close start maintenance visit"
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

                        {(confirmationPending ||
                            confirmationDeclined) && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                Tenant confirmation is{" "}
                                <strong>
                                    {formatLabel(
                                        visit.tenant_confirmation_status
                                    )}
                                </strong>
                                . The backend remains authoritative and may block work from starting until the visit is eligible.
                            </div>
                        )}

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                            <p className="font-semibold">
                                Visit ready-state
                            </p>

                            <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                                <p>
                                    Status:{" "}
                                    <strong>
                                        {formatLabel(
                                            visit.status
                                        )}
                                    </strong>
                                </p>

                                <p>
                                    Tenant:{" "}
                                    <strong>
                                        {formatLabel(
                                            visit.tenant_confirmation_status
                                        )}
                                    </strong>
                                </p>

                                <p>
                                    Start:{" "}
                                    <strong>
                                        {formatDateTime(
                                            visit.scheduled_start_at
                                        )}
                                    </strong>
                                </p>

                                <p>
                                    End:{" "}
                                    <strong>
                                        {formatDateTime(
                                            visit.scheduled_end_at
                                        )}
                                    </strong>
                                </p>
                            </div>
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Arrival At
                            </span>

                            <input
                                type="datetime-local"
                                value={arrivalAt}
                                disabled={submitting}
                                onChange={
                                    event => {
                                        setArrivalAt(
                                            event
                                                .target
                                                .value
                                        );

                                        if (error) {
                                            setError("");
                                        }
                                    }
                                }
                                className={
                                    inputClassName
                                }
                            />

                            <p className="mt-1 text-xs text-slate-500">
                                Optional. Leave blank to let the backend apply its normal lifecycle timing.
                            </p>
                        </label>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Start Reason{" "}
                                <span className="text-rose-500">
                                    *
                                </span>
                            </span>

                            <textarea
                                value={reason}
                                disabled={submitting}
                                minLength={3}
                                maxLength={2000}
                                rows={5}
                                placeholder="Explain why the scheduled visit is starting..."
                                onChange={
                                    event => {
                                        setReason(
                                            event
                                                .target
                                                .value
                                        );

                                        if (error) {
                                            setError("");
                                        }
                                    }
                                }
                                className={`${inputClassName} min-h-32 resize-y`}
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
                        leftIcon={Play}
                        disabled={submitting}
                    >
                        {submitting
                            ? "Starting..."
                            : "Start Visit"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default StartMaintenanceVisitModal;

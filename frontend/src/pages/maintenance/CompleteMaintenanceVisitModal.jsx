import {
    CheckCircle2,
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
    "Unable to complete maintenance visit.";

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

function CompleteMaintenanceVisitModal({
    open,
    maintenanceRequestPublicId,
    visit,
    accessContext,
    onClose,
    onCompleted
}) {
    const [
        completionNotes,
        setCompletionNotes
    ] = useState("");

    const [
        departureAt,
        setDepartureAt
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

        setCompletionNotes("");
        setDepartureAt("");
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
                visit.status !==
                "in_progress"
            ) {
                setError(
                    "This visit is no longer in progress. Close and reopen the maintenance request."
                );
                return;
            }

            if (!visit.updated_at) {
                setError(
                    "Visit updated-at timestamp is missing. Close and reopen the maintenance request."
                );
                return;
            }

            const trimmedNotes =
                completionNotes.trim();

            if (
                trimmedNotes.length < 3 ||
                trimmedNotes.length > 5000
            ) {
                setError(
                    "Completion notes must contain between 3 and 5000 characters."
                );
                return;
            }

            const payload = {
                expected_status:
                    "in_progress",
                expected_updated_at:
                    visit.updated_at,
                completion_notes:
                    trimmedNotes
            };

            if (departureAt) {
                const parsedDeparture =
                    toIsoTimestamp(
                        departureAt
                    );

                if (!parsedDeparture) {
                    setError(
                        "Departure date and time is invalid."
                    );
                    return;
                }

                payload.departure_at =
                    parsedDeparture;
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
                    )}/complete`,
                    payload,
                    config
                );

                onCompleted();
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Complete Maintenance Visit
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
                        aria-label="Close complete maintenance visit"
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

                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                            <p className="font-semibold">
                                Visit currently in progress
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
                                    Arrival:{" "}
                                    <strong>
                                        {formatDateTime(
                                            visit.arrival_at
                                        )}
                                    </strong>
                                </p>

                                <p>
                                    Scheduled start:{" "}
                                    <strong>
                                        {formatDateTime(
                                            visit.scheduled_start_at
                                        )}
                                    </strong>
                                </p>

                                <p>
                                    Scheduled end:{" "}
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
                                Departure At
                            </span>

                            <input
                                type="datetime-local"
                                value={
                                    departureAt
                                }
                                disabled={
                                    submitting
                                }
                                onChange={
                                    event => {
                                        setDepartureAt(
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
                                Optional. Leave blank to use the backend lifecycle default.
                            </p>
                        </label>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Completion Notes{" "}
                                <span className="text-rose-500">
                                    *
                                </span>
                            </span>

                            <textarea
                                value={
                                    completionNotes
                                }
                                disabled={
                                    submitting
                                }
                                minLength={3}
                                maxLength={5000}
                                rows={6}
                                placeholder="Describe the work, inspection result, findings or actions completed during this visit..."
                                onChange={
                                    event => {
                                        setCompletionNotes(
                                            event
                                                .target
                                                .value
                                        );

                                        if (error) {
                                            setError("");
                                        }
                                    }
                                }
                                className={`${inputClassName} min-h-36 resize-y`}
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {
                                    completionNotes
                                        .length
                                }
                                /5000
                            </p>
                        </label>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                            Completing the visit closes this visit record only. Maintenance resolution and request closure remain separate lifecycle actions.
                        </div>
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
                        leftIcon={
                            CheckCircle2
                        }
                        disabled={submitting}
                    >
                        {submitting
                            ? "Completing..."
                            : "Complete Visit"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default CompleteMaintenanceVisitModal;

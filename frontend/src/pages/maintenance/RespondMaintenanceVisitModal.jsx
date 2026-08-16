import {
    CalendarCheck2,
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
    "Unable to submit tenant visit response.";

function RespondMaintenanceVisitModal({
    open,
    maintenanceRequestPublicId,
    visit,
    accessContext,
    onClose,
    onResponded
}) {
    const [
        response,
        setResponse
    ] = useState("confirmed");

    const [
        note,
        setNote
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

        setResponse("confirmed");
        setNote("");
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
                    "This visit is no longer eligible for a tenant response."
                );
                return;
            }

            if (
                ![
                    "pending",
                    "confirmed",
                    "declined"
                ].includes(
                    visit.tenant_confirmation_status
                )
            ) {
                setError(
                    "This visit does not currently require an eligible tenant confirmation response."
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
                ![
                    "confirmed",
                    "declined"
                ].includes(
                    response
                )
            ) {
                setError(
                    "Select Confirmed or Declined."
                );
                return;
            }

            const cleanNote =
                note.trim();

            if (
                cleanNote.length > 2000
            ) {
                setError(
                    "Tenant confirmation note cannot exceed 2000 characters."
                );
                return;
            }

            if (
                response === "declined" &&
                cleanNote.length < 3
            ) {
                setError(
                    "A tenant confirmation note of at least 3 characters is required when declining."
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
                    expected_tenant_confirmation_status:
                        visit.tenant_confirmation_status,
                    expected_updated_at:
                        visit.updated_at,
                    response
                };

                if (cleanNote) {
                    body.note =
                        cleanNote;
                }

                await apiClient.post(
                    `/maintenance/requests/${encodeURIComponent(
                        maintenanceRequestPublicId
                    )}/visits/${encodeURIComponent(
                        visit.public_id
                    )}/respond`,
                    body,
                    config
                );

                onResponded();
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
                            Respond to Maintenance Visit
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
                        aria-label="Close tenant visit response modal"
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

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
                            Current tenant confirmation status:{" "}
                            <strong>
                                {formatLabel(
                                    visit.tenant_confirmation_status
                                )}
                            </strong>
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Response{" "}
                                <span className="text-rose-500">
                                    *
                                </span>
                            </span>

                            <select
                                value={
                                    response
                                }
                                disabled={
                                    submitting
                                }
                                onChange={
                                    event => {
                                        setResponse(
                                            event.target.value
                                        );

                                        if (error) {
                                            setError("");
                                        }
                                    }
                                }
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="confirmed">
                                    Confirmed
                                </option>

                                <option value="declined">
                                    Declined
                                </option>
                            </select>
                        </label>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Confirmation Note{" "}
                                {response ===
                                    "declined" && (
                                    <span className="text-rose-500">
                                        *
                                    </span>
                                )}
                            </span>

                            <textarea
                                value={
                                    note
                                }
                                disabled={
                                    submitting
                                }
                                maxLength={2000}
                                rows={5}
                                placeholder={
                                    response ===
                                    "declined"
                                        ? "Explain why this visit schedule is being declined..."
                                        : "Optional note about the visit confirmation..."
                                }
                                onChange={
                                    event => {
                                        setNote(
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
                                {note.length}/2000
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
                        leftIcon={CalendarCheck2}
                        disabled={submitting}
                    >
                        {submitting
                            ? "Submitting..."
                            : "Submit Response"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default RespondMaintenanceVisitModal;

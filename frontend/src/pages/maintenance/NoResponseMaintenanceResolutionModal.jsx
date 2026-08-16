import {
    ClockAlert,
    X
} from "lucide-react";

import {
    useEffect,
    useMemo,
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
    "Unable to mark maintenance resolution as no response.";

function NoResponseMaintenanceResolutionModal({
    open,
    maintenanceRequest,
    accessContext,
    onClose,
    onMarked
}) {
    const [
        confirmationNote,
        setConfirmationNote
    ] = useState("");

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const resolution =
        maintenanceRequest
            ?.latest_resolution ||
        null;

    const deadlinePassed =
        useMemo(() => {
            if (
                !resolution
                    ?.confirmation_deadline_at
            ) {
                return false;
            }

            const time =
                new Date(
                    resolution
                        .confirmation_deadline_at
                ).getTime();

            return (
                Number.isFinite(time) &&
                time <= Date.now()
            );
        }, [
            resolution
                ?.confirmation_deadline_at
        ]);

    useEffect(() => {
        if (!open) {
            return;
        }

        setConfirmationNote("");
        setSubmitting(false);
        setError("");
    }, [
        open,
        resolution?.public_id
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
        !maintenanceRequest ||
        !resolution
    ) {
        return null;
    }

    const submit =
        async event => {
            event.preventDefault();

            if (
                maintenanceRequest.status !==
                "resolved"
            ) {
                setError(
                    "The maintenance request is no longer in resolved status."
                );
                return;
            }

            if (
                resolution.confirmation_status !==
                "pending"
            ) {
                setError(
                    "This resolution is no longer pending a tenant response."
                );
                return;
            }

            if (!deadlinePassed) {
                setError(
                    "The confirmation deadline has not passed yet."
                );
                return;
            }

            if (
                !maintenanceRequest.updated_at
            ) {
                setError(
                    "Maintenance request updated-at timestamp is missing. Close and reopen the request."
                );
                return;
            }

            if (
                !resolution.submitted_at
            ) {
                setError(
                    "Resolution submitted-at timestamp is missing. Close and reopen the request."
                );
                return;
            }

            const note =
                confirmationNote.trim();

            if (
                note.length < 5 ||
                note.length > 2000
            ) {
                setError(
                    "No-response confirmation note must contain between 5 and 2000 characters."
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
                        maintenanceRequest.public_id
                    )}/resolutions/${encodeURIComponent(
                        resolution.public_id
                    )}/no-response`,
                    {
                        expected_request_status:
                            "resolved",
                        expected_request_updated_at:
                            maintenanceRequest.updated_at,
                        expected_resolution_status:
                            "pending",
                        expected_resolution_submitted_at:
                            resolution.submitted_at,
                        confirmation_note:
                            note
                    },
                    config
                );

                onMarked();
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
                            Mark Resolution as No Response
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            {maintenanceRequest.request_number ||
                                maintenanceRequest.public_id}
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close no-response modal"
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

                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            <p className="font-semibold">
                                Tenant response deadline
                            </p>

                            <p className="mt-1 text-xs leading-5">
                                Deadline:{" "}
                                <strong>
                                    {formatDateTime(
                                        resolution.confirmation_deadline_at
                                    )}
                                </strong>
                            </p>

                            <p className="mt-1 text-xs leading-5">
                                This action should only be used after the confirmation deadline has passed and the resolution is still pending.
                            </p>
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                No-response Confirmation Note{" "}
                                <span className="text-rose-500">
                                    *
                                </span>
                            </span>

                            <textarea
                                value={
                                    confirmationNote
                                }
                                disabled={
                                    submitting
                                }
                                minLength={5}
                                maxLength={2000}
                                rows={6}
                                placeholder="Record why the resolution is being marked as no response..."
                                onChange={
                                    event => {
                                        setConfirmationNote(
                                            event.target.value
                                        );

                                        if (error) {
                                            setError("");
                                        }
                                    }
                                }
                                className={`${inputClassName} min-h-36 resize-y`}
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {confirmationNote.length}/2000
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
                        leftIcon={ClockAlert}
                        disabled={
                            submitting ||
                            !deadlinePassed
                        }
                    >
                        {submitting
                            ? "Marking..."
                            : "Mark No Response"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default NoResponseMaintenanceResolutionModal;

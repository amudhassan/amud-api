import {
    LockKeyhole,
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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to close maintenance request.";

function CloseMaintenanceRequestModal({
    open,
    maintenanceRequest,
    accessContext,
    onClose,
    onClosed
}) {
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

    const resolution =
        maintenanceRequest
            ?.latest_resolution ||
        null;

    useEffect(() => {
        if (!open) {
            return;
        }

        setReason("");
        setSubmitting(false);
        setError("");
    }, [
        open,
        maintenanceRequest?.public_id
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
        !maintenanceRequest
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
                    "Only a resolved maintenance request can be closed."
                );
                return;
            }

            if (
                ![
                    "confirmed",
                    "no_response",
                    "not_required"
                ].includes(
                    resolution
                        ?.confirmation_status
                )
            ) {
                setError(
                    "Resolution confirmation must be terminal before closing the request."
                );
                return;
            }

            if (
                !maintenanceRequest.updated_at
            ) {
                setError(
                    "Maintenance request updated-at timestamp is missing. Close and reopen the detail view."
                );
                return;
            }

            const trimmedReason =
                reason.trim();

            if (
                trimmedReason.length < 5 ||
                trimmedReason.length > 2000
            ) {
                setError(
                    "Closure reason must contain between 5 and 2000 characters."
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
                    )}/close`,
                    {
                        expected_request_status:
                            "resolved",
                        expected_request_updated_at:
                            maintenanceRequest.updated_at,
                        reason:
                            trimmedReason
                    },
                    config
                );

                onClosed();
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
                            Close Maintenance Request
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            {maintenanceRequest.request_number ||
                                maintenanceRequest.public_id}
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close maintenance closure modal"
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
                                Resolution confirmation is terminal
                            </p>

                            <p className="mt-1 text-xs leading-5">
                                Confirmation status:{" "}
                                <strong>
                                    {formatLabel(
                                        resolution?.confirmation_status
                                    )}
                                </strong>
                            </p>
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Closure Reason{" "}
                                <span className="text-rose-500">
                                    *
                                </span>
                            </span>

                            <textarea
                                value={reason}
                                disabled={submitting}
                                minLength={5}
                                maxLength={2000}
                                rows={5}
                                placeholder="Explain why this maintenance request is ready to be closed..."
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
                                className={`${inputClassName} min-h-32 resize-y`}
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {reason.length}/2000
                            </p>
                        </label>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                            The backend will still block closure if any active assignment, active visit, pending cost approval, active unit-status lock or unresolved cost responsibility remains.
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
                        leftIcon={LockKeyhole}
                        disabled={submitting}
                    >
                        {submitting
                            ? "Closing..."
                            : "Close Request"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default CloseMaintenanceRequestModal;

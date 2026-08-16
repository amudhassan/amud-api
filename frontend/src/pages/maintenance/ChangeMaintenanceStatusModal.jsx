import {
    ArrowRight,
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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to change maintenance status.";

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

function ChangeMaintenanceStatusModal({
    open,
    maintenanceRequest,
    accessContext,
    allowedTargets = [],
    onClose,
    onChanged
}) {
    const [
        targetStatus,
        setTargetStatus
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

        setTargetStatus(
            allowedTargets[0] || ""
        );
        setReason("");
        setError("");
        setSubmitting(false);
    }, [
        allowedTargets,
        open
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

            const trimmedReason =
                reason.trim();

            if (
                !allowedTargets.includes(
                    targetStatus
                )
            ) {
                setError(
                    "Select a valid maintenance status transition."
                );
                return;
            }

            if (
                trimmedReason.length < 5 ||
                trimmedReason.length > 2000
            ) {
                setError(
                    "Reason must contain between 5 and 2000 characters."
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

                const response =
                    await apiClient.patch(
                        `/maintenance/requests/${encodeURIComponent(
                            maintenanceRequest.public_id
                        )}/status`,
                        {
                            expected_status:
                                maintenanceRequest.status,
                            status:
                                targetStatus,
                            reason:
                                trimmedReason
                        },
                        config
                    );

                const changedRequest =
                    response?.data
                        ?.data
                        ?.maintenance_request;

                if (!changedRequest) {
                    throw new Error(
                        "Status response did not include maintenance_request."
                    );
                }

                onChanged(
                    changedRequest
                );
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Change Maintenance Status
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            {maintenanceRequest.request_number ||
                                maintenanceRequest.public_id}
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close status change"
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

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                            This action changes the maintenance lifecycle and creates an auditable status transition. Assignment, resolution and closure continue to use their dedicated APIs.
                        </div>

                        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Current Status
                                </p>

                                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800">
                                    {formatLabel(
                                        maintenanceRequest.status
                                    )}
                                </div>
                            </div>

                            <ArrowRight className="mx-auto mb-3 h-5 w-5 text-slate-400" />

                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    New Status{" "}
                                    <span className="text-rose-500">
                                        *
                                    </span>
                                </span>

                                <select
                                    value={
                                        targetStatus
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event => {
                                            setTargetStatus(
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
                                >
                                    {allowedTargets.map(
                                        status => (
                                            <option
                                                key={
                                                    status
                                                }
                                                value={
                                                    status
                                                }
                                            >
                                                {
                                                    formatLabel(
                                                        status
                                                    )
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Reason{" "}
                                <span className="text-rose-500">
                                    *
                                </span>
                            </span>

                            <textarea
                                value={
                                    reason
                                }
                                disabled={
                                    submitting
                                }
                                minLength={5}
                                maxLength={2000}
                                rows={5}
                                placeholder="Explain why this lifecycle change is being made..."
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
                        disabled={
                            submitting ||
                            !targetStatus
                        }
                    >
                        {submitting
                            ? "Updating..."
                            : "Confirm Status Change"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default ChangeMaintenanceStatusModal;

import {
    CircleCheckBig,
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
    "Unable to resolve maintenance request.";

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

const toDateTimeLocalNow = () => {
    const now = new Date();
    const offset =
        now.getTimezoneOffset();

    const local =
        new Date(
            now.getTime() -
            offset * 60 * 1000
        );

    return local
        .toISOString()
        .slice(0, 16);
};

function FieldLabel({
    children,
    required = false
}) {
    return (
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {children}

            {required && (
                <span className="text-rose-500">
                    {" "}*
                </span>
            )}
        </span>
    );
}

function ResolveMaintenanceRequestModal({
    open,
    maintenanceRequest,
    accessContext,
    onClose,
    onResolved
}) {
    const [
        resolutionSummary,
        setResolutionSummary
    ] = useState("");

    const [
        workCompletedAt,
        setWorkCompletedAt
    ] = useState("");

    const [
        actualCostSummary,
        setActualCostSummary
    ] = useState("");

    const [
        evidenceOverrideReason,
        setEvidenceOverrideReason
    ] = useState("");

    const [
        confirmationDeadlineAt,
        setConfirmationDeadlineAt
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

        setResolutionSummary("");
        setWorkCompletedAt(
            toDateTimeLocalNow()
        );
        setActualCostSummary("");
        setEvidenceOverrideReason("");
        setConfirmationDeadlineAt("");
        setError("");
        setSubmitting(false);
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

    const isTechnician =
        accessContext ===
        "technician";

    const validate = () => {
        if (
            maintenanceRequest.status !==
            "in_progress"
        ) {
            return "Only an in-progress maintenance request can be resolved.";
        }

        if (
            !maintenanceRequest.updated_at
        ) {
            return "Maintenance request updated-at timestamp is missing. Close and reopen the request.";
        }

        if (
            maintenanceRequest.current_assignment
        ) {
            return "Complete the current assignment before resolving the maintenance request.";
        }

        if (
            maintenanceRequest.next_visit
        ) {
            return "Complete or otherwise finish the active visit before resolving the maintenance request.";
        }

        const summary =
            resolutionSummary.trim();

        if (
            summary.length < 10 ||
            summary.length > 5000
        ) {
            return "Resolution summary must contain between 10 and 5000 characters.";
        }

        const completedAt =
            toIsoTimestamp(
                workCompletedAt
            );

        if (!completedAt) {
            return "Work completion date and time is required.";
        }

        if (
            new Date(
                completedAt
            ).getTime() >
            Date.now() +
                5 * 60 * 1000
        ) {
            return "Work completion time cannot be more than five minutes in the future.";
        }

        if (
            actualCostSummary.trim()
                .length > 5000
        ) {
            return "Actual cost summary cannot exceed 5000 characters.";
        }

        if (
            evidenceOverrideReason.trim()
                .length > 2000
        ) {
            return "Evidence override reason cannot exceed 2000 characters.";
        }

        if (
            confirmationDeadlineAt
        ) {
            const deadline =
                toIsoTimestamp(
                    confirmationDeadlineAt
                );

            if (!deadline) {
                return "Resolution confirmation deadline is invalid.";
            }

            if (
                new Date(
                    deadline
                ).getTime() <=
                Date.now()
            ) {
                return "Resolution confirmation deadline must be in the future.";
            }
        }

        return "";
    };

    const submit =
        async event => {
            event.preventDefault();

            const validationError =
                validate();

            if (validationError) {
                setError(
                    validationError
                );
                return;
            }

            const payload = {
                expected_request_status:
                    "in_progress",
                expected_request_updated_at:
                    maintenanceRequest.updated_at,
                resolution_summary:
                    resolutionSummary.trim(),
                work_completed_at:
                    toIsoTimestamp(
                        workCompletedAt
                    )
            };

            const trimmedActualCost =
                actualCostSummary.trim();

            const trimmedOverride =
                evidenceOverrideReason.trim();

            if (trimmedActualCost) {
                payload.actual_cost_summary =
                    trimmedActualCost;
            }

            if (
                trimmedOverride &&
                !isTechnician
            ) {
                payload.evidence_override_reason =
                    trimmedOverride;
            }

            if (
                confirmationDeadlineAt
            ) {
                payload.confirmation_deadline_at =
                    toIsoTimestamp(
                        confirmationDeadlineAt
                    );
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
                    )}/resolve`,
                    payload,
                    config
                );

                onResolved();
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
                className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Resolve Maintenance Request
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            {maintenanceRequest.request_number ||
                                maintenanceRequest.public_id}
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close resolve maintenance request"
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
                                Ready for resolution
                            </p>

                            <p className="mt-1 text-xs leading-5">
                                Current request status:{" "}
                                <strong>
                                    {formatLabel(
                                        maintenanceRequest.status
                                    )}
                                </strong>
                                . Resolving creates the audited resolution record and moves the request into the resolution-confirmation lifecycle.
                            </p>
                        </div>

                        <label className="block">
                            <FieldLabel required>
                                Resolution Summary
                            </FieldLabel>

                            <textarea
                                value={
                                    resolutionSummary
                                }
                                disabled={
                                    submitting
                                }
                                minLength={10}
                                maxLength={5000}
                                rows={6}
                                placeholder="Summarize the problem, the work completed and the final outcome..."
                                onChange={
                                    event => {
                                        setResolutionSummary(
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
                                {resolutionSummary.length}/5000
                            </p>
                        </label>

                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block">
                                <FieldLabel required>
                                    Work Completed At
                                </FieldLabel>

                                <input
                                    type="datetime-local"
                                    value={
                                        workCompletedAt
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event => {
                                            setWorkCompletedAt(
                                                event.target.value
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
                            </label>

                            <label className="block">
                                <FieldLabel>
                                    Confirmation Deadline
                                </FieldLabel>

                                <input
                                    type="datetime-local"
                                    value={
                                        confirmationDeadlineAt
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event => {
                                            setConfirmationDeadlineAt(
                                                event.target.value
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
                                    Optional. When used, it must be a future date and time.
                                </p>
                            </label>
                        </div>

                        <label className="block">
                            <FieldLabel>
                                Actual Cost Summary
                            </FieldLabel>

                            <textarea
                                value={
                                    actualCostSummary
                                }
                                disabled={
                                    submitting
                                }
                                maxLength={5000}
                                rows={4}
                                placeholder="Optional final cost summary..."
                                onChange={
                                    event => {
                                        setActualCostSummary(
                                            event.target.value
                                        );

                                        if (error) {
                                            setError("");
                                        }
                                    }
                                }
                                className={`${inputClassName} min-h-28 resize-y`}
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {actualCostSummary.length}/5000
                            </p>
                        </label>

                        {!isTechnician && (
                            <label className="block">
                                <FieldLabel>
                                    Completion Evidence Override Reason
                                </FieldLabel>

                                <textarea
                                    value={
                                        evidenceOverrideReason
                                    }
                                    disabled={
                                        submitting
                                    }
                                    maxLength={2000}
                                    rows={4}
                                    placeholder="If no completion-evidence attachment exists, explain why resolution may proceed without it..."
                                    onChange={
                                        event => {
                                            setEvidenceOverrideReason(
                                                event.target.value
                                            );

                                            if (error) {
                                                setError("");
                                            }
                                        }
                                    }
                                    className={`${inputClassName} min-h-28 resize-y`}
                                />

                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    Leave blank when valid completion evidence is already attached. Use this only when resolution must proceed without that evidence.
                                </p>

                                <p className="mt-1 text-right text-xs text-slate-400">
                                    {evidenceOverrideReason.length}/2000
                                </p>
                            </label>
                        )}

                        {isTechnician && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                                Technician context cannot waive completion evidence.
                            </div>
                        )}
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
                            CircleCheckBig
                        }
                        disabled={submitting}
                    >
                        {submitting
                            ? "Resolving..."
                            : "Resolve Request"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default ResolveMaintenanceRequestModal;

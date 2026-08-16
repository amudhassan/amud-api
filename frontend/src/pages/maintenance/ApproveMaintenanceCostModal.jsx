import {
    CheckCircle2,
    X
} from "lucide-react";

import {
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";
import { Button } from "../../components/ui/Button";

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to approve the maintenance cost.";

const getMaintenanceCost = response => {
    const body = response?.data || {};
    const data = body?.data || {};

    return (
        data.maintenance_cost ||
        data.cost ||
        body.maintenance_cost ||
        body.cost ||
        null
    );
};

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );

const formatAmount = (amount, currencyCode) => {
    if (
        amount === null ||
        amount === undefined ||
        amount === ""
    ) {
        return "—";
    }

    const numeric = Number(amount);
    if (Number.isNaN(numeric)) {
        return String(amount);
    }

    const currency = currencyCode || "TZS";

    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency,
            maximumFractionDigits: 2
        }).format(numeric);
    } catch {
        return `${currency} ${numeric.toLocaleString()}`;
    }
};

function ApproveMaintenanceCostModal({
    open,
    maintenanceRequest,
    maintenanceCost,
    accessContext,
    onClose,
    onApproved
}) {
    const [decisionNote, setDecisionNote] =
        useState("");
    const [submitting, setSubmitting] =
        useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }

        setDecisionNote("");
        setSubmitting(false);
        setError("");
    }, [
        open,
        maintenanceCost?.public_id
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !submitting
            ) {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () =>
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
    }, [open, onClose, submitting]);

    if (
        !open ||
        !maintenanceRequest ||
        !maintenanceCost
    ) {
        return null;
    }

    const submit = async event => {
        event.preventDefault();

        const note = decisionNote.trim();

        if (
            note.length < 3 ||
            note.length > 2000
        ) {
            setError(
                "Decision note must contain between 3 and 2000 characters."
            );
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const config = {};
            if (accessContext) {
                config.params = {
                    access_context: accessContext
                };
            }

            // Refresh the authoritative cost immediately before
            // deciding the pending approval so concurrency values
            // and latest approval state are current.
            const currentResponse = await apiClient.get(
                `/maintenance/requests/${encodeURIComponent(
                    maintenanceRequest.public_id
                )}/costs/${encodeURIComponent(
                    maintenanceCost.public_id
                )}`,
                config
            );

            const authoritativeCost =
                getMaintenanceCost(currentResponse);

            if (!authoritativeCost) {
                throw new Error(
                    "The maintenance cost could not be refreshed before approval."
                );
            }

            if (
                ![
                    "submitted",
                    "approved"
                ].includes(
                    authoritativeCost.status
                )
            ) {
                setError(
                    `This cost is now ${formatLabel(
                        authoritativeCost.status
                    )}. It is not awaiting an approval decision.`
                );
                return;
            }

            if (
                authoritativeCost.latest_approval
                    ?.decision !== "pending"
            ) {
                setError(
                    "No pending cost approval exists for this maintenance cost."
                );
                return;
            }

            if (!authoritativeCost.updated_at) {
                throw new Error(
                    "The maintenance cost updated-at timestamp is missing."
                );
            }

            await apiClient.post(
                `/maintenance/requests/${encodeURIComponent(
                    maintenanceRequest.public_id
                )}/costs/${encodeURIComponent(
                    maintenanceCost.public_id
                )}/approve`,
                {
                    expected_status:
                        authoritativeCost.status,
                    expected_updated_at:
                        authoritativeCost.updated_at,
                    decision_note: note
                },
                config
            );

            await onApproved?.();
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setSubmitting(false);
        }
    };

    const approval =
        maintenanceCost.latest_approval;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Approve Maintenance Cost
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Confirm the currently pending cost approval decision.
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close approve maintenance cost modal"
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

                        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Cost Type
                                </p>
                                <p className="mt-1 text-sm font-bold text-slate-900">
                                    {formatLabel(
                                        maintenanceCost.cost_type
                                    ) || "Maintenance Cost"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Cost Status
                                </p>
                                <p className="mt-1 text-sm font-bold text-slate-900">
                                    {formatLabel(
                                        maintenanceCost.status
                                    )}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Approval Type
                                </p>
                                <p className="mt-1 text-sm font-bold text-slate-900">
                                    {formatLabel(
                                        approval?.approval_type
                                    ) || "—"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Pending Amount
                                </p>
                                <p className="mt-1 text-sm font-bold text-slate-900">
                                    {formatAmount(
                                        approval?.submitted_amount,
                                        maintenanceCost.currency_code ||
                                            maintenanceRequest.currency_code
                                    )}
                                </p>
                            </div>
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Approval Decision Note *
                            </span>

                            <textarea
                                value={decisionNote}
                                disabled={submitting}
                                minLength={3}
                                maxLength={2000}
                                rows={5}
                                placeholder="Why is this maintenance cost approved?"
                                onChange={event => {
                                    setDecisionNote(
                                        event.target.value
                                    );
                                    setError("");
                                }}
                                className="mt-2 min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />

                            <p className="mt-1.5 text-xs text-slate-500">
                                Required for the permanent maintenance cost audit trail.
                            </p>
                        </label>

                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
                            Approval will apply the pending submitted amount according to the maintenance cost approval lifecycle.
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
                        leftIcon={CheckCircle2}
                        disabled={submitting}
                    >
                        {submitting
                            ? "Approving..."
                            : "Approve Cost"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default ApproveMaintenanceCostModal;

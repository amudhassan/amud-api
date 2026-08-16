import {
    X,
    XCircle
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
    "Unable to reject the maintenance cost.";

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

function RejectMaintenanceCostModal({
    open,
    maintenanceRequest,
    maintenanceCost,
    accessContext,
    onClose,
    onRejected
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
                "Rejection decision note must contain between 3 and 2000 characters."
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
                    "The maintenance cost could not be refreshed before rejection."
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
                )}/reject`,
                {
                    expected_status:
                        authoritativeCost.status,
                    expected_updated_at:
                        authoritativeCost.updated_at,
                    decision_note: note
                },
                config
            );

            await onRejected?.();
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
                            Reject Maintenance Cost
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Reject the currently pending maintenance cost approval.
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close reject maintenance cost modal"
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

                            <div className="sm:col-span-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Pending Amount
                                </p>
                                <p className="mt-1 text-lg font-bold text-slate-950">
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
                                Rejection Decision Note *
                            </span>

                            <textarea
                                value={decisionNote}
                                disabled={submitting}
                                minLength={3}
                                maxLength={2000}
                                rows={5}
                                placeholder="Explain why this maintenance cost is being rejected..."
                                onChange={event => {
                                    setDecisionNote(
                                        event.target.value
                                    );
                                    setError("");
                                }}
                                className="mt-2 min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {decisionNote.length}/2000
                            </p>
                        </label>

                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900">
                            Rejection closes the pending approval decision and preserves the decision note in the maintenance cost audit trail.
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
                        leftIcon={XCircle}
                        disabled={submitting}
                    >
                        {submitting
                            ? "Rejecting..."
                            : "Reject Cost"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default RejectMaintenanceCostModal;

import {
    ReceiptText,
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
    "Unable to record the actual maintenance cost.";

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

const toLocalDateTimeInput = date => {
    const value = date instanceof Date
        ? date
        : new Date(date);

    if (Number.isNaN(value.getTime())) {
        return "";
    }

    const offsetMs =
        value.getTimezoneOffset() * 60 * 1000;

    return new Date(
        value.getTime() - offsetMs
    )
        .toISOString()
        .slice(0, 16);
};

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

function IncurMaintenanceCostModal({
    open,
    maintenanceRequest,
    maintenanceCost,
    accessContext,
    onClose,
    onIncurred
}) {
    const [actualAmount, setActualAmount] =
        useState("");
    const [incurredAt, setIncurredAt] =
        useState("");
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] =
        useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open || !maintenanceCost) {
            return;
        }

        setActualAmount(
            String(
                maintenanceCost.approved_amount ?? ""
            )
        );
        setIncurredAt(
            toLocalDateTimeInput(new Date())
        );
        setReason("");
        setSubmitting(false);
        setError("");
    }, [
        open,
        maintenanceCost?.public_id,
        maintenanceCost?.approved_amount
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

        const amountText = actualAmount.trim();
        const amount = Number(amountText);
        const reasonText = reason.trim();
        const localIncurredDate = new Date(incurredAt);

        if (
            !/^\d+(\.\d{1,2})?$/.test(amountText) ||
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            setError(
                "Actual amount must be greater than zero and can contain at most two decimal places."
            );
            return;
        }

        if (
            !incurredAt ||
            Number.isNaN(
                localIncurredDate.getTime()
            )
        ) {
            setError(
                "Select a valid incurred date and time."
            );
            return;
        }

        if (
            reasonText.length < 3 ||
            reasonText.length > 2000
        ) {
            setError(
                "Incurrence reason must contain between 3 and 2000 characters."
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
                    "The maintenance cost could not be refreshed before recording the actual cost."
                );
            }

            if (
                authoritativeCost.status !== "approved"
            ) {
                setError(
                    "Only an approved maintenance cost can be recorded as incurred."
                );
                return;
            }

            if (!authoritativeCost.updated_at) {
                throw new Error(
                    "The maintenance cost updated-at timestamp is missing."
                );
            }

            const approvedAmount = Number(
                authoritativeCost.approved_amount
            );

            if (
                !Number.isFinite(approvedAmount) ||
                approvedAmount <= 0
            ) {
                setError(
                    "The approved amount is missing or invalid."
                );
                return;
            }

            if (amount > approvedAmount) {
                setError(
                    `Actual amount cannot exceed the currently approved amount of ${formatAmount(
                        approvedAmount,
                        authoritativeCost.currency_code ||
                            maintenanceRequest.currency_code
                    )}.`
                );
                return;
            }

            const createdAt = new Date(
                authoritativeCost.created_at
            );

            if (
                !Number.isNaN(createdAt.getTime()) &&
                localIncurredDate.getTime() <
                    createdAt.getTime()
            ) {
                setError(
                    "Incurred date and time cannot be before the cost was created."
                );
                return;
            }

            await apiClient.post(
                `/maintenance/requests/${encodeURIComponent(
                    maintenanceRequest.public_id
                )}/costs/${encodeURIComponent(
                    maintenanceCost.public_id
                )}/incur`,
                {
                    expected_status:
                        authoritativeCost.status,
                    expected_updated_at:
                        authoritativeCost.updated_at,
                    actual_amount: amount,
                    incurred_at:
                        localIncurredDate.toISOString(),
                    reason: reasonText
                },
                config
            );

            await onIncurred?.();
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Record Actual Maintenance Cost
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Finalize the approved maintenance cost with the amount actually incurred.
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close actual maintenance cost modal"
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
                                    Estimated Amount
                                </p>
                                <p className="mt-1 text-sm font-bold text-slate-900">
                                    {formatAmount(
                                        maintenanceCost.estimated_amount,
                                        maintenanceCost.currency_code ||
                                            maintenanceRequest.currency_code
                                    )}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Approved Ceiling
                                </p>
                                <p className="mt-1 text-sm font-bold text-emerald-700">
                                    {formatAmount(
                                        maintenanceCost.approved_amount,
                                        maintenanceCost.currency_code ||
                                            maintenanceRequest.currency_code
                                    )}
                                </p>
                            </div>
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Actual Amount *
                            </span>

                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={actualAmount}
                                disabled={submitting}
                                onChange={event => {
                                    setActualAmount(
                                        event.target.value
                                    );
                                    setError("");
                                }}
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />

                            <p className="mt-1.5 text-xs text-slate-500">
                                It cannot exceed the current approved amount.
                            </p>
                        </label>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Incurred Date & Time *
                            </span>

                            <input
                                type="datetime-local"
                                value={incurredAt}
                                disabled={submitting}
                                onChange={event => {
                                    setIncurredAt(
                                        event.target.value
                                    );
                                    setError("");
                                }}
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Incurrence Reason *
                            </span>

                            <textarea
                                value={reason}
                                disabled={submitting}
                                minLength={3}
                                maxLength={2000}
                                rows={5}
                                placeholder="Example: Final supplier invoice received and maintenance work completed"
                                onChange={event => {
                                    setReason(
                                        event.target.value
                                    );
                                    setError("");
                                }}
                                className="mt-2 min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>

                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                            Recording the actual cost changes this cost from Approved to Incurred. An incurred cost is terminal and remains available for audit and reporting.
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
                        leftIcon={ReceiptText}
                        disabled={submitting}
                    >
                        {submitting
                            ? "Recording..."
                            : "Record Actual Cost"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default IncurMaintenanceCostModal;

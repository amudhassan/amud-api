import {
    AlertTriangle,
    RotateCcw,
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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to reverse payment.";

const formatMoney = (
    value,
    currencyCode
) => {
    const amount =
        Number(value);

    if (!Number.isFinite(amount)) {
        return "—";
    }

    const formatted =
        new Intl.NumberFormat(
            undefined,
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        ).format(amount);

    return currencyCode
        ? `${currencyCode} ${formatted}`
        : formatted;
};

function ReversePaymentModal({
    open,
    payment,
    onClose,
    onReversed
}) {
    const [
        reversalReason,
        setReversalReason
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

        setReversalReason("");
        setError("");
    }, [
        open,
        payment?.public_id
    ]);

    if (
        !open ||
        !payment
    ) {
        return null;
    }

    const closeModal = () => {
        if (submitting) {
            return;
        }

        setError("");
        onClose?.();
    };

    const handleSubmit =
        async event => {
            event.preventDefault();
            setError("");

            if (
                payment.status !==
                "completed"
            ) {
                setError(
                    "Only a completed payment can be reversed."
                );
                return;
            }

            const normalizedReason =
                reversalReason.trim();

            if (!normalizedReason) {
                setError(
                    "Reversal reason is required."
                );
                return;
            }

            if (
                normalizedReason.length >
                1000
            ) {
                setError(
                    "Reversal reason cannot exceed 1000 characters."
                );
                return;
            }

            try {
                setSubmitting(
                    true
                );

                const response =
                    await apiClient.patch(
                        `/payments/${payment.public_id}/reverse`,
                        {
                            reversal_reason:
                                normalizedReason
                        }
                    );

                await onReversed?.(
                    response?.data
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
                setSubmitting(
                    false
                );
            }
        };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
            <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-2xl">
                <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                            <RotateCcw className="h-5 w-5" />
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-slate-950">
                                Reverse Payment
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                This financial action preserves the original payment and changes its lifecycle to reversed.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        aria-label="Close"
                        disabled={submitting}
                        onClick={
                            closeModal
                        }
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form
                    onSubmit={
                        handleSubmit
                    }
                    className="min-h-0 flex-1 overflow-y-auto"
                >
                    <div className="space-y-5 px-6 py-5">
                        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

                            <p>
                                Reversal removes this completed payment from the current financial effect. The backend remains responsible for restoring the affected invoice balance/status and recording the reversal audit.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Payment
                                    </p>

                                    <p className="mt-1 break-words text-sm font-bold text-slate-950">
                                        {payment.payment_number}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Receipt
                                    </p>

                                    <p className="mt-1 break-words text-sm font-bold text-slate-950">
                                        {payment.receipt_number}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Amount
                                    </p>

                                    <p className="mt-1 text-sm font-bold text-slate-950">
                                        {formatMoney(
                                            payment.amount,
                                            payment.currency_code
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Current Status
                                    </p>

                                    <p className="mt-1 text-sm font-bold capitalize text-emerald-700">
                                        {payment.status}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {error}
                            </div>
                        )}

                        <label className="block">
                            <span className="text-sm font-semibold text-slate-800">
                                Reversal Reason
                                <span className="text-rose-600">
                                    {" "}
                                    *
                                </span>
                            </span>

                            <textarea
                                rows={5}
                                value={
                                    reversalReason
                                }
                                maxLength={1000}
                                disabled={submitting}
                                onChange={
                                    event =>
                                        setReversalReason(
                                            event
                                                .target
                                                .value
                                        )
                                }
                                placeholder="Explain why this completed payment must be reversed..."
                                className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100 disabled:bg-slate-50"
                            />

                            <p className="mt-1.5 flex justify-between gap-3 text-xs text-slate-500">
                                <span>
                                    Required. Maximum 1000 characters.
                                </span>

                                <span>
                                    {reversalReason.length}/1000
                                </span>
                            </p>
                        </label>
                    </div>

                    <div className="sticky bottom-0 flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={submitting}
                            onClick={
                                closeModal
                            }
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            variant="danger"
                            disabled={
                                submitting ||
                                reversalReason
                                    .trim()
                                    .length === 0
                            }
                        >
                            {submitting
                                ? "Reversing..."
                                : "Confirm Reversal"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ReversePaymentModal;

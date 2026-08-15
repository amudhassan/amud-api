import {
    AlertTriangle,
    Ban,
    X
} from "lucide-react";

import {
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button,
    IconButton
} from "../../components/ui/Button";

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to void the invoice.";

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

function VoidInvoiceModal({
    open,
    invoice,
    onClose,
    onVoided
}) {
    const [
        voidReason,
        setVoidReason
    ] = useState("");

    const [
        voiding,
        setVoiding
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }

        setVoidReason("");
        setVoiding(false);
        setError("");
    }, [
        open,
        invoice?.public_id
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !voiding
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
        open,
        voiding,
        onClose
    ]);

    if (
        !open ||
        !invoice
    ) {
        return null;
    }

    const paidAmount =
        Number(
            invoice
                .financial_summary
                ?.paid_amount ??
            invoice.paid_amount ??
            0
        );

    const balanceAmount =
        Number(
            invoice
                .financial_summary
                ?.balance_amount ??
            invoice.balance_amount ??
            0
        );

    const eligibleStatus =
        [
            "draft",
            "issued"
        ].includes(
            invoice.status
        );

    const noPayments =
        Number.isFinite(
            paidAmount
        ) &&
        paidAmount === 0;

    const eligible =
        eligibleStatus &&
        noPayments;

    const submit =
        async event => {
            event.preventDefault();

            if (
                !invoice.public_id
            ) {
                setError(
                    "Invoice identifier is missing."
                );
                return;
            }

            const normalizedReason =
                voidReason.trim();

            if (!eligible) {
                setError(
                    "Only draft or issued invoices without recorded payments can be voided."
                );
                return;
            }

            if (
                normalizedReason.length === 0
            ) {
                setError(
                    "Enter a reason for voiding this invoice."
                );
                return;
            }

            if (
                normalizedReason.length > 1000
            ) {
                setError(
                    "Void reason cannot exceed 1000 characters."
                );
                return;
            }

            try {
                setVoiding(true);
                setError("");

                const response =
                    await apiClient.patch(
                        `/invoices/${encodeURIComponent(
                            invoice.public_id
                        )}/void`,
                        {
                            void_reason:
                                normalizedReason
                        }
                    );

                await onVoided?.(
                    response?.data?.data ||
                    {}
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
                setVoiding(false);
            }
        };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="void-invoice-title"
                className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
                <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                            <Ban className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="void-invoice-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Void Invoice
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                {invoice.invoice_number}
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close void invoice"
                        icon={X}
                        disabled={voiding}
                        onClick={onClose}
                    />
                </div>

                <form
                    onSubmit={submit}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                        {error && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {error}
                            </div>
                        )}

                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                                <p>
                                    Voiding preserves this invoice and its audit history, but marks it as no longer active for billing.
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                    Current Status
                                </p>

                                <p className="mt-1 text-sm font-bold capitalize text-slate-950">
                                    {invoice.status}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                    Balance
                                </p>

                                <p className="mt-1 text-sm font-bold text-slate-950">
                                    {formatMoney(
                                        balanceAmount,
                                        invoice.currency_code
                                    )}
                                </p>
                            </div>
                        </div>

                        <div
                            className={`rounded-2xl border px-4 py-3 text-sm ${
                                eligible
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                    : "border-rose-200 bg-rose-50 text-rose-800"
                            }`}
                        >
                            {eligible
                                ? "This invoice is currently eligible to be voided."
                                : "This invoice is not eligible to be voided. Only draft or issued invoices without recorded payments are allowed."
                            }
                        </div>

                        <label className="block">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-slate-800">
                                    Void Reason
                                </span>

                                <span className="text-xs text-slate-400">
                                    {voidReason.length}/1000
                                </span>
                            </div>

                            <textarea
                                value={voidReason}
                                maxLength={1000}
                                rows={5}
                                disabled={
                                    voiding ||
                                    !eligible
                                }
                                onChange={event =>
                                    setVoidReason(
                                        event.target.value
                                    )
                                }
                                placeholder="Explain why this invoice is being voided"
                                className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100 disabled:bg-slate-100"
                                required
                            />
                        </label>
                    </div>

                    <div className="shrink-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={voiding}
                            onClick={onClose}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            leftIcon={Ban}
                            disabled={
                                voiding ||
                                !eligible ||
                                !voidReason.trim()
                            }
                            className="bg-rose-600 text-white hover:bg-rose-700"
                        >
                            {voiding
                                ? "Voiding..."
                                : "Void Invoice"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default VoidInvoiceModal;

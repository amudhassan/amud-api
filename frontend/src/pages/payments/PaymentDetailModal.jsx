import {
    Banknote,
    Building2,
    CalendarClock,
    FileText,
    Hash,
    ReceiptText,
    RotateCcw,
    UserRound,
    WalletCards,
    X
} from "lucide-react";

import {
    useState
} from "react";

import ReversePaymentModal from "./ReversePaymentModal";
import ReceiptDetailModal from "./ReceiptDetailModal";

import {
    Button
} from "../../components/ui/Button";

const PAYMENT_METHOD_LABELS = {
    cash: "Cash",
    bank_transfer: "Bank Transfer",
    mobile_money: "Mobile Money",
    card: "Card",
    cheque: "Cheque",
    other: "Other"
};

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
            minute: "2-digit",
            second: "2-digit"
        }
    ).format(parsed);
};

const statusClasses = status => {
    if (status === "completed") {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (status === "reversed") {
        return "border-rose-200 bg-rose-50 text-rose-700";
    }

    return "border-slate-200 bg-slate-50 text-slate-700";
};

const labelStatus = value =>
    String(
        value || "unknown"
    )
        .replaceAll(
            "_",
            " "
        )
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

function InfoItem({
    label,
    value,
    icon: Icon
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
                {Icon && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                        <Icon className="h-4 w-4" />
                    </div>
                )}

                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {label}
                    </p>

                    <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                        {value || "—"}
                    </p>
                </div>
            </div>
        </div>
    );
}

function PaymentDetailModal({
    payment,
    open,
    onClose,
    onChanged
}) {
    const [
        reverseModalOpen,
        setReverseModalOpen
    ] = useState(false);

    const [
        receiptModalOpen,
        setReceiptModalOpen
    ] = useState(false);
    if (
        !open ||
        !payment
    ) {
        return null;
    }

    const allocations =
        Array.isArray(
            payment.allocations
        )
            ? payment.allocations
            : [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <WalletCards className="h-5 w-5" />
                        </div>

                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-xl font-bold text-slate-950">
                                    Payment Details
                                </h2>

                                <span
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                                        payment.status
                                    )}`}
                                >
                                    {labelStatus(
                                        payment.status
                                    )}
                                </span>
                            </div>

                            <p className="mt-1 text-sm text-slate-500">
                                {payment.payment_number}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        aria-label="Close"
                        onClick={
                            onClose
                        }
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="space-y-6 px-6 py-5">
                        <section className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                                Payment Amount
                            </p>

                            <p className="mt-2 text-3xl font-bold text-slate-950">
                                {formatMoney(
                                    payment.amount,
                                    payment.currency_code
                                )}
                            </p>

                            <p className="mt-2 text-sm text-slate-600">
                                Paid via{" "}
                                <span className="font-semibold text-slate-800">
                                    {PAYMENT_METHOD_LABELS[
                                        payment.payment_method
                                    ] ||
                                        payment.payment_method ||
                                        "—"}
                                </span>
                                {" · "}
                                {formatDateTime(
                                    payment.paid_at
                                )}
                            </p>
                        </section>

                        <section>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                                Payment & Receipt
                            </h3>

                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <InfoItem
                                    label="Payment Number"
                                    value={
                                        payment.payment_number
                                    }
                                    icon={Hash}
                                />

                                <InfoItem
                                    label="Receipt Number"
                                    value={
                                        payment.receipt_number
                                    }
                                    icon={ReceiptText}
                                />

                                <InfoItem
                                    label="Payment Method"
                                    value={
                                        PAYMENT_METHOD_LABELS[
                                            payment.payment_method
                                        ] ||
                                        payment.payment_method
                                    }
                                    icon={Banknote}
                                />

                                <InfoItem
                                    label="Transaction Reference"
                                    value={
                                        payment.transaction_reference ||
                                        "Not provided"
                                    }
                                    icon={FileText}
                                />

                                <InfoItem
                                    label="Paid At"
                                    value={
                                        formatDateTime(
                                            payment.paid_at
                                        )
                                    }
                                    icon={CalendarClock}
                                />

                                <InfoItem
                                    label="Created At"
                                    value={
                                        formatDateTime(
                                            payment.created_at
                                        )
                                    }
                                    icon={CalendarClock}
                                />
                            </div>
                        </section>

                        <section>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                                Parties
                            </h3>

                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <InfoItem
                                    label="Tenant"
                                    value={
                                        payment.tenant
                                            ?.display_name
                                    }
                                    icon={UserRound}
                                />

                                <InfoItem
                                    label="Owner"
                                    value={
                                        payment.owner
                                            ?.display_name
                                    }
                                    icon={Building2}
                                />
                            </div>
                        </section>

                        <section>
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                                    Invoice Allocation
                                </h3>

                                <span className="text-xs font-semibold text-slate-500">
                                    {allocations.length} allocation(s)
                                </span>
                            </div>

                            {allocations.length ===
                                0 ? (
                                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                                    No invoice allocation was returned for this payment.
                                </div>
                            ) : (
                                <div className="mt-3 space-y-3">
                                    {allocations.map(
                                        allocation => {
                                            const invoice =
                                                allocation.invoice ||
                                                {};

                                            return (
                                                <div
                                                    key={
                                                        allocation.public_id
                                                    }
                                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                                >
                                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-950">
                                                                {invoice.invoice_number ||
                                                                    "Unknown invoice"}
                                                            </p>

                                                            <p className="mt-1 text-xs text-slate-500">
                                                                Status:{" "}
                                                                {labelStatus(
                                                                    invoice.status
                                                                )}
                                                            </p>
                                                        </div>

                                                        <p className="text-sm font-bold text-slate-950">
                                                            {payment.status ===
                                                            "reversed"
                                                                ? "Reversed Allocation"
                                                                : "Allocated"}
                                                            :{" "}
                                                            {formatMoney(
                                                                allocation.allocated_amount,
                                                                invoice.currency_code ||
                                                                    payment.currency_code
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                                        <div>
                                                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                                                Invoice Total
                                                            </p>

                                                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                                                {formatMoney(
                                                                    invoice.total_amount,
                                                                    invoice.currency_code
                                                                )}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                                                Paid
                                                            </p>

                                                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                                                {formatMoney(
                                                                    invoice.paid_amount,
                                                                    invoice.currency_code
                                                                )}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                                                Balance
                                                            </p>

                                                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                                                {formatMoney(
                                                                    invoice.balance_amount,
                                                                    invoice.currency_code
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            )}
                        </section>

                        {payment.notes && (
                            <section>
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                                    Notes
                                </h3>

                                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                                    {payment.notes}
                                </div>
                            </section>
                        )}

                        {payment.status ===
                            "reversed" && (
                            <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
                                <h3 className="text-sm font-bold uppercase tracking-wide text-rose-700">
                                    Reversal Audit
                                </h3>

                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
                                            Reversed At
                                        </p>

                                        <p className="mt-1 text-sm font-semibold text-slate-900">
                                            {formatDateTime(
                                                payment.reversed_at
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
                                            Reversed By
                                        </p>

                                        <p className="mt-1 text-sm font-semibold text-slate-900">
                                            {payment.reversed_by
                                                ?.role
                                                ? labelStatus(
                                                    payment.reversed_by
                                                        .role
                                                )
                                                : "—"}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
                                        Reason
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-slate-800">
                                        {payment.reversal_reason ||
                                            "—"}
                                    </p>
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {payment.receipt_number && (
                            <Button
                                type="button"
                                variant="secondary"
                                leftIcon={
                                    ReceiptText
                                }
                                onClick={() =>
                                    setReceiptModalOpen(
                                        true
                                    )
                                }
                            >
                                View Receipt
                            </Button>
                        )}

                        {payment.status ===
                            "completed" && (
                            <Button
                                type="button"
                                variant="danger"
                                leftIcon={
                                    RotateCcw
                                }
                                onClick={() =>
                                    setReverseModalOpen(
                                        true
                                    )
                                }
                            >
                                Reverse Payment
                            </Button>
                        )}
                    </div>

                    <Button
                        type="button"
                        variant="secondary"
                        onClick={
                            onClose
                        }
                    >
                        Close
                    </Button>
                </div>
            </div>

            <ReceiptDetailModal
                open={receiptModalOpen}
                receiptNumber={
                    payment.receipt_number
                }
                onClose={() =>
                    setReceiptModalOpen(
                        false
                    )
                }
            />

            <ReversePaymentModal
                open={reverseModalOpen}
                payment={payment}
                onClose={() =>
                    setReverseModalOpen(
                        false
                    )
                }
                onReversed={async () => {
                    setReverseModalOpen(
                        false
                    );

                    await onChanged?.();
                }}
            />
        </div>
    );
}

export default PaymentDetailModal;

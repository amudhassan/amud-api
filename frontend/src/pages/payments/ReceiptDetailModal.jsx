import {
    AlertCircle,
    Banknote,
    Building2,
    CalendarClock,
    Download,
    FileText,
    Hash,
    Loader2,
    ReceiptText,
    UserRound,
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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load receipt.";

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

const labelValue = value =>
    String(
        value || ""
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

function DetailCard({
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

function ReceiptDetailModal({
    open,
    receiptNumber,
    onClose
}) {
    const [
        receipt,
        setReceipt
    ] = useState(null);

    const [
        loading,
        setLoading
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const [
        downloadingPdf,
        setDownloadingPdf
    ] = useState(false);

    const [
        downloadError,
        setDownloadError
    ] = useState("");

    useEffect(() => {
        if (
            !open ||
            !receiptNumber
        ) {
            return;
        }

        let active = true;

        const loadReceipt =
            async () => {
                try {
                    setLoading(true);
                    setError("");
                    setDownloadError("");
                    setReceipt(null);

                    const response =
                        await apiClient.get(
                            `/receipts/${encodeURIComponent(
                                receiptNumber
                            )}`
                        );

                    if (!active) {
                        return;
                    }

                    setReceipt(
                        response?.data?.data
                            ?.receipt ||
                        null
                    );
                } catch (
                    requestError
                ) {
                    if (!active) {
                        return;
                    }

                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    if (active) {
                        setLoading(false);
                    }
                }
            };

        loadReceipt();

        return () => {
            active = false;
        };
    }, [
        open,
        receiptNumber
    ]);

    const allocations =
        useMemo(
            () =>
                Array.isArray(
                    receipt?.allocations
                )
                    ? receipt.allocations
                    : [],
            [
                receipt
            ]
        );

    if (!open) {
        return null;
    }

    const isReversed =
        receipt?.receipt_status ===
        "reversed";

    const downloadPdf =
        async () => {
            if (
                !receipt?.receipt_number ||
                downloadingPdf
            ) {
                return;
            }

            try {
                setDownloadingPdf(true);
                setDownloadError("");

                const response =
                    await apiClient.get(
                        `/receipts/${encodeURIComponent(
                            receipt.receipt_number
                        )}/pdf`,
                        {
                            responseType:
                                "blob"
                        }
                    );

                const blob =
                    response.data instanceof Blob
                        ? response.data
                        : new Blob(
                            [response.data],
                            {
                                type:
                                    "application/pdf"
                            }
                        );

                const objectUrl =
                    URL.createObjectURL(
                        blob
                    );

                const anchor =
                    document.createElement(
                        "a"
                    );

                anchor.href =
                    objectUrl;

                anchor.download =
                    `${receipt.receipt_number}.pdf`;

                document.body.appendChild(
                    anchor
                );

                anchor.click();
                anchor.remove();

                URL.revokeObjectURL(
                    objectUrl
                );
            } catch (
                requestError
            ) {
                setDownloadError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setDownloadingPdf(false);
            }
        };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <ReceiptText className="h-5 w-5" />
                        </div>

                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-xl font-bold text-slate-950">
                                    Rent Payment Receipt
                                </h2>

                                {receipt && (
                                    <span
                                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                            isReversed
                                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        }`}
                                    >
                                        {isReversed
                                            ? "Reversed"
                                            : "Valid Receipt"}
                                    </span>
                                )}
                            </div>

                            <p className="mt-1 text-sm text-slate-500">
                                {receiptNumber}
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
                        {loading && (
                            <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-sm text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading receipt...
                            </div>
                        )}

                        {error && (
                            <div className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                                <span>
                                    {error}
                                </span>
                            </div>
                        )}

                        {!loading &&
                            !error &&
                            receipt && (
                            <>
                                <section
                                    className={`rounded-3xl border p-5 ${
                                        isReversed
                                            ? "border-rose-200 bg-rose-50/70"
                                            : "border-emerald-200 bg-emerald-50/70"
                                    }`}
                                >
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Amount Received
                                    </p>

                                    <p className="mt-2 text-3xl font-bold text-slate-950">
                                        {formatMoney(
                                            receipt.payment
                                                ?.amount,
                                            receipt.payment
                                                ?.currency_code
                                        )}
                                    </p>

                                    <p className="mt-2 text-sm text-slate-600">
                                        Receipt issued{" "}
                                        {formatDateTime(
                                            receipt.issued_at
                                        )}
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                                        Receipt & Payment
                                    </h3>

                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        <DetailCard
                                            label="Receipt Number"
                                            value={
                                                receipt.receipt_number
                                            }
                                            icon={
                                                ReceiptText
                                            }
                                        />

                                        <DetailCard
                                            label="Payment Number"
                                            value={
                                                receipt.payment
                                                    ?.payment_number
                                            }
                                            icon={Hash}
                                        />

                                        <DetailCard
                                            label="Payment Date"
                                            value={
                                                formatDateTime(
                                                    receipt.payment
                                                        ?.paid_at
                                                )
                                            }
                                            icon={
                                                CalendarClock
                                            }
                                        />

                                        <DetailCard
                                            label="Payment Method"
                                            value={
                                                labelValue(
                                                    receipt.payment
                                                        ?.payment_method
                                                )
                                            }
                                            icon={Banknote}
                                        />

                                        <DetailCard
                                            label="Transaction Reference"
                                            value={
                                                receipt.payment
                                                    ?.transaction_reference ||
                                                "Not provided"
                                            }
                                            icon={FileText}
                                        />

                                        <DetailCard
                                            label="Receipt Status"
                                            value={
                                                isReversed
                                                    ? "Reversed"
                                                    : "Valid Receipt"
                                            }
                                            icon={
                                                ReceiptText
                                            }
                                        />
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                                        Payment Parties
                                    </h3>

                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        <DetailCard
                                            label="Payee / Owner"
                                            value={
                                                receipt.payee
                                                    ?.display_name
                                            }
                                            icon={
                                                Building2
                                            }
                                        />

                                        <DetailCard
                                            label="Payer / Tenant"
                                            value={
                                                receipt.payer
                                                    ?.display_name
                                            }
                                            icon={
                                                UserRound
                                            }
                                        />

                                        <DetailCard
                                            label="Recorded By"
                                            value={
                                                receipt.received_by
                                                    ?.full_name ||
                                                receipt.received_by
                                                    ?.display_name ||
                                                receipt.received_by
                                                    ?.role ||
                                                "—"
                                            }
                                            icon={
                                                UserRound
                                            }
                                        />
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                                            Invoice Allocations
                                        </h3>

                                        <span className="text-xs font-semibold text-slate-500">
                                            {allocations.length} allocation(s)
                                        </span>
                                    </div>

                                    {allocations.length ===
                                        0 ? (
                                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                                            No invoice allocation was returned for this receipt.
                                        </div>
                                    ) : (
                                        <div className="mt-3 space-y-3">
                                            {allocations.map(
                                                (
                                                    allocation,
                                                    index
                                                ) => {
                                                    const invoice =
                                                        allocation.invoice ||
                                                        {};

                                                    return (
                                                        <div
                                                            key={
                                                                allocation.public_id ||
                                                                `${invoice.public_id}-${index}`
                                                            }
                                                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                                        >
                                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                                <div>
                                                                    <p className="text-sm font-bold text-slate-950">
                                                                        {invoice.invoice_number ||
                                                                            "Unknown invoice"}
                                                                    </p>

                                                                    <p className="mt-1 text-xs text-slate-500">
                                                                        Status:{" "}
                                                                        {labelValue(
                                                                            invoice.status
                                                                        ) ||
                                                                            "—"}
                                                                    </p>
                                                                </div>

                                                                <p className="text-sm font-bold text-slate-950">
                                                                    {isReversed
                                                                        ? "Reversed Allocation"
                                                                        : "Allocated"}
                                                                    :{" "}
                                                                    {formatMoney(
                                                                        allocation.allocated_amount,
                                                                        invoice.currency_code ||
                                                                            receipt.payment
                                                                                ?.currency_code
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
                                                                        Current Paid
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
                                                                        Current Balance
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

                                {isReversed && (
                                    <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
                                        <h3 className="text-sm font-bold uppercase tracking-wide text-rose-700">
                                            Receipt Reversal Status
                                        </h3>

                                        <p className="mt-2 text-sm leading-6 text-rose-900">
                                            This receipt is tied to a payment that has been reversed. It remains visible for audit history, but it no longer represents a currently valid completed payment.
                                        </p>
                                    </section>
                                )}
                            </>
                        )}
                        {downloadError && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {downloadError}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={
                            onClose
                        }
                    >
                        Close
                    </Button>

                    <Button
                        type="button"
                        leftIcon={Download}
                        disabled={
                            loading ||
                            !receipt ||
                            downloadingPdf
                        }
                        onClick={
                            downloadPdf
                        }
                    >
                        {downloadingPdf
                            ? "Downloading..."
                            : "Download PDF"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default ReceiptDetailModal;

import {
    AlertCircle,
    CheckCircle2,
    Loader2,
    ReceiptText,
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

const ELIGIBLE_STATUSES = [
    "issued",
    "partially_paid",
    "overdue"
];

const PAYMENT_METHODS = [
    {
        value: "cash",
        label: "Cash"
    },
    {
        value: "bank_transfer",
        label: "Bank Transfer"
    },
    {
        value: "mobile_money",
        label: "Mobile Money"
    },
    {
        value: "card",
        label: "Card"
    },
    {
        value: "cheque",
        label: "Cheque"
    },
    {
        value: "other",
        label: "Other"
    }
];

const REFERENCE_REQUIRED_METHODS =
    new Set([
        "bank_transfer",
        "mobile_money",
        "card",
        "cheque"
    ]);

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to record payment.";

const toLocalDateTimeInput = date => {
    const value =
        date instanceof Date
            ? date
            : new Date(date);

    if (
        Number.isNaN(
            value.getTime()
        )
    ) {
        return "";
    }

    const pad = number =>
        String(number).padStart(
            2,
            "0"
        );

    return [
        value.getFullYear(),
        "-",
        pad(
            value.getMonth() + 1
        ),
        "-",
        pad(
            value.getDate()
        ),
        "T",
        pad(
            value.getHours()
        ),
        ":",
        pad(
            value.getMinutes()
        ),
        ":",
        pad(
            value.getSeconds()
        )
    ].join("");
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

const formatDate = value => {
    if (!value) {
        return "—";
    }

    const parsed =
        new Date(
            String(value).length === 10
                ? `${value}T00:00:00`
                : value
        );

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
            day: "2-digit"
        }
    ).format(parsed);
};

const invoiceBalance = invoice =>
    Number(
        invoice?.financial_summary
            ?.balance_amount ??
        invoice?.balance_amount ??
        0
    );

const invoiceTotal = invoice =>
    Number(
        invoice?.financial_summary
            ?.total_amount ??
        invoice?.total_amount ??
        0
    );

const normalizeInvoices = response => {
    const items =
        response?.data?.data
            ?.invoices;

    return Array.isArray(items)
        ? items
        : [];
};

function RecordPaymentModal({
    open,
    onClose,
    onRecorded
}) {
    const [
        invoices,
        setInvoices
    ] = useState([]);

    const [
        invoicePublicId,
        setInvoicePublicId
    ] = useState("");

    const [
        amount,
        setAmount
    ] = useState("");

    const [
        paymentMethod,
        setPaymentMethod
    ] = useState("cash");

    const [
        transactionReference,
        setTransactionReference
    ] = useState("");

    const [
        paidAt,
        setPaidAt
    ] = useState(
        toLocalDateTimeInput(
            new Date()
        )
    );

    const [
        notes,
        setNotes
    ] = useState("");

    const [
        loadingInvoices,
        setLoadingInvoices
    ] = useState(false);

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        loadError,
        setLoadError
    ] = useState("");

    const [
        submitError,
        setSubmitError
    ] = useState("");

    const selectedInvoice =
        useMemo(
            () =>
                invoices.find(
                    invoice =>
                        invoice.public_id ===
                        invoicePublicId
                ) || null,
            [
                invoices,
                invoicePublicId
            ]
        );

    const balance =
        invoiceBalance(
            selectedInvoice
        );

    const referenceRequired =
        REFERENCE_REQUIRED_METHODS
            .has(
                paymentMethod
            );

    useEffect(() => {
        if (!open) {
            return;
        }

        let active = true;

        const loadEligibleInvoices =
            async () => {
                try {
                    setLoadingInvoices(
                        true
                    );
                    setLoadError("");
                    setSubmitError("");

                    const responses =
                        await Promise.all(
                            ELIGIBLE_STATUSES.map(
                                status =>
                                    apiClient.get(
                                        "/invoices",
                                        {
                                            params: {
                                                status,
                                                page: 1,
                                                limit: 100
                                            }
                                        }
                                    )
                            )
                        );

                    if (!active) {
                        return;
                    }

                    const byId =
                        new Map();

                    responses
                        .flatMap(
                            normalizeInvoices
                        )
                        .forEach(
                            invoice => {
                                if (
                                    !invoice
                                        ?.public_id
                                ) {
                                    return;
                                }

                                if (
                                    invoiceBalance(
                                        invoice
                                    ) <= 0
                                ) {
                                    return;
                                }

                                byId.set(
                                    invoice.public_id,
                                    invoice
                                );
                            }
                        );

                    const merged =
                        [...byId.values()]
                            .sort(
                                (
                                    left,
                                    right
                                ) => {
                                    const leftDue =
                                        String(
                                            left.due_date ||
                                            ""
                                        );

                                    const rightDue =
                                        String(
                                            right.due_date ||
                                            ""
                                        );

                                    return (
                                        leftDue.localeCompare(
                                            rightDue
                                        ) ||
                                        String(
                                            left.invoice_number ||
                                            ""
                                        ).localeCompare(
                                            String(
                                                right.invoice_number ||
                                                ""
                                            )
                                        )
                                    );
                                }
                            );

                    setInvoices(
                        merged
                    );

                    setInvoicePublicId(
                        current =>
                            merged.some(
                                invoice =>
                                    invoice.public_id ===
                                    current
                            )
                                ? current
                                : merged[0]
                                    ?.public_id ||
                                ""
                    );
                } catch (
                    error
                ) {
                    if (!active) {
                        return;
                    }

                    setInvoices([]);
                    setInvoicePublicId("");
                    setLoadError(
                        getErrorMessage(
                            error
                        )
                    );
                } finally {
                    if (active) {
                        setLoadingInvoices(
                            false
                        );
                    }
                }
            };

        setPaidAt(
            toLocalDateTimeInput(
                new Date()
            )
        );

        loadEligibleInvoices();

        return () => {
            active = false;
        };
    }, [
        open
    ]);

    useEffect(() => {
        if (!open) {
            return;
        }

        if (!selectedInvoice) {
            setAmount("");
            return;
        }

        setAmount(
            balance > 0
                ? balance.toFixed(2)
                : ""
        );
    }, [
        open,
        selectedInvoice,
        balance
    ]);

    useEffect(() => {
        if (!referenceRequired) {
            setTransactionReference(
                ""
            );
        }
    }, [
        referenceRequired
    ]);

    if (!open) {
        return null;
    }

    const closeModal = () => {
        if (submitting) {
            return;
        }

        setSubmitError("");
        onClose?.();
    };

    const handleSubmit =
        async event => {
            event.preventDefault();
            setSubmitError("");

            if (!selectedInvoice) {
                setSubmitError(
                    "Select an eligible invoice."
                );
                return;
            }

            const normalizedAmount =
                String(
                    amount
                ).trim();

            if (
                !/^\d{1,12}(\.\d{1,2})?$/.test(
                    normalizedAmount
                ) ||
                Number(
                    normalizedAmount
                ) <= 0
            ) {
                setSubmitError(
                    "Payment amount must be greater than zero and use at most two decimal places."
                );
                return;
            }

            if (
                Number(
                    normalizedAmount
                ) > balance
            ) {
                setSubmitError(
                    `Payment cannot exceed the outstanding balance of ${formatMoney(
                        balance,
                        selectedInvoice
                            .currency_code
                    )}.`
                );
                return;
            }

            const normalizedReference =
                transactionReference
                    .trim();

            if (
                referenceRequired &&
                !normalizedReference
            ) {
                setSubmitError(
                    "Transaction reference is required for the selected payment method."
                );
                return;
            }

            if (
                normalizedReference
                    .length > 150
            ) {
                setSubmitError(
                    "Transaction reference cannot exceed 150 characters."
                );
                return;
            }

            const paidDate =
                new Date(
                    paidAt
                );

            if (
                !paidAt ||
                Number.isNaN(
                    paidDate.getTime()
                )
            ) {
                setSubmitError(
                    "Enter a valid payment date and time."
                );
                return;
            }

            if (
                paidDate.getTime() >
                Date.now()
            ) {
                setSubmitError(
                    "Payment date and time cannot be in the future."
                );
                return;
            }

            if (
                selectedInvoice
                    .issued_at
            ) {
                const issuedTime =
                    new Date(
                        selectedInvoice
                            .issued_at
                    ).getTime();

                if (
                    Number.isFinite(
                        issuedTime
                    ) &&
                    paidDate.getTime() <
                        issuedTime
                ) {
                    setSubmitError(
                        "Payment date and time cannot be before the invoice was issued."
                    );
                    return;
                }
            }

            const normalizedNotes =
                notes.trim();

            if (
                normalizedNotes.length >
                1000
            ) {
                setSubmitError(
                    "Payment notes cannot exceed 1000 characters."
                );
                return;
            }

            const payload = {
                amount:
                    normalizedAmount,
                payment_method:
                    paymentMethod,
                paid_at:
                    paidDate
                        .toISOString()
            };

            if (
                normalizedReference
            ) {
                payload
                    .transaction_reference =
                    normalizedReference;
            }

            if (
                normalizedNotes
            ) {
                payload.notes =
                    normalizedNotes;
            }

            try {
                setSubmitting(
                    true
                );

                const response =
                    await apiClient.post(
                        `/invoices/${selectedInvoice.public_id}/payments`,
                        payload
                    );

                await onRecorded?.(
                    response?.data
                );
            } catch (
                error
            ) {
                setSubmitError(
                    getErrorMessage(
                        error
                    )
                );
            } finally {
                setSubmitting(
                    false
                );
            }
        };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <ReceiptText className="h-5 w-5" />
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-slate-950">
                                Record Rent Payment
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Record a completed payment against an issued invoice with an outstanding balance.
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
                    <div className="space-y-6 px-6 py-5">
                        {loadError && (
                            <div className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                                <span>
                                    {
                                        loadError
                                    }
                                </span>
                            </div>
                        )}

                        {submitError && (
                            <div className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                                <span>
                                    {
                                        submitError
                                    }
                                </span>
                            </div>
                        )}

                        <section className="space-y-3">
                            <div>
                                <label
                                    htmlFor="payment-invoice"
                                    className="text-sm font-semibold text-slate-800"
                                >
                                    Invoice
                                </label>

                                <p className="mt-1 text-xs text-slate-500">
                                    Eligible statuses: Issued, Partially Paid and Overdue.
                                </p>
                            </div>

                            {loadingInvoices ? (
                                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading eligible invoices...
                                </div>
                            ) : invoices.length ===
                                0 ? (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                                    No eligible invoice with an outstanding balance is available.
                                </div>
                            ) : (
                                <select
                                    id="payment-invoice"
                                    value={
                                        invoicePublicId
                                    }
                                    onChange={
                                        event =>
                                            setInvoicePublicId(
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    {invoices.map(
                                        invoice => (
                                            <option
                                                key={
                                                    invoice.public_id
                                                }
                                                value={
                                                    invoice.public_id
                                                }
                                            >
                                                {invoice.invoice_number}
                                                {" — "}
                                                {invoice
                                                    .tenant
                                                    ?.display_name ||
                                                    "Unknown tenant"}
                                                {" — Balance "}
                                                {formatMoney(
                                                    invoiceBalance(
                                                        invoice
                                                    ),
                                                    invoice
                                                        .currency_code
                                                )}
                                            </option>
                                        )
                                    )}
                                </select>
                            )}
                        </section>

                        {selectedInvoice && (
                            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Selected Invoice
                                        </p>

                                        <p className="mt-1 text-lg font-bold text-slate-950">
                                            {
                                                selectedInvoice
                                                    .invoice_number
                                            }
                                        </p>

                                        <p className="mt-1 text-sm text-slate-600">
                                            {selectedInvoice
                                                .tenant
                                                ?.display_name ||
                                                "Unknown tenant"}
                                            {" · "}
                                            {selectedInvoice
                                                .owner
                                                ?.display_name ||
                                                "Unknown owner"}
                                        </p>
                                    </div>

                                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                                        {String(
                                            selectedInvoice
                                                .status ||
                                            ""
                                        ).replaceAll(
                                            "_",
                                            " "
                                        )}
                                    </span>
                                </div>

                                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                            Total
                                        </p>

                                        <p className="mt-1 text-sm font-bold text-slate-900">
                                            {formatMoney(
                                                invoiceTotal(
                                                    selectedInvoice
                                                ),
                                                selectedInvoice
                                                    .currency_code
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                            Balance
                                        </p>

                                        <p className="mt-1 text-sm font-bold text-rose-700">
                                            {formatMoney(
                                                balance,
                                                selectedInvoice
                                                    .currency_code
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                            Due Date
                                        </p>

                                        <p className="mt-1 text-sm font-semibold text-slate-900">
                                            {formatDate(
                                                selectedInvoice
                                                    .due_date
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </section>
                        )}

                        <div className="grid gap-5 md:grid-cols-2">
                            <label className="block">
                                <span className="text-sm font-semibold text-slate-800">
                                    Amount
                                </span>

                                <div className="mt-2 flex rounded-xl border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                                    <span className="flex items-center border-r border-slate-200 px-3 text-xs font-semibold text-slate-500">
                                        {selectedInvoice
                                            ?.currency_code ||
                                            "—"}
                                    </span>

                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={
                                            amount
                                        }
                                        disabled={
                                            !selectedInvoice ||
                                            submitting
                                        }
                                        onChange={
                                            event =>
                                                setAmount(
                                                    event
                                                        .target
                                                        .value
                                                )
                                        }
                                        placeholder="0.00"
                                        className="min-w-0 flex-1 rounded-r-xl px-3 py-2.5 text-sm text-slate-900 outline-none disabled:bg-slate-50"
                                    />
                                </div>

                                {selectedInvoice && (
                                    <p className="mt-1.5 text-xs text-slate-500">
                                        Maximum:{" "}
                                        {formatMoney(
                                            balance,
                                            selectedInvoice
                                                .currency_code
                                        )}
                                    </p>
                                )}
                            </label>

                            <label className="block">
                                <span className="text-sm font-semibold text-slate-800">
                                    Payment Method
                                </span>

                                <select
                                    value={
                                        paymentMethod
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            setPaymentMethod(
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                                >
                                    {PAYMENT_METHODS.map(
                                        method => (
                                            <option
                                                key={
                                                    method.value
                                                }
                                                value={
                                                    method.value
                                                }
                                            >
                                                {
                                                    method.label
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="block">
                                <span className="text-sm font-semibold text-slate-800">
                                    Payment Date & Time
                                </span>

                                <input
                                    type="datetime-local"
                                    step="1"
                                    value={
                                        paidAt
                                    }
                                    max={
                                        toLocalDateTimeInput(
                                            new Date()
                                        )
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            setPaidAt(
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                                />

                                <p className="mt-1.5 text-xs text-slate-500">
                                    Cannot be before invoice issue time or in the future.
                                </p>
                            </label>

                            <label className="block">
                                <span className="text-sm font-semibold text-slate-800">
                                    Transaction Reference
                                    {referenceRequired && (
                                        <span className="text-rose-600">
                                            {" "}
                                            *
                                        </span>
                                    )}
                                </span>

                                <input
                                    type="text"
                                    value={
                                        transactionReference
                                    }
                                    maxLength={150}
                                    disabled={
                                        submitting ||
                                        !referenceRequired
                                    }
                                    onChange={
                                        event =>
                                            setTransactionReference(
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    placeholder={
                                        referenceRequired
                                            ? "Bank / mobile money / card / cheque reference"
                                            : "Not required for this method"
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
                                />
                            </label>
                        </div>

                        <label className="block">
                            <span className="text-sm font-semibold text-slate-800">
                                Notes
                            </span>

                            <textarea
                                rows={4}
                                value={notes}
                                maxLength={1000}
                                disabled={
                                    submitting
                                }
                                onChange={
                                    event =>
                                        setNotes(
                                            event
                                                .target
                                                .value
                                        )
                                }
                                placeholder="Optional payment note..."
                                className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                            />

                            <p className="mt-1.5 text-right text-xs text-slate-400">
                                {notes.length}/1000
                            </p>
                        </label>

                        <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

                            <p>
                                Successful submission creates a completed payment, receipt number and invoice allocation. The invoice balance/status is synchronized by the backend.
                            </p>
                        </div>
                    </div>

                    <div className="sticky bottom-0 flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={
                                submitting
                            }
                            onClick={
                                closeModal
                            }
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            disabled={
                                submitting ||
                                loadingInvoices ||
                                !selectedInvoice
                            }
                        >
                            {submitting
                                ? "Recording..."
                                : "Record Payment"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default RecordPaymentModal;

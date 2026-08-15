import {
    Banknote,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    Eye,
    Plus,
    RefreshCw,
    Search,
    WalletCards
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import RecordPaymentModal from "./RecordPaymentModal";
import PaymentDetailModal from "./PaymentDetailModal";

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

const PAYMENT_STATUS_LABELS = {
    completed: "Completed",
    reversed: "Reversed"
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load payments.";

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
            minute: "2-digit"
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

const normalizePaymentsResponse = response => {
    const body =
        response?.data || {};

    const data =
        body?.data || {};

    const payments =
        Array.isArray(
            data.payments
        )
            ? data.payments
            : Array.isArray(
                body.payments
            )
                ? body.payments
                : [];

    const pagination =
        body.pagination ||
        data.pagination ||
        {};

    return {
        payments,
        pagination: {
            page:
                Number(
                    pagination.page
                ) || 1,
            limit:
                Number(
                    pagination.limit
                ) || 20,
            total_items:
                Number(
                    pagination.total_items ??
                    pagination.total ??
                    body.count ??
                    payments.length
                ) || 0,
            total_pages:
                Number(
                    pagination.total_pages
                ) || 0
        }
    };
};

function PaymentsPage() {
    const [
        recordModalOpen,
        setRecordModalOpen
    ] = useState(false);

    const [
        selectedPayment,
        setSelectedPayment
    ] = useState(null);

    const [
        payments,
        setPayments
    ] = useState([]);

    const [
        pagination,
        setPagination
    ] = useState({
        page: 1,
        limit: 20,
        total_items: 0,
        total_pages: 0
    });

    const [
        loading,
        setLoading
    ] = useState(true);

    const [
        error,
        setError
    ] = useState("");

    const [
        searchInput,
        setSearchInput
    ] = useState("");

    const [
        search,
        setSearch
    ] = useState("");

    const [
        status,
        setStatus
    ] = useState("");

    const [
        paymentMethod,
        setPaymentMethod
    ] = useState("");

    const [
        paidAtFrom,
        setPaidAtFrom
    ] = useState("");

    const [
        paidAtTo,
        setPaidAtTo
    ] = useState("");

    const loadPayments =
        useCallback(
            async ({
                page =
                    pagination.page
            } = {}) => {
                try {
                    setLoading(true);
                    setError("");

                    const params = {
                        page,
                        limit:
                            pagination.limit
                    };

                    if (search) {
                        params.search =
                            search;
                    }

                    if (status) {
                        params.status =
                            status;
                    }

                    if (paymentMethod) {
                        params.payment_method =
                            paymentMethod;
                    }

                    if (paidAtFrom) {
                        params.paid_at_from =
                            paidAtFrom;
                    }

                    if (paidAtTo) {
                        params.paid_at_to =
                            paidAtTo;
                    }

                    const response =
                        await apiClient.get(
                            "/payments",
                            {
                                params
                            }
                        );

                    const normalized =
                        normalizePaymentsResponse(
                            response
                        );

                    setPayments(
                        normalized.payments
                    );

                    setPagination(
                        normalized.pagination
                    );
                } catch (
                    requestError
                ) {
                    setPayments([]);
                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            [
                pagination.limit,
                pagination.page,
                search,
                status,
                paymentMethod,
                paidAtFrom,
                paidAtTo
            ]
        );

    useEffect(() => {
        loadPayments({
            page: 1
        });
    }, [
        search,
        status,
        paymentMethod,
        paidAtFrom,
        paidAtTo
    ]);

    const submitSearch =
        event => {
            event.preventDefault();
            setSearch(
                searchInput.trim()
            );
        };

    const clearFilters = () => {
        setSearchInput("");
        setSearch("");
        setStatus("");
        setPaymentMethod("");
        setPaidAtFrom("");
        setPaidAtTo("");
    };

    const currentPageCompleted =
        useMemo(
            () =>
                payments.filter(
                    payment =>
                        payment.status ===
                        "completed"
                ).length,
            [
                payments
            ]
        );

    const currentPageReversed =
        useMemo(
            () =>
                payments.filter(
                    payment =>
                        payment.status ===
                        "reversed"
                ).length,
            [
                payments
            ]
        );

    const totalPages =
        pagination.total_pages;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <WalletCards className="h-5 w-5" />
                        </div>

                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">
                                Payments & Receipts
                            </h1>

                            <p className="mt-1 text-sm text-slate-500">
                                View rent payments, receipt numbers and invoice allocations.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        leftIcon={Plus}
                        onClick={() =>
                            setRecordModalOpen(
                                true
                            )
                        }
                    >
                        Record Payment
                    </Button>

                    <Button
                        type="button"
                        variant="secondary"
                        leftIcon={RefreshCw}
                        disabled={loading}
                        onClick={() =>
                            loadPayments({
                                page:
                                    pagination.page
                            })
                        }
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <Banknote className="h-5 w-5" />
                        </div>

                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                Total Records
                            </p>

                            <p className="mt-1 text-2xl font-bold text-slate-950">
                                {pagination.total_items}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Completed on this page
                    </p>

                    <p className="mt-2 text-2xl font-bold text-emerald-700">
                        {currentPageCompleted}
                    </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Reversed on this page
                    </p>

                    <p className="mt-2 text-2xl font-bold text-rose-700">
                        {currentPageReversed}
                    </p>
                </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <form
                    onSubmit={
                        submitSearch
                    }
                    className="grid gap-4 xl:grid-cols-[minmax(260px,1.4fr)_repeat(4,minmax(150px,1fr))_auto]"
                >
                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Search
                        </span>

                        <div className="relative mt-2">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                            <input
                                type="text"
                                value={
                                    searchInput
                                }
                                maxLength={100}
                                onChange={
                                    event =>
                                        setSearchInput(
                                            event
                                                .target
                                                .value
                                        )
                                }
                                placeholder="Payment, receipt, transaction, owner, tenant..."
                                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Status
                        </span>

                        <select
                            value={status}
                            onChange={
                                event =>
                                    setStatus(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">
                                All statuses
                            </option>

                            <option value="completed">
                                Completed
                            </option>

                            <option value="reversed">
                                Reversed
                            </option>
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Method
                        </span>

                        <select
                            value={
                                paymentMethod
                            }
                            onChange={
                                event =>
                                    setPaymentMethod(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">
                                All methods
                            </option>

                            {Object.entries(
                                PAYMENT_METHOD_LABELS
                            ).map(
                                ([
                                    value,
                                    label
                                ]) => (
                                    <option
                                        key={
                                            value
                                        }
                                        value={
                                            value
                                        }
                                    >
                                        {
                                            label
                                        }
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Paid From
                        </span>

                        <input
                            type="date"
                            value={
                                paidAtFrom
                            }
                            onChange={
                                event =>
                                    setPaidAtFrom(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Paid To
                        </span>

                        <input
                            type="date"
                            value={
                                paidAtTo
                            }
                            min={
                                paidAtFrom ||
                                undefined
                            }
                            onChange={
                                event =>
                                    setPaidAtTo(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>

                    <div className="flex items-end gap-2">
                        <Button
                            type="submit"
                            disabled={loading}
                        >
                            Search
                        </Button>

                        <Button
                            type="button"
                            variant="secondary"
                            disabled={loading}
                            onClick={
                                clearFilters
                            }
                        >
                            Clear
                        </Button>
                    </div>
                </form>
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Payment
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Receipt
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Tenant / Owner
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Invoice
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Method
                                </th>

                                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Amount
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Status
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Paid At
                                </th>

                                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="px-5 py-12 text-center text-sm text-slate-500"
                                    >
                                        Loading payments...
                                    </td>
                                </tr>
                            ) : payments.length ===
                                0 ? (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="px-5 py-12 text-center"
                                    >
                                        <CreditCard className="mx-auto h-8 w-8 text-slate-300" />

                                        <p className="mt-3 text-sm font-semibold text-slate-700">
                                            No payments found.
                                        </p>

                                        <p className="mt-1 text-sm text-slate-500">
                                            Try changing the search or filters.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                payments.map(
                                    payment => {
                                        const allocation =
                                            Array.isArray(
                                                payment.allocations
                                            )
                                                ? payment
                                                    .allocations[0]
                                                : null;

                                        const invoice =
                                            allocation
                                                ?.invoice ||
                                            null;

                                        return (
                                            <tr
                                                key={
                                                    payment.public_id
                                                }
                                                className="align-top hover:bg-slate-50/70"
                                            >
                                                <td className="px-5 py-4">
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {
                                                            payment.payment_number
                                                        }
                                                    </p>

                                                    {payment.transaction_reference && (
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            Ref:{" "}
                                                            {
                                                                payment.transaction_reference
                                                            }
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <p className="text-sm font-medium text-slate-800">
                                                        {
                                                            payment.receipt_number
                                                        }
                                                    </p>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {payment
                                                            .tenant
                                                            ?.display_name ||
                                                            "—"}
                                                    </p>

                                                    <p className="mt-1 text-xs text-slate-500">
                                                        Owner:{" "}
                                                        {payment
                                                            .owner
                                                            ?.display_name ||
                                                            "—"}
                                                    </p>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <p className="text-sm font-medium text-slate-800">
                                                        {invoice
                                                            ?.invoice_number ||
                                                            "—"}
                                                    </p>

                                                    {Array.isArray(
                                                        payment.allocations
                                                    ) &&
                                                        payment.allocations.length >
                                                            1 && (
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            +
                                                            {payment.allocations.length -
                                                                1}{" "}
                                                            more allocation(s)
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <p className="text-sm text-slate-700">
                                                        {PAYMENT_METHOD_LABELS[
                                                            payment
                                                                .payment_method
                                                        ] ||
                                                            payment
                                                                .payment_method ||
                                                            "—"}
                                                    </p>
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <p className="whitespace-nowrap text-sm font-bold text-slate-950">
                                                        {formatMoney(
                                                            payment.amount,
                                                            payment.currency_code
                                                        )}
                                                    </p>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                                                            payment.status
                                                        )}`}
                                                    >
                                                        {PAYMENT_STATUS_LABELS[
                                                            payment
                                                                .status
                                                        ] ||
                                                            payment
                                                                .status ||
                                                            "Unknown"}
                                                    </span>

                                                    {payment.status ===
                                                        "reversed" &&
                                                        payment.reversal_reason && (
                                                        <p className="mt-2 max-w-[220px] text-xs leading-5 text-slate-500">
                                                            {
                                                                payment.reversal_reason
                                                            }
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <p className="whitespace-nowrap text-sm text-slate-700">
                                                        {formatDateTime(
                                                            payment.paid_at
                                                        )}
                                                    </p>

                                                    {payment.reversed_at && (
                                                        <p className="mt-1 whitespace-nowrap text-xs text-rose-600">
                                                            Reversed:{" "}
                                                            {formatDateTime(
                                                                payment.reversed_at
                                                            )}
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        leftIcon={Eye}
                                                        onClick={() =>
                                                            setSelectedPayment(
                                                                payment
                                                            )
                                                        }
                                                    >
                                                        View
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    }
                                )
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                        Page{" "}
                        <span className="font-semibold text-slate-800">
                            {pagination.page}
                        </span>
                        {totalPages > 0 && (
                            <>
                                {" "}
                                of{" "}
                                <span className="font-semibold text-slate-800">
                                    {totalPages}
                                </span>
                            </>
                        )}
                        {" · "}
                        {pagination.total_items}{" "}
                        total payment(s)
                    </p>

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={
                                ChevronLeft
                            }
                            disabled={
                                loading ||
                                pagination.page <=
                                    1
                            }
                            onClick={() =>
                                loadPayments({
                                    page:
                                        pagination.page -
                                        1
                                })
                            }
                        >
                            Previous
                        </Button>

                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={
                                ChevronRight
                            }
                            disabled={
                                loading ||
                                totalPages === 0 ||
                                pagination.page >=
                                    totalPages
                            }
                            onClick={() =>
                                loadPayments({
                                    page:
                                        pagination.page +
                                        1
                                })
                            }
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>

            <PaymentDetailModal
                payment={selectedPayment}
                open={
                    selectedPayment !== null
                }
                onClose={() =>
                    setSelectedPayment(
                        null
                    )
                }
                onChanged={async () => {
                    setSelectedPayment(
                        null
                    );

                    await loadPayments({
                        page:
                            pagination.page
                    });
                }}
            />

            <RecordPaymentModal
                open={recordModalOpen}
                onClose={() =>
                    setRecordModalOpen(
                        false
                    )
                }
                onRecorded={async () => {
                    setRecordModalOpen(
                        false
                    );

                    await loadPayments({
                        page: 1
                    });
                }}
            />
        </div>
    );
}

export default PaymentsPage;

import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Eye,
    FileText,
    Plus,
    RefreshCw,
    Search,
    SlidersHorizontal
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button,
    IconButton
} from "../../components/ui/Button";

import CreateInvoiceModal from "./CreateInvoiceModal";
import InvoiceDetailModal from "./InvoiceDetailModal";

const INVOICE_STATUSES = [
    ["", "All statuses"],
    ["draft", "Draft"],
    ["issued", "Issued"],
    ["partially_paid", "Partially Paid"],
    ["paid", "Paid"],
    ["overdue", "Overdue"],
    ["void", "Void"]
];

const EMPTY_PAGINATION = {
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
    has_next_page: false,
    has_previous_page: false
};

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

const formatMoney = (
    value,
    currencyCode
) => {
    const amount = Number(value);

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

const dateOnly = value => {
    if (!value) {
        return "";
    }

    const stringValue =
        String(value);

    if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            stringValue
        )
    ) {
        return stringValue;
    }

    const parsed =
        new Date(stringValue);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return stringValue.slice(
            0,
            10
        );
    }

    const year =
        parsed.getFullYear();

    const month =
        String(
            parsed.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            parsed.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const formatDate = value => {
    const normalized =
        dateOnly(value);

    if (!normalized) {
        return "—";
    }

    const parsed =
        new Date(
            `${normalized}T00:00:00`
        );

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return normalized;
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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load invoices.";

const statusClassName = status => {
    switch (status) {
        case "draft":
            return "bg-slate-100 text-slate-700 ring-slate-200";

        case "issued":
            return "bg-blue-50 text-blue-700 ring-blue-200";

        case "partially_paid":
            return "bg-amber-50 text-amber-700 ring-amber-200";

        case "paid":
            return "bg-emerald-50 text-emerald-700 ring-emerald-200";

        case "overdue":
            return "bg-orange-50 text-orange-700 ring-orange-200";

        case "void":
            return "bg-rose-50 text-rose-700 ring-rose-200";

        default:
            return "bg-slate-100 text-slate-600 ring-slate-200";
    }
};

function InvoicesPage() {
    const [
        invoices,
        setInvoices
    ] = useState([]);

    const [
        createOpen,
        setCreateOpen
    ] = useState(false);

    const [
        createSuccess,
        setCreateSuccess
    ] = useState("");

    const [
        detailInvoicePublicId,
        setDetailInvoicePublicId
    ] = useState("");

    const [
        detailOpen,
        setDetailOpen
    ] = useState(false);

    const [
        pagination,
        setPagination
    ] = useState(
        EMPTY_PAGINATION
    );

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
        dueDateFrom,
        setDueDateFrom
    ] = useState("");

    const [
        dueDateTo,
        setDueDateTo
    ] = useState("");

    const [
        page,
        setPage
    ] = useState(1);

    const limit = 20;

    const loadInvoices =
        useCallback(
            async () => {
                try {
                    setLoading(true);
                    setError("");

                    const params = {
                        page,
                        limit
                    };

                    if (search) {
                        params.search =
                            search;
                    }

                    if (status) {
                        params.status =
                            status;
                    }

                    if (dueDateFrom) {
                        params.due_date_from =
                            dueDateFrom;
                    }

                    if (dueDateTo) {
                        params.due_date_to =
                            dueDateTo;
                    }

                    const response =
                        await apiClient.get(
                            "/invoices",
                            {
                                params
                            }
                        );

                    const receivedInvoices =
                        response?.data?.data
                            ?.invoices;

                    setInvoices(
                        Array.isArray(
                            receivedInvoices
                        )
                            ? receivedInvoices
                            : []
                    );

                    const receivedPagination =
                        response?.data
                            ?.pagination ||
                        {};

                    const totalPages =
                        Math.max(
                            1,
                            Number(
                                receivedPagination
                                    .total_pages
                            ) || 0
                        );

                    setPagination({
                        ...EMPTY_PAGINATION,
                        ...receivedPagination,
                        page:
                            Number(
                                receivedPagination
                                    .page
                            ) || page,
                        limit:
                            Number(
                                receivedPagination
                                    .limit
                            ) || limit,
                        total:
                            Number(
                                receivedPagination
                                    .total
                            ) || 0,
                        total_pages:
                            totalPages,
                        has_next_page:
                            Boolean(
                                receivedPagination
                                    .has_next_page
                            ),
                        has_previous_page:
                            Boolean(
                                receivedPagination
                                    .has_previous_page
                            )
                    });
                } catch (
                    requestError
                ) {
                    setInvoices([]);
                    setPagination(
                        EMPTY_PAGINATION
                    );
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
                page,
                search,
                status,
                dueDateFrom,
                dueDateTo
            ]
        );

    useEffect(() => {
        loadInvoices();
    }, [loadInvoices]);

    const handleInvoiceCreated =
        async data => {
            const createdInvoice =
                data?.invoice || null;

            setCreateOpen(false);
            setCreateSuccess(
                createdInvoice
                    ?.invoice_number
                    ? `Draft invoice ${createdInvoice.invoice_number} created successfully.`
                    : "Draft invoice created successfully."
            );

            setPage(1);
            await loadInvoices();
        };

    const openInvoiceDetail =
        invoicePublicId => {
            setDetailInvoicePublicId(
                invoicePublicId
            );
            setDetailOpen(true);
        };

    const submitFilters =
        event => {
            event.preventDefault();

            setPage(1);
            setSearch(
                searchInput.trim()
            );
        };

    const resetFilters = () => {
        setSearchInput("");
        setSearch("");
        setStatus("");
        setDueDateFrom("");
        setDueDateTo("");
        setPage(1);
    };

    const filterCount =
        useMemo(
            () =>
                [
                    search,
                    status,
                    dueDateFrom,
                    dueDateTo
                ].filter(Boolean)
                    .length,
            [
                search,
                status,
                dueDateFrom,
                dueDateTo
            ]
        );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <FileText className="h-5 w-5" />
                    </div>

                    <div>
                        <h1 className="text-2xl font-bold text-slate-950">
                            Invoices
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            View rent invoices and their current billing and payment status.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <IconButton
                        label="Refresh invoices"
                        icon={RefreshCw}
                        disabled={loading}
                        onClick={loadInvoices}
                    />

                    <Button
                        type="button"
                        leftIcon={Plus}
                        onClick={() => {
                            setCreateSuccess("");
                            setCreateOpen(true);
                        }}
                    >
                        Add Draft Invoice
                    </Button>
                </div>
            </div>

            {createSuccess && (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                >
                    {createSuccess}
                </div>
            )}

            <form
                onSubmit={submitFilters}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
                <div className="mb-4 flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-slate-500" />

                    <p className="text-sm font-semibold text-slate-800">
                        Filters
                    </p>

                    {filterCount > 0 && (
                        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            {filterCount}
                        </span>
                    )}
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-slate-600">
                            Search
                        </span>

                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                            <input
                                type="search"
                                value={searchInput}
                                onChange={event =>
                                    setSearchInput(
                                        event.target
                                            .value
                                    )
                                }
                                placeholder="Invoice, tenant, lease..."
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-slate-600">
                            Status
                        </span>

                        <select
                            value={status}
                            onChange={event => {
                                setStatus(
                                    event.target
                                        .value
                                );
                                setPage(1);
                            }}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                            {INVOICE_STATUSES.map(
                                ([
                                    value,
                                    label
                                ]) => (
                                    <option
                                        key={
                                            value ||
                                            "all"
                                        }
                                        value={
                                            value
                                        }
                                    >
                                        {label}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-slate-600">
                            Due date from
                        </span>

                        <div className="relative">
                            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                            <input
                                type="date"
                                value={dueDateFrom}
                                max={
                                    dueDateTo ||
                                    undefined
                                }
                                onChange={event => {
                                    setDueDateFrom(
                                        event.target
                                            .value
                                    );
                                    setPage(1);
                                }}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-slate-600">
                            Due date to
                        </span>

                        <div className="relative">
                            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                            <input
                                type="date"
                                value={dueDateTo}
                                min={
                                    dueDateFrom ||
                                    undefined
                                }
                                onChange={event => {
                                    setDueDateTo(
                                        event.target
                                            .value
                                    );
                                    setPage(1);
                                }}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={loading}
                        onClick={resetFilters}
                    >
                        Clear
                    </Button>

                    <Button
                        type="submit"
                        leftIcon={Search}
                        loading={loading}
                    >
                        Search
                    </Button>
                </div>
            </form>

            {error && (
                <div
                    role="alert"
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                >
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">
                            Invoice Register
                        </h2>

                        <p className="mt-1 text-xs text-slate-500">
                            {pagination.total} invoice
                            {pagination.total === 1
                                ? ""
                                : "s"}{" "}
                            found
                        </p>
                    </div>

                    <p className="text-xs text-slate-500">
                        Page {pagination.page} of{" "}
                        {pagination.total_pages}
                    </p>
                </div>

                {loading ? (
                    <div className="px-5 py-16 text-center">
                        <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-600" />

                        <p className="mt-3 text-sm font-medium text-slate-700">
                            Loading invoices...
                        </p>
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="px-5 py-16 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                            <FileText className="h-5 w-5" />
                        </div>

                        <p className="mt-3 text-sm font-semibold text-slate-800">
                            No invoices found
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                            Adjust the filters or create a new draft invoice.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="min-w-full">
                                <thead className="bg-slate-50">
                                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        <th className="px-5 py-3">
                                            Invoice
                                        </th>
                                        <th className="px-4 py-3">
                                            Tenant / Lease
                                        </th>
                                        <th className="px-4 py-3">
                                            Property / Unit
                                        </th>
                                        <th className="px-4 py-3">
                                            Billing Period
                                        </th>
                                        <th className="px-4 py-3">
                                            Due Date
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Total
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Balance
                                        </th>
                                        <th className="px-5 py-3">
                                            Status
                                        </th>
                                        <th className="px-5 py-3 text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {invoices.map(
                                        invoice => (
                                            <tr
                                                key={
                                                    invoice.public_id
                                                }
                                                className="transition hover:bg-slate-50/80"
                                            >
                                                <td className="px-5 py-4">
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {invoice.invoice_number ||
                                                            "—"}
                                                    </p>

                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {Number(
                                                            invoice.item_count
                                                        ) || 0}{" "}
                                                        item
                                                        {Number(
                                                            invoice.item_count
                                                        ) ===
                                                        1
                                                            ? ""
                                                            : "s"}
                                                    </p>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <p className="max-w-[220px] truncate text-sm font-medium text-slate-800">
                                                        {invoice
                                                            .tenant
                                                            ?.display_name ||
                                                            "—"}
                                                    </p>

                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {invoice
                                                            .lease
                                                            ?.lease_number ||
                                                            "No lease reference"}
                                                    </p>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <p className="max-w-[220px] truncate text-sm text-slate-700">
                                                        {invoice
                                                            .property
                                                            ?.property_name ||
                                                            "—"}
                                                    </p>

                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {invoice
                                                            .unit
                                                            ?.unit_name ||
                                                            invoice
                                                                .unit
                                                                ?.unit_code ||
                                                            "No unit"}
                                                    </p>
                                                </td>

                                                <td className="px-4 py-4 text-sm text-slate-700">
                                                    <p>
                                                        {formatDate(
                                                            invoice.billing_period_start
                                                        )}
                                                    </p>

                                                    <p className="mt-1 text-xs text-slate-500">
                                                        to{" "}
                                                        {formatDate(
                                                            invoice.billing_period_end
                                                        )}
                                                    </p>
                                                </td>

                                                <td className="px-4 py-4 text-sm text-slate-700">
                                                    {formatDate(
                                                        invoice.due_date
                                                    )}
                                                </td>

                                                <td className="px-4 py-4 text-right text-sm font-medium text-slate-800">
                                                    {formatMoney(
                                                        invoice
                                                            .financial_summary
                                                            ?.total_amount,
                                                        invoice.currency_code
                                                    )}
                                                </td>

                                                <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">
                                                    {formatMoney(
                                                        invoice
                                                            .financial_summary
                                                            ?.balance_amount,
                                                        invoice.currency_code
                                                    )}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClassName(
                                                            invoice.status
                                                        )}`}
                                                    >
                                                        {formatLabel(
                                                            invoice.status
                                                        )}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        leftIcon={Eye}
                                                        onClick={() =>
                                                            openInvoiceDetail(
                                                                invoice.public_id
                                                            )
                                                        }
                                                    >
                                                        View
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="divide-y divide-slate-100 lg:hidden">
                            {invoices.map(
                                invoice => (
                                    <article
                                        key={
                                            invoice.public_id
                                        }
                                        className="space-y-4 p-5"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-slate-900">
                                                    {invoice.invoice_number ||
                                                        "—"}
                                                </p>

                                                <p className="mt-1 truncate text-xs text-slate-500">
                                                    {invoice
                                                        .tenant
                                                        ?.display_name ||
                                                        "No tenant"}
                                                </p>
                                            </div>

                                            <span
                                                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClassName(
                                                    invoice.status
                                                )}`}
                                            >
                                                {formatLabel(
                                                    invoice.status
                                                )}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-xs text-slate-500">
                                                    Lease
                                                </p>

                                                <p className="mt-1 text-sm font-medium text-slate-800">
                                                    {invoice
                                                        .lease
                                                        ?.lease_number ||
                                                        "—"}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-slate-500">
                                                    Due Date
                                                </p>

                                                <p className="mt-1 text-sm font-medium text-slate-800">
                                                    {formatDate(
                                                        invoice.due_date
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-slate-500">
                                                    Total
                                                </p>

                                                <p className="mt-1 text-sm font-medium text-slate-800">
                                                    {formatMoney(
                                                        invoice
                                                            .financial_summary
                                                            ?.total_amount,
                                                        invoice.currency_code
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-slate-500">
                                                    Balance
                                                </p>

                                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                                    {formatMoney(
                                                        invoice
                                                            .financial_summary
                                                            ?.balance_amount,
                                                        invoice.currency_code
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                                            <p className="text-xs text-slate-500">
                                                Property / Unit
                                            </p>

                                            <p className="mt-1 text-sm text-slate-700">
                                                {[
                                                    invoice
                                                        .property
                                                        ?.property_name,
                                                    invoice
                                                        .unit
                                                        ?.unit_name ||
                                                        invoice
                                                            .unit
                                                            ?.unit_code
                                                ]
                                                    .filter(
                                                        Boolean
                                                    )
                                                    .join(
                                                        " • "
                                                    ) ||
                                                    "—"}
                                            </p>
                                        </div>

                                        <Button
                                            type="button"
                                            variant="secondary"
                                            leftIcon={Eye}
                                            className="w-full"
                                            onClick={() =>
                                                openInvoiceDetail(
                                                    invoice.public_id
                                                )
                                            }
                                        >
                                            View Invoice
                                        </Button>
                                    </article>
                                )
                            )}
                        </div>
                    </>
                )}

                <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
                    <p className="text-xs text-slate-500">
                        Showing page{" "}
                        {pagination.page} of{" "}
                        {pagination.total_pages}
                    </p>

                    <div className="flex items-center gap-2">
                        <IconButton
                            label="Previous page"
                            icon={ChevronLeft}
                            disabled={
                                loading ||
                                page <= 1
                            }
                            onClick={() =>
                                setPage(
                                    current =>
                                        Math.max(
                                            1,
                                            current -
                                                1
                                        )
                                )
                            }
                        />

                        <IconButton
                            label="Next page"
                            icon={ChevronRight}
                            disabled={
                                loading ||
                                page >=
                                    pagination.total_pages
                            }
                            onClick={() =>
                                setPage(
                                    current =>
                                        Math.min(
                                            pagination.total_pages,
                                            current +
                                                1
                                        )
                                )
                            }
                        />
                    </div>
                </div>
            </div>

            <CreateInvoiceModal
                open={createOpen}
                onClose={() =>
                    setCreateOpen(false)
                }
                onCreated={
                    handleInvoiceCreated
                }
            />

            <InvoiceDetailModal
                open={detailOpen}
                invoicePublicId={
                    detailInvoicePublicId
                }
                onClose={() => {
                    setDetailOpen(false);
                    setDetailInvoicePublicId(
                        ""
                    );
                }}
                onInvoiceChanged={
                    loadInvoices
                }
            />
        </div>
    );
}

export default InvoicesPage;

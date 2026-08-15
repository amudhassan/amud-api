import {
    AlertCircle,
    Building2,
    CalendarDays,
    FileText,
    Home,
    Pencil,
    Plus,
    RefreshCw,
    Trash2,
    UserRound,
    WalletCards,
    X
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button,
    IconButton
} from "../../components/ui/Button";

import AddInvoiceItemModal from "./AddInvoiceItemModal";
import EditInvoiceItemModal from "./EditInvoiceItemModal";
import DeleteInvoiceItemModal from "./DeleteInvoiceItemModal";
import EditInvoiceModal from "./EditInvoiceModal";
import IssueInvoiceModal from "./IssueInvoiceModal";
import VoidInvoiceModal from "./VoidInvoiceModal";

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

const formatDateTime = value => {
    if (!value) {
        return "—";
    }

    const parsed = new Date(value);

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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load invoice details.";

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

function InfoCard({
    icon: Icon,
    label,
    primary,
    secondary
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {label}
                    </p>

                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                        {primary || "—"}
                    </p>

                    {secondary && (
                        <p className="mt-1 text-xs text-slate-500">
                            {secondary}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function InvoiceDetailModal({
    open,
    invoicePublicId,
    onClose,
    onInvoiceChanged
}) {
    const [
        invoice,
        setInvoice
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
        editInvoiceOpen,
        setEditInvoiceOpen
    ] = useState(false);

    const [
        issueInvoiceOpen,
        setIssueInvoiceOpen
    ] = useState(false);

    const [
        voidInvoiceOpen,
        setVoidInvoiceOpen
    ] = useState(false);

    const [
        addItemOpen,
        setAddItemOpen
    ] = useState(false);

    const [
        editItemOpen,
        setEditItemOpen
    ] = useState(false);

    const [
        deleteItemOpen,
        setDeleteItemOpen
    ] = useState(false);

    const [
        selectedItem,
        setSelectedItem
    ] = useState(null);

    const [
        itemSuccess,
        setItemSuccess
    ] = useState("");

    const loadInvoice =
        useCallback(
            async () => {
                if (
                    !open ||
                    !invoicePublicId
                ) {
                    return;
                }

                try {
                    setLoading(true);
                    setError("");

                    const response =
                        await apiClient.get(
                            `/invoices/${encodeURIComponent(
                                invoicePublicId
                            )}`
                        );

                    const receivedInvoice =
                        response?.data?.data
                            ?.invoice;

                    if (!receivedInvoice) {
                        throw new Error(
                            "Invoice details were not returned by the server."
                        );
                    }

                    setInvoice(
                        receivedInvoice
                    );
                } catch (
                    requestError
                ) {
                    setInvoice(null);
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
                open,
                invoicePublicId
            ]
        );

    useEffect(() => {
        if (open) {
            loadInvoice();
        } else {
            setInvoice(null);
            setError("");
            setEditInvoiceOpen(false);
            setIssueInvoiceOpen(false);
            setVoidInvoiceOpen(false);
            setAddItemOpen(false);
            setEditItemOpen(false);
            setDeleteItemOpen(false);
            setSelectedItem(null);
            setItemSuccess("");
        }
    }, [
        open,
        loadInvoice
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !editInvoiceOpen &&
                !issueInvoiceOpen &&
                !voidInvoiceOpen &&
                !addItemOpen &&
                !editItemOpen &&
                !deleteItemOpen
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
        onClose,
        editInvoiceOpen,
        issueInvoiceOpen,
        voidInvoiceOpen,
        addItemOpen,
        editItemOpen,
        deleteItemOpen
    ]);

    const handleInvoiceUpdated =
        async data => {
            const updatedInvoice =
                data?.invoice || null;

            setEditInvoiceOpen(false);
            setItemSuccess(
                updatedInvoice?.invoice_number
                    ? `${updatedInvoice.invoice_number} updated successfully.`
                    : "Draft invoice updated successfully."
            );

            await loadInvoice();
            await onInvoiceChanged?.();
        };

    const handleInvoiceIssued =
        async data => {
            const issuedInvoice =
                data?.invoice || null;

            setIssueInvoiceOpen(false);
            setItemSuccess(
                issuedInvoice?.invoice_number
                    ? `${issuedInvoice.invoice_number} issued successfully.`
                    : "Invoice issued successfully."
            );

            await loadInvoice();
            await onInvoiceChanged?.();
        };

    const handleInvoiceVoided =
        async data => {
            const voidedInvoice =
                data?.invoice || null;

            setVoidInvoiceOpen(false);
            setItemSuccess(
                voidedInvoice?.invoice_number
                    ? `${voidedInvoice.invoice_number} voided successfully.`
                    : "Invoice voided successfully."
            );

            await loadInvoice();
            await onInvoiceChanged?.();
        };

    const handleItemAdded =
        async data => {
            const addedItem =
                data?.item || null;

            setAddItemOpen(false);
            setItemSuccess(
                addedItem?.description
                    ? `Invoice item “${addedItem.description}” added successfully.`
                    : "Invoice item added successfully."
            );

            await loadInvoice();
            await onInvoiceChanged?.();
        };

    const handleItemUpdated =
        async data => {
            const updatedItem =
                data?.item || null;

            setEditItemOpen(false);
            setSelectedItem(null);
            setItemSuccess(
                updatedItem?.description
                    ? `Invoice item “${updatedItem.description}” updated successfully.`
                    : "Invoice item updated successfully."
            );

            await loadInvoice();
            await onInvoiceChanged?.();
        };

    const handleItemDeleted =
        async data => {
            const deletedItem =
                data?.deletedItem || null;

            setDeleteItemOpen(false);
            setSelectedItem(null);
            setItemSuccess(
                deletedItem?.description
                    ? `Invoice item “${deletedItem.description}” deleted successfully.`
                    : "Invoice item deleted successfully."
            );

            await loadInvoice();
            await onInvoiceChanged?.();
        };

    if (!open) {
        return null;
    }

    const financialSummary =
        invoice?.financial_summary || {};

    const items =
        Array.isArray(invoice?.items)
            ? invoice.items
            : [];

    return (
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[1px] sm:p-5">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="invoice-detail-title"
                className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2
                                id="invoice-detail-title"
                                className="truncate text-lg font-bold text-slate-950 sm:text-xl"
                            >
                                {invoice?.invoice_number ||
                                    "Invoice Detail"}
                            </h2>

                            {invoice?.status && (
                                <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClassName(
                                        invoice.status
                                    )}`}
                                >
                                    {formatLabel(
                                        invoice.status
                                    )}
                                </span>
                            )}
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                            Billing, financial and related lease information.
                        </p>
                    </div>

                    <IconButton
                        label="Close invoice detail"
                        icon={X}
                        onClick={onClose}
                    />
                </div>

                <div className="overflow-y-auto p-5 sm:p-6">
                    {itemSuccess && (
                        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                            {itemSuccess}
                        </div>
                    )}

                    {loading ? (
                        <div className="py-20 text-center">
                            <RefreshCw className="mx-auto h-7 w-7 animate-spin text-blue-600" />

                            <p className="mt-3 text-sm font-medium text-slate-700">
                                Loading invoice details...
                            </p>
                        </div>
                    ) : error ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

                                <div>
                                    <p className="text-sm font-semibold">
                                        Unable to open invoice
                                    </p>

                                    <p className="mt-1 text-sm">
                                        {error}
                                    </p>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                leftIcon={RefreshCw}
                                className="mt-4"
                                onClick={loadInvoice}
                            >
                                Retry
                            </Button>
                        </div>
                    ) : invoice ? (
                        <div className="space-y-6">
                            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <InfoCard
                                    icon={CalendarDays}
                                    label="Billing Period"
                                    primary={`${formatDate(
                                        invoice.billing_period_start
                                    )} → ${formatDate(
                                        invoice.billing_period_end
                                    )}`}
                                    secondary={`Due ${formatDate(
                                        invoice.due_date
                                    )}`}
                                />

                                <InfoCard
                                    icon={UserRound}
                                    label="Tenant"
                                    primary={
                                        invoice.tenant
                                            ?.display_name
                                    }
                                    secondary={
                                        invoice.tenant
                                            ?.tenant_type
                                            ? formatLabel(
                                                invoice.tenant
                                                    .tenant_type
                                            )
                                            : ""
                                    }
                                />

                                <InfoCard
                                    icon={FileText}
                                    label="Lease"
                                    primary={
                                        invoice.lease
                                            ?.lease_number
                                    }
                                    secondary={
                                        invoice.lease
                                            ?.status
                                            ? formatLabel(
                                                invoice.lease
                                                    .status
                                            )
                                            : ""
                                    }
                                />

                                <InfoCard
                                    icon={Building2}
                                    label="Owner"
                                    primary={
                                        invoice.owner
                                            ?.display_name
                                    }
                                    secondary={
                                        invoice.owner
                                            ?.owner_type
                                            ? formatLabel(
                                                invoice.owner
                                                    .owner_type
                                            )
                                            : ""
                                    }
                                />
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                                <div className="flex items-center gap-2">
                                    <WalletCards className="h-5 w-5 text-blue-600" />

                                    <h3 className="text-sm font-bold text-slate-900">
                                        Financial Summary
                                    </h3>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {[
                                        [
                                            "Subtotal",
                                            financialSummary.subtotal_amount
                                        ],
                                        [
                                            "Discount",
                                            financialSummary.discount_amount
                                        ],
                                        [
                                            "Tax",
                                            financialSummary.tax_amount
                                        ],
                                        [
                                            "Late Fee",
                                            financialSummary.late_fee_amount
                                        ],
                                        [
                                            "Total",
                                            financialSummary.total_amount
                                        ],
                                        [
                                            "Paid",
                                            financialSummary.paid_amount
                                        ],
                                        [
                                            "Balance",
                                            financialSummary.balance_amount
                                        ]
                                    ].map(([
                                        label,
                                        value
                                    ]) => (
                                        <div
                                            key={label}
                                            className="rounded-xl bg-slate-50 px-4 py-3"
                                        >
                                            <p className="text-xs font-medium text-slate-500">
                                                {label}
                                            </p>

                                            <p className="mt-1 text-sm font-bold text-slate-900">
                                                {formatMoney(
                                                    value,
                                                    invoice.currency_code
                                                )}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="grid gap-3 md:grid-cols-2">
                                <InfoCard
                                    icon={Building2}
                                    label="Property"
                                    primary={
                                        invoice.property
                                            ?.property_name
                                    }
                                    secondary={
                                        invoice.property
                                            ?.property_code ||
                                        ""
                                    }
                                />

                                <InfoCard
                                    icon={Home}
                                    label="Unit"
                                    primary={
                                        invoice.unit
                                            ?.unit_name ||
                                        invoice.unit
                                            ?.unit_code
                                    }
                                    secondary={
                                        invoice.unit
                                            ?.unit_name &&
                                        invoice.unit
                                            ?.unit_code
                                            ? invoice.unit
                                                .unit_code
                                            : ""
                                    }
                                />
                            </section>

                            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">
                                            Invoice Items
                                        </h3>

                                        <p className="mt-1 text-xs text-slate-500">
                                            {items.length} item
                                            {items.length === 1
                                                ? ""
                                                : "s"}
                                        </p>
                                    </div>

                                    {invoice.status ===
                                        "draft" && (
                                        <Button
                                            type="button"
                                            leftIcon={Plus}
                                            onClick={() => {
                                                setItemSuccess("");
                                                setAddItemOpen(true);
                                            }}
                                        >
                                            Add Item
                                        </Button>
                                    )}
                                </div>

                                {items.length === 0 ? (
                                    <div className="px-5 py-10 text-center">
                                        <FileText className="mx-auto h-6 w-6 text-slate-400" />

                                        <p className="mt-3 text-sm font-semibold text-slate-700">
                                            No invoice items yet
                                        </p>

                                        <p className="mt-1 text-xs text-slate-500">
                                            This draft currently has a zero financial total.
                                        </p>

                                        {invoice.status ===
                                            "draft" && (
                                            <Button
                                                type="button"
                                                leftIcon={Plus}
                                                className="mt-4"
                                                onClick={() => {
                                                    setItemSuccess("");
                                                    setAddItemOpen(true);
                                                }}
                                            >
                                                Add First Item
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full">
                                            <thead className="bg-slate-50">
                                                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    <th className="px-5 py-3">
                                                        Type
                                                    </th>
                                                    <th className="px-4 py-3">
                                                        Description
                                                    </th>
                                                    <th className="px-4 py-3 text-right">
                                                        Quantity
                                                    </th>
                                                    <th className="px-4 py-3 text-right">
                                                        Unit Amount
                                                    </th>
                                                    <th className="px-5 py-3 text-right">
                                                        Line Amount
                                                    </th>

                                                    {invoice.status ===
                                                        "draft" && (
                                                        <th className="px-5 py-3 text-right">
                                                            Actions
                                                        </th>
                                                    )}
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-100">
                                                {items.map(
                                                    item => (
                                                        <tr
                                                            key={
                                                                item.public_id
                                                            }
                                                        >
                                                            <td className="px-5 py-4 text-sm font-medium text-slate-800">
                                                                {formatLabel(
                                                                    item.item_type
                                                                )}
                                                            </td>

                                                            <td className="px-4 py-4 text-sm text-slate-700">
                                                                {item.description ||
                                                                    "—"}
                                                            </td>

                                                            <td className="px-4 py-4 text-right text-sm text-slate-700">
                                                                {item.quantity ||
                                                                    "—"}
                                                            </td>

                                                            <td className="px-4 py-4 text-right text-sm text-slate-700">
                                                                {formatMoney(
                                                                    item.unit_amount,
                                                                    invoice.currency_code
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">
                                                                {formatMoney(
                                                                    item.line_amount,
                                                                    invoice.currency_code
                                                                )}
                                                            </td>

                                                            {invoice.status ===
                                                                "draft" && (
                                                                <td className="px-5 py-4 text-right">
                                                                    <div className="flex justify-end gap-2">
                                                                        <Button
                                                                            type="button"
                                                                            variant="secondary"
                                                                            leftIcon={Pencil}
                                                                            onClick={() => {
                                                                                setItemSuccess(
                                                                                    ""
                                                                                );
                                                                                setSelectedItem(
                                                                                    item
                                                                                );
                                                                                setEditItemOpen(
                                                                                    true
                                                                                );
                                                                            }}
                                                                        >
                                                                            Edit
                                                                        </Button>

                                                                        <Button
                                                                            type="button"
                                                                            variant="secondary"
                                                                            leftIcon={Trash2}
                                                                            className="border-rose-200 text-rose-700 hover:bg-rose-50"
                                                                            onClick={() => {
                                                                                setItemSuccess(
                                                                                    ""
                                                                                );
                                                                                setSelectedItem(
                                                                                    item
                                                                                );
                                                                                setDeleteItemOpen(
                                                                                    true
                                                                                );
                                                                            }}
                                                                        >
                                                                            Delete
                                                                        </Button>
                                                                    </div>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>

                            <section className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                                    <h3 className="text-sm font-bold text-slate-900">
                                        Notes
                                    </h3>

                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                        {invoice.notes ||
                                            "No notes recorded for this invoice."}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                                    <h3 className="text-sm font-bold text-slate-900">
                                        Audit Information
                                    </h3>

                                    <dl className="mt-3 space-y-3 text-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <dt className="text-slate-500">
                                                Created by
                                            </dt>
                                            <dd className="text-right font-medium text-slate-800">
                                                {invoice.audit
                                                    ?.created_by
                                                    ?.full_name ||
                                                    "—"}
                                            </dd>
                                        </div>

                                        <div className="flex items-start justify-between gap-4">
                                            <dt className="text-slate-500">
                                                Created at
                                            </dt>
                                            <dd className="text-right font-medium text-slate-800">
                                                {formatDateTime(
                                                    invoice.created_at
                                                )}
                                            </dd>
                                        </div>

                                        <div className="flex items-start justify-between gap-4">
                                            <dt className="text-slate-500">
                                                Issued at
                                            </dt>
                                            <dd className="text-right font-medium text-slate-800">
                                                {formatDateTime(
                                                    invoice.audit
                                                        ?.issued
                                                        ?.issued_at
                                                )}
                                            </dd>
                                        </div>

                                        <div className="flex items-start justify-between gap-4">
                                            <dt className="text-slate-500">
                                                Voided at
                                            </dt>
                                            <dd className="text-right font-medium text-slate-800">
                                                {formatDateTime(
                                                    invoice.audit
                                                        ?.voided
                                                        ?.voided_at
                                                )}
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            </section>
                        </div>
                    ) : null}
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                    >
                        Close
                    </Button>

                    {invoice?.status ===
                        "draft" && (
                        <>
                            <Button
                                type="button"
                                variant="secondary"
                                leftIcon={Pencil}
                                onClick={() => {
                                    setItemSuccess("");
                                    setEditInvoiceOpen(true);
                                }}
                            >
                                Edit Invoice
                            </Button>

                            <Button
                                type="button"
                                onClick={() => {
                                    setItemSuccess("");
                                    setIssueInvoiceOpen(true);
                                }}
                            >
                                Issue Invoice
                            </Button>
                        </>
                    )}

                    {[
                        "draft",
                        "issued"
                    ].includes(
                        invoice?.status
                    ) && (
                        <Button
                            type="button"
                            variant="secondary"
                            className="border-rose-200 text-rose-700 hover:bg-rose-50"
                            onClick={() => {
                                setItemSuccess("");
                                setVoidInvoiceOpen(true);
                            }}
                        >
                            Void Invoice
                        </Button>
                    )}
                </div>
            </div>
        </div>

        <EditInvoiceModal
            open={editInvoiceOpen}
            invoice={invoice}
            onClose={() =>
                setEditInvoiceOpen(false)
            }
            onUpdated={handleInvoiceUpdated}
        />

        <IssueInvoiceModal
            open={issueInvoiceOpen}
            invoice={invoice}
            onClose={() =>
                setIssueInvoiceOpen(false)
            }
            onIssued={handleInvoiceIssued}
        />

        <VoidInvoiceModal
            open={voidInvoiceOpen}
            invoice={invoice}
            onClose={() =>
                setVoidInvoiceOpen(false)
            }
            onVoided={handleInvoiceVoided}
        />

        <AddInvoiceItemModal
            open={addItemOpen}
            invoice={invoice}
            onClose={() =>
                setAddItemOpen(false)
            }
            onAdded={handleItemAdded}
        />

        <EditInvoiceItemModal
            open={editItemOpen}
            invoice={invoice}
            item={selectedItem}
            onClose={() => {
                setEditItemOpen(false);
                setSelectedItem(null);
            }}
            onUpdated={handleItemUpdated}
        />

        <DeleteInvoiceItemModal
            open={deleteItemOpen}
            invoice={invoice}
            item={selectedItem}
            onClose={() => {
                setDeleteItemOpen(false);
                setSelectedItem(null);
            }}
            onDeleted={handleItemDeleted}
        />
        </>
    );
}

export default InvoiceDetailModal;

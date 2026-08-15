import {
    AlertCircle,
    Calculator,
    Plus,
    X
} from "lucide-react";

import {
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button,
    IconButton
} from "../../components/ui/Button";

const ITEM_TYPES = [
    ["rent", "Rent"],
    ["late_fee", "Late Fee"],
    ["utility", "Utility"],
    ["service_charge", "Service Charge"],
    ["adjustment", "Adjustment"],
    ["discount", "Discount"],
    ["tax", "Tax"],
    ["other", "Other"]
];

const DEFAULT_DESCRIPTIONS = {
    rent: "Rent",
    late_fee: "Late fee",
    utility: "Utility charge",
    service_charge: "Service charge",
    adjustment: "Adjustment",
    discount: "Discount",
    tax: "Tax",
    other: "Other charge"
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to add invoice item.";

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

function AddInvoiceItemModal({
    open,
    invoice,
    onClose,
    onAdded
}) {
    const [
        itemType,
        setItemType
    ] = useState("rent");

    const [
        description,
        setDescription
    ] = useState("Rent");

    const [
        quantity,
        setQuantity
    ] = useState("1");

    const [
        unitAmount,
        setUnitAmount
    ] = useState("");

    const [
        error,
        setError
    ] = useState("");

    const [
        saving,
        setSaving
    ] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }

        setItemType("rent");
        setDescription("Rent");
        setQuantity("1");
        setUnitAmount("");
        setError("");
        setSaving(false);
    }, [open]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !saving
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
        saving
    ]);

    const lineAmount =
        useMemo(() => {
            const parsedQuantity =
                Number(quantity);

            const parsedUnitAmount =
                Number(unitAmount);

            if (
                !Number.isFinite(
                    parsedQuantity
                ) ||
                parsedQuantity <= 0 ||
                !Number.isFinite(
                    parsedUnitAmount
                ) ||
                parsedUnitAmount < 0
            ) {
                return null;
            }

            return (
                parsedQuantity *
                parsedUnitAmount
            );
        }, [
            quantity,
            unitAmount
        ]);

    if (!open) {
        return null;
    }

    const submitItem = async event => {
        event.preventDefault();
        setError("");

        const normalizedDescription =
            description.trim();

        const normalizedQuantity =
            quantity.trim();

        const normalizedUnitAmount =
            unitAmount.trim();

        if (!normalizedDescription) {
            setError(
                "Item description is required."
            );
            return;
        }

        if (
            normalizedDescription.length >
            500
        ) {
            setError(
                "Item description cannot exceed 500 characters."
            );
            return;
        }

        if (
            !/^\d{1,8}(\.\d{1,4})?$/.test(
                normalizedQuantity
            ) ||
            Number(normalizedQuantity) <= 0
        ) {
            setError(
                "Quantity must be greater than zero and contain at most 4 decimal places."
            );
            return;
        }

        if (
            !/^\d{1,12}(\.\d{1,2})?$/.test(
                normalizedUnitAmount
            ) ||
            Number(normalizedUnitAmount) < 0
        ) {
            setError(
                "Unit amount must be zero or greater and contain at most 2 decimal places."
            );
            return;
        }

        try {
            setSaving(true);

            const response =
                await apiClient.post(
                    `/invoices/${encodeURIComponent(
                        invoice.public_id
                    )}/items`,
                    {
                        item_type:
                            itemType,
                        description:
                            normalizedDescription,
                        quantity:
                            normalizedQuantity,
                        unit_amount:
                            normalizedUnitAmount
                    }
                );

            await onAdded?.(
                response?.data?.data
            );
        } catch (requestError) {
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setSaving(false);
        }
    };

    const changeItemType = event => {
        const nextType =
            event.target.value;

        setItemType(nextType);

        const currentDefault =
            DEFAULT_DESCRIPTIONS[
                itemType
            ];

        if (
            !description.trim() ||
            description === currentDefault
        ) {
            setDescription(
                DEFAULT_DESCRIPTIONS[
                    nextType
                ] || ""
            );
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-[2px] sm:p-5">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-invoice-item-title"
                className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h2
                            id="add-invoice-item-title"
                            className="text-lg font-bold text-slate-950"
                        >
                            Add Invoice Item
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            {invoice?.invoice_number ||
                                "Draft invoice"}
                        </p>
                    </div>

                    <IconButton
                        label="Close add item"
                        icon={X}
                        disabled={saving}
                        onClick={onClose}
                    />
                </div>

                <form onSubmit={submitItem}>
                    <div className="space-y-5 px-5 py-5 sm:px-6">
                        {error && (
                            <div
                                role="alert"
                                className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                            >
                                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                                    Item Type
                                </span>

                                <select
                                    value={itemType}
                                    disabled={saving}
                                    onChange={changeItemType}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                >
                                    {ITEM_TYPES.map(
                                        ([
                                            value,
                                            label
                                        ]) => (
                                            <option
                                                key={value}
                                                value={value}
                                            >
                                                {label}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                                    Quantity
                                </span>

                                <input
                                    type="number"
                                    min="0.0001"
                                    step="0.0001"
                                    value={quantity}
                                    disabled={saving}
                                    onChange={event =>
                                        setQuantity(
                                            event.target
                                                .value
                                        )
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                    required
                                />
                            </label>
                        </div>

                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                                Description
                            </span>

                            <input
                                type="text"
                                maxLength={500}
                                value={description}
                                disabled={saving}
                                onChange={event =>
                                    setDescription(
                                        event.target
                                            .value
                                    )
                                }
                                placeholder="e.g. August 2026 rent"
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                required
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                                Unit Amount ({invoice?.currency_code ||
                                    "Currency"})
                            </span>

                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={unitAmount}
                                disabled={saving}
                                onChange={event =>
                                    setUnitAmount(
                                        event.target
                                            .value
                                    )
                                }
                                placeholder="500000"
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                required
                            />
                        </label>

                        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                            <div className="flex items-start gap-3">
                                <Calculator className="mt-0.5 h-5 w-5 text-blue-600" />

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                        Line Amount Preview
                                    </p>

                                    <p className="mt-1 text-lg font-bold text-slate-950">
                                        {lineAmount === null
                                            ? "—"
                                            : formatMoney(
                                                lineAmount,
                                                invoice?.currency_code
                                            )}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        The backend/database will calculate and synchronize the final invoice totals after the item is saved.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={saving}
                            onClick={onClose}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            leftIcon={Plus}
                            loading={saving}
                        >
                            Add Item
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AddInvoiceItemModal;

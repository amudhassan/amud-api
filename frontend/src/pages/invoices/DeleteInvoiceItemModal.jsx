import {
    AlertTriangle,
    Trash2,
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
    error?.message ||
    "Unable to delete the invoice item.";

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

function DeleteInvoiceItemModal({
    open,
    invoice,
    item,
    onClose,
    onDeleted
}) {
    const [
        deleting,
        setDeleting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }

        setDeleting(false);
        setError("");
    }, [
        open,
        item?.public_id
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !deleting
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
        deleting
    ]);

    if (
        !open ||
        !invoice ||
        !item
    ) {
        return null;
    }

    const deleteItem = async () => {
        if (
            !invoice.public_id ||
            !item.public_id
        ) {
            setError(
                "Invoice or item identifier is missing."
            );
            return;
        }

        try {
            setDeleting(true);
            setError("");

            const response =
                await apiClient.delete(
                    `/invoices/${encodeURIComponent(
                        invoice.public_id
                    )}/items/${encodeURIComponent(
                        item.public_id
                    )}`
                );

            const data =
                response?.data?.data || {};

            await onDeleted?.(data);
        } catch (
            requestError
        ) {
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-invoice-item-title"
                className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                            <AlertTriangle className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="delete-invoice-item-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Delete Invoice Item
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                This action removes the billing line from the draft invoice.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close delete invoice item"
                        icon={X}
                        disabled={deleting}
                        onClick={onClose}
                    />
                </div>

                <div className="space-y-4 px-5 py-5 sm:px-6">
                    {error && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Item
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-900">
                            {item.description ||
                                "Invoice item"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                            <div>
                                <span className="text-slate-500">
                                    Quantity:
                                </span>{" "}
                                <span className="font-medium text-slate-800">
                                    {item.quantity ??
                                        "—"}
                                </span>
                            </div>

                            <div>
                                <span className="text-slate-500">
                                    Line Amount:
                                </span>{" "}
                                <span className="font-semibold text-slate-900">
                                    {formatMoney(
                                        item.line_amount,
                                        invoice.currency_code
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>

                    <p className="text-sm leading-6 text-slate-600">
                        The invoice financial totals will be recalculated automatically after this item is deleted.
                    </p>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={deleting}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="button"
                        leftIcon={Trash2}
                        disabled={deleting}
                        className="bg-rose-600 text-white hover:bg-rose-700"
                        onClick={deleteItem}
                    >
                        {deleting
                            ? "Deleting..."
                            : "Delete Item"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default DeleteInvoiceItemModal;

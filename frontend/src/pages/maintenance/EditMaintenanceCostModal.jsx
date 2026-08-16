import {
    Calculator,
    Pencil,
    X
} from "lucide-react";

import {
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";
import { Button } from "../../components/ui/Button";

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to update the maintenance cost.";

const getMaintenanceCost = response => {
    const body = response?.data || {};
    const data = body?.data || {};

    return (
        data.maintenance_cost ||
        data.cost ||
        body.maintenance_cost ||
        body.cost ||
        null
    );
};

const initialForm = cost => ({
    description: cost?.description || "",
    quantity:
        cost?.quantity === null ||
        cost?.quantity === undefined
            ? ""
            : String(cost.quantity),
    unit_cost:
        cost?.unit_cost === null ||
        cost?.unit_cost === undefined
            ? ""
            : String(cost.unit_cost),
    currency_code:
        cost?.currency_code || "TZS",
    vendor_reference:
        cost?.vendor_reference || "",
    quotation_reference:
        cost?.quotation_reference || ""
});

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );

function EditMaintenanceCostModal({
    open,
    maintenanceRequest,
    maintenanceCost,
    accessContext,
    onClose,
    onUpdated
}) {
    const [form, setForm] = useState(() =>
        initialForm(maintenanceCost)
    );
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (
            !open ||
            !maintenanceRequest?.public_id ||
            !maintenanceCost?.public_id
        ) {
            return undefined;
        }

        let active = true;

        const load = async () => {
            try {
                setLoading(true);
                setError("");
                setSnapshot(null);

                const config = {};
                if (accessContext) {
                    config.params = {
                        access_context: accessContext
                    };
                }

                const response = await apiClient.get(
                    `/maintenance/requests/${encodeURIComponent(
                        maintenanceRequest.public_id
                    )}/costs/${encodeURIComponent(
                        maintenanceCost.public_id
                    )}`,
                    config
                );

                if (!active) {
                    return;
                }

                const currentCost =
                    getMaintenanceCost(response);

                if (!currentCost) {
                    throw new Error(
                        "The maintenance cost could not be loaded for editing."
                    );
                }

                if (currentCost.status !== "draft") {
                    setError(
                        "Only a draft maintenance cost can be edited."
                    );
                    return;
                }

                if (!currentCost.updated_at) {
                    throw new Error(
                        "The maintenance cost updated-at timestamp is missing."
                    );
                }

                setSnapshot(currentCost);
                setForm(initialForm(currentCost));
            } catch (requestError) {
                if (active) {
                    setError(getErrorMessage(requestError));
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            active = false;
        };
    }, [
        accessContext,
        maintenanceCost?.public_id,
        maintenanceRequest?.public_id,
        open
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !submitting
            ) {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () =>
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
    }, [open, onClose, submitting]);

    const estimatedAmount = useMemo(() => {
        const quantity = Number(form.quantity);
        const unitCost = Number(form.unit_cost);

        if (
            !Number.isFinite(quantity) ||
            !Number.isFinite(unitCost) ||
            quantity <= 0 ||
            unitCost <= 0
        ) {
            return null;
        }

        return Math.round(
            quantity * unitCost * 100
        ) / 100;
    }, [form.quantity, form.unit_cost]);

    if (
        !open ||
        !maintenanceRequest ||
        !maintenanceCost
    ) {
        return null;
    }

    const update = (field, value) => {
        setForm(current => ({
            ...current,
            [field]: value
        }));
        setError("");
    };

    const formatEstimate = value => {
        if (value === null) {
            return "—";
        }

        const currency =
            form.currency_code || "TZS";

        try {
            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency,
                maximumFractionDigits: 2
            }).format(value);
        } catch {
            return `${currency} ${value.toLocaleString()}`;
        }
    };

    const submit = async event => {
        event.preventDefault();

        if (!snapshot) {
            setError(
                "The maintenance cost is still loading."
            );
            return;
        }

        if (snapshot.status !== "draft") {
            setError(
                "Only a draft maintenance cost can be updated."
            );
            return;
        }

        const description = form.description.trim();
        const quantityText = form.quantity.trim();
        const quantity = Number(quantityText);
        const unitCostText = form.unit_cost.trim();
        const unitCost = Number(unitCostText);
        const currencyCode = form.currency_code
            .trim()
            .toUpperCase();
        const vendorReference =
            form.vendor_reference.trim();
        const quotationReference =
            form.quotation_reference.trim();

        if (
            description.length < 3 ||
            description.length > 3000
        ) {
            setError(
                "Cost description must contain between 3 and 3000 characters."
            );
            return;
        }

        if (
            !/^\d+(\.\d{1,3})?$/.test(quantityText) ||
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            quantity > 999999999.999
        ) {
            setError(
                "Quantity must be greater than zero and can contain at most three decimal places."
            );
            return;
        }

        if (
            !/^\d+(\.\d{1,2})?$/.test(unitCostText) ||
            !Number.isFinite(unitCost) ||
            unitCost <= 0 ||
            unitCost > 999999999999.99
        ) {
            setError(
                "Unit cost must be greater than zero and can contain at most two decimal places."
            );
            return;
        }

        if (!/^[A-Z]{3}$/.test(currencyCode)) {
            setError(
                "Currency code must contain exactly three uppercase letters."
            );
            return;
        }

        const requestCurrency =
            maintenanceRequest.currency_code ||
            snapshot.currency_code;

        if (
            requestCurrency &&
            currencyCode !== requestCurrency
        ) {
            setError(
                `Maintenance cost currency must remain ${requestCurrency}.`
            );
            return;
        }

        if (
            vendorReference.length > 255 ||
            quotationReference.length > 255
        ) {
            setError(
                "Vendor and quotation references cannot exceed 255 characters."
            );
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const config = {};
            if (accessContext) {
                config.params = {
                    access_context: accessContext
                };
            }

            await apiClient.patch(
                `/maintenance/requests/${encodeURIComponent(
                    maintenanceRequest.public_id
                )}/costs/${encodeURIComponent(
                    maintenanceCost.public_id
                )}`,
                {
                    expected_status: snapshot.status,
                    expected_updated_at: snapshot.updated_at,
                    description,
                    quantity,
                    unit_cost: unitCost,
                    currency_code: currencyCode,
                    vendor_reference:
                        vendorReference || null,
                    quotation_reference:
                        quotationReference || null
                },
                config
            );

            await onUpdated?.();
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Edit Draft Maintenance Cost
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Update draft cost terms before submission for approval.
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close edit maintenance cost modal"
                        disabled={submitting}
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                    <div className="space-y-5">
                        {error && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {error}
                            </div>
                        )}

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
                            Cost type and request relationship are fixed. Draft financial terms can be edited until the cost is submitted.
                        </div>

                        {loading ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                                Loading current draft cost...
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Cost Type
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-slate-900">
                                        {formatLabel(
                                            snapshot?.cost_type ||
                                                maintenanceCost.cost_type
                                        )}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Status
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-slate-900">
                                        Draft
                                    </p>
                                </div>

                                <label className="block sm:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Description *
                                    </span>
                                    <textarea
                                        value={form.description}
                                        disabled={submitting || loading}
                                        maxLength={3000}
                                        rows={4}
                                        onChange={event =>
                                            update(
                                                "description",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Quantity *
                                    </span>
                                    <input
                                        type="number"
                                        min="0.001"
                                        step="0.001"
                                        value={form.quantity}
                                        disabled={submitting || loading}
                                        onChange={event =>
                                            update(
                                                "quantity",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Unit Cost *
                                    </span>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={form.unit_cost}
                                        disabled={submitting || loading}
                                        onChange={event =>
                                            update(
                                                "unit_cost",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </label>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Currency
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-slate-900">
                                        {form.currency_code || "—"}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                        <Calculator className="h-4 w-4" />
                                        Estimated Amount
                                    </div>
                                    <p className="mt-1 text-sm font-bold text-emerald-900">
                                        {formatEstimate(
                                            estimatedAmount
                                        )}
                                    </p>
                                </div>

                                <label className="block">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Vendor Reference
                                    </span>
                                    <input
                                        value={form.vendor_reference}
                                        disabled={submitting || loading}
                                        maxLength={255}
                                        onChange={event =>
                                            update(
                                                "vendor_reference",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Quotation Reference
                                    </span>
                                    <input
                                        value={form.quotation_reference}
                                        disabled={submitting || loading}
                                        maxLength={255}
                                        onChange={event =>
                                            update(
                                                "quotation_reference",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </label>
                            </div>
                        )}

                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                            If another user changes this draft after you open it, the backend will reject this update with a concurrency conflict instead of overwriting their changes.
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={submitting}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        leftIcon={Pencil}
                        disabled={
                            submitting ||
                            loading ||
                            !snapshot
                        }
                    >
                        {submitting
                            ? "Saving..."
                            : "Save Draft Changes"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default EditMaintenanceCostModal;

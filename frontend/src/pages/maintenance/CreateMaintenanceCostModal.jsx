import {
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
    Button
} from "../../components/ui/Button";

const COST_TYPES = [
    ["labour", "Labour"],
    ["materials", "Materials"],
    ["transport", "Transport"],
    ["inspection", "Inspection"],
    ["replacement", "Replacement"],
    ["service_fee", "Service Fee"],
    ["other", "Other"]
];

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to create the maintenance cost.";

const getRequestFromResponse = response =>
    response?.data?.data
        ?.maintenance_request ||
    response?.data
        ?.maintenance_request ||
    null;

const initialForm = request => ({
    cost_type: "materials",
    description: "",
    quantity: "1",
    unit_cost: "",
    currency_code:
        request?.currency_code ||
        "TZS",
    vendor_reference: "",
    quotation_reference: ""
});

function CreateMaintenanceCostModal({
    open,
    maintenanceRequest,
    accessContext,
    onClose,
    onCreated
}) {
    const [
        form,
        setForm
    ] = useState(() =>
        initialForm(
            maintenanceRequest
        )
    );

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(
            initialForm(
                maintenanceRequest
            )
        );
        setError("");
        setSubmitting(false);
    }, [
        open,
        maintenanceRequest
            ?.public_id,
        maintenanceRequest
            ?.currency_code
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown =
            event => {
                if (
                    event.key ===
                        "Escape" &&
                    !submitting
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
        onClose,
        open,
        submitting
    ]);

    const estimatedAmount =
        useMemo(() => {
            const quantity =
                Number(
                    form.quantity
                );

            const unitCost =
                Number(
                    form.unit_cost
                );

            if (
                !Number.isFinite(
                    quantity
                ) ||
                !Number.isFinite(
                    unitCost
                ) ||
                quantity <= 0 ||
                unitCost <= 0
            ) {
                return null;
            }

            return Math.round(
                (
                    quantity *
                    unitCost
                ) *
                    100
            ) / 100;
        }, [
            form.quantity,
            form.unit_cost
        ]);

    if (
        !open ||
        !maintenanceRequest
    ) {
        return null;
    }

    const update =
        (field, value) => {
            setForm(
                current => ({
                    ...current,
                    [field]:
                        value
                })
            );

            if (error) {
                setError("");
            }
        };

    const formatEstimate =
        value => {
            if (
                value === null
            ) {
                return "—";
            }

            const currency =
                form.currency_code ||
                "TZS";

            try {
                return new Intl.NumberFormat(
                    undefined,
                    {
                        style:
                            "currency",
                        currency,
                        maximumFractionDigits:
                            2
                    }
                ).format(
                    value
                );
            } catch {
                return `${currency} ${value.toLocaleString()}`;
            }
        };

    const submit =
        async event => {
            event.preventDefault();

            const description =
                form.description.trim();

            const quantity =
                Number(
                    form.quantity
                );

            const unitCost =
                Number(
                    form.unit_cost
                );

            const currencyCode =
                form.currency_code
                    .trim()
                    .toUpperCase();

            if (
                !COST_TYPES.some(
                    ([value]) =>
                        value ===
                        form.cost_type
                )
            ) {
                setError(
                    "Select a valid maintenance cost type."
                );
                return;
            }

            if (
                description.length <
                    1 ||
                description.length >
                    5000
            ) {
                setError(
                    "Cost description must contain between 1 and 5000 characters."
                );
                return;
            }

            if (
                !Number.isFinite(
                    quantity
                ) ||
                quantity <= 0 ||
                quantity >
                    999999999.999
            ) {
                setError(
                    "Quantity must be greater than zero."
                );
                return;
            }

            if (
                !/^\d+(\.\d{1,3})?$/.test(
                    form.quantity.trim()
                )
            ) {
                setError(
                    "Quantity can contain at most three decimal places."
                );
                return;
            }

            if (
                !Number.isFinite(
                    unitCost
                ) ||
                unitCost <= 0 ||
                unitCost >
                    999999999999.99
            ) {
                setError(
                    "Unit cost must be greater than zero."
                );
                return;
            }

            if (
                !/^\d+(\.\d{1,2})?$/.test(
                    form.unit_cost.trim()
                )
            ) {
                setError(
                    "Unit cost can contain at most two decimal places."
                );
                return;
            }

            if (
                !/^[A-Z]{3}$/.test(
                    currencyCode
                )
            ) {
                setError(
                    "Currency code must contain exactly three uppercase letters."
                );
                return;
            }

            const vendorReference =
                form.vendor_reference
                    .trim();

            const quotationReference =
                form.quotation_reference
                    .trim();

            if (
                vendorReference.length >
                    255 ||
                quotationReference.length >
                    255
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
                        access_context:
                            accessContext
                    };
                }

                /*
                 * Reload the request immediately before the write.
                 * Nested maintenance writes use authoritative
                 * request state for optimistic concurrency.
                 */
                const requestResponse =
                    await apiClient.get(
                        `/maintenance/requests/${encodeURIComponent(
                            maintenanceRequest.public_id
                        )}`,
                        config
                    );

                const authoritativeRequest =
                    getRequestFromResponse(
                        requestResponse
                    );

                if (
                    !authoritativeRequest
                ) {
                    throw new Error(
                        "Unable to refresh the maintenance request before creating the cost."
                    );
                }

                if (
                    [
                        "closed",
                        "rejected",
                        "cancelled"
                    ].includes(
                        authoritativeRequest
                            .status
                    )
                ) {
                    setError(
                        "A maintenance cost cannot be added to a terminal request."
                    );
                    return;
                }

                if (
                    !authoritativeRequest
                        .updated_at
                ) {
                    throw new Error(
                        "The maintenance request updated-at timestamp is missing."
                    );
                }

                const body = {
                    expected_request_status:
                        authoritativeRequest.status,
                    expected_request_updated_at:
                        authoritativeRequest.updated_at,
                    cost_type:
                        form.cost_type,
                    description,
                    quantity,
                    unit_cost:
                        unitCost,
                    currency_code:
                        currencyCode
                };

                if (
                    vendorReference
                ) {
                    body.vendor_reference =
                        vendorReference;
                }

                if (
                    quotationReference
                ) {
                    body.quotation_reference =
                        quotationReference;
                }

                await apiClient.post(
                    `/maintenance/requests/${encodeURIComponent(
                        maintenanceRequest.public_id
                    )}/costs`,
                    body,
                    config
                );

                await onCreated?.();
            } catch (
                requestError
            ) {
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
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
                            Add Maintenance Cost
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Create a draft cost record. Approval and incurred amounts are handled by later lifecycle actions.
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close create maintenance cost modal"
                        disabled={
                            submitting
                        }
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
                            New maintenance costs begin as Draft. Estimated amount is calculated from Quantity × Unit Cost.
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Cost Type *
                                </span>

                                <select
                                    value={
                                        form.cost_type
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "cost_type",
                                                event.target.value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    {COST_TYPES.map(
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
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Currency *
                                </span>

                                <input
                                    value={
                                        form.currency_code
                                    }
                                    disabled={
                                        submitting
                                    }
                                    maxLength={3}
                                    onChange={
                                        event =>
                                            update(
                                                "currency_code",
                                                event.target.value.toUpperCase()
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm uppercase text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>

                            <label className="block sm:col-span-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Description *
                                </span>

                                <textarea
                                    value={
                                        form.description
                                    }
                                    disabled={
                                        submitting
                                    }
                                    maxLength={5000}
                                    rows={4}
                                    placeholder="Example: Replacement of damaged water pipe and fittings"
                                    onChange={
                                        event =>
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
                                    value={
                                        form.quantity
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
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
                                    value={
                                        form.unit_cost
                                    }
                                    disabled={
                                        submitting
                                    }
                                    placeholder="0.00"
                                    onChange={
                                        event =>
                                            update(
                                                "unit_cost",
                                                event.target.value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>

                            <div className="sm:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                <div className="flex items-center gap-2 text-emerald-800">
                                    <Calculator className="h-4 w-4" />
                                    <span className="text-xs font-semibold uppercase tracking-wide">
                                        Estimated Amount
                                    </span>
                                </div>

                                <p className="mt-2 text-xl font-bold text-emerald-900">
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
                                    value={
                                        form.vendor_reference
                                    }
                                    disabled={
                                        submitting
                                    }
                                    maxLength={255}
                                    placeholder="Optional"
                                    onChange={
                                        event =>
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
                                    value={
                                        form.quotation_reference
                                    }
                                    disabled={
                                        submitting
                                    }
                                    maxLength={255}
                                    placeholder="Optional"
                                    onChange={
                                        event =>
                                            update(
                                                "quotation_reference",
                                                event.target.value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={
                            submitting
                        }
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        leftIcon={Plus}
                        disabled={
                            submitting
                        }
                    >
                        {submitting
                            ? "Creating..."
                            : "Create Draft Cost"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default CreateMaintenanceCostModal;

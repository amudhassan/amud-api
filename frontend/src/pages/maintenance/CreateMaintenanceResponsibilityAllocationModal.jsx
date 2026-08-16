import {
    Plus,
    Scale,
    X
} from "lucide-react";

import {
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

const PARTY_TYPES = [
    ["owner", "Owner"],
    ["tenant", "Tenant"],
    ["insurance", "Insurance"],
    ["warranty_provider", "Warranty Provider"],
    ["external_party", "External Party"],
    ["other", "Other"]
];

const PROVIDER_PARTY_TYPES = [
    "insurance",
    "warranty_provider",
    "external_party",
    "other"
];

const MUTABLE_REQUEST_STATUSES = [
    "reported",
    "under_review",
    "assigned",
    "in_progress",
    "on_hold",
    "resolved"
];

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to create the responsibility allocation.";

const getRequestFromResponse = response =>
    response?.data?.data?.maintenance_request ||
    response?.data?.maintenance_request ||
    null;

const initialForm = maintenanceRequest => ({
    party_type:
        maintenanceRequest?.tenant
            ? "tenant"
            : "owner",
    provider_name: "",
    allocation_method: "percentage",
    allocated_amount: "",
    allocation_percentage: "100",
    reason: ""
});

function CreateMaintenanceResponsibilityAllocationModal({
    open,
    maintenanceRequest,
    responsibility,
    existingAllocationMethod,
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

        setForm({
            ...initialForm(
                maintenanceRequest
            ),
            allocation_method:
                existingAllocationMethod ||
                "percentage"
        });
        setError("");
        setSubmitting(false);
    }, [
        open,
        maintenanceRequest?.public_id,
        existingAllocationMethod
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

    if (
        !open ||
        !maintenanceRequest ||
        !responsibility
    ) {
        return null;
    }

    const update =
        (field, value) => {
            setForm(
                current => ({
                    ...current,
                    [field]: value
                })
            );

            if (error) {
                setError("");
            }
        };

    const submit =
        async event => {
            event.preventDefault();

            const validPartyType =
                PARTY_TYPES.some(
                    ([value]) =>
                        value ===
                        form.party_type
                );

            if (!validPartyType) {
                setError(
                    "Select a valid responsibility party type."
                );
                return;
            }

            if (
                form.party_type ===
                    "tenant" &&
                !maintenanceRequest
                    ?.tenant?.public_id
            ) {
                setError(
                    "This maintenance request does not have a tenant that can receive a tenant allocation."
                );
                return;
            }

            const providerName =
                form.provider_name.trim();

            if (
                PROVIDER_PARTY_TYPES.includes(
                    form.party_type
                ) &&
                !providerName
            ) {
                setError(
                    "Provider name is required for this responsibility party type."
                );
                return;
            }

            if (
                providerName.length >
                    255
            ) {
                setError(
                    "Provider name cannot exceed 255 characters."
                );
                return;
            }

            const reason =
                form.reason.trim();

            if (
                reason.length < 3 ||
                reason.length > 2000
            ) {
                setError(
                    "Allocation reason must contain between 3 and 2000 characters."
                );
                return;
            }

            let allocatedAmount = null;
            let allocationPercentage = null;

            if (
                form.allocation_method ===
                "amount"
            ) {
                if (
                    !/^\d+(?:\.\d{1,2})?$/.test(
                        form.allocated_amount.trim()
                    )
                ) {
                    setError(
                        "Allocated amount must be a positive number with at most two decimal places."
                    );
                    return;
                }

                allocatedAmount =
                    Number(
                        form.allocated_amount
                    );

                if (
                    !Number.isFinite(
                        allocatedAmount
                    ) ||
                    allocatedAmount <= 0 ||
                    allocatedAmount >
                        999999999999.99
                ) {
                    setError(
                        "Allocated amount must be greater than zero and within the supported monetary range."
                    );
                    return;
                }
            } else if (
                form.allocation_method ===
                "percentage"
            ) {
                if (
                    !/^\d+(?:\.\d{1,4})?$/.test(
                        form.allocation_percentage.trim()
                    )
                ) {
                    setError(
                        "Allocation percentage must be a positive number with at most four decimal places."
                    );
                    return;
                }

                allocationPercentage =
                    Number(
                        form.allocation_percentage
                    );

                if (
                    !Number.isFinite(
                        allocationPercentage
                    ) ||
                    allocationPercentage <= 0 ||
                    allocationPercentage > 100
                ) {
                    setError(
                        "Allocation percentage must be greater than zero and cannot exceed 100."
                    );
                    return;
                }
            } else {
                setError(
                    "Select amount or percentage as the allocation method."
                );
                return;
            }

            if (
                !responsibility.public_id ||
                !responsibility.updated_at
            ) {
                setError(
                    "The responsibility concurrency snapshot is incomplete. Refresh the allocations and try again."
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

                if (!authoritativeRequest) {
                    throw new Error(
                        "Unable to refresh the maintenance request before creating the allocation."
                    );
                }

                if (
                    !MUTABLE_REQUEST_STATUSES.includes(
                        authoritativeRequest.status
                    )
                ) {
                    setError(
                        "Responsibility allocations can only be changed while the maintenance request is still mutable."
                    );
                    return;
                }

                if (
                    !authoritativeRequest.updated_at
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
                    responsibility_public_id:
                        responsibility.public_id,
                    expected_responsibility_updated_at:
                        responsibility.updated_at,
                    party_type:
                        form.party_type,
                    tenant_public_id:
                        form.party_type ===
                            "tenant"
                            ? maintenanceRequest
                                  .tenant
                                  .public_id
                            : null,
                    provider_name:
                        PROVIDER_PARTY_TYPES.includes(
                            form.party_type
                        )
                            ? providerName
                            : null,
                    allocated_amount:
                        allocatedAmount,
                    allocation_percentage:
                        allocationPercentage,
                    reason
                };

                const response =
                    await apiClient.post(
                        `/maintenance/requests/${encodeURIComponent(
                            maintenanceRequest.public_id
                        )}/responsibility/allocations`,
                        body,
                        config
                    );

                await onCreated?.(
                    response?.data?.data ||
                        null
                );
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
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <Scale className="h-5 w-5 text-blue-600" />

                            <h3 className="text-xl font-bold text-slate-950">
                                Add Responsibility Allocation
                            </h3>
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                            Allocate maintenance liability by amount or percentage to one responsible party.
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close responsibility allocation modal"
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

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                            Responsibility: <span className="font-semibold">{String(
                                responsibility.responsibility_status ||
                                    "pending_review"
                            ).replaceAll("_", " ")}</span>. Creating an allocation updates the responsibility concurrency timestamp automatically.
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Responsible Party
                                </span>

                                <select
                                    value={
                                        form.party_type
                                    }
                                    disabled={submitting}
                                    onChange={event =>
                                        update(
                                            "party_type",
                                            event.target.value
                                        )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                >
                                    {PARTY_TYPES.map(
                                        ([value, label]) => (
                                            <option
                                                key={value}
                                                value={value}
                                                disabled={
                                                    value ===
                                                        "tenant" &&
                                                    !maintenanceRequest
                                                        ?.tenant
                                                        ?.public_id
                                                }
                                            >
                                                {label}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Allocation Method
                                </span>

                                <select
                                    value={
                                        form.allocation_method
                                    }
                                    disabled={
                                        submitting ||
                                        Boolean(
                                            existingAllocationMethod
                                        )
                                    }
                                    onChange={event =>
                                        update(
                                            "allocation_method",
                                            event.target.value
                                        )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                >
                                    <option value="percentage">
                                        Percentage
                                    </option>
                                    <option value="amount">
                                        Amount
                                    </option>
                                </select>

                                {existingAllocationMethod && (
                                    <p className="mt-1 text-xs text-slate-500">
                                        Active allocations already use the {existingAllocationMethod} method, so the same method is required for this allocation.
                                    </p>
                                )}
                            </label>

                            {form.party_type ===
                                "tenant" && (
                                <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Tenant
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                        {maintenanceRequest
                                            ?.tenant
                                            ?.display_name ||
                                            maintenanceRequest
                                                ?.tenant
                                                ?.public_id ||
                                            "—"}
                                    </p>
                                </div>
                            )}

                            {PROVIDER_PARTY_TYPES.includes(
                                form.party_type
                            ) && (
                                <label className="block sm:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Provider / Party Name *
                                    </span>

                                    <input
                                        type="text"
                                        maxLength={255}
                                        value={
                                            form.provider_name
                                        }
                                        disabled={submitting}
                                        onChange={event =>
                                            update(
                                                "provider_name",
                                                event.target.value
                                            )
                                        }
                                        placeholder="e.g. ABC Insurance, vendor or external contractor"
                                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                    />
                                </label>
                            )}

                            {form.allocation_method ===
                            "amount" ? (
                                <label className="block sm:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Allocated Amount *
                                    </span>

                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={
                                            form.allocated_amount
                                        }
                                        disabled={submitting}
                                        onChange={event =>
                                            update(
                                                "allocated_amount",
                                                event.target.value
                                            )
                                        }
                                        placeholder="e.g. 150000"
                                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                    />
                                </label>
                            ) : (
                                <label className="block sm:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Allocation Percentage *
                                    </span>

                                    <div className="mt-2 flex items-center rounded-xl border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={
                                                form.allocation_percentage
                                            }
                                            disabled={submitting}
                                            onChange={event =>
                                                update(
                                                    "allocation_percentage",
                                                    event.target.value
                                                )
                                            }
                                            placeholder="e.g. 50"
                                            className="min-w-0 flex-1 rounded-xl border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none disabled:bg-slate-100"
                                        />
                                        <span className="px-3 text-sm font-semibold text-slate-500">
                                            %
                                        </span>
                                    </div>
                                </label>
                            )}

                            <label className="block sm:col-span-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Allocation Reason *
                                </span>

                                <textarea
                                    rows={4}
                                    maxLength={2000}
                                    value={
                                        form.reason
                                    }
                                    disabled={submitting}
                                    onChange={event =>
                                        update(
                                            "reason",
                                            event.target.value
                                        )
                                    }
                                    placeholder="Explain why this party carries this share of the maintenance responsibility."
                                    className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
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
                        disabled={submitting}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        {submitting
                            ? "Adding Allocation..."
                            : "Add Allocation"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default CreateMaintenanceResponsibilityAllocationModal;

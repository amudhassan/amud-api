import {
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

const COVERAGE_TYPES = [
    ["none", "None"],
    ["manufacturer_warranty", "Manufacturer Warranty"],
    ["vendor_warranty", "Vendor Warranty"],
    ["service_contract", "Service Contract"],
    ["insurance", "Insurance"],
    ["landlord_responsibility", "Landlord Responsibility"],
    ["tenant_responsibility", "Tenant Responsibility"],
    ["shared_responsibility", "Shared Responsibility"],
    ["under_investigation", "Under Investigation"]
];

const RESPONSIBILITY_STATUSES = [
    ["pending_review", "Pending Review"],
    ["owner", "Owner"],
    ["tenant", "Tenant"],
    ["shared", "Shared"],
    ["warranty_provider", "Warranty Provider"],
    ["insurance_provider", "Insurance Provider"],
    ["external_party", "External Party"],
    ["not_applicable", "Not Applicable"]
];

const MUTABLE_REQUEST_STATUSES = [
    "reported",
    "under_review",
    "assigned",
    "in_progress",
    "on_hold",
    "resolved"
];

const PROVIDER_REQUIRED_COVERAGE = [
    "manufacturer_warranty",
    "vendor_warranty",
    "service_contract",
    "insurance"
];

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to determine maintenance responsibility.";

const getRequestFromResponse = response =>
    response?.data?.data
        ?.maintenance_request ||
    response?.data
        ?.maintenance_request ||
    null;

const getResponsibilityFromResponse = response =>
    response?.data?.data
        ?.maintenance_responsibility ||
    response?.data
        ?.maintenance_responsibility ||
    null;

const makeForm = ({
    maintenanceRequest,
    responsibility
}) => ({
    coverage_type:
        responsibility?.coverage_type ||
        maintenanceRequest
            ?.responsibility
            ?.coverage_type ||
        "under_investigation",
    provider_name:
        responsibility?.provider_name ||
        "",
    contract_or_policy_reference:
        responsibility
            ?.contract_or_policy_reference ||
        "",
    coverage_start_date:
        responsibility
            ?.coverage_start_date ||
        "",
    coverage_end_date:
        responsibility
            ?.coverage_end_date ||
        "",
    claim_reference:
        responsibility
            ?.claim_reference ||
        "",
    coverage_notes:
        responsibility
            ?.coverage_notes ||
        "",
    responsibility_status:
        responsibility
            ?.responsibility_status ||
        maintenanceRequest
            ?.responsibility
            ?.status ||
        "pending_review"
});

function DetermineMaintenanceResponsibilityModal({
    open,
    maintenanceRequest,
    accessContext,
    onClose,
    onDetermined
}) {
    const [
        form,
        setForm
    ] = useState(() =>
        makeForm({
            maintenanceRequest,
            responsibility: null
        })
    );

    const [
        responsibilitySnapshot,
        setResponsibilitySnapshot
    ] = useState(null);

    const [
        loading,
        setLoading
    ] = useState(false);

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    useEffect(() => {
        if (
            !open ||
            !maintenanceRequest
                ?.public_id
        ) {
            return undefined;
        }

        let active = true;

        const loadResponsibility =
            async () => {
                try {
                    setLoading(true);
                    setError("");
                    setResponsibilitySnapshot(
                        null
                    );
                    setForm(
                        makeForm({
                            maintenanceRequest,
                            responsibility:
                                null
                        })
                    );

                    const params = {
                        page: 1,
                        limit: 1
                    };

                    if (accessContext) {
                        params.access_context =
                            accessContext;
                    }

                    const response =
                        await apiClient.get(
                            `/maintenance/requests/${encodeURIComponent(
                                maintenanceRequest.public_id
                            )}/responsibility/allocations`,
                            {
                                params
                            }
                        );

                    if (!active) {
                        return;
                    }

                    const responsibility =
                        getResponsibilityFromResponse(
                            response
                        );

                    setResponsibilitySnapshot(
                        responsibility
                    );
                    setForm(
                        makeForm({
                            maintenanceRequest,
                            responsibility
                        })
                    );
                } catch (
                    requestError
                ) {
                    if (!active) {
                        return;
                    }

                    /*
                     * A responsibility record does not exist yet.
                     * The determine endpoint creates the first one.
                     */
                    if (
                        requestError
                            ?.response
                            ?.status === 404
                    ) {
                        setResponsibilitySnapshot(
                            null
                        );
                        setForm(
                            makeForm({
                                maintenanceRequest,
                                responsibility:
                                    null
                            })
                        );
                    } else {
                        setError(
                            getErrorMessage(
                                requestError
                            )
                        );
                    }
                } finally {
                    if (active) {
                        setLoading(false);
                    }
                }
            };

        loadResponsibility();

        return () => {
            active = false;
        };
    }, [
        accessContext,
        maintenanceRequest,
        open
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
        !maintenanceRequest
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

            if (loading) {
                setError(
                    "Wait for the current responsibility determination to finish loading."
                );
                return;
            }

            if (
                !COVERAGE_TYPES.some(
                    ([value]) =>
                        value ===
                        form.coverage_type
                )
            ) {
                setError(
                    "Select a valid maintenance coverage type."
                );
                return;
            }

            if (
                !RESPONSIBILITY_STATUSES.some(
                    ([value]) =>
                        value ===
                        form.responsibility_status
                )
            ) {
                setError(
                    "Select a valid maintenance responsibility status."
                );
                return;
            }

            const providerName =
                form.provider_name.trim();
            const contractReference =
                form.contract_or_policy_reference
                    .trim();
            const claimReference =
                form.claim_reference
                    .trim();
            const coverageNotes =
                form.coverage_notes
                    .trim();

            if (
                PROVIDER_REQUIRED_COVERAGE.includes(
                    form.coverage_type
                ) &&
                !providerName
            ) {
                setError(
                    "Provider name is required for warranty, service-contract or insurance coverage."
                );
                return;
            }

            if (
                providerName.length > 255 ||
                contractReference.length >
                    255 ||
                claimReference.length >
                    255
            ) {
                setError(
                    "Provider, contract/policy and claim references cannot exceed 255 characters."
                );
                return;
            }

            if (
                coverageNotes.length >
                    3000
            ) {
                setError(
                    "Coverage notes cannot exceed 3000 characters."
                );
                return;
            }

            if (
                form.coverage_start_date &&
                form.coverage_end_date &&
                form.coverage_start_date >
                    form.coverage_end_date
            ) {
                setError(
                    "Coverage start date cannot be after coverage end date."
                );
                return;
            }

            if (
                responsibilitySnapshot &&
                (
                    !responsibilitySnapshot
                        .public_id ||
                    !responsibilitySnapshot
                        .updated_at
                )
            ) {
                setError(
                    "The current responsibility concurrency snapshot is incomplete. Close and reopen this form."
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
                 * Refresh the parent request immediately before
                 * the nested responsibility write. The responsibility
                 * itself keeps the snapshot loaded when this form opened,
                 * so a concurrent responsibility edit still returns 409.
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
                        "Unable to refresh the maintenance request before determining responsibility."
                    );
                }

                if (
                    !MUTABLE_REQUEST_STATUSES.includes(
                        authoritativeRequest
                            .status
                    )
                ) {
                    setError(
                        "Responsibility can only be determined while the maintenance request is still mutable."
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
                    coverage_type:
                        form.coverage_type,
                    provider_name:
                        providerName || null,
                    contract_or_policy_reference:
                        contractReference ||
                        null,
                    coverage_start_date:
                        form.coverage_start_date ||
                        null,
                    coverage_end_date:
                        form.coverage_end_date ||
                        null,
                    claim_reference:
                        claimReference || null,
                    coverage_notes:
                        coverageNotes || null,
                    responsibility_status:
                        form.responsibility_status
                };

                if (
                    responsibilitySnapshot
                ) {
                    body.responsibility_public_id =
                        responsibilitySnapshot
                            .public_id;
                    body.expected_responsibility_updated_at =
                        responsibilitySnapshot
                            .updated_at;
                }

                await apiClient.post(
                    `/maintenance/requests/${encodeURIComponent(
                        maintenanceRequest.public_id
                    )}/responsibility/determine`,
                    body,
                    config
                );

                await onDetermined?.();
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
                className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <Scale className="h-5 w-5 text-blue-600" />

                            <h3 className="text-xl font-bold text-slate-950">
                                {responsibilitySnapshot
                                    ? "Update Maintenance Responsibility"
                                    : "Determine Maintenance Responsibility"}
                            </h3>
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                            Record who is responsible and whether warranty, insurance or another coverage source applies.
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close maintenance responsibility modal"
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

                        {loading && (
                            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                                Loading current responsibility determination...
                            </div>
                        )}

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                            Existing responsibility records use optimistic concurrency. If another operation changes the determination while this form is open, save is rejected so you can refresh safely.
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Coverage Type
                                </span>

                                <select
                                    value={
                                        form.coverage_type
                                    }
                                    disabled={
                                        loading ||
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "coverage_type",
                                                event.target.value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                >
                                    {COVERAGE_TYPES.map(
                                        ([value, label]) => (
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
                                    Responsibility Status
                                </span>

                                <select
                                    value={
                                        form.responsibility_status
                                    }
                                    disabled={
                                        loading ||
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "responsibility_status",
                                                event.target.value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                >
                                    {RESPONSIBILITY_STATUSES.map(
                                        ([value, label]) => (
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

                            <label className="block sm:col-span-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Provider Name
                                    {PROVIDER_REQUIRED_COVERAGE.includes(
                                        form.coverage_type
                                    )
                                        ? " *"
                                        : ""}
                                </span>

                                <input
                                    type="text"
                                    maxLength={255}
                                    value={
                                        form.provider_name
                                    }
                                    disabled={
                                        loading ||
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "provider_name",
                                                event.target.value
                                            )
                                    }
                                    placeholder="e.g. Insurance company, vendor or warranty provider"
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                />
                            </label>

                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Contract / Policy Reference
                                </span>

                                <input
                                    type="text"
                                    maxLength={255}
                                    value={
                                        form.contract_or_policy_reference
                                    }
                                    disabled={
                                        loading ||
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "contract_or_policy_reference",
                                                event.target.value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                />
                            </label>

                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Claim Reference
                                </span>

                                <input
                                    type="text"
                                    maxLength={255}
                                    value={
                                        form.claim_reference
                                    }
                                    disabled={
                                        loading ||
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "claim_reference",
                                                event.target.value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                />
                            </label>

                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Coverage Start Date
                                </span>

                                <input
                                    type="date"
                                    value={
                                        form.coverage_start_date
                                    }
                                    disabled={
                                        loading ||
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "coverage_start_date",
                                                event.target.value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                />
                            </label>

                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Coverage End Date
                                </span>

                                <input
                                    type="date"
                                    value={
                                        form.coverage_end_date
                                    }
                                    disabled={
                                        loading ||
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "coverage_end_date",
                                                event.target.value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                />
                            </label>

                            <label className="block sm:col-span-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Coverage Notes
                                </span>

                                <textarea
                                    rows={4}
                                    maxLength={3000}
                                    value={
                                        form.coverage_notes
                                    }
                                    disabled={
                                        loading ||
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "coverage_notes",
                                                event.target.value
                                            )
                                    }
                                    placeholder="Reasoning, supporting coverage details or responsibility notes"
                                    className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
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
                        disabled={
                            loading ||
                            submitting
                        }
                    >
                        {submitting
                            ? "Saving..."
                            : responsibilitySnapshot
                                ? "Save Responsibility Changes"
                                : "Determine Responsibility"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default DetermineMaintenanceResponsibilityModal;

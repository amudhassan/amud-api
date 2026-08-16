import {
    ShieldX,
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

const MUTABLE_REQUEST_STATUSES = [
    "reported",
    "under_review",
    "assigned",
    "in_progress",
    "on_hold",
    "resolved"
];

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to revoke the responsibility allocation.";

const getMaintenanceRequest = response =>
    response?.data?.data
        ?.maintenance_request ||
    response?.data
        ?.maintenance_request ||
    null;

const getResponsibility = response =>
    response?.data?.data
        ?.maintenance_responsibility ||
    response?.data
        ?.maintenance_responsibility ||
    null;

const getAllocations = response =>
    response?.data?.data
        ?.responsibility_allocations ||
    response?.data
        ?.responsibility_allocations ||
    [];

const allocationValue = allocation => {
    if (!allocation) {
        return "—";
    }

    if (
        allocation.allocation_method ===
            "amount"
    ) {
        return allocation.allocated_amount ??
            "—";
    }

    return `${Number(
        allocation.allocation_percentage ||
            0
    ).toLocaleString(
        undefined,
        {
            maximumFractionDigits: 4
        }
    )}%`;
};

function RevokeMaintenanceResponsibilityAllocationModal({
    open,
    maintenanceRequest,
    allocation,
    accessContext,
    onClose,
    onRevoked
}) {
    const [
        authoritativeRequest,
        setAuthoritativeRequest
    ] = useState(null);

    const [
        authoritativeResponsibility,
        setAuthoritativeResponsibility
    ] = useState(null);

    const [
        authoritativeAllocation,
        setAuthoritativeAllocation
    ] = useState(null);

    const [
        revocationReason,
        setRevocationReason
    ] = useState("");

    const [
        loadingSnapshot,
        setLoadingSnapshot
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
        if (!open) {
            return;
        }

        setAuthoritativeRequest(null);
        setAuthoritativeResponsibility(null);
        setAuthoritativeAllocation(null);
        setRevocationReason("");
        setLoadingSnapshot(false);
        setSubmitting(false);
        setError("");
    }, [
        open,
        allocation?.public_id
    ]);

    useEffect(() => {
        if (
            !open ||
            !maintenanceRequest?.public_id ||
            !allocation?.public_id
        ) {
            return;
        }

        let cancelled = false;

        const loadSnapshot = async () => {
            try {
                setLoadingSnapshot(true);
                setError("");

                const requestConfig = {};
                const allocationParams = {
                    page: 1,
                    limit: 100,
                    sort_order: "desc",
                    include_revoked: true
                };

                if (accessContext) {
                    requestConfig.params = {
                        access_context:
                            accessContext
                    };
                    allocationParams.access_context =
                        accessContext;
                }

                const [
                    requestResponse,
                    allocationsResponse
                ] = await Promise.all([
                    apiClient.get(
                        `/maintenance/requests/${encodeURIComponent(
                            maintenanceRequest.public_id
                        )}`,
                        requestConfig
                    ),
                    apiClient.get(
                        `/maintenance/requests/${encodeURIComponent(
                            maintenanceRequest.public_id
                        )}/responsibility/allocations`,
                        {
                            params:
                                allocationParams
                        }
                    )
                ]);

                const freshRequest =
                    getMaintenanceRequest(
                        requestResponse
                    );
                const freshResponsibility =
                    getResponsibility(
                        allocationsResponse
                    );
                const freshAllocation =
                    getAllocations(
                        allocationsResponse
                    ).find(
                        row =>
                            row.public_id ===
                            allocation.public_id
                    );

                if (!freshRequest) {
                    throw new Error(
                        "The maintenance request could not be refreshed before revocation."
                    );
                }

                if (!freshResponsibility) {
                    throw new Error(
                        "The maintenance responsibility could not be refreshed before revocation."
                    );
                }

                if (!freshAllocation) {
                    throw new Error(
                        "The responsibility allocation could not be refreshed before revocation."
                    );
                }

                if (freshAllocation.revoked) {
                    throw new Error(
                        "This responsibility allocation has already been revoked."
                    );
                }

                if (!cancelled) {
                    setAuthoritativeRequest(
                        freshRequest
                    );
                    setAuthoritativeResponsibility(
                        freshResponsibility
                    );
                    setAuthoritativeAllocation(
                        freshAllocation
                    );
                }
            } catch (requestError) {
                if (!cancelled) {
                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingSnapshot(false);
                }
            }
        };

        loadSnapshot();

        return () => {
            cancelled = true;
        };
    }, [
        accessContext,
        allocation?.public_id,
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
                !submitting &&
                !loadingSnapshot
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
        loadingSnapshot,
        onClose,
        open,
        submitting
    ]);

    if (
        !open ||
        !maintenanceRequest ||
        !allocation
    ) {
        return null;
    }

    const submit = async event => {
        event.preventDefault();

        if (
            !authoritativeRequest ||
            !authoritativeResponsibility ||
            !authoritativeAllocation
        ) {
            setError(
                "Refresh the responsibility allocation before revoking it."
            );
            return;
        }

        if (
            !MUTABLE_REQUEST_STATUSES.includes(
                authoritativeRequest.status
            )
        ) {
            setError(
                `Responsibility allocations cannot be changed while the maintenance request is ${formatLabel(
                    authoritativeRequest.status
                )}.`
            );
            return;
        }

        if (
            !authoritativeRequest.updated_at ||
            !authoritativeResponsibility.public_id ||
            !authoritativeResponsibility.updated_at
        ) {
            setError(
                "The concurrency snapshot is incomplete. Close and reopen the maintenance request, then try again."
            );
            return;
        }

        if (authoritativeAllocation.revoked) {
            setError(
                "This responsibility allocation has already been revoked."
            );
            return;
        }

        const reason =
            revocationReason.trim();

        if (
            reason.length < 3 ||
            reason.length > 2000
        ) {
            setError(
                "Responsibility allocation revocation reason must contain between 3 and 2000 characters."
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

            await apiClient.post(
                `/maintenance/requests/${encodeURIComponent(
                    maintenanceRequest.public_id
                )}/responsibility/allocations/${encodeURIComponent(
                    authoritativeAllocation.public_id
                )}/revoke`,
                {
                    expected_request_status:
                        authoritativeRequest.status,
                    expected_request_updated_at:
                        authoritativeRequest.updated_at,
                    responsibility_public_id:
                        authoritativeResponsibility.public_id,
                    expected_responsibility_updated_at:
                        authoritativeResponsibility.updated_at,
                    revocation_reason:
                        reason
                },
                config
            );

            await onRevoked?.();
        } catch (requestError) {
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setSubmitting(false);
        }
    };

    const displayAllocation =
        authoritativeAllocation ||
        allocation;

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Revoke Responsibility Allocation
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Remove this party from the active maintenance liability allocation without deleting its audit history.
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close revoke responsibility allocation modal"
                        disabled={
                            submitting ||
                            loadingSnapshot
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

                        {loadingSnapshot && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                Refreshing allocation and concurrency state...
                            </div>
                        )}

                        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Responsible Party
                                </p>
                                <p className="mt-1 text-sm font-bold text-slate-900">
                                    {displayAllocation.tenant
                                        ?.tenant_name ||
                                        displayAllocation.provider_name ||
                                        formatLabel(
                                            displayAllocation.party_type
                                        ) ||
                                        "—"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Allocation
                                </p>
                                <p className="mt-1 text-sm font-bold text-slate-900">
                                    {allocationValue(
                                        displayAllocation
                                    )}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Method
                                </p>
                                <p className="mt-1 text-sm font-bold text-slate-900">
                                    {formatLabel(
                                        displayAllocation.allocation_method
                                    ) || "—"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Request Status
                                </p>
                                <p className="mt-1 text-sm font-bold text-slate-900">
                                    {formatLabel(
                                        authoritativeRequest
                                            ?.status ||
                                        maintenanceRequest.status
                                    ) || "—"}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            Revocation keeps the allocation in the audit trail, but it will no longer count toward the active allocated total.
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Revocation Reason *
                            </span>

                            <textarea
                                value={
                                    revocationReason
                                }
                                disabled={
                                    submitting ||
                                    loadingSnapshot
                                }
                                minLength={3}
                                maxLength={2000}
                                rows={6}
                                placeholder="Explain why this responsibility allocation is being revoked..."
                                onChange={event => {
                                    setRevocationReason(
                                        event.target.value
                                    );

                                    if (error) {
                                        setError("");
                                    }
                                }}
                                className="mt-2 min-h-36 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {revocationReason.length}/2000
                            </p>
                        </label>
                    </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={
                            submitting ||
                            loadingSnapshot
                        }
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        leftIcon={ShieldX}
                        disabled={
                            submitting ||
                            loadingSnapshot ||
                            !authoritativeRequest ||
                            !authoritativeResponsibility ||
                            !authoritativeAllocation
                        }
                    >
                        {submitting
                            ? "Revoking Allocation..."
                            : "Revoke Allocation"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default RevokeMaintenanceResponsibilityAllocationModal;

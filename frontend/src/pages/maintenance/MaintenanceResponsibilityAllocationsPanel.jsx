import {
    Coins,
    Percent,
    Plus,
    RefreshCw,
    Scale,
    ShieldCheck,
    ShieldX
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

import CreateMaintenanceResponsibilityAllocationModal from "./CreateMaintenanceResponsibilityAllocationModal";
import RevokeMaintenanceResponsibilityAllocationModal from "./RevokeMaintenanceResponsibilityAllocationModal";

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

const formatAmount = (
    amount,
    currencyCode
) => {
    if (
        amount === null ||
        amount === undefined ||
        amount === ""
    ) {
        return "—";
    }

    const numeric = Number(amount);

    if (!Number.isFinite(numeric)) {
        return String(amount);
    }

    const currency =
        currencyCode || "TZS";

    try {
        return new Intl.NumberFormat(
            undefined,
            {
                style: "currency",
                currency,
                maximumFractionDigits: 2
            }
        ).format(numeric);
    } catch {
        return `${currency} ${numeric.toLocaleString()}`;
    }
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load responsibility allocations.";

const getAllocationRows = response =>
    response?.data?.data
        ?.responsibility_allocations ||
    response?.data
        ?.responsibility_allocations ||
    [];

const getResponsibility = response =>
    response?.data?.data
        ?.maintenance_responsibility ||
    response?.data
        ?.maintenance_responsibility ||
    null;

function SummaryCard({
    label,
    value
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </p>
            <p className="mt-2 text-base font-bold text-slate-950">
                {value}
            </p>
        </div>
    );
}

function MaintenanceResponsibilityAllocationsPanel({
    maintenanceRequest,
    accessContext,
    onChanged
}) {
    const [
        allocations,
        setAllocations
    ] = useState([]);

    const [
        responsibility,
        setResponsibility
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
        createOpen,
        setCreateOpen
    ] = useState(false);

    const [
        allocationToRevoke,
        setAllocationToRevoke
    ] = useState(null);

    const loadAllocations =
        useCallback(
            async () => {
                if (
                    !maintenanceRequest
                        ?.public_id
                ) {
                    return;
                }

                try {
                    setLoading(true);
                    setError("");

                    const params = {
                        page: 1,
                        limit: 100,
                        sort_order: "desc"
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

                    setResponsibility(
                        getResponsibility(
                            response
                        )
                    );
                    setAllocations(
                        getAllocationRows(
                            response
                        )
                    );
                } catch (
                    requestError
                ) {
                    setAllocations([]);
                    setResponsibility(null);

                    if (
                        requestError
                            ?.response
                            ?.status === 404
                    ) {
                        setError("");
                    } else {
                        setError(
                            getErrorMessage(
                                requestError
                            )
                        );
                    }
                } finally {
                    setLoading(false);
                }
            },
            [
                accessContext,
                maintenanceRequest
                    ?.public_id
            ]
        );

    useEffect(() => {
        loadAllocations();
    }, [
        loadAllocations,
        maintenanceRequest
            ?.updated_at,
        maintenanceRequest
            ?.responsibility
            ?.status,
        maintenanceRequest
            ?.responsibility
            ?.coverage_type
    ]);

    const activeAllocations =
        useMemo(
            () =>
                allocations.filter(
                    allocation =>
                        !allocation.revoked
                ),
            [allocations]
        );

    const allocationMethod =
        activeAllocations[0]
            ?.allocation_method ||
        "—";

    const allocatedTotal =
        useMemo(() => {
            if (
                activeAllocations.length ===
                0
            ) {
                return "—";
            }

            if (
                allocationMethod ===
                "amount"
            ) {
                const total =
                    activeAllocations.reduce(
                        (sum, allocation) =>
                            sum +
                            Number(
                                allocation
                                    .allocated_amount ||
                                    0
                            ),
                        0
                    );

                return formatAmount(
                    total,
                    maintenanceRequest
                        ?.cost_summary
                        ?.currency_code ||
                        maintenanceRequest
                            ?.lease
                            ?.currency_code ||
                        "TZS"
                );
            }

            if (
                allocationMethod ===
                "percentage"
            ) {
                const total =
                    activeAllocations.reduce(
                        (sum, allocation) =>
                            sum +
                            Number(
                                allocation
                                    .allocation_percentage ||
                                    0
                            ),
                        0
                    );

                return `${total.toLocaleString(
                    undefined,
                    {
                        maximumFractionDigits:
                            4
                    }
                )}%`;
            }

            return "—";
        }, [
            activeAllocations,
            allocationMethod,
            maintenanceRequest
                ?.cost_summary
                ?.currency_code,
            maintenanceRequest
                ?.lease
                ?.currency_code
        ]);

    const canCreate =
        Boolean(
            responsibility &&
            (
                !accessContext ||
                accessContext ===
                    "owner"
            ) &&
            MUTABLE_REQUEST_STATUSES.includes(
                maintenanceRequest
                    ?.status
            )
        );

    return (
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-700">
                        <Scale className="h-5 w-5" />
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-slate-950">
                            Responsibility Allocations
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Track how approved maintenance liability is shared between the owner, tenant, insurer, warranty provider or another party.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={loading}
                        onClick={loadAllocations}
                    >
                        <RefreshCw
                            className={`mr-2 h-4 w-4 ${
                                loading
                                    ? "animate-spin"
                                    : ""
                            }`}
                        />
                        Refresh
                    </Button>

                    {canCreate && (
                        <Button
                            type="button"
                            onClick={() =>
                                setCreateOpen(
                                    true
                                )
                            }
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Allocation
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}

                {!responsibility &&
                    !loading &&
                    !error && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                            Determine maintenance responsibility first. Allocations become available after a responsibility record exists.
                        </div>
                    )}

                {responsibility && (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <SummaryCard
                                label="Responsibility"
                                value={
                                    formatLabel(
                                        responsibility.responsibility_status
                                    ) ||
                                    "—"
                                }
                            />
                            <SummaryCard
                                label="Coverage"
                                value={
                                    formatLabel(
                                        responsibility.coverage_type
                                    ) ||
                                    "—"
                                }
                            />
                            <SummaryCard
                                label="Active Allocations"
                                value={
                                    activeAllocations.length
                                }
                            />
                            <SummaryCard
                                label="Allocated Total"
                                value={
                                    allocatedTotal
                                }
                            />
                        </div>

                        {loading ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                Loading responsibility allocations...
                            </div>
                        ) : activeAllocations.length ===
                          0 ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center">
                                <ShieldCheck className="mx-auto h-7 w-7 text-slate-400" />
                                <p className="mt-3 text-sm font-semibold text-slate-800">
                                    No active responsibility allocations yet.
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                    Add an allocation when liability needs to be assigned to a specific party.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeAllocations.map(
                                    allocation => (
                                        <article
                                            key={
                                                allocation.public_id
                                            }
                                            className="rounded-2xl border border-slate-200 p-4"
                                        >
                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                                            {formatLabel(
                                                                allocation.party_type
                                                            )}
                                                        </span>

                                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                                            {allocation.allocation_method ===
                                                            "amount" ? (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <Coins className="h-3.5 w-3.5" />
                                                                    Amount
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <Percent className="h-3.5 w-3.5" />
                                                                    Percentage
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>

                                                    <p className="mt-3 text-sm font-semibold text-slate-950">
                                                        {allocation.tenant
                                                            ?.tenant_name ||
                                                            allocation.provider_name ||
                                                            formatLabel(
                                                                allocation.party_type
                                                            )}
                                                    </p>

                                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                                        {allocation.reason}
                                                    </p>
                                                </div>

                                                <div className="sm:text-right">
                                                    <p className="text-lg font-bold text-slate-950">
                                                        {allocation.allocation_method ===
                                                        "amount"
                                                            ? formatAmount(
                                                                  allocation.allocated_amount,
                                                                  maintenanceRequest
                                                                      ?.cost_summary
                                                                      ?.currency_code ||
                                                                      maintenanceRequest
                                                                          ?.lease
                                                                          ?.currency_code ||
                                                                      "TZS"
                                                              )
                                                            : `${Number(
                                                                  allocation.allocation_percentage ||
                                                                      0
                                                              ).toLocaleString(
                                                                  undefined,
                                                                  {
                                                                      maximumFractionDigits:
                                                                          4
                                                                  }
                                                              )}%`}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        Approved {formatDateTime(
                                                            allocation.approved_at
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                                {allocation.approved_by ? (
                                                    <p className="text-xs text-slate-500">
                                                        Approved by {allocation.approved_by.full_name ||
                                                            allocation.approved_by.public_id}
                                                    </p>
                                                ) : (
                                                    <span />
                                                )}

                                                {canCreate && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        onClick={() =>
                                                            setAllocationToRevoke(
                                                                allocation
                                                            )
                                                        }
                                                    >
                                                        <ShieldX className="mr-2 h-4 w-4" />
                                                        Revoke Allocation
                                                    </Button>
                                                )}
                                            </div>
                                        </article>
                                    )
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>


            <RevokeMaintenanceResponsibilityAllocationModal
                open={Boolean(
                    allocationToRevoke
                )}
                maintenanceRequest={
                    maintenanceRequest
                }
                allocation={
                    allocationToRevoke
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setAllocationToRevoke(
                        null
                    )
                }
                onRevoked={async () => {
                    setAllocationToRevoke(
                        null
                    );
                    await loadAllocations();
                    onChanged?.();
                }}
            />

            <CreateMaintenanceResponsibilityAllocationModal
                open={createOpen}
                maintenanceRequest={
                    maintenanceRequest
                }
                responsibility={
                    responsibility
                }
                existingAllocationMethod={
                    activeAllocations[0]
                        ?.allocation_method ||
                    null
                }
                accessContext={
                    accessContext
                }
                onClose={() =>
                    setCreateOpen(false)
                }
                onCreated={async () => {
                    setCreateOpen(false);
                    await loadAllocations();
                    onChanged?.();
                }}
            />
        </section>
    );
}

export default MaintenanceResponsibilityAllocationsPanel;

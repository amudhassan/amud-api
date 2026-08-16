import {
    Ban,
    CheckCircle2,
    Coins,
    History,
    Pencil,
    ReceiptText,
    Plus,
    RefreshCw,
    Send,
    XCircle
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

import ApproveMaintenanceCostModal from "./ApproveMaintenanceCostModal";
import CancelMaintenanceCostModal from "./CancelMaintenanceCostModal";
import CreateMaintenanceCostModal from "./CreateMaintenanceCostModal";
import EditMaintenanceCostModal from "./EditMaintenanceCostModal";
import IncurMaintenanceCostModal from "./IncurMaintenanceCostModal";
import MaintenanceCostApprovalHistoryModal from "./MaintenanceCostApprovalHistoryModal";
import RejectMaintenanceCostModal from "./RejectMaintenanceCostModal";
import SubmitMaintenanceCostModal from "./SubmitMaintenanceCostModal";

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

    const numeric =
        Number(amount);

    if (
        Number.isNaN(numeric)
    ) {
        return String(amount);
    }

    const currency =
        currencyCode ||
        "TZS";

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
    "Unable to load maintenance costs.";

const getRows = response => {
    const body =
        response?.data || {};

    const data =
        body?.data || {};

    const candidates = [
        data.maintenance_costs,
        data.costs,
        body.maintenance_costs,
        body.costs
    ];

    return (
        candidates.find(
            Array.isArray
        ) || []
    );
};

const statusClassName =
    status => {
        switch (status) {
            case "approved":
                return "border-blue-200 bg-blue-50 text-blue-700";

            case "incurred":
                return "border-emerald-200 bg-emerald-50 text-emerald-700";

            case "submitted":
                return "border-amber-200 bg-amber-50 text-amber-700";

            case "rejected":
            case "cancelled":
                return "border-rose-200 bg-rose-50 text-rose-700";

            case "draft":
            default:
                return "border-slate-200 bg-slate-50 text-slate-700";
        }
    };

function SummaryCard({
    label,
    value
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </p>

            <p className="mt-2 text-lg font-bold text-slate-950">
                {value}
            </p>
        </div>
    );
}

function MaintenanceCostsPanel({
    maintenanceRequest,
    accessContext,
    onChanged
}) {
    const [
        costs,
        setCosts
    ] = useState([]);

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
        submitCost,
        setSubmitCost
    ] = useState(null);

    const [
        editCost,
        setEditCost
    ] = useState(null);

    const [
        approveCost,
        setApproveCost
    ] = useState(null);

    const [
        incurCost,
        setIncurCost
    ] = useState(null);

    const [
        rejectCost,
        setRejectCost
    ] = useState(null);

    const [
        cancelCost,
        setCancelCost
    ] = useState(null);

    const [
        historyCost,
        setHistoryCost
    ] = useState(null);

    const loadCosts =
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

                    const config = {};

                    if (
                        accessContext
                    ) {
                        config.params = {
                            access_context:
                                accessContext
                        };
                    }

                    const response =
                        await apiClient.get(
                            `/maintenance/requests/${encodeURIComponent(
                                maintenanceRequest.public_id
                            )}/costs`,
                            config
                        );

                    setCosts(
                        getRows(
                            response
                        )
                    );
                } catch (
                    requestError
                ) {
                    setCosts([]);
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
                accessContext,
                maintenanceRequest
                    ?.public_id
            ]
        );

    useEffect(() => {
        loadCosts();
    }, [
        loadCosts
    ]);

    const summary =
        maintenanceRequest
            ?.cost_summary ||
        maintenanceRequest
            ?.costs_summary ||
        {};

    const currencyCode =
        maintenanceRequest
            ?.currency_code ||
        costs[0]
            ?.currency_code ||
        "TZS";

    const totals =
        useMemo(
            () => {
                const estimated =
                    summary
                        ?.total_estimated_cost ??
                    summary
                        ?.estimated_total ??
                    costs.reduce(
                        (
                            total,
                            cost
                        ) =>
                            total +
                            (
                                [
                                    "rejected",
                                    "cancelled"
                                ].includes(
                                    cost.status
                                )
                                    ? 0
                                    : Number(
                                          cost.estimated_amount ||
                                              0
                                      )
                            ),
                        0
                    );

                const approved =
                    summary
                        ?.total_approved_cost ??
                    summary
                        ?.approved_total ??
                    costs.reduce(
                        (
                            total,
                            cost
                        ) =>
                            total +
                            Number(
                                cost.approved_amount ||
                                    0
                            ),
                        0
                    );

                const actual =
                    summary
                        ?.total_actual_cost ??
                    summary
                        ?.actual_total ??
                    costs.reduce(
                        (
                            total,
                            cost
                        ) =>
                            total +
                            Number(
                                cost.actual_amount ||
                                    0
                            ),
                        0
                    );

                return {
                    estimated,
                    approved,
                    actual
                };
            },
            [
                costs,
                summary
            ]
        );

    const canCreateCost =
        ![
            "closed",
            "rejected",
            "cancelled"
        ].includes(
            maintenanceRequest
                ?.status
        );

    return (
        <>
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                        <Coins className="h-5 w-5" />
                    </span>

                    <div>
                        <h3 className="text-base font-bold text-slate-900">
                            Maintenance Costs
                        </h3>

                        <p className="mt-0.5 text-xs text-slate-500">
                            Estimated, approved and incurred cost records for this request.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {canCreateCost && (
                        <Button
                            type="button"
                            leftIcon={Plus}
                            onClick={() =>
                                setCreateOpen(
                                    true
                                )
                            }
                        >
                            Add Cost
                        </Button>
                    )}

                    <Button
                        type="button"
                        variant="secondary"
                        leftIcon={
                            RefreshCw
                        }
                        disabled={loading}
                        onClick={
                            loadCosts
                        }
                    >
                        Refresh Costs
                    </Button>
                </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                    <SummaryCard
                        label="Estimated"
                        value={formatAmount(
                            totals.estimated,
                            currencyCode
                        )}
                    />

                    <SummaryCard
                        label="Approved"
                        value={formatAmount(
                            totals.approved,
                            currencyCode
                        )}
                    />

                    <SummaryCard
                        label="Actual"
                        value={formatAmount(
                            totals.actual,
                            currencyCode
                        )}
                    />
                </div>

                {loading && (
                    <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        Loading maintenance costs...
                    </div>
                )}

                {!loading &&
                    costs.length ===
                        0 &&
                    !error && (
                        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                            No maintenance cost records have been added to this request yet.
                        </div>
                    )}

                {!loading &&
                    costs.length >
                        0 && (
                        <div className="space-y-3">
                            {costs.map(
                                cost => (
                                    <article
                                        key={
                                            cost.public_id
                                        }
                                        className="rounded-2xl border border-slate-200 p-4"
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">
                                                    {formatLabel(
                                                        cost.cost_type
                                                    ) ||
                                                        "Maintenance Cost"}
                                                </p>

                                                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                                                    {cost.description ||
                                                        "—"}
                                                </p>
                                            </div>

                                            <span
                                                className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(
                                                    cost.status
                                                )}`}
                                            >
                                                {formatLabel(
                                                    cost.status
                                                ) ||
                                                    "Unknown"}
                                            </span>
                                        </div>

                                        <div className="mt-4 grid gap-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                                            <div>
                                                <span className="font-semibold text-slate-500">
                                                    Quantity
                                                </span>

                                                <p className="mt-1">
                                                    {cost.quantity ??
                                                        "—"}
                                                </p>
                                            </div>

                                            <div>
                                                <span className="font-semibold text-slate-500">
                                                    Unit Cost
                                                </span>

                                                <p className="mt-1">
                                                    {formatAmount(
                                                        cost.unit_cost,
                                                        cost.currency_code ||
                                                            currencyCode
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <span className="font-semibold text-slate-500">
                                                    Estimated
                                                </span>

                                                <p className="mt-1">
                                                    {formatAmount(
                                                        cost.estimated_amount,
                                                        cost.currency_code ||
                                                            currencyCode
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <span className="font-semibold text-slate-500">
                                                    Approved
                                                </span>

                                                <p className="mt-1">
                                                    {formatAmount(
                                                        cost.approved_amount,
                                                        cost.currency_code ||
                                                            currencyCode
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <span className="font-semibold text-slate-500">
                                                    Actual
                                                </span>

                                                <p className="mt-1">
                                                    {formatAmount(
                                                        cost.actual_amount,
                                                        cost.currency_code ||
                                                            currencyCode
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <span className="font-semibold text-slate-500">
                                                    Incurred At
                                                </span>

                                                <p className="mt-1">
                                                    {formatDateTime(
                                                        cost.incurred_at
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <span className="font-semibold text-slate-500">
                                                    Vendor Ref.
                                                </span>

                                                <p className="mt-1 break-words">
                                                    {cost.vendor_reference ||
                                                        "—"}
                                                </p>
                                            </div>

                                            <div>
                                                <span className="font-semibold text-slate-500">
                                                    Quotation Ref.
                                                </span>

                                                <p className="mt-1 break-words">
                                                    {cost.quotation_reference ||
                                                        "—"}
                                                </p>
                                            </div>
                                        </div>

                                        {(
                                            cost.status ===
                                                "draft" ||
                                            (
                                                [
                                                    "submitted",
                                                    "approved"
                                                ].includes(
                                                    cost.status
                                                ) &&
                                                cost.latest_approval
                                                    ?.decision ===
                                                    "pending" &&
                                                (
                                                    !accessContext ||
                                                    accessContext ===
                                                        "owner"
                                                )
                                            ) ||
                                            (
                                                cost.status ===
                                                    "approved" &&
                                                cost.latest_approval
                                                    ?.decision !==
                                                    "pending" &&
                                                (
                                                    !accessContext ||
                                                    accessContext ===
                                                        "owner"
                                                )
                                            )
                                        ) && (
                                            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                                                {cost.status ===
                                                    "draft" && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        leftIcon={Pencil}
                                                        onClick={() =>
                                                            setEditCost(
                                                                cost
                                                            )
                                                        }
                                                    >
                                                        Edit Draft
                                                    </Button>
                                                )}

                                                {cost.status ===
                                                    "draft" && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        leftIcon={Send}
                                                        onClick={() =>
                                                            setSubmitCost(
                                                                cost
                                                            )
                                                        }
                                                    >
                                                        Submit for Approval
                                                    </Button>
                                                )}

                                                {[
                                                    "submitted",
                                                    "approved"
                                                ].includes(
                                                    cost.status
                                                ) &&
                                                    cost.latest_approval
                                                        ?.decision ===
                                                        "pending" &&
                                                    (
                                                        !accessContext ||
                                                        accessContext ===
                                                            "owner"
                                                    ) && (
                                                    <Button
                                                        type="button"
                                                        leftIcon={CheckCircle2}
                                                        onClick={() =>
                                                            setApproveCost(
                                                                cost
                                                            )
                                                        }
                                                    >
                                                        Approve Cost
                                                    </Button>
                                                )}

                                                {[
                                                    "submitted",
                                                    "approved"
                                                ].includes(
                                                    cost.status
                                                ) &&
                                                    cost.latest_approval
                                                        ?.decision ===
                                                        "pending" &&
                                                    (
                                                        !accessContext ||
                                                        accessContext ===
                                                            "owner"
                                                    ) && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        leftIcon={XCircle}
                                                        onClick={() =>
                                                            setRejectCost(
                                                                cost
                                                            )
                                                        }
                                                    >
                                                        Reject Cost
                                                    </Button>
                                                )}

                                                {cost.status ===
                                                    "submitted" &&
                                                    cost.latest_approval
                                                        ?.decision ===
                                                        "pending" &&
                                                    cost.latest_approval
                                                        ?.approval_type ===
                                                        "initial" &&
                                                    (
                                                        !accessContext ||
                                                        accessContext ===
                                                            "owner"
                                                    ) && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        leftIcon={Ban}
                                                        onClick={() =>
                                                            setCancelCost(
                                                                cost
                                                            )
                                                        }
                                                    >
                                                        Cancel Cost
                                                    </Button>
                                                )}

                                                {cost.status ===
                                                    "approved" &&
                                                    cost.latest_approval
                                                        ?.decision !==
                                                        "pending" &&
                                                    (
                                                        !accessContext ||
                                                        accessContext ===
                                                            "owner"
                                                    ) && (
                                                    <Button
                                                        type="button"
                                                        leftIcon={ReceiptText}
                                                        onClick={() =>
                                                            setIncurCost(
                                                                cost
                                                            )
                                                        }
                                                    >
                                                        Record Actual Cost
                                                    </Button>
                                                )}

                                                {(cost.status !==
                                                    "draft" ||
                                                    cost.latest_approval) && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        leftIcon={History}
                                                        onClick={() =>
                                                            setHistoryCost(
                                                                cost
                                                            )
                                                        }
                                                    >
                                                        Approval History
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </article>
                                )
                            )}
                        </div>
                    )}
            </div>
        </section>

        <CreateMaintenanceCostModal
            open={createOpen}
            maintenanceRequest={
                maintenanceRequest
            }
            accessContext={
                accessContext
            }
            onClose={() =>
                setCreateOpen(
                    false
                )
            }
            onCreated={async () => {
                setCreateOpen(false);
                await loadCosts();
                onChanged?.();
            }}
        />

        <EditMaintenanceCostModal
            open={Boolean(
                editCost
            )}
            maintenanceRequest={
                maintenanceRequest
            }
            maintenanceCost={
                editCost
            }
            accessContext={
                accessContext
            }
            onClose={() =>
                setEditCost(null)
            }
            onUpdated={async () => {
                setEditCost(null);
                await loadCosts();
                onChanged?.();
            }}
        />

        <SubmitMaintenanceCostModal
            open={Boolean(
                submitCost
            )}
            maintenanceRequest={
                maintenanceRequest
            }
            maintenanceCost={
                submitCost
            }
            accessContext={
                accessContext
            }
            onClose={() =>
                setSubmitCost(null)
            }
            onSubmitted={async () => {
                setSubmitCost(null);
                await loadCosts();
                onChanged?.();
            }}
        />

        <ApproveMaintenanceCostModal
            open={Boolean(
                approveCost
            )}
            maintenanceRequest={
                maintenanceRequest
            }
            maintenanceCost={
                approveCost
            }
            accessContext={
                accessContext
            }
            onClose={() =>
                setApproveCost(null)
            }
            onApproved={async () => {
                setApproveCost(null);
                await loadCosts();
                onChanged?.();
            }}
        />

        <IncurMaintenanceCostModal
            open={Boolean(
                incurCost
            )}
            maintenanceRequest={
                maintenanceRequest
            }
            maintenanceCost={
                incurCost
            }
            accessContext={
                accessContext
            }
            onClose={() =>
                setIncurCost(null)
            }
            onIncurred={async () => {
                setIncurCost(null);
                await loadCosts();
                onChanged?.();
            }}
        />

        <RejectMaintenanceCostModal
            open={Boolean(
                rejectCost
            )}
            maintenanceRequest={
                maintenanceRequest
            }
            maintenanceCost={
                rejectCost
            }
            accessContext={
                accessContext
            }
            onClose={() =>
                setRejectCost(null)
            }
            onRejected={async () => {
                setRejectCost(null);
                await loadCosts();
                onChanged?.();
            }}
        />

        <MaintenanceCostApprovalHistoryModal
            open={Boolean(
                historyCost
            )}
            maintenanceRequest={
                maintenanceRequest
            }
            maintenanceCost={
                historyCost
            }
            accessContext={
                accessContext
            }
            onClose={() =>
                setHistoryCost(null)
            }
        />

        <CancelMaintenanceCostModal
            open={Boolean(
                cancelCost
            )}
            maintenanceRequest={
                maintenanceRequest
            }
            maintenanceCost={
                cancelCost
            }
            accessContext={
                accessContext
            }
            onClose={() =>
                setCancelCost(null)
            }
            onCancelled={async () => {
                setCancelCost(null);
                await loadCosts();
                onChanged?.();
            }}
        />
        </>
    );
}

export default MaintenanceCostsPanel;

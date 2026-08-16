import {
    History,
    RefreshCw,
    X
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

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

    if (Number.isNaN(parsed.getTime())) {
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

    if (Number.isNaN(numeric)) {
        return String(amount);
    }

    try {
        return new Intl.NumberFormat(
            undefined,
            {
                style: "currency",
                currency:
                    currencyCode || "TZS",
                maximumFractionDigits: 2
            }
        ).format(numeric);
    } catch {
        return `${currencyCode || "TZS"} ${numeric.toLocaleString()}`;
    }
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load maintenance cost approval history.";

const getRows = response => {
    const rows =
        response?.data?.data
            ?.cost_approvals ||
        response?.data
            ?.cost_approvals ||
        [];

    return Array.isArray(rows)
        ? rows
        : [];
};

const decisionClassName = decision => {
    switch (decision) {
        case "approved":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";

        case "rejected":
        case "cancelled":
            return "border-rose-200 bg-rose-50 text-rose-700";

        case "pending":
            return "border-amber-200 bg-amber-50 text-amber-700";

        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
};

function MaintenanceCostApprovalHistoryModal({
    open,
    maintenanceRequest,
    maintenanceCost,
    accessContext,
    onClose
}) {
    const [approvals, setApprovals] =
        useState([]);
    const [pagination, setPagination] =
        useState(null);
    const [loading, setLoading] =
        useState(false);
    const [error, setError] =
        useState("");

    const loadHistory = useCallback(
        async () => {
            if (
                !maintenanceRequest?.public_id ||
                !maintenanceCost?.public_id
            ) {
                return;
            }

            try {
                setLoading(true);
                setError("");

                const params = {
                    sort_order: "desc",
                    page: 1,
                    limit: 100
                };

                if (accessContext) {
                    params.access_context =
                        accessContext;
                }

                const response =
                    await apiClient.get(
                        `/maintenance/requests/${encodeURIComponent(
                            maintenanceRequest.public_id
                        )}/costs/${encodeURIComponent(
                            maintenanceCost.public_id
                        )}/approval-history`,
                        {
                            params
                        }
                    );

                setApprovals(
                    getRows(response)
                );
                setPagination(
                    response?.data
                        ?.pagination ||
                    null
                );
            } catch (requestError) {
                setApprovals([]);
                setPagination(null);
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
            maintenanceCost?.public_id,
            maintenanceRequest?.public_id
        ]
    );

    useEffect(() => {
        if (!open) {
            return;
        }

        loadHistory();
    }, [
        loadHistory,
        open
    ]);

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4">
            <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div>
                        <div className="flex items-center gap-2 text-slate-950">
                            <History className="h-5 w-5" />
                            <h2 className="text-xl font-bold">
                                Maintenance Cost Approval History
                            </h2>
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                            {maintenanceCost?.description ||
                                "Maintenance cost"}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                        aria-label="Close maintenance cost approval history"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="max-h-[calc(92vh-92px)] overflow-y-auto p-6">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-slate-600">
                            Cost status: <span className="font-semibold text-slate-900">{formatLabel(
                                maintenanceCost?.status
                            )}</span>
                            {pagination?.total !== undefined && (
                                <span>
                                    {" "}• Approval records: {pagination.total}
                                </span>
                            )}
                        </div>

                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={RefreshCw}
                            onClick={loadHistory}
                            disabled={loading}
                        >
                            {loading
                                ? "Refreshing..."
                                : "Refresh History"}
                        </Button>
                    </div>

                    {error && (
                        <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    {loading && approvals.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                            Loading approval history...
                        </div>
                    ) : approvals.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                            No approval history has been recorded for this maintenance cost yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {approvals.map(
                                (
                                    approval,
                                    index
                                ) => (
                                    <article
                                        key={
                                            approval.public_id ||
                                            `${approval.submitted_at}-${index}`
                                        }
                                        className="rounded-2xl border border-slate-200 p-5"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-bold text-slate-950">
                                                    {formatLabel(
                                                        approval.approval_type
                                                    )} Approval
                                                </p>

                                                <p className="mt-1 text-sm text-slate-600">
                                                    Submitted amount: <span className="font-semibold text-slate-900">{formatAmount(
                                                        approval.submitted_amount,
                                                        maintenanceCost?.currency_code ||
                                                            maintenanceRequest?.currency_code
                                                    )}</span>
                                                </p>
                                            </div>

                                            <span
                                                className={`rounded-full border px-3 py-1 text-xs font-bold ${decisionClassName(
                                                    approval.decision
                                                )}`}
                                            >
                                                {formatLabel(
                                                    approval.decision
                                                )}
                                            </span>
                                        </div>

                                        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Submitted At
                                                </p>
                                                <p className="mt-1 text-sm text-slate-900">
                                                    {formatDateTime(
                                                        approval.submitted_at
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Submitted By
                                                </p>
                                                <p className="mt-1 text-sm text-slate-900">
                                                    {approval.submitted_by?.full_name ||
                                                        "—"}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Decided At
                                                </p>
                                                <p className="mt-1 text-sm text-slate-900">
                                                    {formatDateTime(
                                                        approval.decided_at
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Decided By
                                                </p>
                                                <p className="mt-1 text-sm text-slate-900">
                                                    {approval.decided_by?.full_name ||
                                                        "—"}
                                                </p>
                                            </div>
                                        </div>

                                        {approval.submission_note && (
                                            <div className="mt-4 rounded-xl bg-slate-50 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Submission Note
                                                </p>
                                                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                                                    {approval.submission_note}
                                                </p>
                                            </div>
                                        )}

                                        {approval.decision_note && (
                                            <div className="mt-3 rounded-xl bg-slate-50 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Decision Note
                                                </p>
                                                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                                                    {approval.decision_note}
                                                </p>
                                            </div>
                                        )}
                                    </article>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MaintenanceCostApprovalHistoryModal;

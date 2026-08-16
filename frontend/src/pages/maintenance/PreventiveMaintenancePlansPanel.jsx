import {
    CalendarClock,
    CalendarDays,
    Eye,
    Pause,
    Pencil,
    Play,
    Plus,
    RefreshCw
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

import CreatePreventiveMaintenancePlanModal from "./CreatePreventiveMaintenancePlanModal";
import EditPreventiveMaintenancePlanModal from "./EditPreventiveMaintenancePlanModal";
import PreventiveMaintenancePlanDetailModal from "./PreventiveMaintenancePlanDetailModal";
import PreventiveMaintenancePlanLifecycleModal from "./PreventiveMaintenancePlanLifecycleModal";
import PreventiveMaintenanceOccurrencesModal from "./PreventiveMaintenanceOccurrencesModal";
import PreventiveMaintenanceDueQueueModal from "./PreventiveMaintenanceDueQueueModal";

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

    const parsed =
        new Date(value);

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

const formatMoney = (
    amount,
    currencyCode
) => {
    const numeric =
        Number(amount);

    if (!Number.isFinite(numeric)) {
        return "—";
    }

    try {
        return new Intl.NumberFormat(
            undefined,
            {
                style: "currency",
                currency:
                    currencyCode ||
                    "TZS",
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
    "Unable to load preventive maintenance plans.";

const statusClassName = status => {
    switch (status) {
        case "active":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";

        case "paused":
            return "border-amber-200 bg-amber-50 text-amber-700";

        case "completed":
            return "border-blue-200 bg-blue-50 text-blue-700";

        case "cancelled":
            return "border-rose-200 bg-rose-50 text-rose-700";

        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
};

const normalizePlans = response => {
    const body =
        response?.data || {};

    const data =
        body?.data || {};

    const plans =
        Array.isArray(
            data.preventive_maintenance_plans
        )
            ? data.preventive_maintenance_plans
            : Array.isArray(
                  data.preventive_plans
              )
              ? data.preventive_plans
              : Array.isArray(data)
                ? data
                : [];

    const pagination =
        body.pagination ||
        data.pagination ||
        {};

    return {
        plans,
        pagination: {
            page:
                Number(
                    pagination.page
                ) || 1,
            limit:
                Number(
                    pagination.limit
                ) || 10,
            total_records:
                Number(
                    pagination.total_records
                ) || plans.length,
            total_pages:
                Number(
                    pagination.total_pages
                ) ||
                (plans.length > 0
                    ? 1
                    : 0)
        }
    };
};

function PreventiveMaintenancePlansPanel({
    isAdmin = false,
    accessContext = "owner"
}) {
    const [
        plans,
        setPlans
    ] = useState([]);

    const [
        loading,
        setLoading
    ] = useState(true);

    const [
        error,
        setError
    ] = useState("");

    const [
        createOpen,
        setCreateOpen
    ] = useState(false);

    const [
        selectedPlanPublicId,
        setSelectedPlanPublicId
    ] = useState("");

    const [
        detailOpen,
        setDetailOpen
    ] = useState(false);

    const [
        editOpen,
        setEditOpen
    ] = useState(false);

    const [
        lifecycleOpen,
        setLifecycleOpen
    ] = useState(false);

    const [
        lifecycleAction,
        setLifecycleAction
    ] = useState("");

    const [
        occurrencesOpen,
        setOccurrencesOpen
    ] = useState(false);

    const [
        dueQueueOpen,
        setDueQueueOpen
    ] = useState(false);

    const [
        pagination,
        setPagination
    ] = useState({
        page: 1,
        limit: 10,
        total_records: 0,
        total_pages: 0
    });

    const visible =
        isAdmin ||
        accessContext ===
            "owner";

    const loadPlans =
        useCallback(
            async ({
                page = 1
            } = {}) => {
                if (!visible) {
                    setPlans([]);
                    setLoading(false);
                    return;
                }

                try {
                    setLoading(true);
                    setError("");

                    const params = {
                        page,
                        limit:
                            pagination.limit
                    };

                    if (!isAdmin) {
                        params.access_context =
                            "owner";
                    }

                    const response =
                        await apiClient.get(
                            "/maintenance/preventive-plans",
                            {
                                params
                            }
                        );

                    const normalized =
                        normalizePlans(
                            response
                        );

                    setPlans(
                        normalized.plans
                    );
                    setPagination(
                        normalized.pagination
                    );
                } catch (
                    requestError
                ) {
                    setPlans([]);
                    setPagination(
                        previous => ({
                            ...previous,
                            page: 1,
                            total_records: 0,
                            total_pages: 0
                        })
                    );
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
                isAdmin,
                pagination.limit,
                visible
            ]
        );

    useEffect(() => {
        loadPlans({
            page: 1
        });
    }, [
        accessContext,
        isAdmin
    ]);

    const activeCount =
        useMemo(
            () =>
                plans.filter(
                    plan =>
                        plan.status ===
                        "active"
                ).length,
            [plans]
        );

    if (!visible) {
        return null;
    }

    return (
        <>
            <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-emerald-100 bg-emerald-50/60 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                            <CalendarClock className="h-5 w-5" />
                        </div>

                        <div>
                            <h2 className="text-lg font-bold text-slate-950">
                                Preventive Maintenance Plans
                            </h2>

                            <p className="mt-1 text-sm text-slate-600">
                                {pagination.total_records} plan(s) · {activeCount} active on this page
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={CalendarClock}
                            onClick={() =>
                                setDueQueueOpen(true)
                            }
                        >
                            Due Queue
                        </Button>

                        <Button
                            type="button"
                            leftIcon={Plus}
                            onClick={() =>
                                setCreateOpen(true)
                            }
                        >
                            Create Plan
                        </Button>

                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={RefreshCw}
                            disabled={loading}
                            onClick={() =>
                                loadPlans({
                                    page:
                                        pagination.page
                                })
                            }
                        >
                            Refresh
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left">
                        <thead className="bg-slate-50">
                            <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <th className="px-5 py-3">
                                    Plan
                                </th>
                                <th className="px-5 py-3">
                                    Scope
                                </th>
                                <th className="px-5 py-3">
                                    Schedule
                                </th>
                                <th className="px-5 py-3">
                                    Next Due
                                </th>
                                <th className="px-5 py-3">
                                    Estimated Cost
                                </th>
                                <th className="px-5 py-3">
                                    Status
                                </th>
                                <th className="px-5 py-3 text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-5 py-10 text-center text-sm text-slate-500"
                                    >
                                        Loading preventive maintenance plans...
                                    </td>
                                </tr>
                            ) : plans.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-5 py-10 text-center"
                                    >
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                                            <CalendarClock className="h-5 w-5" />
                                        </div>

                                        <p className="mt-3 font-semibold text-slate-800">
                                            No preventive plans found
                                        </p>

                                        <p className="mt-1 text-sm text-slate-500">
                                            Create the first plan to schedule preventive work.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                plans.map(plan => (
                                    <tr
                                        key={plan.public_id}
                                        className="align-top hover:bg-slate-50/70"
                                    >
                                        <td className="px-5 py-4">
                                            <p className="font-semibold text-slate-900">
                                                {plan.title || "Untitled plan"}
                                            </p>

                                            <p className="mt-1 text-xs text-slate-500">
                                                {formatLabel(plan.category)} · {formatLabel(plan.priority)}
                                            </p>

                                            {plan.description_preview && (
                                                <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">
                                                    {plan.description_preview}
                                                </p>
                                            )}
                                        </td>

                                        <td className="px-5 py-4">
                                            <p className="text-sm font-semibold text-slate-800">
                                                {plan.property?.property_name ||
                                                    plan.property_name ||
                                                    plan.property?.property_code ||
                                                    "—"}
                                            </p>

                                            <p className="mt-1 text-xs text-slate-500">
                                                {plan.request_scope ===
                                                "property_common_area"
                                                    ? "Property Common Area"
                                                    : plan.unit?.unit_name ||
                                                      plan.unit_name ||
                                                      plan.unit?.unit_code ||
                                                      "Unit"}
                                            </p>
                                        </td>

                                        <td className="px-5 py-4">
                                            <p className="text-sm font-semibold text-slate-800">
                                                {formatLabel(
                                                    plan.schedule?.frequency ??
                                                        plan.frequency
                                                )}
                                            </p>

                                            <p className="mt-1 text-xs text-slate-500">
                                                Interval:{" "}
                                                {plan.schedule?.interval_value ??
                                                    plan.interval_value ??
                                                    1}
                                                {(plan.schedule?.frequency ??
                                                    plan.frequency) === "custom" &&
                                                    (plan.schedule
                                                        ?.custom_interval_days ??
                                                        plan.custom_interval_days)
                                                    ? ` × ${
                                                          plan.schedule
                                                              ?.custom_interval_days ??
                                                          plan.custom_interval_days
                                                      } days`
                                                    : ""}
                                            </p>
                                        </td>

                                        <td className="px-5 py-4 text-sm text-slate-700">
                                            {formatDateTime(
                                                plan.schedule?.next_due_at ??
                                                    plan.next_due_at
                                            )}
                                        </td>

                                        <td className="px-5 py-4 text-sm font-semibold text-slate-800">
                                            {formatMoney(
                                                plan.estimated_cost,
                                                plan.currency_code
                                            )}
                                        </td>

                                        <td className="px-5 py-4">
                                            <span
                                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(
                                                    plan.status
                                                )}`}
                                            >
                                                {formatLabel(plan.status)}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    leftIcon={Eye}
                                                    onClick={() => {
                                                        setSelectedPlanPublicId(
                                                            plan.public_id
                                                        );
                                                        setDetailOpen(true);
                                                    }}
                                                >
                                                    View
                                                </Button>

                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    leftIcon={CalendarDays}
                                                    onClick={() => {
                                                        setSelectedPlanPublicId(
                                                            plan.public_id
                                                        );
                                                        setOccurrencesOpen(true);
                                                    }}
                                                >
                                                    Occurrences
                                                </Button>

                                                {plan.status === "active" && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        leftIcon={Pause}
                                                        onClick={() => {
                                                            setSelectedPlanPublicId(
                                                                plan.public_id
                                                            );
                                                            setLifecycleAction("pause");
                                                            setLifecycleOpen(true);
                                                        }}
                                                    >
                                                        Pause
                                                    </Button>
                                                )}

                                                {plan.status === "paused" && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        leftIcon={Play}
                                                        onClick={() => {
                                                            setSelectedPlanPublicId(
                                                                plan.public_id
                                                            );
                                                            setLifecycleAction("resume");
                                                            setLifecycleOpen(true);
                                                        }}
                                                    >
                                                        Resume
                                                    </Button>
                                                )}

                                                {![
                                                    "completed",
                                                    "cancelled"
                                                ].includes(plan.status) && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        leftIcon={Pencil}
                                                        onClick={() => {
                                                            setSelectedPlanPublicId(
                                                                plan.public_id
                                                            );
                                                            setEditOpen(true);
                                                        }}
                                                    >
                                                        Edit
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {pagination.total_pages > 1 && (
                    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={
                                loading ||
                                pagination.page <= 1
                            }
                            onClick={() =>
                                loadPlans({
                                    page:
                                        pagination.page -
                                        1
                                })
                            }
                        >
                            Previous
                        </Button>

                        <p className="text-sm text-slate-500">
                            Page {pagination.page} of {pagination.total_pages}
                        </p>

                        <Button
                            type="button"
                            variant="secondary"
                            disabled={
                                loading ||
                                pagination.page >=
                                    pagination.total_pages
                            }
                            onClick={() =>
                                loadPlans({
                                    page:
                                        pagination.page +
                                        1
                                })
                            }
                        >
                            Next
                        </Button>
                    </div>
                )}
            </section>

            <CreatePreventiveMaintenancePlanModal
                open={createOpen}
                isAdmin={isAdmin}
                onClose={() =>
                    setCreateOpen(false)
                }
                onCreated={() => {
                    setCreateOpen(false);
                    loadPlans({
                        page: 1
                    });
                }}
            />

            <PreventiveMaintenancePlanDetailModal
                open={detailOpen}
                planPublicId={selectedPlanPublicId}
                isAdmin={isAdmin}
                onClose={() => {
                    setDetailOpen(false);
                    setSelectedPlanPublicId("");
                }}
                onEdit={plan => {
                    setSelectedPlanPublicId(
                        plan?.public_id ||
                            selectedPlanPublicId
                    );
                    setDetailOpen(false);
                    setEditOpen(true);
                }}
                onLifecycle={(action, plan) => {
                    setSelectedPlanPublicId(
                        plan?.public_id ||
                            selectedPlanPublicId
                    );
                    setDetailOpen(false);
                    setLifecycleAction(action);
                    setLifecycleOpen(true);
                }}
                onOccurrences={plan => {
                    setSelectedPlanPublicId(
                        plan?.public_id ||
                            selectedPlanPublicId
                    );
                    setDetailOpen(false);
                    setOccurrencesOpen(true);
                }}
            />

            <PreventiveMaintenanceOccurrencesModal
                open={occurrencesOpen}
                planPublicId={selectedPlanPublicId}
                isAdmin={isAdmin}
                onClose={() => {
                    setOccurrencesOpen(false);
                    setSelectedPlanPublicId("");
                }}
            />

            <PreventiveMaintenanceDueQueueModal
                open={dueQueueOpen}
                isAdmin={isAdmin}
                onClose={() =>
                    setDueQueueOpen(false)
                }
                onProcessed={() => {
                    loadPlans({
                        page: pagination.page
                    });
                }}
            />

            <PreventiveMaintenancePlanLifecycleModal
                open={lifecycleOpen}
                planPublicId={selectedPlanPublicId}
                action={lifecycleAction}
                isAdmin={isAdmin}
                onClose={() => {
                    setLifecycleOpen(false);
                    setLifecycleAction("");
                    setSelectedPlanPublicId("");
                }}
                onUpdated={() => {
                    setLifecycleOpen(false);
                    setLifecycleAction("");
                    setSelectedPlanPublicId("");
                    loadPlans({
                        page: pagination.page
                    });
                }}
            />

            <EditPreventiveMaintenancePlanModal
                open={editOpen}
                planPublicId={selectedPlanPublicId}
                isAdmin={isAdmin}
                onClose={() => {
                    setEditOpen(false);
                    setSelectedPlanPublicId("");
                }}
                onUpdated={() => {
                    setEditOpen(false);
                    setSelectedPlanPublicId("");
                    loadPlans({
                        page: pagination.page
                    });
                }}
            />
        </>
    );
}

export default PreventiveMaintenancePlansPanel;

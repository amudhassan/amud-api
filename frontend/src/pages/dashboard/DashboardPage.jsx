import {
    AlertTriangle,
    CheckCircle2,
    DoorOpen,
    Gauge,
    Hammer,
    ReceiptText,
    Wrench
} from "lucide-react";
import {
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

const formatNumber = value =>
    new Intl.NumberFormat().format(
        Number(value || 0)
    );

const formatAmount = value =>
    new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(value || 0));

const formatDateTime = value => {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleString();
};

const humanize = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, letter =>
            letter.toUpperCase()
        );

function DashboardPage() {
    const [dashboard, setDashboard] =
        useState(null);
    const [loading, setLoading] =
        useState(true);
    const [error, setError] =
        useState("");

    useEffect(() => {
        let isMounted = true;

        const loadDashboard = async () => {
            try {
                setLoading(true);
                setError("");

                const response =
                    await apiClient.get(
                        "/reports/dashboard"
                    );

                if (isMounted) {
                    setDashboard(
                        response.data?.data || null
                    );
                }
            } catch (requestError) {
                if (!isMounted) return;

                setError(
                    requestError.response?.data?.message ||
                    "Unable to load dashboard data."
                );
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadDashboard();

        return () => {
            isMounted = false;
        };
    }, []);

    const portfolio =
        dashboard?.portfolio || null;

    const financial =
        Array.isArray(dashboard?.financial)
            ? dashboard.financial
            : [];

    const maintenance =
        dashboard?.maintenance || null;

    const recentActivity =
        Array.isArray(
            dashboard?.recent_activity
        )
            ? dashboard.recent_activity
            : [];

    const expiringLeases =
        dashboard?.expiring_leases_30_days ||
        null;

    const sectionAccess =
        dashboard?.section_access || {};

    const stats = useMemo(
        () => [
            {
                label: "Total Units",
                value:
                    portfolio?.total_units ??
                    "—",
                icon: DoorOpen
            },
            {
                label: "Occupied Units",
                value:
                    portfolio?.occupied_units ??
                    "—",
                icon: CheckCircle2
            },
            {
                label: "Available Units",
                value:
                    portfolio?.available_units ??
                    "—",
                icon: Gauge
            },
            {
                label: "Occupancy Rate",
                value:
                    portfolio
                        ? `${portfolio.occupancy_rate_percent}%`
                        : "—",
                icon: Gauge
            }
        ],
        [portfolio]
    );

    if (loading) {
        return (
            <div className="flex min-h-[420px] items-center justify-center">
                <div className="text-sm font-medium text-slate-500">
                    Loading dashboard...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">
                        Dashboard
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Overview of your property management operations.
                    </p>
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">
                    Dashboard
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                    Overview of your property management operations.
                </p>
            </div>

            {sectionAccess.portfolio_and_leases ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    {stats.map(
                        ({
                            label,
                            value,
                            icon: Icon
                        }) => (
                            <div
                                key={label}
                                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-slate-500">
                                            {label}
                                        </p>

                                        <p className="mt-3 text-3xl font-bold text-slate-900">
                                            {typeof value ===
                                            "number"
                                                ? formatNumber(
                                                      value
                                                  )
                                                : value}
                                        </p>
                                    </div>

                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                        <Icon size={23} />
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                </div>
            ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                    Portfolio information is not available for your current access level.
                </div>
            )}

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">
                                Financial Overview
                            </h2>

                            <p className="mt-2 text-sm text-slate-500">
                                Invoiced, collected and outstanding amounts by currency.
                            </p>
                        </div>

                        <ReceiptText
                            className="text-slate-400"
                            size={22}
                        />
                    </div>

                    {!sectionAccess.financial ? (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-400">
                            Financial information is not available for your current access level.
                        </div>
                    ) : financial.length === 0 ? (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-400">
                            No financial activity yet.
                        </div>
                    ) : (
                        <div className="mt-6 space-y-4">
                            {financial.map(
                                item => (
                                    <div
                                        key={
                                            item.currency_code
                                        }
                                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {
                                                        item.currency_code
                                                    }
                                                </p>

                                                <p className="mt-1 text-xs text-slate-500">
                                                    {
                                                        item.invoice_count
                                                    }{" "}
                                                    invoice(s) ·{" "}
                                                    {
                                                        item.completed_payment_count
                                                    }{" "}
                                                    completed payment(s)
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                                    Collection rate
                                                </p>
                                                <p className="mt-1 text-lg font-bold text-slate-900">
                                                    {
                                                        item.collection_rate_percent
                                                    }
                                                    %
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                            <div className="rounded-lg bg-white p-3">
                                                <p className="text-xs text-slate-500">
                                                    Total invoiced
                                                </p>
                                                <p className="mt-1 font-semibold text-slate-900">
                                                    {
                                                        item.currency_code
                                                    }{" "}
                                                    {formatAmount(
                                                        item.total_invoiced
                                                    )}
                                                </p>
                                            </div>

                                            <div className="rounded-lg bg-white p-3">
                                                <p className="text-xs text-slate-500">
                                                    Total collected
                                                </p>
                                                <p className="mt-1 font-semibold text-slate-900">
                                                    {
                                                        item.currency_code
                                                    }{" "}
                                                    {formatAmount(
                                                        item.total_collected
                                                    )}
                                                </p>
                                            </div>

                                            <div className="rounded-lg bg-white p-3">
                                                <p className="text-xs text-slate-500">
                                                    Outstanding
                                                </p>
                                                <p className="mt-1 font-semibold text-slate-900">
                                                    {
                                                        item.currency_code
                                                    }{" "}
                                                    {formatAmount(
                                                        item.outstanding_balance
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900">
                        Recent Activity
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        Latest payment and maintenance activity.
                    </p>

                    {recentActivity.length === 0 ? (
                        <div className="mt-6 flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
                            No activity yet
                        </div>
                    ) : (
                        <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                            {recentActivity.map(
                                (
                                    activity,
                                    index
                                ) => {
                                    const isPayment =
                                        activity.reference
                                            ?.type ===
                                        "payment";

                                    const title =
                                        isPayment
                                            ? humanize(
                                                  activity.activity_type
                                              )
                                            : activity.summary
                                                  ?.title ||
                                              humanize(
                                                  activity.activity_type
                                              );

                                    const detail =
                                        isPayment
                                            ? `${activity.summary?.currency_code || ""} ${formatAmount(
                                                  activity
                                                      .summary
                                                      ?.amount
                                              )}`
                                            : `${humanize(
                                                  activity
                                                      .summary
                                                      ?.status
                                              )}${
                                                  activity
                                                      .summary
                                                      ?.priority
                                                      ? ` · ${humanize(
                                                            activity
                                                                .summary
                                                                .priority
                                                        )}`
                                                      : ""
                                              }`;

                                    return (
                                        <div
                                            key={`${activity.activity_type}-${activity.occurred_at}-${index}`}
                                            className="rounded-xl border border-slate-200 p-4"
                                        >
                                            <div className="flex gap-3">
                                                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                                    {isPayment ? (
                                                        <ReceiptText
                                                            size={
                                                                18
                                                            }
                                                        />
                                                    ) : (
                                                        <Wrench
                                                            size={
                                                                18
                                                            }
                                                        />
                                                    )}
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-slate-900">
                                                        {
                                                            title
                                                        }
                                                    </p>

                                                    <p className="mt-1 text-sm text-slate-600">
                                                        {
                                                            detail
                                                        }
                                                    </p>

                                                    {activity
                                                        .property
                                                        ?.property_name && (
                                                        <p className="mt-1 truncate text-xs text-slate-500">
                                                            {
                                                                activity
                                                                    .property
                                                                    .property_name
                                                            }
                                                        </p>
                                                    )}

                                                    <p className="mt-2 text-xs text-slate-400">
                                                        {formatDateTime(
                                                            activity.occurred_at
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">
                                Maintenance
                            </h2>

                            <p className="mt-2 text-sm text-slate-500">
                                Current maintenance request status.
                            </p>
                        </div>

                        <Hammer
                            className="text-slate-400"
                            size={22}
                        />
                    </div>

                    {!sectionAccess.maintenance ? (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-400">
                            Maintenance information is not available for your current access level.
                        </div>
                    ) : maintenance ? (
                        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {[
                                [
                                    "Total Requests",
                                    maintenance.total_requests
                                ],
                                [
                                    "Open",
                                    maintenance.open_requests
                                ],
                                [
                                    "Resolved",
                                    maintenance.resolved_requests
                                ],
                                [
                                    "Closed",
                                    maintenance.closed_requests
                                ],
                                [
                                    "Emergency",
                                    maintenance.emergency_requests
                                ],
                                [
                                    "Overdue",
                                    maintenance.overdue_requests
                                ]
                            ].map(
                                ([
                                    label,
                                    value
                                ]) => (
                                    <div
                                        key={
                                            label
                                        }
                                        className="rounded-xl bg-slate-50 p-4"
                                    >
                                        <p className="text-xs font-medium text-slate-500">
                                            {
                                                label
                                            }
                                        </p>

                                        <p className="mt-2 text-2xl font-bold text-slate-900">
                                            {formatNumber(
                                                value
                                            )}
                                        </p>
                                    </div>
                                )
                            )}
                        </div>
                    ) : (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-400">
                            No maintenance data yet.
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">
                                Expiring Leases
                            </h2>

                            <p className="mt-2 text-sm text-slate-500">
                                Active leases expiring within 30 days.
                            </p>
                        </div>

                        <AlertTriangle
                            className="text-slate-400"
                            size={22}
                        />
                    </div>

                    {!sectionAccess.portfolio_and_leases ? (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-400">
                            Lease information is not available for your current access level.
                        </div>
                    ) : !expiringLeases ||
                      expiringLeases.count === 0 ? (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-400">
                            No leases are expiring in the next 30 days.
                        </div>
                    ) : (
                        <div className="mt-5 space-y-3">
                            {expiringLeases.leases.map(
                                lease => (
                                    <div
                                        key={
                                            lease.public_id
                                        }
                                        className="rounded-xl border border-slate-200 p-4"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-slate-900">
                                                    {
                                                        lease.tenant
                                                            ?.display_name
                                                    }
                                                </p>

                                                <p className="mt-1 truncate text-xs text-slate-500">
                                                    {
                                                        lease.property
                                                            ?.property_name
                                                    }{" "}
                                                    ·{" "}
                                                    {
                                                        lease.unit
                                                            ?.unit_code
                                                    }
                                                </p>
                                            </div>

                                            <div className="shrink-0 text-right">
                                                <p className="text-sm font-bold text-slate-900">
                                                    {
                                                        lease.days_remaining
                                                    }{" "}
                                                    day(s)
                                                </p>

                                                <p className="mt-1 text-xs text-slate-400">
                                                    {
                                                        lease.lease_number
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;

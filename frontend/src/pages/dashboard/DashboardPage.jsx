import {
    Activity,
    AlertTriangle,
    Building2,
    CalendarClock,
    CheckCircle2,
    DoorOpen,
    Gauge,
    Hammer,
    ReceiptText,
    RefreshCw,
    Sparkles,
    TrendingUp,
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

const clampPercent = value => {
    const numericValue = Number(value || 0);

    if (!Number.isFinite(numericValue)) {
        return 0;
    }

    return Math.min(
        100,
        Math.max(0, numericValue)
    );
};

const STAT_STYLES = {
    total: {
        card: "from-blue-50/90 via-white to-white",
        icon: "bg-blue-100 text-blue-700",
        glow: "bg-blue-400/20",
        line: "bg-blue-500"
    },
    occupied: {
        card: "from-emerald-50/90 via-white to-white",
        icon: "bg-emerald-100 text-emerald-700",
        glow: "bg-emerald-400/20",
        line: "bg-emerald-500"
    },
    available: {
        card: "from-violet-50/90 via-white to-white",
        icon: "bg-violet-100 text-violet-700",
        glow: "bg-violet-400/20",
        line: "bg-violet-500"
    },
    occupancy: {
        card: "from-cyan-50/90 via-white to-white",
        icon: "bg-cyan-100 text-cyan-700",
        glow: "bg-cyan-400/20",
        line: "bg-cyan-500"
    }
};

const MAINTENANCE_STYLES = {
    "Total Requests":
        "border-slate-200 bg-slate-50 text-slate-900",
    Open:
        "border-blue-200 bg-blue-50 text-blue-900",
    Resolved:
        "border-emerald-200 bg-emerald-50 text-emerald-900",
    Closed:
        "border-violet-200 bg-violet-50 text-violet-900",
    Emergency:
        "border-rose-200 bg-rose-50 text-rose-900",
    Overdue:
        "border-amber-200 bg-amber-50 text-amber-900"
};

function DashboardLoading() {
    return (
        <div className="space-y-6">
            <div className="h-44 animate-pulse rounded-3xl bg-slate-200/80" />

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map(item => (
                    <div
                        key={item}
                        className="h-36 animate-pulse rounded-2xl bg-white/80 shadow-sm"
                    />
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
                <div className="h-80 animate-pulse rounded-2xl bg-white/80 shadow-sm xl:col-span-2" />
                <div className="h-80 animate-pulse rounded-2xl bg-white/80 shadow-sm" />
            </div>
        </div>
    );
}

function DashboardPage() {
    const [dashboard, setDashboard] =
        useState(null);
    const [loading, setLoading] =
        useState(true);
    const [refreshing, setRefreshing] =
        useState(false);
    const [error, setError] =
        useState("");

    const loadDashboard = async ({
        initial = false
    } = {}) => {
        try {
            if (initial) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }

            setError("");

            const response =
                await apiClient.get(
                    "/reports/dashboard"
                );

            setDashboard(
                response.data?.data || null
            );
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                "Unable to load dashboard data."
            );
        } finally {
            if (initial) {
                setLoading(false);
            } else {
                setRefreshing(false);
            }
        }
    };

    useEffect(() => {
        let isMounted = true;

        const loadInitialDashboard = async () => {
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

        loadInitialDashboard();

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

    const occupancyRate =
        clampPercent(
            portfolio?.occupancy_rate_percent
        );

    const stats = useMemo(
        () => [
            {
                key: "total",
                label: "Total Units",
                value:
                    portfolio?.total_units ??
                    "—",
                icon: Building2,
                note: "Portfolio inventory"
            },
            {
                key: "occupied",
                label: "Occupied Units",
                value:
                    portfolio?.occupied_units ??
                    "—",
                icon: CheckCircle2,
                note: "Currently in use"
            },
            {
                key: "available",
                label: "Available Units",
                value:
                    portfolio?.available_units ??
                    "—",
                icon: DoorOpen,
                note: "Ready for leasing"
            },
            {
                key: "occupancy",
                label: "Occupancy Rate",
                value:
                    portfolio
                        ? `${portfolio.occupancy_rate_percent}%`
                        : "—",
                icon: Gauge,
                note: "Portfolio utilization"
            }
        ],
        [portfolio]
    );

    if (loading) {
        return <DashboardLoading />;
    }

    if (error && !dashboard) {
        return (
            <div className="space-y-6">
                <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-7 text-white shadow-xl">
                    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />

                    <div className="relative">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">
                            Management Overview
                        </p>

                        <h1 className="mt-3 text-3xl font-bold">
                            Dashboard
                        </h1>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                            Overview of your property management operations.
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50/95 p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-semibold text-red-800">
                                Dashboard could not be loaded
                            </p>
                            <p className="mt-1 text-sm text-red-700">
                                {error}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                loadDashboard({
                                    initial: true
                                })
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
                        >
                            <RefreshCw size={17} />
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="group relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-[0_24px_70px_-28px_rgba(15,23,42,0.75)] sm:p-8">
                <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-400/15 blur-3xl transition duration-700 group-hover:scale-110" />
                <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl" />

                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100 backdrop-blur">
                                <Sparkles size={14} />
                                Management Overview
                            </span>

                            <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-300">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                </span>
                                Live operational data
                            </span>
                        </div>

                        <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
                            Dashboard
                        </h1>

                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                            A clear snapshot of occupancy, collections, maintenance and lease activity across your authorized portfolio.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            loadDashboard()
                        }
                        disabled={refreshing}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw
                            size={17}
                            className={
                                refreshing
                                    ? "animate-spin"
                                    : ""
                            }
                        />
                        {refreshing
                            ? "Refreshing..."
                            : "Refresh Dashboard"}
                    </button>
                </div>
            </section>

            {error && dashboard ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
                    {error}
                </div>
            ) : null}

            {sectionAccess.portfolio_and_leases ? (
                <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    {stats.map(
                        ({
                            key,
                            label,
                            value,
                            icon: Icon,
                            note
                        }) => {
                            const style =
                                STAT_STYLES[key];

                            return (
                                <article
                                    key={label}
                                    className={`group relative overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br ${style.card} p-6 shadow-[0_12px_34px_-22px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/60 transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_48px_-24px_rgba(15,23,42,0.5)]`}
                                >
                                    <div
                                        className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full ${style.glow} blur-2xl transition duration-500 group-hover:scale-125`}
                                    />

                                    <div
                                        className={`absolute inset-x-0 top-0 h-1 ${style.line}`}
                                    />

                                    <div className="relative flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-500">
                                                {label}
                                            </p>

                                            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                                                {typeof value ===
                                                "number"
                                                    ? formatNumber(
                                                          value
                                                      )
                                                    : value}
                                            </p>

                                            <p className="mt-2 text-xs text-slate-400">
                                                {note}
                                            </p>
                                        </div>

                                        <div
                                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${style.icon} shadow-sm transition duration-300 group-hover:-rotate-3 group-hover:scale-105`}
                                        >
                                            <Icon size={22} />
                                        </div>
                                    </div>

                                    {key ===
                                        "occupancy" &&
                                    portfolio ? (
                                        <div className="relative mt-5">
                                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-[width] duration-700"
                                                    style={{
                                                        width: `${occupancyRate}%`
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ) : null}
                                </article>
                            );
                        }
                    )}
                </section>
            ) : (
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 text-sm text-slate-500 shadow-sm backdrop-blur">
                    Portfolio information is not available for your current access level.
                </div>
            )}

            <section className="grid gap-6 xl:grid-cols-3">
                <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/90 p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/70 backdrop-blur xl:col-span-2">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                                    <TrendingUp size={18} />
                                </span>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Financial Overview
                                </h2>
                            </div>

                            <p className="mt-2 text-sm text-slate-500">
                                Invoiced, collected and outstanding amounts by currency.
                            </p>
                        </div>

                        <ReceiptText
                            className="text-slate-300"
                            size={24}
                        />
                    </div>

                    {!sectionAccess.financial ? (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center text-sm text-slate-400">
                            Financial information is not available for your current access level.
                        </div>
                    ) : financial.length === 0 ? (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center text-sm text-slate-400">
                            No financial activity yet.
                        </div>
                    ) : (
                        <div className="mt-6 space-y-4">
                            {financial.map(
                                item => {
                                    const collectionRate =
                                        clampPercent(
                                            item.collection_rate_percent
                                        );

                                    return (
                                        <div
                                            key={
                                                item.currency_code
                                            }
                                            className="group rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-5 transition duration-300 hover:border-blue-200 hover:shadow-lg"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                                                        <ReceiptText size={19} />
                                                    </span>

                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">
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
                                                </div>

                                                <div className="min-w-[160px]">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                                            Collection rate
                                                        </p>
                                                        <p className="text-lg font-bold text-slate-900">
                                                            {
                                                                item.collection_rate_percent
                                                            }
                                                            %
                                                        </p>
                                                    </div>

                                                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-[width] duration-700"
                                                            style={{
                                                                width: `${collectionRate}%`
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                                {[
                                                    [
                                                        "Total invoiced",
                                                        item.total_invoiced,
                                                        "text-slate-900"
                                                    ],
                                                    [
                                                        "Total collected",
                                                        item.total_collected,
                                                        "text-emerald-700"
                                                    ],
                                                    [
                                                        "Outstanding",
                                                        item.outstanding_balance,
                                                        "text-amber-700"
                                                    ]
                                                ].map(
                                                    ([
                                                        label,
                                                        value,
                                                        valueClass
                                                    ]) => (
                                                        <div
                                                            key={
                                                                label
                                                            }
                                                            className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition duration-300 group-hover:shadow"
                                                        >
                                                            <p className="text-xs font-medium text-slate-500">
                                                                {
                                                                    label
                                                                }
                                                            </p>
                                                            <p
                                                                className={`mt-1.5 font-bold ${valueClass}`}
                                                            >
                                                                {
                                                                    item.currency_code
                                                                }{" "}
                                                                {formatAmount(
                                                                    value
                                                                )}
                                                            </p>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-white/80 bg-white/90 p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/70 backdrop-blur">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                                    <Activity size={18} />
                                </span>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Recent Activity
                                </h2>
                            </div>

                            <p className="mt-2 text-sm text-slate-500">
                                Latest payment and maintenance activity.
                            </p>
                        </div>
                    </div>

                    {recentActivity.length === 0 ? (
                        <div className="mt-6 flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-400">
                            No activity yet
                        </div>
                    ) : (
                        <div className="relative mt-5 max-h-[430px] space-y-3 overflow-y-auto pr-1">
                            <div className="pointer-events-none absolute bottom-4 left-[18px] top-4 w-px bg-gradient-to-b from-blue-200 via-slate-200 to-transparent" />

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
                                            className="group relative rounded-xl border border-slate-200/80 bg-white p-4 pl-14 transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                                        >
                                            <div
                                                className={`absolute left-2.5 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg ring-4 ring-white ${
                                                    isPayment
                                                        ? "bg-emerald-50 text-emerald-700"
                                                        : "bg-blue-50 text-blue-700"
                                                }`}
                                            >
                                                {isPayment ? (
                                                    <ReceiptText
                                                        size={16}
                                                    />
                                                ) : (
                                                    <Wrench
                                                        size={16}
                                                    />
                                                )}
                                            </div>

                                            <p className="truncate text-sm font-semibold text-slate-900">
                                                {title}
                                            </p>

                                            <p className="mt-1 text-sm text-slate-600">
                                                {detail}
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
                                    );
                                }
                            )}
                        </div>
                    )}
                </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/80 bg-white/90 p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/70 backdrop-blur">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                                    <Hammer size={18} />
                                </span>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Maintenance
                                </h2>
                            </div>

                            <p className="mt-2 text-sm text-slate-500">
                                Current maintenance request status.
                            </p>
                        </div>

                        <Wrench
                            className="text-slate-300"
                            size={22}
                        />
                    </div>

                    {!sectionAccess.maintenance ? (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center text-sm text-slate-400">
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
                                ([label, value]) => (
                                    <div
                                        key={label}
                                        className={`group rounded-xl border p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${MAINTENANCE_STYLES[label]}`}
                                    >
                                        <p className="text-xs font-semibold opacity-65">
                                            {label}
                                        </p>

                                        <div className="mt-2 flex items-end justify-between gap-3">
                                            <p className="text-2xl font-bold">
                                                {formatNumber(
                                                    value
                                                )}
                                            </p>

                                            <span className="h-2 w-2 rounded-full bg-current opacity-30 transition group-hover:scale-150" />
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    ) : (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center text-sm text-slate-400">
                            No maintenance data yet.
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-white/80 bg-white/90 p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/70 backdrop-blur">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                                    <CalendarClock size={18} />
                                </span>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Expiring Leases
                                </h2>
                            </div>

                            <p className="mt-2 text-sm text-slate-500">
                                Active leases expiring within 30 days.
                            </p>
                        </div>

                        <AlertTriangle
                            className="text-slate-300"
                            size={22}
                        />
                    </div>

                    {!sectionAccess.portfolio_and_leases ? (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center text-sm text-slate-400">
                            Lease information is not available for your current access level.
                        </div>
                    ) : !expiringLeases ||
                      expiringLeases.count === 0 ? (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center text-sm text-slate-400">
                            No leases are expiring in the next 30 days.
                        </div>
                    ) : (
                        <div className="mt-5 space-y-3">
                            {expiringLeases.leases.map(
                                lease => {
                                    const days =
                                        Number(
                                            lease.days_remaining ||
                                                0
                                        );

                                    const urgencyClass =
                                        days <= 7
                                            ? "bg-rose-50 text-rose-700 ring-rose-200"
                                            : days <= 14
                                              ? "bg-amber-50 text-amber-700 ring-amber-200"
                                              : "bg-blue-50 text-blue-700 ring-blue-200";

                                    return (
                                        <div
                                            key={
                                                lease.public_id
                                            }
                                            className="group rounded-xl border border-slate-200/80 bg-white p-4 transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
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

                                                    <p className="mt-2 text-xs text-slate-400">
                                                        {
                                                            lease.lease_number
                                                        }
                                                    </p>
                                                </div>

                                                <span
                                                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${urgencyClass}`}
                                                >
                                                    {days}{" "}
                                                    day(s)
                                                </span>
                                            </div>

                                            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                <div
                                                    className={`h-full rounded-full transition-[width] duration-700 ${
                                                        days <= 7
                                                            ? "bg-rose-500"
                                                            : days <= 14
                                                              ? "bg-amber-500"
                                                              : "bg-blue-500"
                                                    }`}
                                                    style={{
                                                        width: `${clampPercent(
                                                            ((30 -
                                                                days) /
                                                                30) *
                                                                100
                                                        )}%`
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

export default DashboardPage;

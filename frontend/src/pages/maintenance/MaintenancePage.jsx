import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    CircleCheckBig,
    Clock3,
    Eye,
    Plus,
    RefreshCw,
    Search,
    ShieldAlert,
    Wrench
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

import {
    useAuth
} from "../../contexts/AuthContext";

import MaintenanceDetailModal from "./MaintenanceDetailModal";
import CreateMaintenanceRequestModal from "./CreateMaintenanceRequestModal";
import MaintenanceOverduePanel from "./MaintenanceOverduePanel";
import PreventiveMaintenancePlansPanel from "./PreventiveMaintenancePlansPanel";

const MAINTENANCE_STATUSES = [
    "reported",
    "under_review",
    "assigned",
    "in_progress",
    "on_hold",
    "resolved",
    "closed",
    "rejected",
    "cancelled"
];

const MAINTENANCE_PRIORITIES = [
    "low",
    "medium",
    "high",
    "emergency"
];

const MAINTENANCE_CATEGORIES = [
    "plumbing",
    "electrical",
    "appliance",
    "structural",
    "roofing",
    "painting",
    "doors_windows",
    "security",
    "water_supply",
    "sanitation",
    "pest_control",
    "internet_communication",
    "cleaning",
    "common_area",
    "other"
];

const SLA_STATUSES = [
    "overdue",
    "on_track",
    "review_overdue",
    "work_start_overdue",
    "resolution_overdue"
];

const SORT_FIELDS = [
    ["reported_at", "Reported At"],
    ["updated_at", "Updated At"],
    ["priority", "Priority"],
    ["target_review_at", "Target Review"],
    ["target_work_start_at", "Target Work Start"],
    ["target_resolution_at", "Target Resolution"]
];

const EMPTY_PAGINATION = {
    page: 1,
    limit: 20,
    total_records: 0,
    total_pages: 0
};

const EMPTY_SUMMARY = {
    open_requests: 0,
    terminal_requests: 0,
    overdue_requests: 0,
    emergency_requests: 0
};

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
    "Unable to load maintenance requests.";

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

const statusClassName = status => {
    switch (status) {
        case "reported":
            return "border-blue-200 bg-blue-50 text-blue-700";

        case "under_review":
            return "border-violet-200 bg-violet-50 text-violet-700";

        case "assigned":
            return "border-cyan-200 bg-cyan-50 text-cyan-700";

        case "in_progress":
            return "border-amber-200 bg-amber-50 text-amber-700";

        case "on_hold":
            return "border-orange-200 bg-orange-50 text-orange-700";

        case "resolved":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";

        case "closed":
            return "border-slate-300 bg-slate-100 text-slate-700";

        case "rejected":
        case "cancelled":
            return "border-rose-200 bg-rose-50 text-rose-700";

        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
};

const priorityClassName = priority => {
    switch (priority) {
        case "emergency":
            return "border-rose-200 bg-rose-50 text-rose-700";

        case "high":
            return "border-orange-200 bg-orange-50 text-orange-700";

        case "medium":
            return "border-amber-200 bg-amber-50 text-amber-700";

        case "low":
        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
};

const hasOverdueSla = request =>
    Boolean(
        request?.sla?.review_overdue ||
        request?.sla?.work_start_overdue ||
        request?.sla?.resolution_overdue
    );

const normalizeResponse = response => {
    const body =
        response?.data || {};

    const data =
        body?.data || {};

    const maintenanceRequests =
        Array.isArray(
            data.maintenance_requests
        )
            ? data.maintenance_requests
            : [];

    const pagination =
        body.pagination ||
        data.pagination ||
        {};

    const summary =
        body.summary ||
        data.summary ||
        {};

    return {
        maintenanceRequests,
        pagination: {
            page:
                Number(
                    pagination.page
                ) || 1,
            limit:
                Number(
                    pagination.limit
                ) || 20,
            total_records:
                Number(
                    pagination.total_records
                ) || 0,
            total_pages:
                Number(
                    pagination.total_pages
                ) || 0
        },
        summary: {
            open_requests:
                Number(
                    summary.open_requests
                ) || 0,
            terminal_requests:
                Number(
                    summary.terminal_requests
                ) || 0,
            overdue_requests:
                Number(
                    summary.overdue_requests
                ) || 0,
            emergency_requests:
                Number(
                    summary.emergency_requests
                ) || 0
        }
    };
};

function MaintenancePage() {
    const {
        user
    } = useAuth();

    const isAdmin =
        user?.role === "admin";

    const [
        accessContext,
        setAccessContext
    ] = useState("owner");

    const [
        maintenanceRequests,
        setMaintenanceRequests
    ] = useState([]);

    const [
        createOpen,
        setCreateOpen
    ] = useState(false);

    const [
        detailRequestPublicId,
        setDetailRequestPublicId
    ] = useState(null);

    const [
        pagination,
        setPagination
    ] = useState(
        EMPTY_PAGINATION
    );

    const [
        summary,
        setSummary
    ] = useState(
        EMPTY_SUMMARY
    );

    const [
        loading,
        setLoading
    ] = useState(true);

    const [
        error,
        setError
    ] = useState("");

    const [
        searchInput,
        setSearchInput
    ] = useState("");

    const [
        search,
        setSearch
    ] = useState("");

    const [
        status,
        setStatus
    ] = useState("");

    const [
        priority,
        setPriority
    ] = useState("");

    const [
        category,
        setCategory
    ] = useState("");

    const [
        slaStatus,
        setSlaStatus
    ] = useState("");

    const [
        sortBy,
        setSortBy
    ] = useState(
        "reported_at"
    );

    const [
        sortOrder,
        setSortOrder
    ] = useState("desc");

    const loadMaintenanceRequests =
        useCallback(
            async ({
                page = 1
            } = {}) => {
                try {
                    setLoading(true);
                    setError("");

                    const params = {
                        page,
                        limit:
                            pagination.limit,
                        sort_by:
                            sortBy,
                        sort_order:
                            sortOrder
                    };

                    if (!isAdmin) {
                        params.access_context =
                            accessContext;
                    }

                    if (search) {
                        params.search =
                            search;
                    }

                    if (status) {
                        params.status =
                            status;
                    }

                    if (priority) {
                        params.priority =
                            priority;
                    }

                    if (category) {
                        params.category =
                            category;
                    }

                    if (slaStatus) {
                        params.sla_status =
                            slaStatus;
                    }

                    const response =
                        await apiClient.get(
                            "/maintenance/requests",
                            {
                                params
                            }
                        );

                    const normalized =
                        normalizeResponse(
                            response
                        );

                    setMaintenanceRequests(
                        normalized
                            .maintenanceRequests
                    );

                    setPagination(
                        normalized.pagination
                    );

                    setSummary(
                        normalized.summary
                    );
                } catch (
                    requestError
                ) {
                    setMaintenanceRequests(
                        []
                    );

                    setPagination(
                        previous => ({
                            ...previous,
                            page: 1,
                            total_records: 0,
                            total_pages: 0
                        })
                    );

                    setSummary(
                        EMPTY_SUMMARY
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
                accessContext,
                category,
                isAdmin,
                pagination.limit,
                priority,
                search,
                slaStatus,
                sortBy,
                sortOrder,
                status
            ]
        );

    useEffect(() => {
        loadMaintenanceRequests({
            page: 1
        });
    }, [
        accessContext,
        category,
        isAdmin,
        priority,
        search,
        slaStatus,
        sortBy,
        sortOrder,
        status
    ]);

    const submitSearch =
        event => {
            event.preventDefault();

            setSearch(
                searchInput.trim()
            );
        };

    const clearFilters = () => {
        setSearchInput("");
        setSearch("");
        setStatus("");
        setPriority("");
        setCategory("");
        setSlaStatus("");
        setSortBy(
            "reported_at"
        );
        setSortOrder("desc");
    };

    const pageRangeText =
        useMemo(
            () => {
                if (
                    pagination
                        .total_records === 0
                ) {
                    return "0 records";
                }

                const first =
                    (
                        pagination.page -
                        1
                    ) *
                        pagination.limit +
                    1;

                const last =
                    Math.min(
                        pagination.page *
                            pagination.limit,
                        pagination
                            .total_records
                    );

                return `${first}-${last} of ${pagination.total_records}`;
            },
            [
                pagination
            ]
        );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <Wrench className="h-5 w-5" />
                    </div>

                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            Maintenance
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            Track maintenance requests, priorities, lifecycle status and SLA health.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        leftIcon={Plus}
                        onClick={() =>
                            setCreateOpen(true)
                        }
                    >
                        New Request
                    </Button>

                    <Button
                        type="button"
                        variant="secondary"
                        leftIcon={RefreshCw}
                        disabled={loading}
                        onClick={() =>
                            loadMaintenanceRequests({
                                page:
                                    pagination.page
                            })
                        }
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            {!isAdmin && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-blue-900">
                                Maintenance Access Context
                            </p>

                            <p className="mt-1 text-xs text-blue-700">
                                Choose the relationship through which you are viewing maintenance records.
                            </p>
                        </div>

                        <select
                            value={
                                accessContext
                            }
                            onChange={
                                event =>
                                    setAccessContext(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="owner">
                                Owner context
                            </option>

                            <option value="tenant">
                                Tenant context
                            </option>
                        </select>
                    </div>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <Wrench className="h-5 w-5" />
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Total
                            </p>

                            <p className="mt-1 text-2xl font-bold text-slate-950">
                                {
                                    pagination
                                        .total_records
                                }
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                            <Clock3 className="h-5 w-5" />
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Open
                            </p>

                            <p className="mt-1 text-2xl font-bold text-amber-700">
                                {
                                    summary
                                        .open_requests
                                }
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                            <CircleCheckBig className="h-5 w-5" />
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Terminal
                            </p>

                            <p className="mt-1 text-2xl font-bold text-emerald-700">
                                {
                                    summary
                                        .terminal_requests
                                }
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                            <AlertTriangle className="h-5 w-5" />
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Overdue
                            </p>

                            <p className="mt-1 text-2xl font-bold text-rose-700">
                                {
                                    summary
                                        .overdue_requests
                                }
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                            <ShieldAlert className="h-5 w-5" />
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Emergency
                            </p>

                            <p className="mt-1 text-2xl font-bold text-rose-700">
                                {
                                    summary
                                        .emergency_requests
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {(isAdmin ||
                accessContext === "owner") && (
                <MaintenanceOverduePanel
                    accessContext={
                        isAdmin
                            ? ""
                            : "owner"
                    }
                    onOpenRequest={
                        requestPublicId =>
                            setDetailRequestPublicId(
                                requestPublicId
                            )
                    }
                />
            )}

            <PreventiveMaintenancePlansPanel
                isAdmin={isAdmin}
                accessContext={accessContext}
            />

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <form
                    onSubmit={
                        submitSearch
                    }
                    className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4"
                >
                    <label className="block xl:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Search
                        </span>

                        <div className="relative mt-2">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                            <input
                                type="text"
                                value={
                                    searchInput
                                }
                                onChange={
                                    event =>
                                        setSearchInput(
                                            event
                                                .target
                                                .value
                                        )
                                }
                                maxLength={100}
                                placeholder="Request number, title, property, unit, tenant, lease..."
                                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Status
                        </span>

                        <select
                            value={status}
                            onChange={
                                event =>
                                    setStatus(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">
                                All statuses
                            </option>

                            {MAINTENANCE_STATUSES.map(
                                value => (
                                    <option
                                        key={
                                            value
                                        }
                                        value={
                                            value
                                        }
                                    >
                                        {
                                            formatLabel(
                                                value
                                            )
                                        }
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Priority
                        </span>

                        <select
                            value={
                                priority
                            }
                            onChange={
                                event =>
                                    setPriority(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">
                                All priorities
                            </option>

                            {MAINTENANCE_PRIORITIES.map(
                                value => (
                                    <option
                                        key={
                                            value
                                        }
                                        value={
                                            value
                                        }
                                    >
                                        {
                                            formatLabel(
                                                value
                                            )
                                        }
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Category
                        </span>

                        <select
                            value={
                                category
                            }
                            onChange={
                                event =>
                                    setCategory(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">
                                All categories
                            </option>

                            {MAINTENANCE_CATEGORIES.map(
                                value => (
                                    <option
                                        key={
                                            value
                                        }
                                        value={
                                            value
                                        }
                                    >
                                        {
                                            formatLabel(
                                                value
                                            )
                                        }
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            SLA
                        </span>

                        <select
                            value={
                                slaStatus
                            }
                            onChange={
                                event =>
                                    setSlaStatus(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">
                                All SLA states
                            </option>

                            {SLA_STATUSES.map(
                                value => (
                                    <option
                                        key={
                                            value
                                        }
                                        value={
                                            value
                                        }
                                    >
                                        {
                                            formatLabel(
                                                value
                                            )
                                        }
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Sort By
                        </span>

                        <select
                            value={sortBy}
                            onChange={
                                event =>
                                    setSortBy(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            {SORT_FIELDS.map(
                                ([
                                    value,
                                    label
                                ]) => (
                                    <option
                                        key={
                                            value
                                        }
                                        value={
                                            value
                                        }
                                    >
                                        {
                                            label
                                        }
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Order
                        </span>

                        <select
                            value={
                                sortOrder
                            }
                            onChange={
                                event =>
                                    setSortOrder(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="desc">
                                Descending
                            </option>

                            <option value="asc">
                                Ascending
                            </option>
                        </select>
                    </label>

                    <div className="flex flex-wrap items-end gap-2 xl:col-span-4">
                        <Button
                            type="submit"
                            disabled={loading}
                        >
                            Apply Search
                        </Button>

                        <Button
                            type="button"
                            variant="secondary"
                            disabled={loading}
                            onClick={
                                clearFilters
                            }
                        >
                            Clear Filters
                        </Button>
                    </div>
                </form>
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Request
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Property / Unit
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Tenant
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Classification
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Status / SLA
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Reported
                                </th>

                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-5 py-14 text-center text-sm text-slate-500"
                                    >
                                        Loading maintenance requests...
                                    </td>
                                </tr>
                            ) : maintenanceRequests.length ===
                              0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-5 py-14 text-center"
                                    >
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                                            <Wrench className="h-5 w-5" />
                                        </div>

                                        <p className="mt-3 font-semibold text-slate-800">
                                            No maintenance requests found
                                        </p>

                                        <p className="mt-1 text-sm text-slate-500">
                                            Adjust the filters or refresh the page.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                maintenanceRequests.map(
                                    request => (
                                        <tr
                                            key={
                                                request.public_id
                                            }
                                            className="align-top hover:bg-slate-50/70"
                                        >
                                            <td className="px-5 py-4">
                                                <p className="font-semibold text-slate-900">
                                                    {
                                                        request.request_number ||
                                                        "—"
                                                    }
                                                </p>

                                                <p className="mt-1 max-w-xs text-sm font-medium text-slate-700">
                                                    {
                                                        request.title ||
                                                        "Untitled maintenance request"
                                                    }
                                                </p>

                                                {request.description_preview && (
                                                    <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                                                        {
                                                            request.description_preview
                                                        }
                                                    </p>
                                                )}

                                                {request.location_details && (
                                                    <p className="mt-2 text-xs text-slate-500">
                                                        Location:{" "}
                                                        {
                                                            request.location_details
                                                        }
                                                    </p>
                                                )}
                                            </td>

                                            <td className="px-5 py-4">
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {
                                                        request.property
                                                            ?.property_name ||
                                                        request.property
                                                            ?.property_code ||
                                                        "—"
                                                    }
                                                </p>

                                                {request.property
                                                    ?.property_code && (
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {
                                                            request.property
                                                                .property_code
                                                        }
                                                    </p>
                                                )}

                                                <p className="mt-2 text-xs text-slate-600">
                                                    {request.unit
                                                        ? `${request.unit.unit_name || request.unit.unit_code || "Unit"}`
                                                        : request.request_scope ===
                                                            "property_common_area"
                                                          ? "Property Common Area"
                                                          : "—"}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4">
                                                <p className="text-sm font-medium text-slate-800">
                                                    {
                                                        request.tenant
                                                            ?.display_name ||
                                                        "—"
                                                    }
                                                </p>

                                                {request.lease
                                                    ?.lease_number && (
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        Lease:{" "}
                                                        {
                                                            request.lease
                                                                .lease_number
                                                        }
                                                    </p>
                                                )}
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex flex-col items-start gap-2">
                                                    <span
                                                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClassName(
                                                            request.priority
                                                        )}`}
                                                    >
                                                        {
                                                            formatLabel(
                                                                request.priority
                                                            )
                                                        }
                                                    </span>

                                                    <span className="text-xs font-medium text-slate-600">
                                                        {
                                                            formatLabel(
                                                                request.category
                                                            )
                                                        }
                                                    </span>

                                                    <span className="text-xs text-slate-500">
                                                        Impact:{" "}
                                                        {
                                                            formatLabel(
                                                                request.impact_level
                                                            )
                                                        }
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName(
                                                        request.status
                                                    )}`}
                                                >
                                                    {
                                                        formatLabel(
                                                            request.status
                                                        )
                                                    }
                                                </span>

                                                {hasOverdueSla(
                                                    request
                                                ) ? (
                                                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                                        <AlertTriangle className="h-3.5 w-3.5" />
                                                        SLA Overdue
                                                    </div>
                                                ) : (
                                                    <p className="mt-2 text-xs text-slate-500">
                                                        SLA on track
                                                    </p>
                                                )}
                                            </td>

                                            <td className="px-5 py-4">
                                                <p className="text-sm text-slate-700">
                                                    {
                                                        formatDateTime(
                                                            request.reported_at
                                                        )
                                                    }
                                                </p>

                                                <p className="mt-2 text-xs text-slate-500">
                                                    Updated:{" "}
                                                    {
                                                        formatDateTime(
                                                            request.updated_at
                                                        )
                                                    }
                                                </p>

                                                {request.reporter
                                                    ?.full_name && (
                                                    <p className="mt-2 text-xs text-slate-500">
                                                        By:{" "}
                                                        {
                                                            request.reporter
                                                                .full_name
                                                        }
                                                    </p>
                                                )}
                                            </td>

                                            <td className="px-5 py-4">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    leftIcon={Eye}
                                                    onClick={() =>
                                                        setDetailRequestPublicId(
                                                            request.public_id
                                                        )
                                                    }
                                                >
                                                    View
                                                </Button>
                                            </td>
                                        </tr>
                                    )
                                )
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                        {pageRangeText}
                    </p>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={ChevronLeft}
                            disabled={
                                loading ||
                                pagination.page <=
                                    1
                            }
                            onClick={() =>
                                loadMaintenanceRequests({
                                    page:
                                        pagination.page -
                                        1
                                })
                            }
                        >
                            Previous
                        </Button>

                        <span className="px-2 text-sm font-medium text-slate-600">
                            Page{" "}
                            {
                                pagination.page
                            }
                            {" of "}
                            {
                                Math.max(
                                    pagination.total_pages,
                                    1
                                )
                            }
                        </span>

                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={ChevronRight}
                            disabled={
                                loading ||
                                pagination
                                    .total_pages ===
                                    0 ||
                                pagination.page >=
                                    pagination
                                        .total_pages
                            }
                            onClick={() =>
                                loadMaintenanceRequests({
                                    page:
                                        pagination.page +
                                        1
                                })
                            }
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>

            <CreateMaintenanceRequestModal
                open={createOpen}
                submissionContext={
                    isAdmin
                        ? "owner"
                        : accessContext
                }
                onClose={() =>
                    setCreateOpen(false)
                }
                onCreated={() => {
                    setCreateOpen(false);

                    loadMaintenanceRequests({
                        page: 1
                    });
                }}
            />

            {detailRequestPublicId && (
                <MaintenanceDetailModal
                    maintenanceRequestPublicId={
                        detailRequestPublicId
                    }
                    accessContext={
                        isAdmin
                            ? null
                            : accessContext
                    }
                    onChanged={() =>
                        loadMaintenanceRequests({
                            page:
                                pagination.page
                        })
                    }
                    onClose={() =>
                        setDetailRequestPublicId(
                            null
                        )
                    }
                />
            )}
        </div>
    );
}

export default MaintenancePage;

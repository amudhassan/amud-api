import {
    Building2,
    ChevronLeft,
    ChevronRight,
    CircleUserRound,
    Eye,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    UserRoundCheck,
    UserRoundX
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";
import {
    useNavigate
} from "react-router-dom";

import apiClient from "../../api/apiClient";
import CreateTenantModal from "./CreateTenantModal";
import {
    ActionGroup,
    Button,
    IconButton
} from "../../components/ui/Button";

const TENANT_TYPES = [
    "individual",
    "company",
    "government",
    "organization",
    "partnership"
];

const TENANT_STATUSES = [
    "prospective",
    "active",
    "inactive",
    "blocked"
];

const RELATIONSHIP_STATUSES = [
    "active",
    "blocked"
];

const EMPTY_SUMMARY = {
    total_tenants: 0,
    prospective_tenants: 0,
    active_tenants: 0,
    inactive_tenants: 0,
    blocked_tenants: 0,
    active_relationships: 0,
    blocked_relationships: 0
};

const EMPTY_PAGINATION = {
    current_page: 1,
    per_page: 20,
    total_items: 0,
    total_pages: 0,
    has_previous_page: false,
    has_next_page: false
};

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to complete the request.";

const statusClassName = status => {
    const styles = {
        prospective:
            "bg-amber-50 text-amber-700 ring-amber-200",
        active:
            "bg-emerald-50 text-emerald-700 ring-emerald-200",
        inactive:
            "bg-slate-100 text-slate-700 ring-slate-200",
        blocked:
            "bg-rose-50 text-rose-700 ring-rose-200"
    };

    return (
        styles[status] ||
        "bg-slate-100 text-slate-700 ring-slate-200"
    );
};

function TenantsPage() {
    const navigate = useNavigate();

    const [owners, setOwners] =
        useState([]);
    const [ownersLoading, setOwnersLoading] =
        useState(true);
    const [ownersError, setOwnersError] =
        useState("");
    const [selectedOwnerId, setSelectedOwnerId] =
        useState("");

    const [tenants, setTenants] =
        useState([]);
    const [summary, setSummary] =
        useState(EMPTY_SUMMARY);
    const [pagination, setPagination] =
        useState(EMPTY_PAGINATION);
    const [loading, setLoading] =
        useState(false);
    const [error, setError] =
        useState("");
    const [success, setSuccess] =
        useState("");
    const [createOpen, setCreateOpen] =
        useState(false);

    const [page, setPage] =
        useState(1);
    const [searchInput, setSearchInput] =
        useState("");
    const [search, setSearch] =
        useState("");
    const [tenantType, setTenantType] =
        useState("");
    const [tenantStatus, setTenantStatus] =
        useState("");
    const [relationshipStatus, setRelationshipStatus] =
        useState("");

    const selectedOwner =
        useMemo(
            () =>
                owners.find(
                    owner =>
                        owner.public_id ===
                        selectedOwnerId
                ) || null,
            [owners, selectedOwnerId]
        );

    const loadOwners =
        useCallback(
            async () => {
                try {
                    setOwnersLoading(true);
                    setOwnersError("");

                    const response =
                        await apiClient.get(
                            "/owners",
                            {
                                params: {
                                    page: 1,
                                    limit: 100
                                }
                            }
                        );

                    const directRows =
                        response?.data?.data;

                    const nestedRows =
                        response?.data?.data
                            ?.owners;

                    const rows =
                        Array.isArray(directRows)
                            ? directRows
                            : Array.isArray(nestedRows)
                                ? nestedRows
                                : [];

                    setOwners(rows);

                    setSelectedOwnerId(
                        current => {
                            if (
                                current &&
                                rows.some(
                                    owner =>
                                        owner.public_id ===
                                        current
                                )
                            ) {
                                return current;
                            }

                            return (
                                rows[0]?.public_id ||
                                ""
                            );
                        }
                    );
                } catch (requestError) {
                    setOwners([]);
                    setSelectedOwnerId("");
                    setOwnersError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setOwnersLoading(false);
                }
            },
            []
        );

    const loadTenants =
        useCallback(
            async () => {
                if (!selectedOwnerId) {
                    setTenants([]);
                    setSummary(EMPTY_SUMMARY);
                    setPagination(
                        EMPTY_PAGINATION
                    );
                    return;
                }

                try {
                    setLoading(true);
                    setError("");

                    const params = {
                        owner_public_id:
                            selectedOwnerId,
                        page,
                        limit: 20
                    };

                    if (search.trim()) {
                        params.search =
                            search.trim();
                    }

                    if (tenantType) {
                        params.tenant_type =
                            tenantType;
                    }

                    if (tenantStatus) {
                        params.status =
                            tenantStatus;
                    }

                    if (relationshipStatus) {
                        params.relationship_status =
                            relationshipStatus;
                    }

                    const response =
                        await apiClient.get(
                            "/tenants",
                            { params }
                        );

                    const payload =
                        response?.data?.data || {};

                    const rows =
                        Array.isArray(
                            payload.tenants
                        )
                            ? payload.tenants
                            : [];

                    setTenants(rows);

                    const sourceSummary =
                        payload.summary || {};

                    setSummary({
                        total_tenants:
                            Number(
                                sourceSummary
                                    .total_tenants ||
                                    0
                            ),
                        prospective_tenants:
                            Number(
                                sourceSummary
                                    .prospective_tenants ||
                                    0
                            ),
                        active_tenants:
                            Number(
                                sourceSummary
                                    .active_tenants ||
                                    0
                            ),
                        inactive_tenants:
                            Number(
                                sourceSummary
                                    .inactive_tenants ||
                                    0
                            ),
                        blocked_tenants:
                            Number(
                                sourceSummary
                                    .blocked_tenants ||
                                    0
                            ),
                        active_relationships:
                            Number(
                                sourceSummary
                                    .active_relationships ||
                                    0
                            ),
                        blocked_relationships:
                            Number(
                                sourceSummary
                                    .blocked_relationships ||
                                    0
                            )
                    });

                    setPagination({
                        ...EMPTY_PAGINATION,
                        ...(payload.pagination || {})
                    });
                } catch (requestError) {
                    setTenants([]);
                    setSummary(EMPTY_SUMMARY);
                    setPagination(
                        EMPTY_PAGINATION
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
                page,
                relationshipStatus,
                search,
                selectedOwnerId,
                tenantStatus,
                tenantType
            ]
        );

    useEffect(() => {
        loadOwners();
    }, [loadOwners]);

    useEffect(() => {
        loadTenants();
    }, [loadTenants]);

    const handleOwnerChange = event => {
        setSelectedOwnerId(
            event.target.value
        );
        setPage(1);
        setSearchInput("");
        setSearch("");
        setTenantType("");
        setTenantStatus("");
        setRelationshipStatus("");
    };

    const handleSearchSubmit = event => {
        event.preventDefault();
        setPage(1);
        setSearch(
            searchInput.trim()
        );
    };

    const clearFilters = () => {
        setSearchInput("");
        setSearch("");
        setTenantType("");
        setTenantStatus("");
        setRelationshipStatus("");
        setPage(1);
    };

    const stats = [
        {
            label: "Total Tenants",
            value: summary.total_tenants,
            icon: CircleUserRound
        },
        {
            label: "Active",
            value: summary.active_tenants,
            icon: UserRoundCheck
        },
        {
            label: "Prospective",
            value:
                summary.prospective_tenants,
            icon: ShieldCheck
        },
        {
            label: "Blocked",
            value: summary.blocked_tenants,
            icon: UserRoundX
        }
    ];

    return (
        <div className="space-y-6">
            <div
                className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"
            >
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                        Tenants
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        View tenant profiles and current owner relationships.
                    </p>
                </div>

                <ActionGroup>
                    <IconButton
                        label="Refresh tenants"
                        icon={RefreshCw}
                        onClick={loadTenants}
                        loading={loading}
                        disabled={
                            !selectedOwnerId
                        }
                    />

                    <Button
                        leftIcon={Plus}
                        onClick={() => {
                            setSuccess("");
                            setCreateOpen(true);
                        }}
                        disabled={!selectedOwnerId}
                    >
                        Add Tenant
                    </Button>
                </ActionGroup>
            </div>

            {success && (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                >
                    {success}
                </div>
            )}

            {ownersError && (
                <div
                    role="alert"
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                >
                    {ownersError}
                </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <Building2 className="h-5 w-5" />
                        </div>

                        <div>
                            <p className="text-sm font-semibold text-slate-900">
                                Owner Context
                            </p>
                            <p className="text-xs text-slate-500">
                                Tenant records are scoped to the selected authorized owner.
                            </p>
                        </div>
                    </div>

                    <select
                        value={selectedOwnerId}
                        onChange={handleOwnerChange}
                        disabled={
                            ownersLoading ||
                            owners.length === 0
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 lg:max-w-md"
                    >
                        {ownersLoading ? (
                            <option value="">
                                Loading owners...
                            </option>
                        ) : owners.length === 0 ? (
                            <option value="">
                                No authorized owners
                            </option>
                        ) : (
                            owners.map(owner => (
                                <option
                                    key={
                                        owner.public_id
                                    }
                                    value={
                                        owner.public_id
                                    }
                                >
                                    {owner.display_name}
                                    {owner.owner_type
                                        ? ` · ${formatLabel(owner.owner_type)}`
                                        : ""}
                                </option>
                            ))
                        )}
                    </select>
                </div>

                {selectedOwner && (
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1">
                            {selectedOwner.display_name}
                        </span>
                        {selectedOwner.status && (
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1">
                                Owner status: {formatLabel(selectedOwner.status)}
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map(stat => {
                    const Icon = stat.icon;

                    return (
                        <div
                            key={stat.label}
                            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">
                                        {stat.label}
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-slate-950">
                                        {stat.value}
                                    </p>
                                </div>

                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                    <Icon className="h-5 w-5" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <form
                    onSubmit={handleSearchSubmit}
                    className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_190px_170px_190px_auto]"
                >
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={searchInput}
                            onChange={event =>
                                setSearchInput(
                                    event.target.value
                                )
                            }
                            placeholder="Search tenant details"
                            disabled={!selectedOwnerId}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                    </div>

                    <select
                        value={tenantType}
                        onChange={event => {
                            setTenantType(
                                event.target.value
                            );
                            setPage(1);
                        }}
                        disabled={!selectedOwnerId}
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <option value="">
                            All tenant types
                        </option>
                        {TENANT_TYPES.map(type => (
                            <option
                                key={type}
                                value={type}
                            >
                                {formatLabel(type)}
                            </option>
                        ))}
                    </select>

                    <select
                        value={tenantStatus}
                        onChange={event => {
                            setTenantStatus(
                                event.target.value
                            );
                            setPage(1);
                        }}
                        disabled={!selectedOwnerId}
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <option value="">
                            All statuses
                        </option>
                        {TENANT_STATUSES.map(status => (
                            <option
                                key={status}
                                value={status}
                            >
                                {formatLabel(status)}
                            </option>
                        ))}
                    </select>

                    <select
                        value={relationshipStatus}
                        onChange={event => {
                            setRelationshipStatus(
                                event.target.value
                            );
                            setPage(1);
                        }}
                        disabled={!selectedOwnerId}
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <option value="">
                            All relationships
                        </option>
                        {RELATIONSHIP_STATUSES.map(
                            status => (
                                <option
                                    key={status}
                                    value={status}
                                >
                                    {formatLabel(status)}
                                </option>
                            )
                        )}
                    </select>

                    <div className="flex gap-2">
                        <Button
                            type="submit"
                            size="lg"
                            leftIcon={Search}
                            disabled={!selectedOwnerId}
                        >
                            Search
                        </Button>

                        <Button
                            variant="secondary"
                            size="lg"
                            onClick={clearFilters}
                            disabled={!selectedOwnerId}
                        >
                            Clear
                        </Button>
                    </div>
                </form>
            </div>

            {error && (
                <div
                    role="alert"
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                >
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-950">
                            Tenant List
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {selectedOwner
                                ? `Current relationships for ${selectedOwner.display_name}`
                                : "Select an owner to load tenant records."}
                        </p>
                    </div>

                    <div className="text-sm text-slate-500">
                        {pagination.total_items} result{pagination.total_items === 1 ? "" : "s"}
                    </div>
                </div>

                {loading ? (
                    <div className="flex min-h-[280px] items-center justify-center gap-2 text-sm text-slate-500">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading tenants...
                    </div>
                ) : !selectedOwnerId ? (
                    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
                        <Building2 className="h-9 w-9 text-slate-300" />
                        <p className="mt-3 font-semibold text-slate-800">
                            Owner context required
                        </p>
                        <p className="mt-1 max-w-md text-sm text-slate-500">
                            Select an authorized owner before viewing tenant records.
                        </p>
                    </div>
                ) : tenants.length === 0 ? (
                    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
                        <CircleUserRound className="h-9 w-9 text-slate-300" />
                        <p className="mt-3 font-semibold text-slate-800">
                            No tenants found
                        </p>
                        <p className="mt-1 max-w-md text-sm text-slate-500">
                            No current tenant relationships match the selected filters.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <th className="px-5 py-3">Tenant</th>
                                    <th className="px-5 py-3">Type</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Relationship</th>
                                    <th className="px-5 py-3">Contact</th>
                                    <th className="px-5 py-3">Location</th>
                                    <th className="px-5 py-3 text-right">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100 bg-white">
                                {tenants.map(tenant => {
                                    const relationship =
                                        tenant.owner_relationship || {};

                                    return (
                                        <tr
                                            key={tenant.public_id}
                                            className="align-middle"
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                                        <CircleUserRound className="h-4 w-4" />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-slate-900">
                                                            {tenant.display_name}
                                                        </p>
                                                        <p className="mt-0.5 max-w-[240px] truncate text-xs text-slate-500">
                                                            {tenant.email ||
                                                                tenant.phone_number ||
                                                                tenant.public_id}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                {formatLabel(
                                                    tenant.tenant_type
                                                )}
                                            </td>

                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClassName(tenant.status)}`}
                                                >
                                                    {formatLabel(
                                                        tenant.status
                                                    )}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="space-y-1">
                                                    <span
                                                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClassName(relationship.relationship_status)}`}
                                                    >
                                                        {formatLabel(
                                                            relationship.relationship_status
                                                        )}
                                                    </span>

                                                    {relationship.is_primary_owner_relationship && (
                                                        <p className="text-xs font-medium text-blue-600">
                                                            Primary owner relationship
                                                        </p>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                <p>
                                                    {tenant.phone_number || "—"}
                                                </p>
                                                <p className="mt-0.5 text-xs text-slate-500">
                                                    {tenant.email || "—"}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                {[tenant.city, tenant.region, tenant.country]
                                                    .filter(Boolean)
                                                    .join(", ") || "—"}
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex justify-end">
                                                    <ActionGroup>
                                                        <IconButton
                                                            label="View tenant details"
                                                            icon={Eye}
                                                            onClick={() =>
                                                                navigate(
                                                                    `/tenants/${tenant.public_id}?owner_public_id=${encodeURIComponent(selectedOwnerId)}`
                                                                )
                                                            }
                                                        />
                                                    </ActionGroup>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                        Page {pagination.current_page || 1}
                        {pagination.total_pages
                            ? ` of ${pagination.total_pages}`
                            : ""}
                    </p>

                    <ActionGroup>
                        <IconButton
                            label="Previous page"
                            icon={ChevronLeft}
                            disabled={
                                loading ||
                                !pagination.has_previous_page
                            }
                            onClick={() =>
                                setPage(current =>
                                    Math.max(
                                        1,
                                        current - 1
                                    )
                                )
                            }
                        />

                        <IconButton
                            label="Next page"
                            icon={ChevronRight}
                            disabled={
                                loading ||
                                !pagination.has_next_page
                            }
                            onClick={() =>
                                setPage(current =>
                                    current + 1
                                )
                            }
                        />
                    </ActionGroup>
                </div>
            </div>

            <CreateTenantModal
                open={createOpen}
                owner={selectedOwner}
                onClose={() =>
                    setCreateOpen(false)
                }
                onCreated={async tenant => {
                    setCreateOpen(false);
                    setSuccess(
                        `${tenant?.display_name || "Tenant"} created successfully.`
                    );
                    setPage(1);
                    await loadTenants();
                }}
            />
        </div>
    );
}

export default TenantsPage;

import {
    ArrowLeft,
    Check,
    UserPlus,
    ChevronLeft,
    ChevronRight,
    CircleUserRound,
    RefreshCw,
    Search,
    ShieldCheck,
    UserRoundCog,
    X
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useState
} from "react";
import {
    useNavigate,
    useParams,
    useSearchParams
} from "react-router-dom";

import apiClient from "../../api/apiClient";
import AddTenantUserModal from "./AddTenantUserModal";
import {
    ActionGroup,
    Button,
    IconButton
} from "../../components/ui/Button";

const RELATIONSHIP_ROLES = [
    "primary_contact",
    "authorized_representative",
    "accountant",
    "occupant",
    "viewer"
];

const EMPTY_PAGINATION = {
    total: 0,
    page: 1,
    limit: 20,
    total_pages: 0,
    has_next_page: false,
    has_previous_page: false
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to retrieve tenant users.";

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );

function PermissionBadge({
    allowed,
    label
}) {
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
                allowed
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-slate-100 text-slate-500 ring-slate-200"
            }`}
        >
            {allowed ? (
                <Check className="h-3 w-3" />
            ) : (
                <X className="h-3 w-3" />
            )}
            {label}
        </span>
    );
}

function TenantUsersPage() {
    const navigate = useNavigate();
    const { tenant_public_id } =
        useParams();
    const [searchParams] =
        useSearchParams();

    const ownerPublicId =
        searchParams.get(
            "owner_public_id"
        ) || "";

    const [tenant, setTenant] =
        useState(null);
    const [users, setUsers] =
        useState([]);
    const [pagination, setPagination] =
        useState(EMPTY_PAGINATION);

    const [loading, setLoading] =
        useState(true);
    const [error, setError] =
        useState("");
    const [success, setSuccess] =
        useState("");
    const [addOpen, setAddOpen] =
        useState(false);

    const [page, setPage] =
        useState(1);
    const [searchInput, setSearchInput] =
        useState("");
    const [search, setSearch] =
        useState("");
    const [
        relationshipRole,
        setRelationshipRole
    ] = useState("");

    const loadUsers = useCallback(
        async () => {
            try {
                setLoading(true);
                setError("");

                const params = {
                    page,
                    limit: 20
                };

                if (search.trim()) {
                    params.search =
                        search.trim();
                }

                if (relationshipRole) {
                    params.relationship_role =
                        relationshipRole;
                }

                const response =
                    await apiClient.get(
                        `/tenants/${tenant_public_id}/users`,
                        {
                            params
                        }
                    );

                const payload =
                    response?.data?.data || {};

                setTenant(
                    payload.tenant || null
                );

                setUsers(
                    Array.isArray(
                        payload.users
                    )
                        ? payload.users
                        : []
                );

                setPagination({
                    ...EMPTY_PAGINATION,
                    ...(payload.pagination ||
                        {})
                });
            } catch (requestError) {
                setTenant(null);
                setUsers([]);
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
            tenant_public_id,
            page,
            search,
            relationshipRole
        ]
    );

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const submitSearch = event => {
        event.preventDefault();
        setPage(1);
        setSearch(
            searchInput.trim()
        );
    };

    const clearFilters = () => {
        setSearchInput("");
        setSearch("");
        setRelationshipRole("");
        setPage(1);
    };

    const goBack = () => {
        if (ownerPublicId) {
            navigate(
                `/tenants/${tenant_public_id}?owner_public_id=${encodeURIComponent(
                    ownerPublicId
                )}`
            );
            return;
        }

        navigate("/tenants");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <UserRoundCog className="h-5 w-5" />
                        </div>

                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                                Tenant Users
                            </h1>

                            <p className="mt-1 text-sm text-slate-500">
                                Manage active portal users linked to this tenant.
                            </p>
                        </div>
                    </div>
                </div>

                <ActionGroup>
                    <Button
                        leftIcon={UserPlus}
                        onClick={() => {
                            setSuccess("");
                            setAddOpen(true);
                        }}
                    >
                        Add Tenant User
                    </Button>

                    <IconButton
                        label="Back to tenant details"
                        icon={ArrowLeft}
                        onClick={goBack}
                    />

                    <IconButton
                        label="Refresh tenant users"
                        icon={RefreshCw}
                        onClick={loadUsers}
                        loading={loading}
                    />
                </ActionGroup>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Tenant
                        </p>

                        <p className="mt-1 font-semibold text-slate-900">
                            {tenant?.public_id ||
                                tenant_public_id}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <CircleUserRound className="h-4 w-4" />
                        {pagination.total || 0} active user relationship
                        {(pagination.total || 0) === 1
                            ? ""
                            : "s"}
                    </div>
                </div>
            </div>

            <form
                onSubmit={submitSearch}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px_auto]">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                        <input
                            value={searchInput}
                            onChange={event =>
                                setSearchInput(
                                    event.target.value
                                )
                            }
                            placeholder="Search by name or email"
                            maxLength={200}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <select
                        value={relationshipRole}
                        onChange={event => {
                            setRelationshipRole(
                                event.target.value
                            );
                            setPage(1);
                        }}
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                        <option value="">
                            All relationship roles
                        </option>

                        {RELATIONSHIP_ROLES.map(
                            role => (
                                <option
                                    key={role}
                                    value={role}
                                >
                                    {formatLabel(
                                        role
                                    )}
                                </option>
                            )
                        )}
                    </select>

                    <div className="flex gap-2">
                        <Button
                            type="submit"
                            leftIcon={Search}
                        >
                            Search
                        </Button>

                        <Button
                            type="button"
                            variant="secondary"
                            onClick={
                                clearFilters
                            }
                        >
                            Clear
                        </Button>
                    </div>
                </div>
            </form>

            {success && (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                >
                    {success}
                </div>
            )}

            {error && (
                <div
                    role="alert"
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                >
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {loading ? (
                    <div className="flex min-h-[300px] items-center justify-center gap-2 text-sm text-slate-500">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading tenant users...
                    </div>
                ) : users.length === 0 ? (
                    <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
                        <UserRoundCog className="h-10 w-10 text-slate-300" />

                        <h2 className="mt-3 text-base font-semibold text-slate-900">
                            No active tenant users found
                        </h2>

                        <p className="mt-1 max-w-md text-sm text-slate-500">
                            Adjust the search or role filter, or add a tenant user in the next management phase.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        User
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Relationship
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Permissions
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Account
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {users.map(user => (
                                    <tr
                                        key={
                                            user.link_public_id
                                        }
                                        className="align-top hover:bg-slate-50/70"
                                    >
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                                                    <CircleUserRound className="h-5 w-5" />
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="font-semibold text-slate-900">
                                                        {user.full_name ||
                                                            "Unnamed user"}
                                                    </p>

                                                    <p className="mt-1 break-all text-xs text-slate-500">
                                                        {user.email ||
                                                            "—"}
                                                    </p>

                                                    <p className="mt-1 break-all text-[11px] text-slate-400">
                                                        {user.user_public_id}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-4 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                                                    {formatLabel(
                                                        user.relationship_role
                                                    )}
                                                </span>

                                                {user.is_primary && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
                                                        <ShieldCheck className="h-3 w-3" />
                                                        Primary
                                                    </span>
                                                )}
                                            </div>

                                            <p className="mt-2 break-all text-[11px] text-slate-400">
                                                {user.link_public_id}
                                            </p>
                                        </td>

                                        <td className="px-4 py-4">
                                            <div className="flex max-w-xl flex-wrap gap-1.5">
                                                <PermissionBadge
                                                    allowed={user.can_view_leases}
                                                    label="Leases"
                                                />
                                                <PermissionBadge
                                                    allowed={user.can_view_finances}
                                                    label="Finances"
                                                />
                                                <PermissionBadge
                                                    allowed={user.can_make_payments}
                                                    label="Payments"
                                                />
                                                <PermissionBadge
                                                    allowed={user.can_submit_maintenance}
                                                    label="Maintenance"
                                                />
                                                <PermissionBadge
                                                    allowed={user.can_manage_tenant_users}
                                                    label="Manage Users"
                                                />
                                            </div>
                                        </td>

                                        <td className="px-4 py-4">
                                            <div className="space-y-2">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                                                        user.is_verified
                                                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                                            : "bg-amber-50 text-amber-700 ring-amber-200"
                                                    }`}
                                                >
                                                    {user.is_verified
                                                        ? "Verified"
                                                        : "Unverified"}
                                                </span>

                                                <p className="text-xs text-slate-500">
                                                    {formatLabel(
                                                        user.user_role
                                                    )}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                        Page {pagination.page || 1}
                        {pagination.total_pages > 0
                            ? ` of ${pagination.total_pages}`
                            : ""}
                        {" · "}
                        {pagination.total || 0} total
                    </p>

                    <ActionGroup>
                        <IconButton
                            label="Previous page"
                            icon={ChevronLeft}
                            onClick={() =>
                                setPage(current =>
                                    Math.max(
                                        1,
                                        current - 1
                                    )
                                )
                            }
                            disabled={
                                loading ||
                                !pagination
                                    .has_previous_page
                            }
                        />

                        <IconButton
                            label="Next page"
                            icon={ChevronRight}
                            onClick={() =>
                                setPage(current =>
                                    current + 1
                                )
                            }
                            disabled={
                                loading ||
                                !pagination
                                    .has_next_page
                            }
                        />
                    </ActionGroup>
                </div>
            </div>
            <AddTenantUserModal
                open={addOpen}
                tenantPublicId={tenant_public_id}
                onClose={() =>
                    setAddOpen(false)
                }
                onAdded={async addedUser => {
                    setAddOpen(false);
                    setSuccess(
                        `${addedUser?.full_name || "Tenant user"} added successfully.`
                    );
                    setPage(1);
                    await loadUsers();
                }}
            />
        </div>
    );
}

export default TenantUsersPage;

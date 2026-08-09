import {
    CheckCircle2,
    ChevronLeft,
    Eye,
    Pencil,
    ChevronRight,
    RefreshCw,
    RotateCcw,
    Search,
    ShieldCheck,
    Trash2,
    UserPlus,
    UserRoundCog,
    XCircle
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

import DeleteUserModal from "./components/DeleteUserModal";
import RestoreUserModal from "./components/RestoreUserModal";

import {
    ActionGroup,
    Button,
    IconButton
} from "../../components/ui/Button";

const PAGE_LIMIT = 20;

const EMPTY_PAGINATION = {
    page: 1,
    limit: PAGE_LIMIT,
    totalUsers: 0,
    totalPages: 0,
    count: 0
};

const getErrorMessage = error => {
    if (error?.response?.status === 403) {
        return "Only an administrator can view the system users list.";
    }

    return (
        error?.response?.data?.message ||
        error?.message ||
        "Unable to retrieve system users."
    );
};

const formatDateTime = value => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    ).format(date);
};

const formatRole = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );

function StatusBadge({
    kind,
    children
}) {
    const classes = {
        success:
            "bg-emerald-50 text-emerald-700 ring-emerald-200",
        warning:
            "bg-amber-50 text-amber-700 ring-amber-200",
        danger:
            "bg-rose-50 text-rose-700 ring-rose-200",
        neutral:
            "bg-slate-100 text-slate-600 ring-slate-200",
        blue:
            "bg-blue-50 text-blue-700 ring-blue-200"
    };

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                classes[kind] ||
                classes.neutral
            }`}
        >
            {children}
        </span>
    );
}

function UsersPage() {
    const navigate = useNavigate();

    const [users, setUsers] =
        useState([]);

    const [
        pagination,
        setPagination
    ] = useState(
        EMPTY_PAGINATION
    );

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [
        deleteTarget,
        setDeleteTarget
    ] = useState(null);

    const [
        restoreTarget,
        setRestoreTarget
    ] = useState(null);

    const [page, setPage] =
        useState(1);

    const [
        searchInput,
        setSearchInput
    ] = useState("");

    const [search, setSearch] =
        useState("");

    const [role, setRole] =
        useState("");

    const [status, setStatus] =
        useState("all");

    const loadUsers =
        useCallback(
            async () => {
                try {
                    setLoading(true);
                    setError("");

                    const params = {
                        page,
                        limit:
                            PAGE_LIMIT
                    };

                    if (search.trim()) {
                        params.search =
                            search.trim();
                    }

                    if (role) {
                        params.role =
                            role;
                    }

                    params.status =
                        status;

                    const response =
                        await apiClient.get(
                            "/users",
                            {
                                params
                            }
                        );

                    const payload =
                        response?.data ||
                        {};

                    setUsers(
                        Array.isArray(
                            payload.users
                        )
                            ? payload.users
                            : []
                    );

                    setPagination({
                        page:
                            Number(
                                payload.page
                            ) || 1,

                        limit:
                            Number(
                                payload.limit
                            ) ||
                            PAGE_LIMIT,

                        totalUsers:
                            Number(
                                payload.totalUsers
                            ) || 0,

                        totalPages:
                            Number(
                                payload.totalPages
                            ) || 0,

                        count:
                            Number(
                                payload.count
                            ) || 0
                    });
                } catch (
                    requestError
                ) {
                    setUsers([]);
                    setPagination({
                        ...EMPTY_PAGINATION,
                        page
                    });

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
                search,
                role,
                status
            ]
        );

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        setPage(1);
    }, [
        role,
        status
    ]);

    const eligibleCount =
        useMemo(
            () =>
                users.filter(
                    user =>
                        user.is_verified ===
                            true &&
                        !user.deleted_at
                ).length,
            [users]
        );

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
        setRole("");
        setStatus("all");
        setPage(1);
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
                                Users Management
                            </h1>

                            <p className="mt-1 text-sm text-slate-500">
                                View and manage registered system accounts.
                            </p>
                        </div>
                    </div>
                </div>

                <ActionGroup>
                    <Button
                        leftIcon={
                            UserPlus
                        }
                        onClick={() =>
                            navigate(
                                "/register"
                            )
                        }
                    >
                        Register User
                    </Button>

                    <IconButton
                        label="Refresh users"
                        icon={
                            RefreshCw
                        }
                        onClick={
                            loadUsers
                        }
                        loading={
                            loading
                        }
                    />
                </ActionGroup>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Total users
                    </p>

                    <p className="mt-2 text-3xl font-bold text-slate-950">
                        {
                            pagination.totalUsers
                        }
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Visible on this page
                    </p>

                    <p className="mt-2 text-3xl font-bold text-slate-950">
                        {users.length}
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Eligible for linking
                    </p>

                    <p className="mt-2 text-3xl font-bold text-emerald-600">
                        {eligibleCount}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                        Verified and not deleted on this page.
                    </p>
                </div>
            </div>

            <form
                onSubmit={
                    submitSearch
                }
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
                <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                        <input
                            type="search"
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
                            placeholder="Search by name or email"
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <select
                        value={role}
                        onChange={
                            event =>
                                setRole(
                                    event
                                        .target
                                        .value
                                )
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                        <option value="">
                            All roles
                        </option>

                        <option value="admin">
                            Admin
                        </option>

                        <option value="user">
                            User
                        </option>
                    </select>

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
                        aria-label="Filter users by account status"
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                        <option value="all">
                            All statuses
                        </option>

                        <option value="active">
                            Active
                        </option>

                        <option value="deleted">
                            Deleted
                        </option>
                    </select>

                    <div className="flex gap-2">
                        <Button
                            type="submit"
                            leftIcon={
                                Search
                            }
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

            {error && (
                <div
                    role="alert"
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                >
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-semibold text-slate-950">
                                Registered Accounts
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Open a user profile to review account details and lifecycle state.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                            <ShieldCheck className="h-4 w-4" />
                            Admin-only API
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="px-5 py-14 text-center text-sm text-slate-500">
                        Loading users...
                    </div>
                ) : users.length === 0 ? (
                    <div className="px-5 py-14 text-center">
                        <UserRoundCog className="mx-auto h-9 w-9 text-slate-300" />

                        <p className="mt-3 font-semibold text-slate-800">
                            No users found
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                            Change the search or role filter and try again.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="w-full min-w-[1120px] border-collapse">
                                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-5 py-3">
                                            User
                                        </th>

                                        <th className="px-5 py-3">
                                            Role
                                        </th>

                                        <th className="px-5 py-3">
                                            Verification
                                        </th>

                                        <th className="px-5 py-3">
                                            Account
                                        </th>

                                        <th className="px-5 py-3">
                                            Registered
                                        </th>

                                        <th className="px-5 py-3 text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {users.map(
                                        user => {
                                            const deleted =
                                                Boolean(
                                                    user.deleted_at
                                                );

                                            const verified =
                                                user.is_verified ===
                                                true;

                                            const eligible =
                                                verified &&
                                                !deleted;

                                            return (
                                                <tr
                                                    key={
                                                        user.public_id
                                                    }
                                                    className="align-top hover:bg-slate-50/80"
                                                >
                                                    <td className="px-5 py-4">
                                                        <p className="font-semibold text-slate-900">
                                                            {
                                                                user.full_name
                                                            }
                                                        </p>

                                                        <p className="mt-1 text-sm text-slate-500">
                                                            {
                                                                user.email
                                                            }
                                                        </p>

                                                        {eligible && (
                                                            <div className="mt-2">
                                                                <StatusBadge kind="success">
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                    Eligible for tenant linking
                                                                </StatusBadge>
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <StatusBadge kind={user.role === "admin" ? "blue" : "neutral"}>
                                                            {formatRole(
                                                                user.role
                                                            )}
                                                        </StatusBadge>
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        {verified ? (
                                                            <StatusBadge kind="success">
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                                Verified
                                                            </StatusBadge>
                                                        ) : (
                                                            <StatusBadge kind="warning">
                                                                <XCircle className="h-3.5 w-3.5" />
                                                                Unverified
                                                            </StatusBadge>
                                                        )}
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        {deleted ? (
                                                            <StatusBadge kind="danger">
                                                                Deleted
                                                            </StatusBadge>
                                                        ) : (
                                                            <StatusBadge kind="success">
                                                                Active
                                                            </StatusBadge>
                                                        )}
                                                    </td>


                                                    <td className="px-5 py-4 text-sm text-slate-500">
                                                        {formatDateTime(
                                                            user.created_at
                                                        )}
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <div className="flex justify-end">
                                                            <div className="flex items-center gap-2">
                                                                <IconButton
                                                                    label="View user profile"
                                                                    icon={Eye}
                                                                    onClick={() =>
                                                                        navigate(
                                                                            `/users/${user.public_id}`
                                                                        )
                                                                    }
                                                                />

                                                                {deleted ? (
                                                                    <button
                                                                        type="button"
                                                                        title="Restore user"
                                                                        aria-label={`Restore ${user.full_name}`}
                                                                        onClick={() =>
                                                                            setRestoreTarget(
                                                                                user
                                                                            )
                                                                        }
                                                                        className="
                                                                            inline-flex h-9 w-9
                                                                            items-center justify-center
                                                                            rounded-xl
                                                                            border border-emerald-200
                                                                            bg-white
                                                                            text-emerald-600
                                                                            transition
                                                                            hover:bg-emerald-50
                                                                            hover:text-emerald-700
                                                                            focus:outline-none
                                                                            focus:ring-4
                                                                            focus:ring-emerald-100
                                                                        "
                                                                    >
                                                                        <RotateCcw className="h-4 w-4" />
                                                                    </button>
                                                                ) : (
                                                                    <>
                                                                        <IconButton
                                                                            label="Edit user"
                                                                            icon={Pencil}
                                                                            onClick={() =>
                                                                                navigate(
                                                                                    `/users/${user.public_id}/edit`
                                                                                )
                                                                            }
                                                                        />

                                                                        <button
                                                                            type="button"
                                                                            title="Delete user"
                                                                            aria-label={`Delete ${user.full_name}`}
                                                                            onClick={() =>
                                                                                setDeleteTarget(
                                                                                    user
                                                                                )
                                                                            }
                                                                            className="
                                                                                inline-flex h-9 w-9
                                                                                items-center justify-center
                                                                                rounded-xl
                                                                                border border-rose-200
                                                                                bg-white
                                                                                text-rose-600
                                                                                transition
                                                                                hover:bg-rose-50
                                                                                hover:text-rose-700
                                                                                focus:outline-none
                                                                                focus:ring-4
                                                                                focus:ring-rose-100
                                                                            "
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="divide-y divide-slate-100 lg:hidden">
                            {users.map(
                                user => {
                                    const deleted =
                                        Boolean(
                                            user.deleted_at
                                        );

                                    const verified =
                                        user.is_verified ===
                                        true;

                                    const eligible =
                                        verified &&
                                        !deleted;

                                    return (
                                        <div
                                            key={
                                                user.public_id
                                            }
                                            className="space-y-4 p-5"
                                        >
                                            <div>
                                                <p className="font-semibold text-slate-900">
                                                    {
                                                        user.full_name
                                                    }
                                                </p>

                                                <p className="mt-1 break-all text-sm text-slate-500">
                                                    {
                                                        user.email
                                                    }
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <StatusBadge kind={user.role === "admin" ? "blue" : "neutral"}>
                                                    {formatRole(
                                                        user.role
                                                    )}
                                                </StatusBadge>

                                                <StatusBadge kind={verified ? "success" : "warning"}>
                                                    {verified
                                                        ? "Verified"
                                                        : "Unverified"}
                                                </StatusBadge>

                                                <StatusBadge kind={deleted ? "danger" : "success"}>
                                                    {deleted
                                                        ? "Deleted"
                                                        : "Active"}
                                                </StatusBadge>

                                                {eligible && (
                                                    <StatusBadge kind="success">
                                                        Eligible for linking
                                                    </StatusBadge>
                                                )}
                                            </div>


                                            <div className="flex justify-end">
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        leftIcon={Eye}
                                                        onClick={() =>
                                                            navigate(
                                                                `/users/${user.public_id}`
                                                            )
                                                        }
                                                    >
                                                        View Profile
                                                    </Button>

                                                    {deleted ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setRestoreTarget(
                                                                    user
                                                                )
                                                            }
                                                            className="
                                                                inline-flex min-h-10
                                                                items-center justify-center
                                                                gap-2 rounded-xl
                                                                border border-emerald-200
                                                                bg-white
                                                                px-3 py-2
                                                                text-sm font-semibold
                                                                text-emerald-600
                                                                transition
                                                                hover:bg-emerald-50
                                                                hover:text-emerald-700
                                                                focus:outline-none
                                                                focus:ring-4
                                                                focus:ring-emerald-100
                                                            "
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                            Restore
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                leftIcon={Pencil}
                                                                onClick={() =>
                                                                    navigate(
                                                                        `/users/${user.public_id}/edit`
                                                                    )
                                                                }
                                                            >
                                                                Edit
                                                            </Button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setDeleteTarget(
                                                                        user
                                                                    )
                                                                }
                                                                className="
                                                                    inline-flex min-h-10
                                                                    items-center justify-center
                                                                    gap-2 rounded-xl
                                                                    border border-rose-200
                                                                    bg-white
                                                                    px-3 py-2
                                                                    text-sm font-semibold
                                                                    text-rose-600
                                                                    transition
                                                                    hover:bg-rose-50
                                                                    hover:text-rose-700
                                                                    focus:outline-none
                                                                    focus:ring-4
                                                                    focus:ring-rose-100
                                                                "
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                Delete
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <p className="text-xs text-slate-400">
                                                Registered{" "}
                                                {formatDateTime(
                                                    user.created_at
                                                )}
                                            </p>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    </>
                )}

                <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                        Page{" "}
                        <span className="font-semibold text-slate-800">
                            {
                                pagination.page
                            }
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-slate-800">
                            {
                                Math.max(
                                    pagination.totalPages,
                                    1
                                )
                            }
                        </span>{" "}
                        ·{" "}
                        {
                            pagination.totalUsers
                        }{" "}
                        user
                        {pagination.totalUsers ===
                        1
                            ? ""
                            : "s"}
                    </p>

                    <div className="flex items-center gap-2">
                        <IconButton
                            label="Previous users page"
                            icon={
                                ChevronLeft
                            }
                            disabled={
                                loading ||
                                page <=
                                    1
                            }
                            onClick={() =>
                                setPage(
                                    current =>
                                        Math.max(
                                            1,
                                            current -
                                                1
                                        )
                                )
                            }
                        />

                        <IconButton
                            label="Next users page"
                            icon={
                                ChevronRight
                            }
                            disabled={
                                loading ||
                                pagination.totalPages ===
                                    0 ||
                                page >=
                                    pagination.totalPages
                            }
                            onClick={() =>
                                setPage(
                                    current =>
                                        current +
                                        1
                                )
                            }
                        />
                    </div>
                </div>
            </div>

            <DeleteUserModal
                user={
                    deleteTarget
                }
                onClose={() =>
                    setDeleteTarget(
                        null
                    )
                }
                onDeleted={async () => {
                    setDeleteTarget(
                        null
                    );

                    await loadUsers();
                }}
            />

            <RestoreUserModal
                user={
                    restoreTarget
                }
                onClose={() =>
                    setRestoreTarget(
                        null
                    )
                }
                onRestored={async () => {
                    setRestoreTarget(
                        null
                    );

                    await loadUsers();
                }}
            />
        </div>
    );
}

export default UsersPage;

import {
    Building2,
    ChevronLeft,
    ChevronRight,
    Eye,
    Pencil,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    SlidersHorizontal,
    Trash2,
    UserRound
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button,
    IconButton
} from "../../components/ui/Button";

import CreateOwnerModal from "./CreateOwnerModal";
import DeleteOwnerModal from "./DeleteOwnerModal";
import DeletedOwnersModal from "./DeletedOwnersModal";
import EditOwnerModal from "./EditOwnerModal";
import OwnerDetailModal from "./OwnerDetailModal";

import {
    useAuth
} from "../../contexts/AuthContext";

const OWNER_TYPES = [
    ["", "All owner types"],
    ["individual", "Individual"],
    ["company", "Company"],
    ["government", "Government"],
    ["organization", "Organization"],
    ["partnership", "Partnership"]
];

const OWNER_STATUSES = [
    ["", "All statuses"],
    ["active", "Active"],
    ["inactive", "Inactive"],
    ["blocked", "Blocked"]
];

const EMPTY_PAGINATION = {
    page: 1,
    limit: 20,
    total_records: 0,
    total_pages: 1
};

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

const getInitials = value => {
    const words = String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);

    if (!words.length) {
        return "OW";
    }

    return words
        .map(word => word[0])
        .join("")
        .toUpperCase();
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load owners.";

const statusClassName = status => {
    switch (status) {
        case "active":
            return "bg-emerald-50 text-emerald-700 ring-emerald-200";

        case "blocked":
            return "bg-rose-50 text-rose-700 ring-rose-200";

        case "inactive":
        default:
            return "bg-slate-100 text-slate-600 ring-slate-200";
    }
};

function OwnersPage() {
    const {
        user
    } = useAuth();

    const [
        owners,
        setOwners
    ] = useState([]);

    const [
        createOpen,
        setCreateOpen
    ] = useState(false);

    const [
        selectedOwnerPublicId,
        setSelectedOwnerPublicId
    ] = useState(null);

    const [
        editOwnerPublicId,
        setEditOwnerPublicId
    ] = useState(null);

    const [
        deleteOwner,
        setDeleteOwner
    ] = useState(null);

    const [
        deletedOwnersOpen,
        setDeletedOwnersOpen
    ] = useState(false);

    const [
        success,
        setSuccess
    ] = useState("");

    const [
        pagination,
        setPagination
    ] = useState(
        EMPTY_PAGINATION
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
        ownerType,
        setOwnerType
    ] = useState("");

    const [
        status,
        setStatus
    ] = useState("");

    const [
        countryInput,
        setCountryInput
    ] = useState("");

    const [
        country,
        setCountry
    ] = useState("");

    const [
        page,
        setPage
    ] = useState(1);

    const limit = 20;

    const loadOwners =
        useCallback(
            async () => {
                try {
                    setLoading(true);
                    setError("");

                    const params = {
                        page,
                        limit
                    };

                    if (search) {
                        params.search =
                            search;
                    }

                    if (ownerType) {
                        params.owner_type =
                            ownerType;
                    }

                    if (status) {
                        params.status =
                            status;
                    }

                    if (country) {
                        params.country =
                            country;
                    }

                    const response =
                        await apiClient.get(
                            "/owners",
                            {
                                params
                            }
                        );

                    setOwners(
                        Array.isArray(
                            response?.data?.data
                        )
                            ? response.data.data
                            : []
                    );

                    setPagination({
                        ...EMPTY_PAGINATION,
                        ...(response?.data
                            ?.pagination ||
                            {}),
                        page:
                            Number(
                                response?.data
                                    ?.pagination
                                    ?.page
                            ) || page,
                        limit:
                            Number(
                                response?.data
                                    ?.pagination
                                    ?.limit
                            ) || limit,
                        total_records:
                            Number(
                                response?.data
                                    ?.pagination
                                    ?.total_records
                            ) || 0,
                        total_pages:
                            Math.max(
                                1,
                                Number(
                                    response
                                        ?.data
                                        ?.pagination
                                        ?.total_pages
                                ) || 1
                            )
                    });
                } catch (
                    requestError
                ) {
                    setOwners([]);
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
                search,
                ownerType,
                status,
                country
            ]
        );

    useEffect(() => {
        loadOwners();
    }, [loadOwners]);

    const submitFilters =
        event => {
            event.preventDefault();

            setPage(1);

            setSearch(
                searchInput.trim()
            );

            setCountry(
                countryInput.trim()
            );
        };

    const resetFilters = () => {
        setSearchInput("");
        setSearch("");
        setOwnerType("");
        setStatus("");
        setCountryInput("");
        setCountry("");
        setPage(1);
    };

    const filterCount =
        useMemo(
            () =>
                [
                    search,
                    ownerType,
                    status,
                    country
                ].filter(Boolean)
                    .length,
            [
                search,
                ownerType,
                status,
                country
            ]
        );

    const canEditOwner = owner => {
        if (user?.role === "admin") {
            return true;
        }

        return Boolean(
            owner?.is_primary &&
            [
                "owner",
                "representative",
                "manager"
            ].includes(
                owner?.relationship_role
            )
        );
    };

    const canDeleteOwner = owner =>
        canEditOwner(owner);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <Building2 className="h-5 w-5" />
                        </div>

                        <div>
                            <h1 className="text-2xl font-bold text-slate-950">
                                Owners
                            </h1>

                            <p className="mt-1 text-sm text-slate-500">
                                View and manage owner records available to your account.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <IconButton
                        label="Refresh owners"
                        icon={RefreshCw}
                        disabled={loading}
                        onClick={loadOwners}
                    />

                    {user?.role === "admin" && (
                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={RotateCcw}
                            onClick={() => {
                                setSuccess("");
                                setDeletedOwnersOpen(true);
                            }}
                        >
                            Deleted Owners
                        </Button>
                    )}

                    <Button
                        type="button"
                        leftIcon={Plus}
                        onClick={() => {
                            setSuccess("");
                            setCreateOpen(true);
                        }}
                    >
                        Create Owner
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Visible Owners
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-950">
                        {pagination.total_records}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                        Records matching current access and filters.
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Current Page
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-950">
                        {pagination.page}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                        Of {pagination.total_pages} page{pagination.total_pages === 1 ? "" : "s"}.
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Page Records
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-950">
                        {owners.length}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                        Up to {pagination.limit} records per page.
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Active Filters
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-950">
                        {filterCount}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                        Search, type, status and country.
                    </p>
                </div>
            </div>

            <form
                onSubmit={submitFilters}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
                <div className="mb-4 flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-slate-500" />

                    <h2 className="text-sm font-semibold text-slate-900">
                        Search & Filters
                    </h2>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="relative xl:col-span-2">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                        <input
                            value={searchInput}
                            onChange={event =>
                                setSearchInput(
                                    event.target.value
                                )
                            }
                            placeholder="Name, email, phone, registration or tax number"
                            className="
                                h-11 w-full rounded-xl
                                border border-slate-200
                                bg-white pl-10 pr-3
                                text-sm text-slate-800
                                outline-none transition
                                placeholder:text-slate-400
                                focus:border-blue-400
                                focus:ring-2
                                focus:ring-blue-100
                            "
                        />
                    </div>

                    <select
                        value={ownerType}
                        onChange={event => {
                            setOwnerType(
                                event.target.value
                            );
                            setPage(1);
                        }}
                        className="
                            h-11 rounded-xl
                            border border-slate-200
                            bg-white px-3
                            text-sm text-slate-800
                            outline-none transition
                            focus:border-blue-400
                            focus:ring-2
                            focus:ring-blue-100
                        "
                    >
                        {OWNER_TYPES.map(
                            ([value, label]) => (
                                <option
                                    key={value || "all"}
                                    value={value}
                                >
                                    {label}
                                </option>
                            )
                        )}
                    </select>

                    <select
                        value={status}
                        onChange={event => {
                            setStatus(
                                event.target.value
                            );
                            setPage(1);
                        }}
                        className="
                            h-11 rounded-xl
                            border border-slate-200
                            bg-white px-3
                            text-sm text-slate-800
                            outline-none transition
                            focus:border-blue-400
                            focus:ring-2
                            focus:ring-blue-100
                        "
                    >
                        {OWNER_STATUSES.map(
                            ([value, label]) => (
                                <option
                                    key={value || "all"}
                                    value={value}
                                >
                                    {label}
                                </option>
                            )
                        )}
                    </select>

                    <input
                        value={countryInput}
                        onChange={event =>
                            setCountryInput(
                                event.target.value
                            )
                        }
                        placeholder="Country"
                        className="
                            h-11 rounded-xl
                            border border-slate-200
                            bg-white px-3
                            text-sm text-slate-800
                            outline-none transition
                            placeholder:text-slate-400
                            focus:border-blue-400
                            focus:ring-2
                            focus:ring-blue-100
                        "
                    />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={loading}
                        onClick={resetFilters}
                    >
                        Clear
                    </Button>

                    <Button
                        type="submit"
                        leftIcon={Search}
                        loading={loading}
                    >
                        Search
                    </Button>
                </div>
            </form>

            {success && (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700"
                >
                    {success}
                </div>
            )}

            {error && (
                <div
                    role="alert"
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
                >
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-1 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="font-semibold text-slate-950">
                            Owner Directory
                        </h2>

                        <p className="mt-1 text-xs text-slate-500">
                            Only owner records authorized by the backend are displayed.
                        </p>
                    </div>

                    <p className="text-xs font-medium text-slate-500">
                        {pagination.total_records} total
                    </p>
                </div>

                {loading ? (
                    <div className="space-y-3 p-5">
                        {[1, 2, 3, 4, 5].map(item => (
                            <div
                                key={item}
                                className="h-16 animate-pulse rounded-2xl bg-slate-100"
                            />
                        ))}
                    </div>
                ) : owners.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                            <Building2 className="h-5 w-5" />
                        </div>

                        <h3 className="mt-4 text-sm font-semibold text-slate-900">
                            No owners found
                        </h3>

                        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                            Adjust the current search or filters and try again.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="hidden overflow-x-auto lg:block">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Owner
                                        </th>

                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Type
                                        </th>

                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Contact
                                        </th>

                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Location
                                        </th>

                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Status
                                        </th>

                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Access
                                        </th>

                                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {owners.map(owner => (
                                        <tr
                                            key={owner.public_id}
                                            className="transition hover:bg-slate-50/80"
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-sm font-bold text-blue-700">
                                                        {owner.owner_type === "individual" ? (
                                                            <UserRound className="h-4 w-4" />
                                                        ) : (
                                                            getInitials(
                                                                owner.display_name
                                                            )
                                                        )}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-slate-900">
                                                            {owner.display_name}
                                                        </p>

                                                        <p className="mt-1 truncate text-xs text-slate-500">
                                                            {owner.registration_number ||
                                                                owner.tax_identification_number ||
                                                                "No registration identifier"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-4 py-4 text-sm text-slate-700">
                                                {formatLabel(
                                                    owner.owner_type
                                                )}
                                            </td>

                                            <td className="px-4 py-4">
                                                <p className="max-w-[220px] truncate text-sm text-slate-700">
                                                    {owner.email ||
                                                        owner.phone_number ||
                                                        "—"}
                                                </p>

                                                {owner.email &&
                                                    owner.phone_number && (
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {owner.phone_number}
                                                        </p>
                                                    )}
                                            </td>

                                            <td className="px-4 py-4">
                                                <p className="text-sm text-slate-700">
                                                    {[
                                                        owner.city,
                                                        owner.region
                                                    ]
                                                        .filter(Boolean)
                                                        .join(", ") ||
                                                        owner.country ||
                                                        "—"}
                                                </p>

                                                {(owner.city ||
                                                    owner.region) &&
                                                    owner.country && (
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {owner.country}
                                                        </p>
                                                    )}
                                            </td>

                                            <td className="px-4 py-4">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClassName(
                                                        owner.status
                                                    )}`}
                                                >
                                                    {formatLabel(
                                                        owner.status
                                                    )}
                                                </span>
                                            </td>

                                            <td className="px-4 py-4">
                                                {owner.relationship_role ? (
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-medium text-slate-700">
                                                            {formatLabel(
                                                                owner.relationship_role
                                                            )}
                                                        </p>

                                                        <p className="text-xs text-slate-500">
                                                            {owner.is_primary
                                                                ? "Primary representative"
                                                                : "Linked representative"}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">
                                                        Admin access
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <IconButton
                                                        label={`View ${owner.display_name}`}
                                                        icon={Eye}
                                                        onClick={() =>
                                                            setSelectedOwnerPublicId(
                                                                owner.public_id
                                                            )
                                                        }
                                                    />

                                                    {canEditOwner(owner) && (
                                                        <IconButton
                                                            label={`Edit ${owner.display_name}`}
                                                            icon={Pencil}
                                                            onClick={() =>
                                                                setEditOwnerPublicId(
                                                                    owner.public_id
                                                                )
                                                            }
                                                        />
                                                    )}

                                                    {canDeleteOwner(owner) && (
                                                        <button
                                                            type="button"
                                                            aria-label={`Delete ${owner.display_name}`}
                                                            title={`Delete ${owner.display_name}`}
                                                            onClick={() => {
                                                                setSuccess("");
                                                                setDeleteOwner(owner);
                                                            }}
                                                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-200"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="divide-y divide-slate-100 lg:hidden">
                            {owners.map(owner => (
                                <article
                                    key={owner.public_id}
                                    className="space-y-3 p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                                                {owner.owner_type === "individual" ? (
                                                    <UserRound className="h-4 w-4" />
                                                ) : (
                                                    <span className="text-xs font-bold">
                                                        {getInitials(
                                                            owner.display_name
                                                        )}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <h3 className="truncate text-sm font-semibold text-slate-900">
                                                    {owner.display_name}
                                                </h3>

                                                <p className="mt-1 text-xs text-slate-500">
                                                    {formatLabel(
                                                        owner.owner_type
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <span
                                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClassName(
                                                owner.status
                                            )}`}
                                        >
                                            {formatLabel(
                                                owner.status
                                            )}
                                        </span>
                                    </div>

                                    <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                                        <p>
                                            <span className="font-semibold text-slate-700">
                                                Contact:
                                            </span>{" "}
                                            {owner.email ||
                                                owner.phone_number ||
                                                "—"}
                                        </p>

                                        <p>
                                            <span className="font-semibold text-slate-700">
                                                Country:
                                            </span>{" "}
                                            {owner.country ||
                                                "—"}
                                        </p>
                                    </div>

                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSelectedOwnerPublicId(
                                                    owner.public_id
                                                )
                                            }
                                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                        >
                                            <Eye className="h-4 w-4" />
                                            View Detail
                                        </button>

                                        {canEditOwner(owner) && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setEditOwnerPublicId(
                                                        owner.public_id
                                                    )
                                                }
                                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                                            >
                                                <Pencil className="h-4 w-4" />
                                                Edit Owner
                                            </button>
                                        )}

                                        {canDeleteOwner(owner) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSuccess("");
                                                    setDeleteOwner(owner);
                                                }}
                                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Delete Owner
                                            </button>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </>
                )}

                <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                        Page {pagination.page} of {pagination.total_pages}
                    </p>

                    <div className="flex items-center gap-2">
                        <IconButton
                            label="Previous page"
                            icon={ChevronLeft}
                            disabled={
                                loading ||
                                page <= 1
                            }
                            onClick={() =>
                                setPage(
                                    current =>
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
                                page >=
                                    pagination.total_pages
                            }
                            onClick={() =>
                                setPage(
                                    current =>
                                        Math.min(
                                            pagination.total_pages,
                                            current + 1
                                        )
                                )
                            }
                        />
                    </div>
                </div>
            </div>

            {user?.role === "admin" && (
                <DeletedOwnersModal
                    open={deletedOwnersOpen}
                    onClose={() =>
                        setDeletedOwnersOpen(false)
                    }
                    onRestored={async result => {
                        const restoredOwner =
                            result?.owner;

                        setSuccess(
                            `${restoredOwner?.display_name || "Owner"} restored successfully as inactive.`
                        );

                        await loadOwners();
                    }}
                />
            )}

            <OwnerDetailModal
                ownerPublicId={selectedOwnerPublicId}
                onClose={() =>
                    setSelectedOwnerPublicId(null)
                }
            />

            <EditOwnerModal
                ownerPublicId={editOwnerPublicId}
                onClose={() =>
                    setEditOwnerPublicId(null)
                }
                onUpdated={async updatedOwner => {
                    setEditOwnerPublicId(null);

                    setSuccess(
                        `${updatedOwner?.display_name || "Owner"} updated successfully.`
                    );

                    await loadOwners();
                }}
            />

            <DeleteOwnerModal
                owner={deleteOwner}
                onClose={() =>
                    setDeleteOwner(null)
                }
                onDeleted={async result => {
                    const deleted =
                        result?.owner ||
                        deleteOwner;

                    setDeleteOwner(null);

                    setSuccess(
                        `${deleted?.display_name || "Owner"} deleted successfully.`
                    );

                    if (
                        owners.length === 1 &&
                        page > 1
                    ) {
                        setPage(
                            current =>
                                Math.max(
                                    1,
                                    current - 1
                                )
                        );
                        return;
                    }

                    await loadOwners();
                }}
            />

            <CreateOwnerModal
                open={createOpen}
                onClose={() =>
                    setCreateOpen(false)
                }
                onCreated={async result => {
                    const createdOwner =
                        result?.owner ||
                        result;

                    setCreateOpen(false);

                    setSuccess(
                        `${createdOwner?.display_name || "Owner"} created successfully.`
                    );

                    setPage(1);
                    setSearchInput("");
                    setSearch("");
                    setOwnerType("");
                    setStatus("");
                    setCountryInput("");
                    setCountry("");

                    await loadOwners();
                }}
            />
        </div>
    );
}

export default OwnersPage;

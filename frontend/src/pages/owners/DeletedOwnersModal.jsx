import {
    Building2,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    RotateCcw,
    Search,
    UserRound,
    X
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

const OWNER_TYPES = [
    ["", "All owner types"],
    ["individual", "Individual"],
    ["company", "Company"],
    ["government", "Government"],
    ["organization", "Organization"],
    ["partnership", "Partnership"]
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

const formatDateTime = value => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString();
};

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
    "Unable to load deleted owners.";

function DeletedOwnersModal({
    open,
    onClose,
    onRestored
}) {
    const [owners, setOwners] =
        useState([]);

    const [pagination, setPagination] =
        useState(EMPTY_PAGINATION);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");

    const [success, setSuccess] =
        useState("");

    const [searchInput, setSearchInput] =
        useState("");

    const [search, setSearch] =
        useState("");

    const [ownerType, setOwnerType] =
        useState("");

    const [countryInput, setCountryInput] =
        useState("");

    const [country, setCountry] =
        useState("");

    const [page, setPage] =
        useState(1);

    const [restoringId, setRestoringId] =
        useState(null);

    const limit = 20;

    const loadDeletedOwners =
        useCallback(
            async () => {
                if (!open) {
                    return;
                }

                try {
                    setLoading(true);
                    setError("");

                    const params = {
                        page,
                        limit
                    };

                    if (search) {
                        params.search = search;
                    }

                    if (ownerType) {
                        params.owner_type =
                            ownerType;
                    }

                    if (country) {
                        params.country = country;
                    }

                    const response =
                        await apiClient.get(
                            "/owners/deleted",
                            { params }
                        );

                    setOwners(
                        Array.isArray(
                            response?.data?.data
                        )
                            ? response.data.data
                            : []
                    );

                    const nextPagination = {
                        ...EMPTY_PAGINATION,
                        ...(response?.data
                            ?.pagination ||
                            {})
                    };

                    setPagination({
                        ...nextPagination,
                        page:
                            Number(
                                nextPagination.page
                            ) || page,
                        limit:
                            Number(
                                nextPagination.limit
                            ) || limit,
                        total_records:
                            Number(
                                nextPagination
                                    .total_records
                            ) || 0,
                        total_pages:
                            Math.max(
                                1,
                                Number(
                                    nextPagination
                                        .total_pages
                                ) || 1
                            )
                    });
                } catch (requestError) {
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
                open,
                page,
                search,
                ownerType,
                country
            ]
        );

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        loadDeletedOwners();

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !restoringId
            ) {
                onClose();
            }
        };

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    }, [
        open,
        loadDeletedOwners,
        onClose,
        restoringId
    ]);

    useEffect(() => {
        if (open) {
            return;
        }

        setOwners([]);
        setPagination(EMPTY_PAGINATION);
        setError("");
        setSuccess("");
        setSearchInput("");
        setSearch("");
        setOwnerType("");
        setCountryInput("");
        setCountry("");
        setPage(1);
        setRestoringId(null);
    }, [open]);

    const activeFilterCount =
        useMemo(
            () =>
                [
                    search,
                    ownerType,
                    country
                ].filter(Boolean)
                    .length,
            [
                search,
                ownerType,
                country
            ]
        );

    if (!open) {
        return null;
    }

    const submitFilters = event => {
        event.preventDefault();
        setPage(1);
        setSearch(searchInput.trim());
        setCountry(countryInput.trim());
    };

    const clearFilters = () => {
        setSearchInput("");
        setSearch("");
        setOwnerType("");
        setCountryInput("");
        setCountry("");
        setPage(1);
    };

    const restoreOwner = async owner => {
        if (
            !owner?.public_id ||
            restoringId
        ) {
            return;
        }

        const confirmed = window.confirm(
            `Restore ${owner.display_name}? The owner will return with inactive status. Historical revoked owner-user links will remain revoked.`
        );

        if (!confirmed) {
            return;
        }

        try {
            setRestoringId(owner.public_id);
            setError("");
            setSuccess("");

            const response =
                await apiClient.patch(
                    `/owners/${owner.public_id}/restore`
                );

            const result =
                response?.data?.data || {};

            const restoredOwner =
                result?.owner || owner;

            const historicalLinks =
                Number(
                    result
                        ?.historical_revoked_user_links
                ) || 0;

            setSuccess(
                `${restoredOwner.display_name || "Owner"} restored successfully as inactive. ${historicalLinks} historical revoked user link${historicalLinks === 1 ? "" : "s"} remained revoked.`
            );

            if (onRestored) {
                await onRestored(
                    result
                );
            }

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
            } else {
                await loadDeletedOwners();
            }
        } catch (requestError) {
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setRestoringId(null);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-5"
            onMouseDown={event => {
                if (
                    event.target ===
                        event.currentTarget &&
                    !restoringId
                ) {
                    onClose();
                }
            }}
        >
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                            <RotateCcw className="h-5 w-5" />
                        </div>

                        <div>
                            <h2 className="text-lg font-bold text-slate-950">
                                Deleted Owners
                            </h2>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                Administrator-only inventory for soft-deleted owner records. Restore returns an owner as inactive without reopening historical user links.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close deleted owners"
                        icon={X}
                        disabled={Boolean(restoringId)}
                        onClick={onClose}
                    />
                </div>

                <div className="overflow-y-auto p-5 sm:p-6">
                    <form
                        onSubmit={submitFilters}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                    >
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
                                    placeholder="Search deleted owner"
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
                                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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

                            <input
                                value={countryInput}
                                onChange={event =>
                                    setCountryInput(
                                        event.target.value
                                    )
                                }
                                placeholder="Country"
                                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />

                            <div className="flex gap-2">
                                <Button
                                    type="submit"
                                    leftIcon={Search}
                                    loading={loading}
                                >
                                    Search
                                </Button>

                                <IconButton
                                    label="Refresh deleted owners"
                                    icon={RefreshCw}
                                    disabled={loading}
                                    onClick={loadDeletedOwners}
                                />
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-slate-500">
                                {pagination.total_records} deleted owner{pagination.total_records === 1 ? "" : "s"} · {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
                            </p>

                            <Button
                                type="button"
                                variant="secondary"
                                disabled={loading}
                                onClick={clearFilters}
                            >
                                Clear Filters
                            </Button>
                        </div>
                    </form>

                    {success && (
                        <div
                            role="status"
                            className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700"
                        >
                            {success}
                        </div>
                    )}

                    {error && (
                        <div
                            role="alert"
                            className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
                        >
                            {error}
                        </div>
                    )}

                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        {loading ? (
                            <div className="space-y-3 p-5">
                                {[1, 2, 3].map(item => (
                                    <div
                                        key={item}
                                        className="h-20 animate-pulse rounded-2xl bg-slate-100"
                                    />
                                ))}
                            </div>
                        ) : owners.length === 0 ? (
                            <div className="px-6 py-14 text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                                    <Building2 className="h-5 w-5" />
                                </div>

                                <h3 className="mt-4 text-sm font-semibold text-slate-900">
                                    No deleted owners found
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                    Change the current filters or close this inventory.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="hidden overflow-x-auto md:block">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Owner
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Contact
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Deleted
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Revoked Links
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
                                                    className="hover:bg-slate-50/80"
                                                >
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                                                                {owner.owner_type === "individual" ? (
                                                                    <UserRound className="h-4 w-4" />
                                                                ) : (
                                                                    <span className="text-xs font-bold">
                                                                        {getInitials(owner.display_name)}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="min-w-0">
                                                                <p className="max-w-64 truncate text-sm font-semibold text-slate-900">
                                                                    {owner.display_name}
                                                                </p>
                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    {formatLabel(owner.owner_type)} · {owner.country || "—"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-4 text-sm text-slate-600">
                                                        {owner.email || owner.phone_number || "—"}
                                                    </td>

                                                    <td className="px-4 py-4 text-sm text-slate-600">
                                                        {formatDateTime(owner.deleted_at)}
                                                    </td>

                                                    <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                                                        {Number(owner.historical_revoked_user_link_count) || 0}
                                                    </td>

                                                    <td className="px-5 py-4 text-right">
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            leftIcon={RotateCcw}
                                                            loading={restoringId === owner.public_id}
                                                            disabled={Boolean(restoringId)}
                                                            onClick={() => restoreOwner(owner)}
                                                        >
                                                            Restore
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="divide-y divide-slate-100 md:hidden">
                                    {owners.map(owner => (
                                        <article
                                            key={owner.public_id}
                                            className="space-y-3 p-4"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                                                    {owner.owner_type === "individual" ? (
                                                        <UserRound className="h-4 w-4" />
                                                    ) : (
                                                        <span className="text-xs font-bold">
                                                            {getInitials(owner.display_name)}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="min-w-0">
                                                    <h3 className="truncate text-sm font-semibold text-slate-900">
                                                        {owner.display_name}
                                                    </h3>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {formatLabel(owner.owner_type)} · {owner.country || "—"}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">
                                                <p>
                                                    <span className="font-semibold text-slate-700">Deleted:</span>{" "}
                                                    {formatDateTime(owner.deleted_at)}
                                                </p>
                                                <p>
                                                    <span className="font-semibold text-slate-700">Historical revoked links:</span>{" "}
                                                    {Number(owner.historical_revoked_user_link_count) || 0}
                                                </p>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="secondary"
                                                leftIcon={RotateCcw}
                                                loading={restoringId === owner.public_id}
                                                disabled={Boolean(restoringId)}
                                                onClick={() => restoreOwner(owner)}
                                            >
                                                Restore Owner
                                            </Button>
                                        </article>
                                    ))}
                                </div>
                            </>
                        )}

                        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
                            <p className="text-xs text-slate-500">
                                Page {pagination.page} of {pagination.total_pages}
                            </p>

                            <div className="flex gap-2">
                                <IconButton
                                    label="Previous deleted owners page"
                                    icon={ChevronLeft}
                                    disabled={
                                        loading ||
                                        Boolean(restoringId) ||
                                        page <= 1
                                    }
                                    onClick={() =>
                                        setPage(current =>
                                            Math.max(1, current - 1)
                                        )
                                    }
                                />

                                <IconButton
                                    label="Next deleted owners page"
                                    icon={ChevronRight}
                                    disabled={
                                        loading ||
                                        Boolean(restoringId) ||
                                        page >= pagination.total_pages
                                    }
                                    onClick={() =>
                                        setPage(current =>
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
                </div>
            </div>
        </div>
    );
}

export default DeletedOwnersModal;

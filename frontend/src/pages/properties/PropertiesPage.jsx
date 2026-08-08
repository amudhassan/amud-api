import {
    Building2,
    ChevronLeft,
    ChevronRight,
    MapPin,
    RefreshCw,
    Search,
    ShieldCheck,
    Users
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

const STATUS_OPTIONS = [
    { value: "", label: "All statuses" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "maintenance", label: "Maintenance" },
    {
        value: "under_construction",
        label: "Under Construction"
    },
    { value: "sold", label: "Sold" }
];

const USAGE_OPTIONS = [
    { value: "", label: "All usage categories" },
    { value: "residential", label: "Residential" },
    { value: "commercial", label: "Commercial" },
    { value: "mixed", label: "Mixed" },
    { value: "industrial", label: "Industrial" },
    { value: "land", label: "Land" },
    { value: "hospitality", label: "Hospitality" },
    { value: "institutional", label: "Institutional" },
    { value: "agricultural", label: "Agricultural" },
    { value: "other", label: "Other" }
];

const EMPTY_PAGINATION = {
    page: 1,
    limit: 20,
    total_items: 0,
    total_pages: 0,
    has_previous_page: false,
    has_next_page: false
};

const formatLabel = value => {
    if (!value) {
        return "—";
    }

    return String(value)
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );
};

const getLocationText = location => {
    if (!location) {
        return "Location not provided";
    }

    const parts = [
        location.address,
        location.city,
        location.region,
        location.country
    ].filter(Boolean);

    return parts.length > 0
        ? parts.join(", ")
        : "Location not provided";
};

const getErrorMessage = error => {
    const responseData = error?.response?.data;

    if (typeof responseData?.message === "string") {
        return responseData.message;
    }

    if (
        Array.isArray(responseData?.errors) &&
        responseData.errors.length > 0
    ) {
        return responseData.errors
            .map(item => item?.msg || item?.message)
            .filter(Boolean)
            .join(" ");
    }

    return (
        error?.message ||
        "Properties could not be loaded. Please try again."
    );
};

const getStatusClassName = status => {
    switch (status) {
        case "active":
            return "bg-emerald-50 text-emerald-700 ring-emerald-200";
        case "maintenance":
            return "bg-amber-50 text-amber-700 ring-amber-200";
        case "under_construction":
            return "bg-violet-50 text-violet-700 ring-violet-200";
        case "sold":
            return "bg-slate-100 text-slate-600 ring-slate-200";
        case "inactive":
        default:
            return "bg-rose-50 text-rose-700 ring-rose-200";
    }
};

function PropertiesPage() {
    const [properties, setProperties] =
        useState([]);
    const [pagination, setPagination] =
        useState(EMPTY_PAGINATION);

    const [loading, setLoading] =
        useState(true);
    const [error, setError] =
        useState("");

    const [searchInput, setSearchInput] =
        useState("");
    const [search, setSearch] =
        useState("");
    const [operationalStatus, setOperationalStatus] =
        useState("");
    const [usageCategory, setUsageCategory] =
        useState("");
    const [page, setPage] =
        useState(1);

    const loadProperties = useCallback(
        async () => {
            try {
                setLoading(true);
                setError("");

                const params = {
                    page,
                    limit: 20
                };

                if (search.trim()) {
                    params.search = search.trim();
                }

                if (operationalStatus) {
                    params.operational_status =
                        operationalStatus;
                }

                if (usageCategory) {
                    params.usage_category =
                        usageCategory;
                }

                const response =
                    await apiClient.get(
                        "/properties",
                        { params }
                    );

                const payload =
                    response.data || {};

                setProperties(
                    Array.isArray(
                        payload?.data?.properties
                    )
                        ? payload.data.properties
                        : []
                );

                setPagination({
                    ...EMPTY_PAGINATION,
                    ...(payload.pagination || {})
                });
            } catch (requestError) {
                setProperties([]);
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
            operationalStatus,
            page,
            search,
            usageCategory
        ]
    );

    useEffect(() => {
        loadProperties();
    }, [loadProperties]);

    const handleSearchSubmit = event => {
        event.preventDefault();
        setPage(1);
        setSearch(searchInput.trim());
    };

    const handleClearFilters = () => {
        setSearchInput("");
        setSearch("");
        setOperationalStatus("");
        setUsageCategory("");
        setPage(1);
    };

    const showingText = useMemo(() => {
        const total =
            Number(
                pagination.total_items || 0
            );

        if (total === 0) {
            return "0 properties";
        }

        const limit =
            Number(
                pagination.limit || 20
            );
        const currentPage =
            Number(
                pagination.page || 1
            );

        const start =
            (currentPage - 1) *
                limit +
            1;

        const end = Math.min(
            start +
                properties.length -
                1,
            total
        );

        return `${start}-${end} of ${total} properties`;
    }, [pagination, properties.length]);

    return (
        <div className="space-y-6">
            <div
                className="
                    flex flex-col gap-4
                    lg:flex-row
                    lg:items-end
                    lg:justify-between
                "
            >
                <div>
                    <h1
                        className="
                            text-3xl
                            font-bold
                            tracking-tight
                            text-slate-950
                        "
                    >
                        Properties
                    </h1>

                    <p
                        className="
                            mt-2
                            text-base
                            text-slate-500
                        "
                    >
                        View and filter properties
                        available to your account.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={loadProperties}
                    disabled={loading}
                    className="
                        inline-flex
                        items-center
                        justify-center
                        gap-2
                        rounded-xl
                        border
                        border-slate-200
                        bg-white
                        px-4
                        py-2.5
                        text-sm
                        font-semibold
                        text-slate-700
                        shadow-sm
                        transition
                        hover:bg-slate-50
                        disabled:cursor-not-allowed
                        disabled:opacity-60
                    "
                >
                    <RefreshCw
                        className={`h-4 w-4 ${
                            loading
                                ? "animate-spin"
                                : ""
                        }`}
                    />
                    Refresh
                </button>
            </div>

            <div
                className="
                    rounded-2xl
                    border
                    border-slate-200
                    bg-white
                    p-4
                    shadow-sm
                "
            >
                <form
                    onSubmit={handleSearchSubmit}
                    className="
                        grid gap-3
                        xl:grid-cols-[minmax(260px,1fr)_220px_220px_auto]
                    "
                >
                    <div className="relative">
                        <Search
                            className="
                                pointer-events-none
                                absolute
                                left-3
                                top-1/2
                                h-4 w-4
                                -translate-y-1/2
                                text-slate-400
                            "
                        />

                        <input
                            type="search"
                            value={searchInput}
                            onChange={event =>
                                setSearchInput(
                                    event.target
                                        .value
                                )
                            }
                            placeholder="Search name, code, description or location"
                            className="
                                h-11
                                w-full
                                rounded-xl
                                border
                                border-slate-200
                                bg-slate-50
                                pl-10
                                pr-4
                                text-sm
                                text-slate-800
                                outline-none
                                transition
                                placeholder:text-slate-400
                                focus:border-blue-500
                                focus:bg-white
                                focus:ring-4
                                focus:ring-blue-100
                            "
                        />
                    </div>

                    <select
                        value={operationalStatus}
                        onChange={event => {
                            setOperationalStatus(
                                event.target.value
                            );
                            setPage(1);
                        }}
                        className="
                            h-11
                            rounded-xl
                            border
                            border-slate-200
                            bg-slate-50
                            px-3
                            text-sm
                            text-slate-700
                            outline-none
                            transition
                            focus:border-blue-500
                            focus:bg-white
                            focus:ring-4
                            focus:ring-blue-100
                        "
                    >
                        {STATUS_OPTIONS.map(
                            option => (
                                <option
                                    key={
                                        option.value ||
                                        "all-statuses"
                                    }
                                    value={
                                        option.value
                                    }
                                >
                                    {option.label}
                                </option>
                            )
                        )}
                    </select>

                    <select
                        value={usageCategory}
                        onChange={event => {
                            setUsageCategory(
                                event.target.value
                            );
                            setPage(1);
                        }}
                        className="
                            h-11
                            rounded-xl
                            border
                            border-slate-200
                            bg-slate-50
                            px-3
                            text-sm
                            text-slate-700
                            outline-none
                            transition
                            focus:border-blue-500
                            focus:bg-white
                            focus:ring-4
                            focus:ring-blue-100
                        "
                    >
                        {USAGE_OPTIONS.map(
                            option => (
                                <option
                                    key={
                                        option.value ||
                                        "all-usage"
                                    }
                                    value={
                                        option.value
                                    }
                                >
                                    {option.label}
                                </option>
                            )
                        )}
                    </select>

                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="
                                inline-flex
                                h-11
                                flex-1
                                items-center
                                justify-center
                                rounded-xl
                                bg-blue-600
                                px-5
                                text-sm
                                font-semibold
                                text-white
                                transition
                                hover:bg-blue-700
                                focus:outline-none
                                focus:ring-4
                                focus:ring-blue-100
                            "
                        >
                            Search
                        </button>

                        <button
                            type="button"
                            onClick={
                                handleClearFilters
                            }
                            className="
                                inline-flex
                                h-11
                                items-center
                                justify-center
                                rounded-xl
                                border
                                border-slate-200
                                bg-white
                                px-4
                                text-sm
                                font-semibold
                                text-slate-600
                                transition
                                hover:bg-slate-50
                            "
                        >
                            Clear
                        </button>
                    </div>
                </form>
            </div>

            {error && (
                <div
                    className="
                        rounded-2xl
                        border
                        border-rose-200
                        bg-rose-50
                        p-4
                        text-sm
                        text-rose-700
                    "
                >
                    <div
                        className="
                            flex flex-col gap-3
                            sm:flex-row
                            sm:items-center
                            sm:justify-between
                        "
                    >
                        <span>{error}</span>

                        <button
                            type="button"
                            onClick={
                                loadProperties
                            }
                            className="
                                font-semibold
                                underline
                                underline-offset-4
                            "
                        >
                            Try again
                        </button>
                    </div>
                </div>
            )}

            <div
                className="
                    overflow-hidden
                    rounded-2xl
                    border
                    border-slate-200
                    bg-white
                    shadow-sm
                "
            >
                <div
                    className="
                        flex flex-col gap-2
                        border-b
                        border-slate-200
                        px-5
                        py-4
                        sm:flex-row
                        sm:items-center
                        sm:justify-between
                    "
                >
                    <div>
                        <h2
                            className="
                                text-lg
                                font-bold
                                text-slate-900
                            "
                        >
                            Property List
                        </h2>

                        <p
                            className="
                                mt-1
                                text-sm
                                text-slate-500
                            "
                        >
                            {showingText}
                        </p>
                    </div>

                    <div
                        className="
                            inline-flex
                            items-center
                            gap-2
                            text-sm
                            text-slate-500
                        "
                    >
                        <Building2 className="h-4 w-4" />
                        Authorized properties only
                    </div>
                </div>

                {loading ? (
                    <div
                        className="
                            flex
                            min-h-72
                            items-center
                            justify-center
                            p-8
                        "
                    >
                        <div
                            className="
                                flex
                                items-center
                                gap-3
                                text-sm
                                font-medium
                                text-slate-500
                            "
                        >
                            <RefreshCw
                                className="
                                    h-5 w-5
                                    animate-spin
                                "
                            />
                            Loading properties...
                        </div>
                    </div>
                ) : properties.length === 0 ? (
                    <div
                        className="
                            flex
                            min-h-72
                            flex-col
                            items-center
                            justify-center
                            px-6
                            py-10
                            text-center
                        "
                    >
                        <div
                            className="
                                flex
                                h-14 w-14
                                items-center
                                justify-center
                                rounded-2xl
                                bg-slate-100
                                text-slate-500
                            "
                        >
                            <Building2 className="h-7 w-7" />
                        </div>

                        <h3
                            className="
                                mt-4
                                text-base
                                font-bold
                                text-slate-900
                            "
                        >
                            No properties found
                        </h3>

                        <p
                            className="
                                mt-2
                                max-w-md
                                text-sm
                                text-slate-500
                            "
                        >
                            No accessible property
                            matches the current search
                            and filters.
                        </p>
                    </div>
                ) : (
                    <>
                        <div
                            className="
                                hidden
                                overflow-x-auto
                                lg:block
                            "
                        >
                            <table
                                className="
                                    w-full
                                    min-w-[1080px]
                                    border-collapse
                                "
                            >
                                <thead
                                    className="
                                        bg-slate-50
                                        text-left
                                        text-xs
                                        font-semibold
                                        uppercase
                                        tracking-wide
                                        text-slate-500
                                    "
                                >
                                    <tr>
                                        <th className="px-5 py-3">
                                            Property
                                        </th>
                                        <th className="px-5 py-3">
                                            Type / Usage
                                        </th>
                                        <th className="px-5 py-3">
                                            Location
                                        </th>
                                        <th className="px-5 py-3">
                                            Primary Owner
                                        </th>
                                        <th className="px-5 py-3">
                                            Ownership
                                        </th>
                                        <th className="px-5 py-3">
                                            Status
                                        </th>
                                    </tr>
                                </thead>

                                <tbody
                                    className="
                                        divide-y
                                        divide-slate-100
                                    "
                                >
                                    {properties.map(
                                        property => (
                                            <tr
                                                key={
                                                    property.public_id
                                                }
                                                className="
                                                    align-top
                                                    transition
                                                    hover:bg-slate-50/70
                                                "
                                            >
                                                <td className="px-5 py-4">
                                                    <div
                                                        className="
                                                            flex
                                                            items-start
                                                            gap-3
                                                        "
                                                    >
                                                        <div
                                                            className="
                                                                mt-0.5
                                                                flex
                                                                h-10 w-10
                                                                shrink-0
                                                                items-center
                                                                justify-center
                                                                rounded-xl
                                                                bg-blue-50
                                                                text-blue-600
                                                            "
                                                        >
                                                            <Building2 className="h-5 w-5" />
                                                        </div>

                                                        <div>
                                                            <div
                                                                className="
                                                                    font-semibold
                                                                    text-slate-900
                                                                "
                                                            >
                                                                {
                                                                    property.property_name
                                                                }
                                                            </div>

                                                            <div
                                                                className="
                                                                    mt-1
                                                                    text-xs
                                                                    font-medium
                                                                    text-slate-500
                                                                "
                                                            >
                                                                {
                                                                    property.property_code
                                                                }
                                                            </div>

                                                            <div
                                                                className="
                                                                    mt-2
                                                                    text-xs
                                                                    text-slate-500
                                                                "
                                                            >
                                                                {property.is_multi_unit
                                                                    ? "Multi-unit property"
                                                                    : "Single-unit property"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div
                                                        className="
                                                            text-sm
                                                            font-medium
                                                            text-slate-800
                                                        "
                                                    >
                                                        {formatLabel(
                                                            property.property_type
                                                        )}
                                                    </div>

                                                    <div
                                                        className="
                                                            mt-1
                                                            text-xs
                                                            text-slate-500
                                                        "
                                                    >
                                                        {formatLabel(
                                                            property.usage_category
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div
                                                        className="
                                                            flex
                                                            max-w-xs
                                                            items-start
                                                            gap-2
                                                            text-sm
                                                            text-slate-600
                                                        "
                                                    >
                                                        <MapPin
                                                            className="
                                                                mt-0.5
                                                                h-4 w-4
                                                                shrink-0
                                                                text-slate-400
                                                            "
                                                        />
                                                        <span>
                                                            {getLocationText(
                                                                property.location
                                                            )}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4">
                                                    {property.primary_owner ? (
                                                        <div
                                                            className="
                                                                flex
                                                                items-start
                                                                gap-2
                                                            "
                                                        >
                                                            <Users
                                                                className="
                                                                    mt-0.5
                                                                    h-4 w-4
                                                                    shrink-0
                                                                    text-slate-400
                                                                "
                                                            />

                                                            <div>
                                                                <div
                                                                    className="
                                                                        text-sm
                                                                        font-medium
                                                                        text-slate-800
                                                                    "
                                                                >
                                                                    {
                                                                        property
                                                                            .primary_owner
                                                                            .display_name
                                                                    }
                                                                </div>

                                                                <div
                                                                    className="
                                                                        mt-1
                                                                        text-xs
                                                                        text-slate-500
                                                                    "
                                                                >
                                                                    {formatLabel(
                                                                        property
                                                                            .primary_owner
                                                                            .owner_type
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            className="
                                                                text-sm
                                                                text-slate-400
                                                            "
                                                        >
                                                            No primary owner
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div
                                                        className="
                                                            flex
                                                            items-center
                                                            gap-2
                                                        "
                                                    >
                                                        <ShieldCheck
                                                            className="
                                                                h-4 w-4
                                                                text-slate-400
                                                            "
                                                        />

                                                        <span
                                                            className="
                                                                text-sm
                                                                font-semibold
                                                                text-slate-800
                                                            "
                                                        >
                                                            {Number(
                                                                property
                                                                    .ownership_summary
                                                                    ?.total_active_ownership ||
                                                                    0
                                                            ).toFixed(
                                                                2
                                                            )}
                                                            %
                                                        </span>
                                                    </div>

                                                    <div
                                                        className="
                                                            mt-1
                                                            text-xs
                                                            text-slate-500
                                                        "
                                                    >
                                                        {Number(
                                                            property
                                                                .ownership_summary
                                                                ?.active_owner_count ||
                                                                0
                                                        )}{" "}
                                                        active owner(s)
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`
                                                            inline-flex
                                                            rounded-full
                                                            px-2.5
                                                            py-1
                                                            text-xs
                                                            font-semibold
                                                            ring-1
                                                            ring-inset
                                                            ${getStatusClassName(
                                                                property.operational_status
                                                            )}
                                                        `}
                                                    >
                                                        {formatLabel(
                                                            property.operational_status
                                                        )}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div
                            className="
                                divide-y
                                divide-slate-100
                                lg:hidden
                            "
                        >
                            {properties.map(
                                property => (
                                    <article
                                        key={
                                            property.public_id
                                        }
                                        className="p-5"
                                    >
                                        <div
                                            className="
                                                flex
                                                items-start
                                                justify-between
                                                gap-4
                                            "
                                        >
                                            <div
                                                className="
                                                    flex
                                                    min-w-0
                                                    items-start
                                                    gap-3
                                                "
                                            >
                                                <div
                                                    className="
                                                        flex
                                                        h-10 w-10
                                                        shrink-0
                                                        items-center
                                                        justify-center
                                                        rounded-xl
                                                        bg-blue-50
                                                        text-blue-600
                                                    "
                                                >
                                                    <Building2 className="h-5 w-5" />
                                                </div>

                                                <div className="min-w-0">
                                                    <h3
                                                        className="
                                                            truncate
                                                            font-bold
                                                            text-slate-900
                                                        "
                                                    >
                                                        {
                                                            property.property_name
                                                        }
                                                    </h3>

                                                    <p
                                                        className="
                                                            mt-1
                                                            text-xs
                                                            font-medium
                                                            text-slate-500
                                                        "
                                                    >
                                                        {
                                                            property.property_code
                                                        }
                                                    </p>
                                                </div>
                                            </div>

                                            <span
                                                className={`
                                                    shrink-0
                                                    rounded-full
                                                    px-2.5
                                                    py-1
                                                    text-xs
                                                    font-semibold
                                                    ring-1
                                                    ring-inset
                                                    ${getStatusClassName(
                                                        property.operational_status
                                                    )}
                                                `}
                                            >
                                                {formatLabel(
                                                    property.operational_status
                                                )}
                                            </span>
                                        </div>

                                        <div
                                            className="
                                                mt-4
                                                grid gap-3
                                                text-sm
                                                sm:grid-cols-2
                                            "
                                        >
                                            <div>
                                                <div className="text-xs text-slate-400">
                                                    Type / Usage
                                                </div>
                                                <div className="mt-1 font-medium text-slate-700">
                                                    {formatLabel(
                                                        property.property_type
                                                    )}{" "}
                                                    ·{" "}
                                                    {formatLabel(
                                                        property.usage_category
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="text-xs text-slate-400">
                                                    Ownership
                                                </div>
                                                <div className="mt-1 font-medium text-slate-700">
                                                    {Number(
                                                        property
                                                            .ownership_summary
                                                            ?.total_active_ownership ||
                                                            0
                                                    ).toFixed(
                                                        2
                                                    )}
                                                    %
                                                </div>
                                            </div>

                                            <div className="sm:col-span-2">
                                                <div className="text-xs text-slate-400">
                                                    Location
                                                </div>
                                                <div
                                                    className="
                                                        mt-1
                                                        flex
                                                        items-start
                                                        gap-2
                                                        text-slate-700
                                                    "
                                                >
                                                    <MapPin
                                                        className="
                                                            mt-0.5
                                                            h-4 w-4
                                                            shrink-0
                                                            text-slate-400
                                                        "
                                                    />
                                                    {getLocationText(
                                                        property.location
                                                    )}
                                                </div>
                                            </div>

                                            <div className="sm:col-span-2">
                                                <div className="text-xs text-slate-400">
                                                    Primary Owner
                                                </div>
                                                <div className="mt-1 font-medium text-slate-700">
                                                    {property.primary_owner
                                                        ?.display_name ||
                                                        "No primary owner"}
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                )
                            )}
                        </div>

                        <div
                            className="
                                flex
                                flex-col gap-3
                                border-t
                                border-slate-200
                                bg-slate-50/70
                                px-5
                                py-4
                                sm:flex-row
                                sm:items-center
                                sm:justify-between
                            "
                        >
                            <p
                                className="
                                    text-sm
                                    text-slate-500
                                "
                            >
                                Page{" "}
                                {pagination.total_pages >
                                0
                                    ? pagination.page
                                    : 0}{" "}
                                of{" "}
                                {
                                    pagination.total_pages
                                }
                            </p>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={
                                        !pagination.has_previous_page ||
                                        loading
                                    }
                                    onClick={() =>
                                        setPage(
                                            currentPage =>
                                                Math.max(
                                                    1,
                                                    currentPage -
                                                        1
                                                )
                                        )
                                    }
                                    className="
                                        inline-flex
                                        items-center
                                        gap-2
                                        rounded-xl
                                        border
                                        border-slate-200
                                        bg-white
                                        px-4
                                        py-2
                                        text-sm
                                        font-semibold
                                        text-slate-700
                                        transition
                                        hover:bg-slate-50
                                        disabled:cursor-not-allowed
                                        disabled:opacity-40
                                    "
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </button>

                                <button
                                    type="button"
                                    disabled={
                                        !pagination.has_next_page ||
                                        loading
                                    }
                                    onClick={() =>
                                        setPage(
                                            currentPage =>
                                                currentPage +
                                                1
                                        )
                                    }
                                    className="
                                        inline-flex
                                        items-center
                                        gap-2
                                        rounded-xl
                                        border
                                        border-slate-200
                                        bg-white
                                        px-4
                                        py-2
                                        text-sm
                                        font-semibold
                                        text-slate-700
                                        transition
                                        hover:bg-slate-50
                                        disabled:cursor-not-allowed
                                        disabled:opacity-40
                                    "
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default PropertiesPage;
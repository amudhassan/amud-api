import {
    Building2,
    ChevronLeft,
    ChevronRight,
    DoorOpen,
    Gauge,
    Home,
    Plus,
    RefreshCw,
    Search,
    Wrench
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";
import CreateUnitModal from "./CreateUnitModal";
import {
    ActionGroup,
    Button,
    IconButton
} from "../../components/ui/Button";

const UNIT_TYPES = [
    "apartment",
    "house",
    "room",
    "shop",
    "office",
    "warehouse",
    "studio",
    "villa",
    "land_section",
    "commercial_space",
    "other"
];

const UNIT_STATUSES = [
    "inactive",
    "available",
    "reserved",
    "occupied",
    "maintenance"
];

const EMPTY_PAGINATION = {
    current_page: 1,
    per_page: 20,
    total_items: 0,
    total_pages: 0,
    has_previous_page: false,
    has_next_page: false
};

const EMPTY_SUMMARY = {
    total_units: 0,
    inactive_units: 0,
    available_units: 0,
    reserved_units: 0,
    occupied_units: 0,
    maintenance_units: 0
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
        inactive:
            "bg-slate-100 text-slate-700 ring-slate-200",
        available:
            "bg-emerald-50 text-emerald-700 ring-emerald-200",
        reserved:
            "bg-amber-50 text-amber-700 ring-amber-200",
        occupied:
            "bg-blue-50 text-blue-700 ring-blue-200",
        maintenance:
            "bg-rose-50 text-rose-700 ring-rose-200"
    };

    return (
        styles[status] ||
        "bg-slate-100 text-slate-700 ring-slate-200"
    );
};

function UnitsPage() {
    const [properties, setProperties] =
        useState([]);
    const [
        propertiesLoading,
        setPropertiesLoading
    ] = useState(true);
    const [
        propertiesError,
        setPropertiesError
    ] = useState("");

    const [
        selectedPropertyId,
        setSelectedPropertyId
    ] = useState("");

    const [units, setUnits] =
        useState([]);
    const [summary, setSummary] =
        useState(EMPTY_SUMMARY);
    const [pagination, setPagination] =
        useState(EMPTY_PAGINATION);
    const [loading, setLoading] =
        useState(false);
    const [error, setError] =
        useState("");
    const [
        createOpen,
        setCreateOpen
    ] = useState(false);
    const [
        createSuccess,
        setCreateSuccess
    ] = useState("");

    const [page, setPage] =
        useState(1);
    const [searchInput, setSearchInput] =
        useState("");
    const [search, setSearch] =
        useState("");
    const [unitType, setUnitType] =
        useState("");
    const [
        operationalStatus,
        setOperationalStatus
    ] = useState("");

    const selectedProperty =
        useMemo(
            () =>
                properties.find(
                    property =>
                        property.public_id ===
                        selectedPropertyId
                ) || null,
            [
                properties,
                selectedPropertyId
            ]
        );

    const loadProperties =
        useCallback(
            async () => {
                try {
                    setPropertiesLoading(true);
                    setPropertiesError("");

                    const response =
                        await apiClient.get(
                            "/properties",
                            {
                                params: {
                                    page: 1,
                                    limit: 100
                                }
                            }
                        );

                    const rows =
                        Array.isArray(
                            response?.data?.data
                                ?.properties
                        )
                            ? response.data.data
                                  .properties
                            : [];

                    setProperties(rows);

                    setSelectedPropertyId(
                        current => {
                            if (
                                current &&
                                rows.some(
                                    property =>
                                        property
                                            .public_id ===
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
                    setProperties([]);
                    setSelectedPropertyId("");
                    setPropertiesError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setPropertiesLoading(false);
                }
            },
            []
        );

    const loadUnits =
        useCallback(
            async () => {
                if (!selectedPropertyId) {
                    setUnits([]);
                    setSummary(
                        EMPTY_SUMMARY
                    );
                    setPagination(
                        EMPTY_PAGINATION
                    );
                    return;
                }

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

                    if (unitType) {
                        params.unit_type =
                            unitType;
                    }

                    if (
                        operationalStatus
                    ) {
                        params.operational_status =
                            operationalStatus;
                    }

                    const response =
                        await apiClient.get(
                            `/properties/${selectedPropertyId}/units`,
                            {
                                params
                            }
                        );

                    /*
                     * Supports the established API result shape
                     * whether the controller exposes result directly
                     * under data or as the response data object.
                     */
                    const payload =
                        response?.data?.data &&
                        (
                            response.data.data
                                .units ||
                            response.data.data
                                .property
                        )
                            ? response.data.data
                            : response?.data || {};

                    const rows =
                        Array.isArray(
                            payload.units
                        )
                            ? payload.units
                            : [];

                    setUnits(rows);

                    const sourceSummary =
                        payload.summary || {};

                    setSummary({
                        total_units:
                            Number(
                                sourceSummary
                                    .total_units ||
                                    0
                            ),
                        inactive_units:
                            Number(
                                sourceSummary
                                    .inactive_units ||
                                    0
                            ),
                        available_units:
                            Number(
                                sourceSummary
                                    .available_units ||
                                    0
                            ),
                        reserved_units:
                            Number(
                                sourceSummary
                                    .reserved_units ||
                                    0
                            ),
                        occupied_units:
                            Number(
                                sourceSummary
                                    .occupied_units ||
                                    0
                            ),
                        maintenance_units:
                            Number(
                                sourceSummary
                                    .maintenance_units ||
                                    0
                            )
                    });

                    setPagination({
                        ...EMPTY_PAGINATION,
                        ...(payload.pagination ||
                            {})
                    });
                } catch (requestError) {
                    setUnits([]);
                    setSummary(
                        EMPTY_SUMMARY
                    );
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
                selectedPropertyId,
                unitType
            ]
        );

    useEffect(() => {
        loadProperties();
    }, [loadProperties]);

    useEffect(() => {
        loadUnits();
    }, [loadUnits]);

    const handlePropertyChange =
        event => {
            setSelectedPropertyId(
                event.target.value
            );
            setPage(1);
            setSearchInput("");
            setSearch("");
            setUnitType("");
            setOperationalStatus("");
        };

    const handleSearchSubmit =
        event => {
            event.preventDefault();
            setPage(1);
            setSearch(
                searchInput.trim()
            );
        };

    const clearFilters = () => {
        setSearchInput("");
        setSearch("");
        setUnitType("");
        setOperationalStatus("");
        setPage(1);
    };

    const handleUnitCreated = async () => {
        setCreateOpen(false);
        setCreateSuccess(
            "Unit created successfully. It starts in Inactive status."
        );
        setPage(1);
        await loadUnits();
    };

    const stats = [
        {
            label: "Total Units",
            value: summary.total_units,
            icon: DoorOpen
        },
        {
            label: "Available",
            value:
                summary.available_units,
            icon: Gauge
        },
        {
            label: "Occupied",
            value:
                summary.occupied_units,
            icon: Home
        },
        {
            label: "Maintenance",
            value:
                summary.maintenance_units,
            icon: Wrench
        }
    ];

    return (
        <div className="space-y-6">
            <div
                className="
                    flex
                    flex-col
                    gap-4
                    xl:flex-row
                    xl:items-end
                    xl:justify-between
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
                        Units
                    </h1>

                    <p
                        className="
                            mt-2
                            text-sm
                            text-slate-500
                        "
                    >
                        View and manage rental
                        spaces by property.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <ActionGroup>
                        <IconButton
                            label="Refresh units"
                            icon={RefreshCw}
                            onClick={loadUnits}
                            loading={loading}
                            disabled={
                                !selectedPropertyId
                            }
                        />
                    </ActionGroup>

                    <Button
                        onClick={() => {
                            setCreateSuccess("");
                            setCreateOpen(true);
                        }}
                        leftIcon={Plus}
                        disabled={
                            !selectedPropertyId
                        }
                    >
                        Add Unit
                    </Button>
                </div>
            </div>

            {createSuccess && (
                <div
                    role="status"
                    className="
                        rounded-2xl
                        border border-emerald-200
                        bg-emerald-50
                        px-4 py-3
                        text-sm font-medium
                        text-emerald-700
                    "
                >
                    {createSuccess}
                </div>
            )}

            {propertiesError && (
                <div
                    className="
                        rounded-2xl
                        border
                        border-rose-200
                        bg-rose-50
                        px-4 py-3
                        text-sm
                        text-rose-700
                    "
                >
                    {propertiesError}
                </div>
            )}

            <div
                className="
                    rounded-2xl
                    border
                    border-slate-200
                    bg-white
                    p-5
                    shadow-sm
                "
            >
                <div
                    className="
                        flex
                        flex-col
                        gap-4
                        lg:flex-row
                        lg:items-center
                        lg:justify-between
                    "
                >
                    <div
                        className="
                            flex
                            items-center
                            gap-3
                        "
                    >
                        <div
                            className="
                                flex h-10 w-10
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
                            <p
                                className="
                                    text-sm
                                    font-semibold
                                    text-slate-900
                                "
                            >
                                Property
                            </p>

                            <p
                                className="
                                    text-xs
                                    text-slate-500
                                "
                            >
                                Select the property
                                whose units you want
                                to view.
                            </p>
                        </div>
                    </div>

                    <select
                        value={
                            selectedPropertyId
                        }
                        onChange={
                            handlePropertyChange
                        }
                        disabled={
                            propertiesLoading ||
                            properties.length ===
                                0
                        }
                        className="
                            h-11
                            min-w-[280px]
                            rounded-xl
                            border
                            border-slate-200
                            bg-slate-50
                            px-3
                            text-sm
                            font-medium
                            text-slate-800
                            outline-none
                            transition
                            focus:border-blue-500
                            focus:bg-white
                            focus:ring-4
                            focus:ring-blue-100
                            disabled:cursor-not-allowed
                            disabled:opacity-60
                        "
                    >
                        {propertiesLoading ? (
                            <option value="">
                                Loading properties...
                            </option>
                        ) : properties.length ===
                          0 ? (
                            <option value="">
                                No properties available
                            </option>
                        ) : (
                            properties.map(
                                property => (
                                    <option
                                        key={
                                            property.public_id
                                        }
                                        value={
                                            property.public_id
                                        }
                                    >
                                        {
                                            property.property_name
                                        }{" "}
                                        —{" "}
                                        {
                                            property.property_code
                                        }
                                    </option>
                                )
                            )
                        )}
                    </select>
                </div>
            </div>

            {selectedProperty && (
                <div
                    className="
                        rounded-2xl
                        border
                        border-blue-100
                        bg-blue-50/60
                        px-5 py-4
                    "
                >
                    <div
                        className="
                            flex
                            flex-wrap
                            items-center
                            gap-x-5
                            gap-y-2
                        "
                    >
                        <span
                            className="
                                font-semibold
                                text-slate-900
                            "
                        >
                            {
                                selectedProperty
                                    .property_name
                            }
                        </span>

                        <span
                            className="
                                text-sm
                                text-slate-500
                            "
                        >
                            {
                                selectedProperty
                                    .property_code
                            }
                        </span>

                        <span
                            className="
                                rounded-full
                                bg-white
                                px-2.5 py-1
                                text-xs
                                font-semibold
                                text-slate-700
                                ring-1
                                ring-slate-200
                            "
                        >
                            {formatLabel(
                                selectedProperty
                                    .operational_status
                            )}
                        </span>
                    </div>
                </div>
            )}

            <div
                className="
                    grid
                    gap-4
                    sm:grid-cols-2
                    xl:grid-cols-4
                "
            >
                {stats.map(stat => {
                    const Icon =
                        stat.icon;

                    return (
                        <div
                            key={
                                stat.label
                            }
                            className="
                                rounded-2xl
                                border
                                border-slate-200
                                bg-white
                                p-5
                                shadow-sm
                            "
                        >
                            <div
                                className="
                                    flex
                                    items-center
                                    justify-between
                                "
                            >
                                <p
                                    className="
                                        text-sm
                                        font-medium
                                        text-slate-500
                                    "
                                >
                                    {
                                        stat.label
                                    }
                                </p>

                                <Icon
                                    className="
                                        h-5 w-5
                                        text-blue-600
                                    "
                                />
                            </div>

                            <p
                                className="
                                    mt-3
                                    text-2xl
                                    font-bold
                                    text-slate-950
                                "
                            >
                                {stat.value}
                            </p>
                        </div>
                    );
                })}
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
                    onSubmit={
                        handleSearchSubmit
                    }
                    className="
                        grid
                        gap-3
                        xl:grid-cols-[minmax(260px,1fr)_220px_220px_auto]
                    "
                >
                    <div className="relative">
                        <Search
                            className="
                                pointer-events-none
                                absolute
                                left-3.5
                                top-1/2
                                h-4 w-4
                                -translate-y-1/2
                                text-slate-400
                            "
                        />

                        <input
                            type="search"
                            value={
                                searchInput
                            }
                            onChange={event =>
                                setSearchInput(
                                    event.target
                                        .value
                                )
                            }
                            placeholder="Search unit code, name or description"
                            className="
                                h-11
                                w-full
                                rounded-xl
                                border
                                border-slate-200
                                bg-slate-50
                                pl-10 pr-4
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
                        value={unitType}
                        onChange={event => {
                            setUnitType(
                                event.target
                                    .value
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
                            text-slate-800
                            outline-none
                            transition
                            focus:border-blue-500
                            focus:bg-white
                            focus:ring-4
                            focus:ring-blue-100
                        "
                    >
                        <option value="">
                            All unit types
                        </option>

                        {UNIT_TYPES.map(
                            type => (
                                <option
                                    key={type}
                                    value={type}
                                >
                                    {formatLabel(
                                        type
                                    )}
                                </option>
                            )
                        )}
                    </select>

                    <select
                        value={
                            operationalStatus
                        }
                        onChange={event => {
                            setOperationalStatus(
                                event.target
                                    .value
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
                            text-slate-800
                            outline-none
                            transition
                            focus:border-blue-500
                            focus:bg-white
                            focus:ring-4
                            focus:ring-blue-100
                        "
                    >
                        <option value="">
                            All statuses
                        </option>

                        {UNIT_STATUSES.map(
                            status => (
                                <option
                                    key={status}
                                    value={
                                        status
                                    }
                                >
                                    {formatLabel(
                                        status
                                    )}
                                </option>
                            )
                        )}
                    </select>

                    <div className="flex gap-2">
                        <Button
                            type="submit"
                            size="lg"
                            leftIcon={Search}
                            className="flex-1"
                            disabled={
                                !selectedPropertyId
                            }
                        >
                            Search
                        </Button>

                        <Button
                            variant="secondary"
                            size="lg"
                            onClick={
                                clearFilters
                            }
                        >
                            Clear
                        </Button>
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
                        px-4 py-3
                        text-sm
                        text-rose-700
                    "
                >
                    {error}
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
                        flex
                        flex-col
                        gap-2
                        border-b
                        border-slate-200
                        px-5 py-4
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
                                text-slate-950
                            "
                        >
                            Unit List
                        </h2>

                        <p
                            className="
                                mt-1
                                text-sm
                                text-slate-500
                            "
                        >
                            {pagination.total_items}
                            {" "}
                            unit
                            {pagination.total_items ===
                            1
                                ? ""
                                : "s"}
                        </p>
                    </div>

                    {selectedProperty && (
                        <span
                            className="
                                text-sm
                                text-slate-500
                            "
                        >
                            {
                                selectedProperty
                                    .property_name
                            }
                        </span>
                    )}
                </div>

                {loading ? (
                    <div
                        className="
                            flex
                            min-h-[280px]
                            items-center
                            justify-center
                            gap-2
                            text-sm
                            text-slate-500
                        "
                    >
                        <RefreshCw
                            className="
                                h-4 w-4
                                animate-spin
                            "
                        />
                        Loading units...
                    </div>
                ) : !selectedPropertyId ? (
                    <div
                        className="
                            min-h-[280px]
                            px-6 py-16
                            text-center
                        "
                    >
                        <Building2
                            className="
                                mx-auto
                                h-9 w-9
                                text-slate-300
                            "
                        />

                        <p
                            className="
                                mt-4
                                font-semibold
                                text-slate-700
                            "
                        >
                            Select a property
                        </p>

                        <p
                            className="
                                mt-1
                                text-sm
                                text-slate-500
                            "
                        >
                            Units are organized
                            under their parent
                            property.
                        </p>
                    </div>
                ) : units.length === 0 ? (
                    <div
                        className="
                            min-h-[280px]
                            px-6 py-16
                            text-center
                        "
                    >
                        <DoorOpen
                            className="
                                mx-auto
                                h-9 w-9
                                text-slate-300
                            "
                        />

                        <p
                            className="
                                mt-4
                                font-semibold
                                text-slate-700
                            "
                        >
                            No units found
                        </p>

                        <p
                            className="
                                mt-1
                                text-sm
                                text-slate-500
                            "
                        >
                            Try another filter or
                            property.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table
                            className="
                                min-w-full
                                divide-y
                                divide-slate-200
                            "
                        >
                            <thead className="bg-slate-50">
                                <tr
                                    className="
                                        text-left
                                        text-xs
                                        font-semibold
                                        uppercase
                                        tracking-wide
                                        text-slate-500
                                    "
                                >
                                    <th className="px-5 py-3.5">
                                        Unit
                                    </th>
                                    <th className="px-5 py-3.5">
                                        Type
                                    </th>
                                    <th className="px-5 py-3.5">
                                        Layout
                                    </th>
                                    <th className="px-5 py-3.5">
                                        Area
                                    </th>
                                    <th className="px-5 py-3.5">
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
                                {units.map(
                                    unit => (
                                        <tr
                                            key={
                                                unit.public_id
                                            }
                                            className="
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
                                                            h-9 w-9
                                                            items-center
                                                            justify-center
                                                            rounded-xl
                                                            bg-blue-50
                                                            text-blue-600
                                                        "
                                                    >
                                                        <DoorOpen className="h-4 w-4" />
                                                    </div>

                                                    <div>
                                                        <p
                                                            className="
                                                                font-semibold
                                                                text-slate-900
                                                            "
                                                        >
                                                            {unit.unit_name ||
                                                                unit.unit_code}
                                                        </p>

                                                        <p
                                                            className="
                                                                mt-1
                                                                text-xs
                                                                text-slate-500
                                                            "
                                                        >
                                                            {
                                                                unit.unit_code
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td
                                                className="
                                                    px-5 py-4
                                                    text-sm
                                                    text-slate-700
                                                "
                                            >
                                                {formatLabel(
                                                    unit.unit_type
                                                )}
                                            </td>

                                            <td
                                                className="
                                                    px-5 py-4
                                                    text-sm
                                                    text-slate-700
                                                "
                                            >
                                                <div>
                                                    Floor:{" "}
                                                    <span className="font-medium">
                                                        {unit.floor_number ??
                                                            "—"}
                                                    </span>
                                                </div>

                                                <div
                                                    className="
                                                        mt-1
                                                        text-xs
                                                        text-slate-500
                                                    "
                                                >
                                                    {unit.bedrooms ??
                                                        0}
                                                    {" "}
                                                    bed ·{" "}
                                                    {unit.bathrooms ??
                                                        0}
                                                    {" "}
                                                    bath
                                                </div>
                                            </td>

                                            <td
                                                className="
                                                    px-5 py-4
                                                    text-sm
                                                    text-slate-700
                                                "
                                            >
                                                {unit.area_size !==
                                                null &&
                                                unit.area_size !==
                                                    undefined
                                                    ? `${unit.area_size} ${unit.area_unit || ""}`.trim()
                                                    : "—"}
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
                                                        ${statusClassName(
                                                            unit.operational_status
                                                        )}
                                                    `}
                                                >
                                                    {formatLabel(
                                                        unit.operational_status
                                                    )}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                <div
                    className="
                        flex
                        flex-col
                        gap-3
                        border-t
                        border-slate-200
                        bg-slate-50/70
                        px-5 py-4
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
                        {pagination.current_page ||
                            1}{" "}
                        of{" "}
                        {pagination.total_pages ||
                            0}
                    </p>

                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={
                                ChevronLeft
                            }
                            disabled={
                                loading ||
                                !pagination
                                    .has_previous_page
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
                        >
                            Previous
                        </Button>

                        <Button
                            variant="secondary"
                            size="sm"
                            rightIcon={
                                ChevronRight
                            }
                            disabled={
                                loading ||
                                !pagination
                                    .has_next_page
                            }
                            onClick={() =>
                                setPage(
                                    current =>
                                        current +
                                        1
                                )
                            }
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>
            <CreateUnitModal
                open={createOpen}
                property={selectedProperty}
                onClose={() =>
                    setCreateOpen(false)
                }
                onCreated={
                    handleUnitCreated
                }
            />
        </div>
    );
}

export default UnitsPage;

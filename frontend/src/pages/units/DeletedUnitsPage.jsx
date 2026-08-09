import {
    ArchiveRestore,
    ArrowLeft,
    Building2,
    ChevronLeft,
    ChevronRight,
    DoorOpen,
    RefreshCw,
    Search
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useState
} from "react";
import {
    useNavigate
} from "react-router-dom";

import apiClient from "../../api/apiClient";
import RestoreUnitModal from "./RestoreUnitModal";
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

const EMPTY_PAGINATION = {
    current_page: 1,
    per_page: 20,
    total_items: 0,
    total_pages: 0,
    has_previous_page: false,
    has_next_page: false
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to retrieve deleted units.";

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
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

function DeletedUnitsPage() {
    const navigate = useNavigate();

    const [units, setUnits] =
        useState([]);
    const [pagination, setPagination] =
        useState(EMPTY_PAGINATION);
    const [loading, setLoading] =
        useState(true);
    const [error, setError] =
        useState("");
    const [success, setSuccess] =
        useState("");

    const [page, setPage] =
        useState(1);
    const [searchInput, setSearchInput] =
        useState("");
    const [search, setSearch] =
        useState("");
    const [unitType, setUnitType] =
        useState("");

    const [restoreOpen, setRestoreOpen] =
        useState(false);
    const [selectedUnit, setSelectedUnit] =
        useState(null);

    const loadDeletedUnits =
        useCallback(
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

                    if (unitType) {
                        params.unit_type =
                            unitType;
                    }

                    const response =
                        await apiClient.get(
                            "/units/deleted",
                            { params }
                        );

                    const payload =
                        response?.data?.data || {};

                    setUnits(
                        Array.isArray(
                            payload.units
                        )
                            ? payload.units
                            : []
                    );

                    setPagination({
                        ...EMPTY_PAGINATION,
                        ...(payload.pagination || {})
                    });
                } catch (requestError) {
                    setUnits([]);
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
            [page, search, unitType]
        );

    useEffect(() => {
        loadDeletedUnits();
    }, [loadDeletedUnits]);

    const handleSearchSubmit = event => {
        event.preventDefault();
        setPage(1);
        setSearch(searchInput.trim());
    };

    const clearFilters = () => {
        setSearchInput("");
        setSearch("");
        setUnitType("");
        setPage(1);
    };

    const openRestore = unit => {
        setSuccess("");
        setSelectedUnit(unit);
        setRestoreOpen(true);
    };

    const handleRestored = async unit => {
        setRestoreOpen(false);
        setSelectedUnit(null);
        setSuccess(
            `${unit.unit_name || unit.unit_code} restored successfully. Status is now Inactive.`
        );

        await loadDeletedUnits();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                        Deleted Units
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Review and restore soft-deleted rental units.
                    </p>
                </div>

                <ActionGroup>
                    <IconButton
                        label="Back to units"
                        icon={ArrowLeft}
                        onClick={() =>
                            navigate("/units")
                        }
                    />

                    <IconButton
                        label="Refresh deleted units"
                        icon={RefreshCw}
                        onClick={loadDeletedUnits}
                        loading={loading}
                    />
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

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <form
                    onSubmit={handleSearchSubmit}
                    className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_auto]"
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
                            placeholder="Search unit or property"
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        />
                    </div>

                    <select
                        value={unitType}
                        onChange={event => {
                            setUnitType(
                                event.target.value
                            );
                            setPage(1);
                        }}
                        className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    >
                        <option value="">
                            All unit types
                        </option>
                        {UNIT_TYPES.map(type => (
                            <option
                                key={type}
                                value={type}
                            >
                                {formatLabel(type)}
                            </option>
                        ))}
                    </select>

                    <div className="flex gap-2">
                        <Button
                            type="submit"
                            size="lg"
                            leftIcon={Search}
                        >
                            Search
                        </Button>

                        <Button
                            variant="secondary"
                            size="lg"
                            onClick={clearFilters}
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
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-950">
                            Deleted Unit List
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {pagination.total_items} deleted unit{pagination.total_items === 1 ? "" : "s"}
                        </p>
                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                        <ArchiveRestore className="h-5 w-5" />
                    </div>
                </div>

                {loading ? (
                    <div className="flex min-h-[260px] items-center justify-center gap-2 text-sm text-slate-500">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading deleted units...
                    </div>
                ) : units.length === 0 ? (
                    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
                        <DoorOpen className="h-9 w-9 text-slate-300" />
                        <p className="mt-3 font-semibold text-slate-800">
                            No deleted units found
                        </p>
                        <p className="mt-1 max-w-md text-sm text-slate-500">
                            Deleted units will appear here until they are restored.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <th className="px-5 py-3">Unit</th>
                                    <th className="px-5 py-3">Property</th>
                                    <th className="px-5 py-3">Type</th>
                                    <th className="px-5 py-3">Deleted</th>
                                    <th className="px-5 py-3 text-right">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100 bg-white">
                                {units.map(unit => {
                                    const property =
                                        unit.property || {};
                                    const blocked =
                                        Boolean(property.deleted_at) ||
                                        property.operational_status === "sold";

                                    return (
                                        <tr
                                            key={unit.public_id}
                                            className="align-middle"
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                                        <DoorOpen className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-900">
                                                            {unit.unit_name || unit.unit_code}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-slate-500">
                                                            {unit.unit_code}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex items-start gap-2">
                                                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-800">
                                                            {property.property_name || "—"}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-slate-500">
                                                            {property.property_code || "—"} · {formatLabel(property.operational_status)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                {formatLabel(unit.unit_type)}
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                {formatDateTime(unit.deleted_at)}
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex justify-end">
                                                    <ActionGroup>
                                                        <IconButton
                                                            label={
                                                                blocked
                                                                    ? "Restore unavailable for this parent property"
                                                                    : "Restore unit"
                                                            }
                                                            icon={ArchiveRestore}
                                                            variant="success"
                                                            disabled={blocked}
                                                            onClick={() =>
                                                                openRestore(unit)
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
                                    Math.max(1, current - 1)
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

            <RestoreUnitModal
                open={restoreOpen}
                unit={selectedUnit}
                onClose={() => {
                    if (!loading) {
                        setRestoreOpen(false);
                        setSelectedUnit(null);
                    }
                }}
                onRestored={handleRestored}
            />
        </div>
    );
}

export default DeletedUnitsPage;

import {
    Building2,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    ShieldCheck,
    Trash2,
    Users,
    X
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import { useNavigate } from "react-router-dom";

import apiClient from "../../api/apiClient";
import {
    ActionGroup,
    Button,
    IconButton
} from "../../components/ui/Button";

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


const OWNERSHIP_TYPE_OPTIONS = [
    { value: "legal", label: "Legal" },
    { value: "beneficial", label: "Beneficial" },
    { value: "trustee", label: "Trustee" },
    { value: "nominee", label: "Nominee" },
    { value: "customary", label: "Customary" },
    { value: "government", label: "Government" },
    { value: "other", label: "Other" }
];

const makeOwnership = () => ({
    owner_public_id: "",
    ownership_percentage: "100",
    ownership_type: "legal",
    is_primary_contact: true,
    effective_from: ""
});

const makePropertyForm = () => ({
    property_name: "",
    property_type: "",
    usage_category: "residential",
    description: "",
    address: "",
    city: "",
    region: "",
    country: "",
    latitude: "",
    longitude: "",
    year_built: "",
    is_multi_unit: true,
    ownerships: [makeOwnership()]
});

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

const getCurrentUser = () => {
    try {
        return JSON.parse(
            localStorage.getItem("auth_user") ||
            "null"
        );
    } catch {
        return null;
    }
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


const nullableString = value => {
    const trimmed = String(value ?? "").trim();
    return trimmed === "" ? null : trimmed;
};

const validateCreateProperty = form => {
    const name = form.property_name.trim();
    const type = form.property_type.trim();
    const country = form.country.trim();

    if (name.length < 2 || name.length > 150) {
        return "Property name must contain between 2 and 150 characters.";
    }

    if (
        type.length < 2 ||
        type.length > 60 ||
        !/^[A-Za-z0-9_-]+$/.test(type)
    ) {
        return "Property type must be 2-60 characters using letters, numbers, underscores or hyphens only.";
    }

    if (country.length < 2 || country.length > 100) {
        return "Country must contain between 2 and 100 characters.";
    }

    if (form.description.length > 2000) {
        return "Description cannot exceed 2000 characters.";
    }

    if (form.address.length > 255) {
        return "Address cannot exceed 255 characters.";
    }

    if (form.city.length > 100 || form.region.length > 100) {
        return "City and region cannot exceed 100 characters.";
    }

    if (form.latitude !== "") {
        const value = Number(form.latitude);

        if (!Number.isFinite(value) || value < -90 || value > 90) {
            return "Latitude must be between -90 and 90.";
        }
    }

    if (form.longitude !== "") {
        const value = Number(form.longitude);

        if (!Number.isFinite(value) || value < -180 || value > 180) {
            return "Longitude must be between -180 and 180.";
        }
    }

    if (form.year_built !== "") {
        const value = Number(form.year_built);

        if (
            !Number.isInteger(value) ||
            value < 1000 ||
            value > 2100
        ) {
            return "Year built must be between 1000 and 2100.";
        }
    }

    if (!form.ownerships.length) {
        return "At least one property owner is required.";
    }

    const ownerIds = form.ownerships.map(
        ownership => ownership.owner_public_id.trim()
    );

    if (ownerIds.some(ownerId => !ownerId)) {
        return "Select an owner for every ownership record.";
    }

    if (new Set(ownerIds).size !== ownerIds.length) {
        return "The same owner cannot appear more than once.";
    }

    let total = 0;

    for (const ownership of form.ownerships) {
        const raw = String(
            ownership.ownership_percentage
        ).trim();

        if (!/^\d+(\.\d{1,4})?$/.test(raw)) {
            return "Ownership percentage may contain at most four decimal places.";
        }

        const value = Number(raw);

        if (!Number.isFinite(value) || value <= 0 || value > 100) {
            return "Ownership percentage must be greater than 0 and cannot exceed 100.";
        }

        total += value;
    }

    if (Number(total.toFixed(4)) > 100) {
        return "Total property ownership cannot exceed 100%.";
    }

    if (
        form.ownerships.filter(
            ownership =>
                ownership.is_primary_contact === true
        ).length > 1
    ) {
        return "Only one property owner can be the primary contact.";
    }

    return "";
};

function PropertiesPage() {
    const navigate = useNavigate();
    const [properties, setProperties] =
        useState([]);
    const [pagination, setPagination] =
        useState(EMPTY_PAGINATION);

    const currentUser = useMemo(
        () => getCurrentUser(),
        []
    );

    const isAdmin =
        currentUser?.role === "admin";

    const [deletedOpen, setDeletedOpen] =
        useState(false);
    const [deletedProperties, setDeletedProperties] =
        useState([]);
    const [deletedPagination, setDeletedPagination] =
        useState(EMPTY_PAGINATION);
    const [deletedPage, setDeletedPage] =
        useState(1);
    const [deletedLoading, setDeletedLoading] =
        useState(false);
    const [deletedError, setDeletedError] =
        useState("");
    const [restoreSuccess, setRestoreSuccess] =
        useState("");
    const [restoringPropertyId, setRestoringPropertyId] =
        useState("");

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

    const [createOpen, setCreateOpen] =
        useState(false);
    const [createSubmitting, setCreateSubmitting] =
        useState(false);
    const [createError, setCreateError] =
        useState("");
    const [createSuccess, setCreateSuccess] =
        useState("");

    const [owners, setOwners] =
        useState([]);
    const [ownersLoading, setOwnersLoading] =
        useState(false);
    const [ownersError, setOwnersError] =
        useState("");

    const [propertyForm, setPropertyForm] =
        useState(makePropertyForm());

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

    const loadDeletedProperties =
        useCallback(
            async requestedPage => {
                if (!isAdmin) {
                    return;
                }

                const targetPage =
                    requestedPage ||
                    deletedPage;

                try {
                    setDeletedLoading(true);
                    setDeletedError("");

                    const response =
                        await apiClient.get(
                            "/properties/deleted",
                            {
                                params: {
                                    page: targetPage,
                                    limit: 20
                                }
                            }
                        );

                    const payload =
                        response.data || {};

                    setDeletedProperties(
                        Array.isArray(
                            payload?.data
                                ?.properties
                        )
                            ? payload.data
                                  .properties
                            : []
                    );

                    setDeletedPagination({
                        ...EMPTY_PAGINATION,
                        ...(payload.pagination ||
                            {})
                    });

                    setDeletedPage(
                        targetPage
                    );
                } catch (requestError) {
                    setDeletedProperties([]);
                    setDeletedPagination(
                        EMPTY_PAGINATION
                    );
                    setDeletedError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setDeletedLoading(false);
                }
            },
            [
                deletedPage,
                isAdmin
            ]
        );

    const openDeletedProperties =
        async () => {
            setRestoreSuccess("");
            setDeletedError("");
            setDeletedOpen(true);
            setDeletedPage(1);

            await loadDeletedProperties(1);
        };

    const closeDeletedProperties =
        () => {
            if (restoringPropertyId) {
                return;
            }

            setDeletedOpen(false);
            setDeletedError("");
            setRestoreSuccess("");
        };

    const restoreProperty =
        async property => {
            if (
                !isAdmin ||
                !property?.public_id
            ) {
                return;
            }

            const confirmed =
                window.confirm(
                    `Restore "${property.property_name}"? It will return as Inactive and can be activated again later.`
                );

            if (!confirmed) {
                return;
            }

            try {
                setRestoringPropertyId(
                    property.public_id
                );
                setDeletedError("");
                setRestoreSuccess("");

                await apiClient.patch(
                    `/properties/${property.public_id}/restore`
                );

                setRestoreSuccess(
                    "Property restored successfully."
                );

                await Promise.all([
                    loadDeletedProperties(
                        deletedPage
                    ),
                    loadProperties()
                ]);
            } catch (requestError) {
                setDeletedError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setRestoringPropertyId("");
            }
        };

    const loadOwners = useCallback(
        async () => {
            try {
                setOwnersLoading(true);
                setOwnersError("");

                const response =
                    await apiClient.get(
                        "/owners",
                        {
                            params: {
                                status: "active",
                                page: 1,
                                limit: 100
                            }
                        }
                    );

                const rows =
                    Array.isArray(response?.data?.data)
                        ? response.data.data
                        : [];

                setOwners(
                    rows.filter(
                        owner =>
                            owner.status === "active" &&
                            owner.can_manage_properties !== false
                    )
                );
            } catch (requestError) {
                setOwners([]);
                setOwnersError(
                    getErrorMessage(requestError)
                );
            } finally {
                setOwnersLoading(false);
            }
        },
        []
    );

    const ownershipTotal = useMemo(
        () =>
            Number(
                propertyForm.ownerships
                    .reduce(
                        (total, ownership) =>
                            total +
                            (
                                Number(
                                    ownership
                                        .ownership_percentage
                                ) || 0
                            ),
                        0
                    )
                    .toFixed(4)
            ),
        [propertyForm.ownerships]
    );

    const openCreateProperty = async () => {
        setCreateError("");
        setCreateSuccess("");
        setPropertyForm(makePropertyForm());
        setCreateOpen(true);
        await loadOwners();
    };

    const closeCreateProperty = () => {
        if (!createSubmitting) {
            setCreateOpen(false);
            setCreateError("");
        }
    };

    const updatePropertyField = (field, value) => {
        setPropertyForm(current => ({
            ...current,
            [field]: value
        }));
    };

    const updateOwnership = (
        index,
        field,
        value
    ) => {
        setPropertyForm(current => ({
            ...current,
            ownerships:
                current.ownerships.map(
                    (ownership, itemIndex) => {
                        if (
                            field ===
                                "is_primary_contact" &&
                            value === true
                        ) {
                            return {
                                ...ownership,
                                is_primary_contact:
                                    itemIndex === index
                            };
                        }

                        if (itemIndex !== index) {
                            return ownership;
                        }

                        return {
                            ...ownership,
                            [field]: value
                        };
                    }
                )
        }));
    };

    const addOwnership = () => {
        setPropertyForm(current => ({
            ...current,
            ownerships: [
                ...current.ownerships,
                {
                    ...makeOwnership(),
                    ownership_percentage: "",
                    is_primary_contact: false
                }
            ]
        }));
    };

    const removeOwnership = index => {
        setPropertyForm(current => {
            if (current.ownerships.length <= 1) {
                return current;
            }

            const ownerships =
                current.ownerships.filter(
                    (_, itemIndex) =>
                        itemIndex !== index
                );

            if (ownerships.length === 1) {
                ownerships[0] = {
                    ...ownerships[0],
                    is_primary_contact: true
                };
            }

            return {
                ...current,
                ownerships
            };
        });
    };

    const handleCreateProperty = async event => {
        event.preventDefault();
        setCreateError("");

        const validationError =
            validateCreateProperty(
                propertyForm
            );

        if (validationError) {
            setCreateError(validationError);
            return;
        }

        const payload = {
            property_name:
                propertyForm.property_name.trim(),
            property_type:
                propertyForm.property_type.trim(),
            usage_category:
                propertyForm.usage_category,
            description:
                nullableString(
                    propertyForm.description
                ),
            address:
                nullableString(
                    propertyForm.address
                ),
            city:
                nullableString(
                    propertyForm.city
                ),
            region:
                nullableString(
                    propertyForm.region
                ),
            country:
                propertyForm.country.trim(),
            latitude:
                propertyForm.latitude === ""
                    ? null
                    : Number(
                          propertyForm.latitude
                      ),
            longitude:
                propertyForm.longitude === ""
                    ? null
                    : Number(
                          propertyForm.longitude
                      ),
            year_built:
                propertyForm.year_built === ""
                    ? null
                    : Number(
                          propertyForm.year_built
                      ),
            is_multi_unit:
                Boolean(
                    propertyForm.is_multi_unit
                ),
            ownerships:
                propertyForm.ownerships.map(
                    ownership => {
                        const normalized = {
                            owner_public_id:
                                ownership.owner_public_id,
                            ownership_percentage:
                                Number(
                                    ownership
                                        .ownership_percentage
                                ),
                            ownership_type:
                                ownership.ownership_type,
                            is_primary_contact:
                                propertyForm
                                    .ownerships
                                    .length === 1
                                    ? true
                                    : Boolean(
                                          ownership
                                              .is_primary_contact
                                      )
                        };

                        if (ownership.effective_from) {
                            normalized.effective_from =
                                ownership.effective_from;
                        }

                        return normalized;
                    }
                )
        };

        try {
            setCreateSubmitting(true);

            const response =
                await apiClient.post(
                    "/properties",
                    payload
                );

            const created =
                response?.data?.data?.property;

            setCreateSuccess(
                created?.property_code
                    ? `${created.property_name} (${created.property_code}) created successfully. It starts as Inactive.`
                    : "Property created successfully. It starts as Inactive."
            );

            setCreateOpen(false);
            setPropertyForm(makePropertyForm());
            setPage(1);
            await loadProperties();
        } catch (requestError) {
            setCreateError(
                getErrorMessage(requestError)
            );
        } finally {
            setCreateSubmitting(false);
        }
    };

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
                        View, filter and create
                        properties available to your account.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <ActionGroup>
                        <IconButton
                            label="Refresh properties"
                            icon={RefreshCw}
                            onClick={loadProperties}
                            loading={loading}
                            variant="ghost"
                        />

                        {isAdmin && (
                            <IconButton
                                label="Deleted properties"
                                icon={Trash2}
                                onClick={
                                    openDeletedProperties
                                }
                                variant="warning"
                            />
                        )}
                    </ActionGroup>

                    <Button
                        onClick={openCreateProperty}
                        variant="primary"
                        size="md"
                        leftIcon={Plus}
                        className="px-3.5"
                    >
                        Add Property
                    </Button>
                </div>
            </div>

            {restoreSuccess && !deletedOpen && (
                <div
                    className="
                        rounded-2xl
                        border
                        border-emerald-200
                        bg-emerald-50
                        px-4
                        py-3
                        text-sm
                        font-medium
                        text-emerald-700
                    "
                >
                    {restoreSuccess}
                </div>
            )}

            {createSuccess && (
                <div
                    className="
                        rounded-2xl
                        border
                        border-emerald-200
                        bg-emerald-50
                        px-4
                        py-3
                        text-sm
                        font-medium
                        text-emerald-700
                    "
                >
                    {createSuccess}
                </div>
            )}

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
                        <Button
                            type="submit"
                            size="lg"
                            leftIcon={Search}
                            className="flex-1"
                        >
                            Search
                        </Button>

                        <Button
                            onClick={
                                handleClearFilters
                            }
                            variant="secondary"
                            size="lg"
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
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    navigate(
                                                                        `/properties/${property.public_id}`
                                                                    )
                                                                }
                                                                className="
                                                                    text-left
                                                                    font-semibold
                                                                    text-slate-900
                                                                    transition
                                                                    hover:text-blue-600
                                                                    hover:underline
                                                                    hover:underline-offset-4
                                                                "
                                                            >
                                                                {
                                                                    property.property_name
                                                                }
                                                            </button>

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
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            navigate(
                                                                `/properties/${property.public_id}`
                                                            )
                                                        }
                                                        className="
                                                            block
                                                            max-w-full
                                                            truncate
                                                            text-left
                                                            font-bold
                                                            text-slate-900
                                                            transition
                                                            hover:text-blue-600
                                                        "
                                                    >
                                                        {
                                                            property.property_name
                                                        }
                                                    </button>

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

            {deletedOpen && isAdmin && (
                <div
                    className="
                        fixed inset-0 z-50
                        flex items-center
                        justify-center
                        bg-slate-950/50
                        p-4
                    "
                >
                    <div
                        className="
                            flex
                            max-h-[90vh]
                            w-full
                            max-w-5xl
                            flex-col
                            overflow-hidden
                            rounded-3xl
                            bg-white
                            shadow-2xl
                        "
                    >
                        <div
                            className="
                                flex items-start
                                justify-between
                                gap-4
                                border-b
                                border-slate-200
                                px-6 py-5
                            "
                        >
                            <div>
                                <h2
                                    className="
                                        text-xl
                                        font-bold
                                        text-slate-950
                                    "
                                >
                                    Deleted Properties
                                </h2>

                                <p
                                    className="
                                        mt-1
                                        text-sm
                                        text-slate-500
                                    "
                                >
                                    Admin recovery area for
                                    soft-deleted properties.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    closeDeletedProperties
                                }
                                disabled={
                                    Boolean(
                                        restoringPropertyId
                                    )
                                }
                                className="
                                    inline-flex
                                    h-9 w-9
                                    items-center
                                    justify-center
                                    rounded-xl
                                    text-slate-500
                                    hover:bg-slate-100
                                    hover:text-slate-900
                                    disabled:opacity-50
                                "
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div
                            className="
                                flex-1
                                overflow-y-auto
                                px-6 py-5
                            "
                        >
                            {restoreSuccess && (
                                <div
                                    className="
                                        mb-4
                                        rounded-xl
                                        border
                                        border-emerald-200
                                        bg-emerald-50
                                        px-4
                                        py-3
                                        text-sm
                                        font-medium
                                        text-emerald-700
                                    "
                                >
                                    {restoreSuccess}
                                </div>
                            )}

                            {deletedError && (
                                <div
                                    className="
                                        mb-4
                                        rounded-xl
                                        border
                                        border-rose-200
                                        bg-rose-50
                                        px-4
                                        py-3
                                        text-sm
                                        text-rose-700
                                    "
                                >
                                    {deletedError}
                                </div>
                            )}

                            {deletedLoading ? (
                                <div
                                    className="
                                        flex
                                        items-center
                                        justify-center
                                        gap-2
                                        py-12
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
                                    Loading deleted
                                    properties...
                                </div>
                            ) : deletedProperties.length ===
                              0 ? (
                                <div
                                    className="
                                        rounded-2xl
                                        border
                                        border-dashed
                                        border-slate-200
                                        bg-slate-50
                                        px-6
                                        py-12
                                        text-center
                                    "
                                >
                                    <Trash2
                                        className="
                                            mx-auto
                                            h-8 w-8
                                            text-slate-300
                                        "
                                    />

                                    <p
                                        className="
                                            mt-3
                                            font-semibold
                                            text-slate-700
                                        "
                                    >
                                        No deleted
                                        properties
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {deletedProperties.map(
                                        property => (
                                            <div
                                                key={
                                                    property.public_id
                                                }
                                                className="
                                                    rounded-2xl
                                                    border
                                                    border-slate-200
                                                    bg-white
                                                    p-4
                                                "
                                            >
                                                <div
                                                    className="
                                                        flex
                                                        flex-col
                                                        gap-4
                                                        md:flex-row
                                                        md:items-center
                                                        md:justify-between
                                                    "
                                                >
                                                    <div className="min-w-0">
                                                        <div
                                                            className="
                                                                flex
                                                                flex-wrap
                                                                items-center
                                                                gap-2
                                                            "
                                                        >
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

                                                            <span
                                                                className="
                                                                    rounded-full
                                                                    bg-rose-50
                                                                    px-2.5
                                                                    py-1
                                                                    text-xs
                                                                    font-semibold
                                                                    text-rose-700
                                                                    ring-1
                                                                    ring-rose-200
                                                                "
                                                            >
                                                                Deleted
                                                            </span>
                                                        </div>

                                                        <p
                                                            className="
                                                                mt-1
                                                                text-sm
                                                                text-slate-500
                                                            "
                                                        >
                                                            {
                                                                property.property_code
                                                            }{" "}
                                                            ·{" "}
                                                            {formatLabel(
                                                                property.property_type
                                                            )}
                                                        </p>

                                                        <div
                                                            className="
                                                                mt-3
                                                                grid
                                                                gap-2
                                                                text-sm
                                                                text-slate-600
                                                                sm:grid-cols-2
                                                            "
                                                        >
                                                            <div>
                                                                Owner:{" "}
                                                                <span className="font-medium text-slate-800">
                                                                    {property.primary_owner
                                                                        ?.display_name ||
                                                                        "No primary owner"}
                                                                </span>
                                                            </div>

                                                            <div>
                                                                Ownership:{" "}
                                                                <span className="font-medium text-slate-800">
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

                                                            <div className="sm:col-span-2">
                                                                Deleted:{" "}
                                                                <span className="font-medium text-slate-800">
                                                                    {property.deleted_at
                                                                        ? new Date(
                                                                              property.deleted_at
                                                                          ).toLocaleString()
                                                                        : "—"}
                                                                </span>
                                                            </div>

                                                            <div className="sm:col-span-2">
                                                                Location:{" "}
                                                                <span className="font-medium text-slate-800">
                                                                    {getLocationText(
                                                                        property.location
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            restoreProperty(
                                                                property
                                                            )
                                                        }
                                                        disabled={
                                                            Boolean(
                                                                restoringPropertyId
                                                            )
                                                        }
                                                        className="
                                                            inline-flex
                                                            shrink-0
                                                            items-center
                                                            justify-center
                                                            gap-2
                                                            rounded-xl
                                                            bg-emerald-600
                                                            px-4
                                                            py-2.5
                                                            text-sm
                                                            font-semibold
                                                            text-white
                                                            transition
                                                            hover:bg-emerald-700
                                                            disabled:cursor-not-allowed
                                                            disabled:opacity-50
                                                        "
                                                    >
                                                        {restoringPropertyId ===
                                                        property.public_id ? (
                                                            <RefreshCw
                                                                className="
                                                                    h-4 w-4
                                                                    animate-spin
                                                                "
                                                            />
                                                        ) : (
                                                            <RotateCcw className="h-4 w-4" />
                                                        )}

                                                        {restoringPropertyId ===
                                                        property.public_id
                                                            ? "Restoring..."
                                                            : "Restore"}
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        </div>

                        <div
                            className="
                                flex
                                flex-col
                                gap-3
                                border-t
                                border-slate-200
                                bg-slate-50
                                px-6 py-4
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
                                {deletedPagination.page ||
                                    1}{" "}
                                of{" "}
                                {deletedPagination.total_pages ||
                                    0}
                            </p>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        loadDeletedProperties(
                                            Math.max(
                                                1,
                                                deletedPage -
                                                    1
                                            )
                                        )
                                    }
                                    disabled={
                                        deletedLoading ||
                                        !deletedPagination.has_previous_page
                                    }
                                    className="
                                        inline-flex
                                        items-center
                                        gap-1
                                        rounded-lg
                                        border
                                        border-slate-200
                                        bg-white
                                        px-3
                                        py-2
                                        text-sm
                                        font-semibold
                                        text-slate-700
                                        disabled:opacity-40
                                    "
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        loadDeletedProperties(
                                            deletedPage +
                                                1
                                        )
                                    }
                                    disabled={
                                        deletedLoading ||
                                        !deletedPagination.has_next_page
                                    }
                                    className="
                                        inline-flex
                                        items-center
                                        gap-1
                                        rounded-lg
                                        border
                                        border-slate-200
                                        bg-white
                                        px-3
                                        py-2
                                        text-sm
                                        font-semibold
                                        text-slate-700
                                        disabled:opacity-40
                                    "
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {createOpen && (
                <div
                    className="
                        fixed inset-0 z-50
                        overflow-y-auto
                        bg-slate-950/50
                        px-4 py-6
                        backdrop-blur-sm
                    "
                >
                    <div
                        className="
                            mx-auto
                            w-full
                            max-w-5xl
                            overflow-hidden
                            rounded-3xl
                            bg-white
                            shadow-2xl
                        "
                    >
                        <div
                            className="
                                flex
                                items-start
                                justify-between
                                gap-4
                                border-b
                                border-slate-200
                                px-6
                                py-5
                            "
                        >
                            <div>
                                <h2 className="text-xl font-bold text-slate-950">
                                    Add Property
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Create a property and assign its ownership.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeCreateProperty}
                                disabled={createSubmitting}
                                className="
                                    rounded-xl
                                    p-2
                                    text-slate-400
                                    transition
                                    hover:bg-slate-100
                                    hover:text-slate-700
                                    disabled:opacity-50
                                "
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateProperty}>
                            <div
                                className="
                                    max-h-[72vh]
                                    space-y-7
                                    overflow-y-auto
                                    px-6
                                    py-6
                                "
                            >
                                {createError && (
                                    <div
                                        className="
                                            rounded-2xl
                                            border
                                            border-rose-200
                                            bg-rose-50
                                            px-4
                                            py-3
                                            text-sm
                                            text-rose-700
                                        "
                                    >
                                        {createError}
                                    </div>
                                )}

                                <section>
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                                        Property Details
                                    </h3>

                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <label className="space-y-1.5">
                                            <span className="text-sm font-semibold text-slate-700">
                                                Property Name *
                                            </span>
                                            <input
                                                value={propertyForm.property_name}
                                                onChange={event =>
                                                    updatePropertyField(
                                                        "property_name",
                                                        event.target.value
                                                    )
                                                }
                                                maxLength={150}
                                                required
                                                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                placeholder="e.g. Riverside Apartments"
                                            />
                                        </label>

                                        <label className="space-y-1.5">
                                            <span className="text-sm font-semibold text-slate-700">
                                                Property Type *
                                            </span>
                                            <input
                                                value={propertyForm.property_type}
                                                onChange={event =>
                                                    updatePropertyField(
                                                        "property_type",
                                                        event.target.value
                                                    )
                                                }
                                                maxLength={60}
                                                required
                                                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                placeholder="e.g. apartment_building"
                                            />
                                            <span className="block text-xs text-slate-400">
                                                Letters, numbers, underscores and hyphens only.
                                            </span>
                                        </label>

                                        <label className="space-y-1.5">
                                            <span className="text-sm font-semibold text-slate-700">
                                                Usage Category *
                                            </span>
                                            <select
                                                value={propertyForm.usage_category}
                                                onChange={event =>
                                                    updatePropertyField(
                                                        "usage_category",
                                                        event.target.value
                                                    )
                                                }
                                                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            >
                                                {USAGE_OPTIONS
                                                    .filter(option => option.value)
                                                    .map(option => (
                                                        <option
                                                            key={option.value}
                                                            value={option.value}
                                                        >
                                                            {option.label}
                                                        </option>
                                                    ))}
                                            </select>
                                        </label>

                                        <label className="space-y-1.5">
                                            <span className="text-sm font-semibold text-slate-700">
                                                Property Structure *
                                            </span>
                                            <select
                                                value={
                                                    propertyForm.is_multi_unit
                                                        ? "true"
                                                        : "false"
                                                }
                                                onChange={event =>
                                                    updatePropertyField(
                                                        "is_multi_unit",
                                                        event.target.value === "true"
                                                    )
                                                }
                                                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            >
                                                <option value="true">
                                                    Multi-unit property
                                                </option>
                                                <option value="false">
                                                    Single-unit property
                                                </option>
                                            </select>
                                        </label>

                                        <label className="space-y-1.5 md:col-span-2">
                                            <span className="text-sm font-semibold text-slate-700">
                                                Description
                                            </span>
                                            <textarea
                                                value={propertyForm.description}
                                                onChange={event =>
                                                    updatePropertyField(
                                                        "description",
                                                        event.target.value
                                                    )
                                                }
                                                maxLength={2000}
                                                rows={3}
                                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            />
                                        </label>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                                        Location
                                    </h3>

                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <label className="space-y-1.5 md:col-span-2">
                                            <span className="text-sm font-semibold text-slate-700">
                                                Address
                                            </span>
                                            <input
                                                value={propertyForm.address}
                                                onChange={event =>
                                                    updatePropertyField(
                                                        "address",
                                                        event.target.value
                                                    )
                                                }
                                                maxLength={255}
                                                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            />
                                        </label>

                                        {[
                                            ["city", "City"],
                                            ["region", "Region"],
                                            ["country", "Country *"]
                                        ].map(([field, label]) => (
                                            <label
                                                key={field}
                                                className="space-y-1.5"
                                            >
                                                <span className="text-sm font-semibold text-slate-700">
                                                    {label}
                                                </span>
                                                <input
                                                    value={propertyForm[field]}
                                                    onChange={event =>
                                                        updatePropertyField(
                                                            field,
                                                            event.target.value
                                                        )
                                                    }
                                                    maxLength={100}
                                                    required={field === "country"}
                                                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                />
                                            </label>
                                        ))}

                                        <label className="space-y-1.5">
                                            <span className="text-sm font-semibold text-slate-700">
                                                Year Built
                                            </span>
                                            <input
                                                type="number"
                                                min="1000"
                                                max="2100"
                                                value={propertyForm.year_built}
                                                onChange={event =>
                                                    updatePropertyField(
                                                        "year_built",
                                                        event.target.value
                                                    )
                                                }
                                                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            />
                                        </label>

                                        <label className="space-y-1.5">
                                            <span className="text-sm font-semibold text-slate-700">
                                                Latitude
                                            </span>
                                            <input
                                                type="number"
                                                step="any"
                                                min="-90"
                                                max="90"
                                                value={propertyForm.latitude}
                                                onChange={event =>
                                                    updatePropertyField(
                                                        "latitude",
                                                        event.target.value
                                                    )
                                                }
                                                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            />
                                        </label>

                                        <label className="space-y-1.5">
                                            <span className="text-sm font-semibold text-slate-700">
                                                Longitude
                                            </span>
                                            <input
                                                type="number"
                                                step="any"
                                                min="-180"
                                                max="180"
                                                value={propertyForm.longitude}
                                                onChange={event =>
                                                    updatePropertyField(
                                                        "longitude",
                                                        event.target.value
                                                    )
                                                }
                                                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            />
                                        </label>
                                    </div>
                                </section>

                                <section>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                                                Ownership
                                            </h3>
                                            <p className="mt-1 text-sm text-slate-500">
                                                Total ownership may not exceed 100%.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                                                    ownershipTotal > 100
                                                        ? "bg-rose-50 text-rose-700"
                                                        : "bg-slate-100 text-slate-700"
                                                }`}
                                            >
                                                Total: {ownershipTotal.toFixed(4)}%
                                            </span>

                                            <button
                                                type="button"
                                                onClick={addOwnership}
                                                disabled={
                                                    propertyForm.ownerships.length >= 100
                                                }
                                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Add Owner
                                            </button>
                                        </div>
                                    </div>

                                    {ownersLoading ? (
                                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                            Loading authorized owners...
                                        </div>
                                    ) : ownersError ? (
                                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                                            {ownersError}
                                        </div>
                                    ) : owners.length === 0 ? (
                                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                                            No active owner is available for property creation.
                                        </div>
                                    ) : (
                                        <div className="mt-4 space-y-4">
                                            {propertyForm.ownerships.map(
                                                (ownership, index) => {
                                                    const selectedByOthers =
                                                        new Set(
                                                            propertyForm.ownerships
                                                                .filter(
                                                                    (_, itemIndex) =>
                                                                        itemIndex !== index
                                                                )
                                                                .map(
                                                                    item =>
                                                                        item.owner_public_id
                                                                )
                                                                .filter(Boolean)
                                                        );

                                                    return (
                                                        <div
                                                            key={index}
                                                            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-bold text-slate-800">
                                                                    Owner {index + 1}
                                                                </span>

                                                                {propertyForm.ownerships.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            removeOwnership(index)
                                                                        }
                                                                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                                                        aria-label="Remove owner"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </button>
                                                                )}
                                                            </div>

                                                            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                                                <label className="space-y-1.5 md:col-span-2">
                                                                    <span className="text-xs font-semibold text-slate-600">
                                                                        Owner *
                                                                    </span>
                                                                    <select
                                                                        value={ownership.owner_public_id}
                                                                        onChange={event =>
                                                                            updateOwnership(
                                                                                index,
                                                                                "owner_public_id",
                                                                                event.target.value
                                                                            )
                                                                        }
                                                                        required
                                                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                                    >
                                                                        <option value="">
                                                                            Select active owner
                                                                        </option>
                                                                        {owners.map(owner => (
                                                                            <option
                                                                                key={owner.public_id}
                                                                                value={owner.public_id}
                                                                                disabled={
                                                                                    selectedByOthers.has(
                                                                                        owner.public_id
                                                                                    )
                                                                                }
                                                                            >
                                                                                {owner.display_name} (
                                                                                {formatLabel(
                                                                                    owner.owner_type
                                                                                )}
                                                                                )
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </label>

                                                                <label className="space-y-1.5">
                                                                    <span className="text-xs font-semibold text-slate-600">
                                                                        Ownership % *
                                                                    </span>
                                                                    <input
                                                                        type="number"
                                                                        min="0.0001"
                                                                        max="100"
                                                                        step="0.0001"
                                                                        value={
                                                                            ownership.ownership_percentage
                                                                        }
                                                                        onChange={event =>
                                                                            updateOwnership(
                                                                                index,
                                                                                "ownership_percentage",
                                                                                event.target.value
                                                                            )
                                                                        }
                                                                        required
                                                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                                    />
                                                                </label>

                                                                <label className="space-y-1.5">
                                                                    <span className="text-xs font-semibold text-slate-600">
                                                                        Ownership Type
                                                                    </span>
                                                                    <select
                                                                        value={ownership.ownership_type}
                                                                        onChange={event =>
                                                                            updateOwnership(
                                                                                index,
                                                                                "ownership_type",
                                                                                event.target.value
                                                                            )
                                                                        }
                                                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                                    >
                                                                        {OWNERSHIP_TYPE_OPTIONS.map(
                                                                            option => (
                                                                                <option
                                                                                    key={option.value}
                                                                                    value={option.value}
                                                                                >
                                                                                    {option.label}
                                                                                </option>
                                                                            )
                                                                        )}
                                                                    </select>
                                                                </label>

                                                                <label className="space-y-1.5">
                                                                    <span className="text-xs font-semibold text-slate-600">
                                                                        Effective From
                                                                    </span>
                                                                    <input
                                                                        type="date"
                                                                        value={ownership.effective_from}
                                                                        onChange={event =>
                                                                            updateOwnership(
                                                                                index,
                                                                                "effective_from",
                                                                                event.target.value
                                                                            )
                                                                        }
                                                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                                    />
                                                                </label>
                                                            </div>

                                                            <label className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={ownership.is_primary_contact}
                                                                    onChange={event =>
                                                                        updateOwnership(
                                                                            index,
                                                                            "is_primary_contact",
                                                                            event.target.checked
                                                                        )
                                                                    }
                                                                    className="h-4 w-4 rounded border-slate-300"
                                                                />
                                                                Primary contact
                                                            </label>
                                                        </div>
                                                    );
                                                }
                                            )}
                                        </div>
                                    )}
                                </section>

                                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                                    New properties are created as <strong>Inactive</strong>.
                                    Activation will be handled separately after ownership
                                    and business requirements are satisfied.
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeCreateProperty}
                                    disabled={createSubmitting}
                                    className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={
                                        createSubmitting ||
                                        ownersLoading ||
                                        owners.length === 0 ||
                                        ownershipTotal > 100
                                    }
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {createSubmitting ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4" />
                                            Create Property
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PropertiesPage;

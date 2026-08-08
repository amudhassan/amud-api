import {
    ArrowLeft,
    Building2,
    CalendarDays,
    Home,
    Mail,
    MapPin,
    Pencil,
    Phone,
    RefreshCw,
    Save,
    ShieldCheck,
    Users,
    X
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";
import {
    useNavigate,
    useParams
} from "react-router-dom";

import apiClient from "../../api/apiClient";

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

const formatDate = value => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    ).format(date);
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
        "Property details could not be loaded."
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

const USAGE_CATEGORIES = [
    "residential",
    "commercial",
    "mixed",
    "industrial",
    "land",
    "hospitality",
    "institutional",
    "agricultural",
    "other"
];

const FIELD_CLASS_NAME = `
    mt-1.5
    w-full
    rounded-xl
    border
    border-slate-200
    bg-white
    px-3
    py-2.5
    text-sm
    text-slate-900
    outline-none
    transition
    focus:border-blue-400
    focus:ring-4
    focus:ring-blue-50
`;

const makeEditForm = property => ({
    property_name:
        property?.property_name || "",
    property_type:
        property?.property_type || "",
    usage_category:
        property?.usage_category || "residential",
    description:
        property?.description || "",
    address:
        property?.address || "",
    city:
        property?.city || "",
    region:
        property?.region || "",
    country:
        property?.country || "",
    latitude:
        property?.latitude ?? "",
    longitude:
        property?.longitude ?? "",
    year_built:
        property?.year_built ?? "",
    is_multi_unit:
        Boolean(property?.is_multi_unit)
});

const DetailItem = ({
    label,
    value
}) => (
    <div
        className="
            rounded-xl
            border
            border-slate-200
            bg-slate-50/70
            px-4
            py-3
        "
    >
        <div
            className="
                text-xs
                font-semibold
                uppercase
                tracking-wide
                text-slate-400
            "
        >
            {label}
        </div>

        <div
            className="
                mt-1
                break-words
                text-sm
                font-medium
                text-slate-800
            "
        >
            {value ?? "—"}
        </div>
    </div>
);

function PropertyDetailPage() {
    const navigate = useNavigate();
    const { property_public_id } = useParams();

    const [detail, setDetail] =
        useState(null);
    const [loading, setLoading] =
        useState(true);
    const [error, setError] =
        useState("");
    const [isEditing, setIsEditing] =
        useState(false);
    const [editForm, setEditForm] =
        useState(null);
    const [saving, setSaving] =
        useState(false);
    const [editError, setEditError] =
        useState("");
    const [successMessage, setSuccessMessage] =
        useState("");

    const loadProperty = useCallback(
        async () => {
            if (!property_public_id) {
                setError(
                    "Property identifier is missing."
                );
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError("");

                const response =
                    await apiClient.get(
                        `/properties/${property_public_id}`
                    );

                setDetail(
                    response?.data?.data || null
                );
            } catch (requestError) {
                setDetail(null);
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setLoading(false);
            }
        },
        [property_public_id]
    );

    useEffect(() => {
        loadProperty();
    }, [loadProperty]);

    const property =
        detail?.property || null;
    const ownershipSummary =
        detail?.ownership_summary || null;
    const ownerships =
        Array.isArray(detail?.ownerships)
            ? detail.ownerships
            : [];

    const locationText = useMemo(() => {
        if (!property) {
            return "—";
        }

        const parts = [
            property.address,
            property.city,
            property.region,
            property.country
        ].filter(Boolean);

        return parts.length > 0
            ? parts.join(", ")
            : "Location not provided";
    }, [property]);

    const openEdit = () => {
        setEditForm(
            makeEditForm(property)
        );
        setEditError("");
        setSuccessMessage("");
        setIsEditing(true);
    };

    const closeEdit = () => {
        if (saving) {
            return;
        }

        setEditForm(null);
        setEditError("");
        setIsEditing(false);
    };

    const updateEditField = (
        field,
        value
    ) => {
        setEditForm(current => ({
            ...current,
            [field]: value
        }));
    };

    const validateEditForm = () => {
        const propertyName =
            editForm?.property_name?.trim() || "";
        const propertyType =
            editForm?.property_type?.trim() || "";
        const country =
            editForm?.country?.trim() || "";

        if (
            propertyName.length < 2 ||
            propertyName.length > 150
        ) {
            return "Property name must contain between 2 and 150 characters.";
        }

        if (
            propertyType.length < 2 ||
            propertyType.length > 60 ||
            !/^[A-Za-z0-9_-]+$/.test(
                propertyType
            )
        ) {
            return "Property type must contain 2–60 letters, numbers, underscores or hyphens.";
        }

        if (
            !USAGE_CATEGORIES.includes(
                editForm?.usage_category
            )
        ) {
            return "Please select a valid usage category.";
        }

        if (
            country.length < 2 ||
            country.length > 100
        ) {
            return "Country must contain between 2 and 100 characters.";
        }

        if (
            editForm?.description?.length > 2000
        ) {
            return "Description cannot exceed 2000 characters.";
        }

        if (
            editForm?.address?.length > 255
        ) {
            return "Address cannot exceed 255 characters.";
        }

        for (const [
            field,
            label
        ] of [
            ["city", "City"],
            ["region", "Region"]
        ]) {
            if (
                editForm?.[field]?.length > 100
            ) {
                return `${label} cannot exceed 100 characters.`;
            }
        }

        if (editForm?.year_built !== "") {
            const yearBuilt =
                Number(editForm.year_built);

            if (
                !Number.isInteger(yearBuilt) ||
                yearBuilt < 1000 ||
                yearBuilt > 2100
            ) {
                return "Year built must be between 1000 and 2100.";
            }
        }

        if (editForm?.latitude !== "") {
            const latitude =
                Number(editForm.latitude);

            if (
                Number.isNaN(latitude) ||
                latitude < -90 ||
                latitude > 90
            ) {
                return "Latitude must be between -90 and 90.";
            }
        }

        if (editForm?.longitude !== "") {
            const longitude =
                Number(editForm.longitude);

            if (
                Number.isNaN(longitude) ||
                longitude < -180 ||
                longitude > 180
            ) {
                return "Longitude must be between -180 and 180.";
            }
        }

        return "";
    };

    const saveProperty = async event => {
        event.preventDefault();

        const validationError =
            validateEditForm();

        if (validationError) {
            setEditError(
                validationError
            );
            return;
        }

        const nullableText = value => {
            const normalized =
                String(value || "").trim();

            return normalized === ""
                ? null
                : normalized;
        };

        const payload = {
            property_name:
                editForm.property_name.trim(),
            property_type:
                editForm.property_type.trim(),
            usage_category:
                editForm.usage_category,
            description:
                nullableText(
                    editForm.description
                ),
            address:
                nullableText(
                    editForm.address
                ),
            city:
                nullableText(
                    editForm.city
                ),
            region:
                nullableText(
                    editForm.region
                ),
            country:
                editForm.country.trim(),
            latitude:
                editForm.latitude === ""
                    ? null
                    : Number(
                        editForm.latitude
                    ),
            longitude:
                editForm.longitude === ""
                    ? null
                    : Number(
                        editForm.longitude
                    ),
            year_built:
                editForm.year_built === ""
                    ? null
                    : Number(
                        editForm.year_built
                    ),
            is_multi_unit:
                Boolean(
                    editForm.is_multi_unit
                )
        };

        try {
            setSaving(true);
            setEditError("");
            setSuccessMessage("");

            await apiClient.patch(
                `/properties/${property_public_id}`,
                payload
            );

            setIsEditing(false);
            setEditForm(null);

            await loadProperty();

            setSuccessMessage(
                "Property updated successfully."
            );
        } catch (requestError) {
            setEditError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div
                className="
                    flex
                    min-h-[55vh]
                    items-center
                    justify-center
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
                    Loading property details...
                </div>
            </div>
        );
    }

    if (error || !property) {
        return (
            <div className="space-y-5">
                <button
                    type="button"
                    onClick={() =>
                        navigate("/properties")
                    }
                    className="
                        inline-flex
                        items-center
                        gap-2
                        text-sm
                        font-semibold
                        text-slate-600
                        hover:text-slate-950
                    "
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Properties
                </button>

                <div
                    className="
                        rounded-2xl
                        border
                        border-rose-200
                        bg-rose-50
                        p-5
                        text-sm
                        text-rose-700
                    "
                >
                    <div
                        className="
                            flex
                            flex-col
                            gap-3
                            sm:flex-row
                            sm:items-center
                            sm:justify-between
                        "
                    >
                        <span>
                            {error ||
                                "Property not found."}
                        </span>

                        <button
                            type="button"
                            onClick={loadProperty}
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
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div
                className="
                    flex
                    flex-col
                    gap-4
                    lg:flex-row
                    lg:items-start
                    lg:justify-between
                "
            >
                <div>
                    <button
                        type="button"
                        onClick={() =>
                            navigate("/properties")
                        }
                        className="
                            mb-4
                            inline-flex
                            items-center
                            gap-2
                            text-sm
                            font-semibold
                            text-slate-500
                            transition
                            hover:text-slate-900
                        "
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Properties
                    </button>

                    <div
                        className="
                            flex
                            items-start
                            gap-4
                        "
                    >
                        <div
                            className="
                                flex
                                h-12 w-12
                                shrink-0
                                items-center
                                justify-center
                                rounded-2xl
                                bg-blue-50
                                text-blue-600
                            "
                        >
                            <Building2 className="h-6 w-6" />
                        </div>

                        <div>
                            <div
                                className="
                                    flex
                                    flex-wrap
                                    items-center
                                    gap-3
                                "
                            >
                                <h1
                                    className="
                                        text-3xl
                                        font-bold
                                        tracking-tight
                                        text-slate-950
                                    "
                                >
                                    {property.property_name}
                                </h1>

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
                            </div>

                            <p
                                className="
                                    mt-2
                                    text-sm
                                    font-medium
                                    text-slate-500
                                "
                            >
                                {property.property_code}
                            </p>
                        </div>
                    </div>
                </div>

                <div
                    className="
                        flex
                        flex-wrap
                        items-center
                        gap-2
                    "
                >
                    <button
                        type="button"
                        onClick={openEdit}
                        disabled={isEditing}
                        className="
                            inline-flex
                            items-center
                            justify-center
                            gap-2
                            rounded-xl
                            bg-blue-600
                            px-4
                            py-2.5
                            text-sm
                            font-semibold
                            text-white
                            shadow-sm
                            transition
                            hover:bg-blue-700
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                        "
                    >
                        <Pencil className="h-4 w-4" />
                        Edit Property
                    </button>

                    <button
                        type="button"
                        onClick={loadProperty}
                        disabled={saving}
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
                            disabled:opacity-50
                        "
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {successMessage && (
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
                    {successMessage}
                </div>
            )}

            {isEditing && editForm && (
                <form
                    onSubmit={saveProperty}
                    className="
                        rounded-2xl
                        border
                        border-blue-200
                        bg-white
                        p-5
                        shadow-sm
                    "
                >
                    <div
                        className="
                            flex
                            flex-col
                            gap-3
                            sm:flex-row
                            sm:items-start
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
                                Edit Property
                            </h2>

                            <p
                                className="
                                    mt-1
                                    text-sm
                                    text-slate-500
                                "
                            >
                                Update property details.
                                Ownership records are managed
                                separately.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={closeEdit}
                            disabled={saving}
                            className="
                                inline-flex
                                h-9 w-9
                                items-center
                                justify-center
                                rounded-lg
                                text-slate-500
                                transition
                                hover:bg-slate-100
                                hover:text-slate-900
                                disabled:opacity-50
                            "
                            aria-label="Close edit form"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {editError && (
                        <div
                            className="
                                mt-4
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
                            {editError}
                        </div>
                    )}

                    <div
                        className="
                            mt-5
                            grid
                            gap-4
                            md:grid-cols-2
                        "
                    >
                        <label className="text-sm font-semibold text-slate-700">
                            Property Name
                            <input
                                type="text"
                                value={
                                    editForm.property_name
                                }
                                onChange={event =>
                                    updateEditField(
                                        "property_name",
                                        event.target.value
                                    )
                                }
                                maxLength={150}
                                required
                                className={
                                    FIELD_CLASS_NAME
                                }
                            />
                        </label>

                        <label className="text-sm font-semibold text-slate-700">
                            Property Type
                            <input
                                type="text"
                                value={
                                    editForm.property_type
                                }
                                onChange={event =>
                                    updateEditField(
                                        "property_type",
                                        event.target.value
                                    )
                                }
                                maxLength={60}
                                required
                                className={
                                    FIELD_CLASS_NAME
                                }
                            />
                        </label>

                        <label className="text-sm font-semibold text-slate-700">
                            Usage Category
                            <select
                                value={
                                    editForm.usage_category
                                }
                                onChange={event =>
                                    updateEditField(
                                        "usage_category",
                                        event.target.value
                                    )
                                }
                                className={
                                    FIELD_CLASS_NAME
                                }
                            >
                                {USAGE_CATEGORIES.map(
                                    category => (
                                        <option
                                            key={
                                                category
                                            }
                                            value={
                                                category
                                            }
                                        >
                                            {formatLabel(
                                                category
                                            )}
                                        </option>
                                    )
                                )}
                            </select>
                        </label>

                        <label className="text-sm font-semibold text-slate-700">
                            Country
                            <input
                                type="text"
                                value={
                                    editForm.country
                                }
                                onChange={event =>
                                    updateEditField(
                                        "country",
                                        event.target.value
                                    )
                                }
                                maxLength={100}
                                required
                                className={
                                    FIELD_CLASS_NAME
                                }
                            />
                        </label>

                        <label className="text-sm font-semibold text-slate-700">
                            Address
                            <input
                                type="text"
                                value={
                                    editForm.address
                                }
                                onChange={event =>
                                    updateEditField(
                                        "address",
                                        event.target.value
                                    )
                                }
                                maxLength={255}
                                className={
                                    FIELD_CLASS_NAME
                                }
                            />
                        </label>

                        <label className="text-sm font-semibold text-slate-700">
                            City
                            <input
                                type="text"
                                value={
                                    editForm.city
                                }
                                onChange={event =>
                                    updateEditField(
                                        "city",
                                        event.target.value
                                    )
                                }
                                maxLength={100}
                                className={
                                    FIELD_CLASS_NAME
                                }
                            />
                        </label>

                        <label className="text-sm font-semibold text-slate-700">
                            Region
                            <input
                                type="text"
                                value={
                                    editForm.region
                                }
                                onChange={event =>
                                    updateEditField(
                                        "region",
                                        event.target.value
                                    )
                                }
                                maxLength={100}
                                className={
                                    FIELD_CLASS_NAME
                                }
                            />
                        </label>

                        <label className="text-sm font-semibold text-slate-700">
                            Year Built
                            <input
                                type="number"
                                min="1000"
                                max="2100"
                                value={
                                    editForm.year_built
                                }
                                onChange={event =>
                                    updateEditField(
                                        "year_built",
                                        event.target.value
                                    )
                                }
                                className={
                                    FIELD_CLASS_NAME
                                }
                            />
                        </label>

                        <label className="text-sm font-semibold text-slate-700">
                            Latitude
                            <input
                                type="number"
                                step="any"
                                min="-90"
                                max="90"
                                value={
                                    editForm.latitude
                                }
                                onChange={event =>
                                    updateEditField(
                                        "latitude",
                                        event.target.value
                                    )
                                }
                                className={
                                    FIELD_CLASS_NAME
                                }
                            />
                        </label>

                        <label className="text-sm font-semibold text-slate-700">
                            Longitude
                            <input
                                type="number"
                                step="any"
                                min="-180"
                                max="180"
                                value={
                                    editForm.longitude
                                }
                                onChange={event =>
                                    updateEditField(
                                        "longitude",
                                        event.target.value
                                    )
                                }
                                className={
                                    FIELD_CLASS_NAME
                                }
                            />
                        </label>

                        <label
                            className="
                                flex
                                items-center
                                gap-3
                                rounded-xl
                                border
                                border-slate-200
                                bg-slate-50
                                px-4
                                py-3
                                text-sm
                                font-semibold
                                text-slate-700
                                md:col-span-2
                            "
                        >
                            <input
                                type="checkbox"
                                checked={
                                    editForm.is_multi_unit
                                }
                                onChange={event =>
                                    updateEditField(
                                        "is_multi_unit",
                                        event.target.checked
                                    )
                                }
                                className="
                                    h-4 w-4
                                    rounded
                                    border-slate-300
                                "
                            />

                            Multi-unit property
                        </label>

                        <label
                            className="
                                text-sm
                                font-semibold
                                text-slate-700
                                md:col-span-2
                            "
                        >
                            Description
                            <textarea
                                rows={4}
                                value={
                                    editForm.description
                                }
                                onChange={event =>
                                    updateEditField(
                                        "description",
                                        event.target.value
                                    )
                                }
                                maxLength={2000}
                                className={
                                    FIELD_CLASS_NAME
                                }
                            />
                        </label>
                    </div>

                    <div
                        className="
                            mt-5
                            flex
                            flex-wrap
                            justify-end
                            gap-3
                            border-t
                            border-slate-200
                            pt-5
                        "
                    >
                        <button
                            type="button"
                            onClick={closeEdit}
                            disabled={saving}
                            className="
                                rounded-xl
                                border
                                border-slate-200
                                bg-white
                                px-4
                                py-2.5
                                text-sm
                                font-semibold
                                text-slate-700
                                transition
                                hover:bg-slate-50
                                disabled:opacity-50
                            "
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            className="
                                inline-flex
                                items-center
                                gap-2
                                rounded-xl
                                bg-blue-600
                                px-4
                                py-2.5
                                text-sm
                                font-semibold
                                text-white
                                transition
                                hover:bg-blue-700
                                disabled:cursor-not-allowed
                                disabled:opacity-60
                            "
                        >
                            {saving ? (
                                <RefreshCw
                                    className="
                                        h-4 w-4
                                        animate-spin
                                    "
                                />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}

                            {saving
                                ? "Saving..."
                                : "Save Changes"}
                        </button>
                    </div>
                </form>
            )}

            <div
                className="
                    grid
                    gap-4
                    md:grid-cols-3
                "
            >
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
                            items-center
                            gap-3
                        "
                    >
                        <ShieldCheck
                            className="
                                h-5 w-5
                                text-blue-600
                            "
                        />

                        <span
                            className="
                                text-sm
                                font-semibold
                                text-slate-500
                            "
                        >
                            Active Ownership
                        </span>
                    </div>

                    <div
                        className="
                            mt-3
                            text-2xl
                            font-bold
                            text-slate-950
                        "
                    >
                        {Number(
                            ownershipSummary
                                ?.total_active_ownership ||
                                0
                        ).toFixed(2)}
                        %
                    </div>
                </div>

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
                            items-center
                            gap-3
                        "
                    >
                        <Users
                            className="
                                h-5 w-5
                                text-blue-600
                            "
                        />

                        <span
                            className="
                                text-sm
                                font-semibold
                                text-slate-500
                            "
                        >
                            Active Owners
                        </span>
                    </div>

                    <div
                        className="
                            mt-3
                            text-2xl
                            font-bold
                            text-slate-950
                        "
                    >
                        {Number(
                            ownershipSummary
                                ?.active_owner_count ||
                                0
                        )}
                    </div>
                </div>

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
                            items-center
                            gap-3
                        "
                    >
                        <Home
                            className="
                                h-5 w-5
                                text-blue-600
                            "
                        />

                        <span
                            className="
                                text-sm
                                font-semibold
                                text-slate-500
                            "
                        >
                            Structure
                        </span>
                    </div>

                    <div
                        className="
                            mt-3
                            text-lg
                            font-bold
                            text-slate-950
                        "
                    >
                        {property.is_multi_unit
                            ? "Multi-unit"
                            : "Single-unit"}
                    </div>
                </div>
            </div>

            <div
                className="
                    grid
                    gap-6
                    xl:grid-cols-[1.35fr_1fr]
                "
            >
                <section
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
                            gap-3
                        "
                    >
                        <Building2
                            className="
                                h-5 w-5
                                text-blue-600
                            "
                        />

                        <div>
                            <h2
                                className="
                                    text-lg
                                    font-bold
                                    text-slate-900
                                "
                            >
                                Property Information
                            </h2>

                            <p
                                className="
                                    mt-1
                                    text-sm
                                    text-slate-500
                                "
                            >
                                Core property and location
                                details.
                            </p>
                        </div>
                    </div>

                    <div
                        className="
                            mt-5
                            grid
                            gap-3
                            sm:grid-cols-2
                        "
                    >
                        <DetailItem
                            label="Property Code"
                            value={
                                property.property_code
                            }
                        />
                        <DetailItem
                            label="Property Type"
                            value={formatLabel(
                                property.property_type
                            )}
                        />
                        <DetailItem
                            label="Usage Category"
                            value={formatLabel(
                                property.usage_category
                            )}
                        />
                        <DetailItem
                            label="Year Built"
                            value={
                                property.year_built ||
                                "—"
                            }
                        />
                        <DetailItem
                            label="Country"
                            value={
                                property.country ||
                                "—"
                            }
                        />
                        <DetailItem
                            label="Region"
                            value={
                                property.region ||
                                "—"
                            }
                        />
                        <DetailItem
                            label="City"
                            value={
                                property.city ||
                                "—"
                            }
                        />
                        <DetailItem
                            label="Address"
                            value={
                                property.address ||
                                "—"
                            }
                        />
                        <DetailItem
                            label="Latitude"
                            value={
                                property.latitude ??
                                "—"
                            }
                        />
                        <DetailItem
                            label="Longitude"
                            value={
                                property.longitude ??
                                "—"
                            }
                        />
                        <DetailItem
                            label="Created"
                            value={formatDate(
                                property.created_at
                            )}
                        />
                        <DetailItem
                            label="Updated"
                            value={formatDate(
                                property.updated_at
                            )}
                        />
                    </div>

                    <div
                        className="
                            mt-4
                            rounded-xl
                            border
                            border-slate-200
                            bg-slate-50
                            p-4
                        "
                    >
                        <div
                            className="
                                flex
                                items-start
                                gap-2
                                text-sm
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

                            <span>
                                {locationText}
                            </span>
                        </div>
                    </div>

                    <div
                        className="
                            mt-4
                            rounded-xl
                            border
                            border-slate-200
                            bg-white
                            p-4
                        "
                    >
                        <div
                            className="
                                text-xs
                                font-semibold
                                uppercase
                                tracking-wide
                                text-slate-400
                            "
                        >
                            Description
                        </div>

                        <p
                            className="
                                mt-2
                                whitespace-pre-wrap
                                text-sm
                                leading-6
                                text-slate-700
                            "
                        >
                            {property.description ||
                                "No description provided."}
                        </p>
                    </div>
                </section>

                <section
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
                            gap-3
                        "
                    >
                        <Users
                            className="
                                h-5 w-5
                                text-blue-600
                            "
                        />

                        <div>
                            <h2
                                className="
                                    text-lg
                                    font-bold
                                    text-slate-900
                                "
                            >
                                Ownership
                            </h2>

                            <p
                                className="
                                    mt-1
                                    text-sm
                                    text-slate-500
                                "
                            >
                                Current active property
                                ownership records.
                            </p>
                        </div>
                    </div>

                    <div
                        className="
                            mt-5
                            space-y-4
                        "
                    >
                        {ownerships.length === 0 ? (
                            <div
                                className="
                                    rounded-xl
                                    border
                                    border-amber-200
                                    bg-amber-50
                                    p-4
                                    text-sm
                                    text-amber-700
                                "
                            >
                                No active ownership
                                records found.
                            </div>
                        ) : (
                            ownerships.map(
                                ownership => (
                                    <div
                                        key={
                                            ownership
                                                .ownership_public_id
                                        }
                                        className="
                                            rounded-2xl
                                            border
                                            border-slate-200
                                            p-4
                                        "
                                    >
                                        <div
                                            className="
                                                flex
                                                flex-col
                                                gap-3
                                                sm:flex-row
                                                sm:items-start
                                                sm:justify-between
                                            "
                                        >
                                            <div>
                                                <div
                                                    className="
                                                        flex
                                                        flex-wrap
                                                        items-center
                                                        gap-2
                                                    "
                                                >
                                                    <div
                                                        className="
                                                            font-bold
                                                            text-slate-900
                                                        "
                                                    >
                                                        {ownership
                                                            .owner
                                                            ?.display_name ||
                                                            "Unnamed owner"}
                                                    </div>

                                                    {ownership.is_primary_contact && (
                                                        <span
                                                            className="
                                                                rounded-full
                                                                bg-blue-50
                                                                px-2
                                                                py-0.5
                                                                text-xs
                                                                font-semibold
                                                                text-blue-700
                                                            "
                                                        >
                                                            Primary
                                                        </span>
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
                                                        ownership
                                                            .owner
                                                            ?.owner_type
                                                    )}{" "}
                                                    ·{" "}
                                                    {formatLabel(
                                                        ownership
                                                            .ownership_type
                                                    )}
                                                </div>
                                            </div>

                                            <div
                                                className="
                                                    text-lg
                                                    font-bold
                                                    text-slate-950
                                                "
                                            >
                                                {Number(
                                                    ownership
                                                        .ownership_percentage ||
                                                        0
                                                ).toFixed(
                                                    2
                                                )}
                                                %
                                            </div>
                                        </div>

                                        <div
                                            className="
                                                mt-4
                                                space-y-2
                                                text-sm
                                                text-slate-600
                                            "
                                        >
                                            {ownership
                                                .owner
                                                ?.email && (
                                                <div
                                                    className="
                                                        flex
                                                        items-center
                                                        gap-2
                                                    "
                                                >
                                                    <Mail className="h-4 w-4 text-slate-400" />
                                                    {
                                                        ownership
                                                            .owner
                                                            .email
                                                    }
                                                </div>
                                            )}

                                            {ownership
                                                .owner
                                                ?.phone_number && (
                                                <div
                                                    className="
                                                        flex
                                                        items-center
                                                        gap-2
                                                    "
                                                >
                                                    <Phone className="h-4 w-4 text-slate-400" />
                                                    {
                                                        ownership
                                                            .owner
                                                            .phone_number
                                                    }
                                                </div>
                                            )}

                                            <div
                                                className="
                                                    flex
                                                    items-center
                                                    gap-2
                                                "
                                            >
                                                <CalendarDays className="h-4 w-4 text-slate-400" />
                                                Effective from{" "}
                                                {formatDate(
                                                    ownership.effective_from
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            )
                        )}
                    </div>

                    <div
                        className="
                            mt-5
                            rounded-xl
                            border
                            border-slate-200
                            bg-slate-50
                            p-4
                        "
                    >
                        <div
                            className="
                                flex
                                items-center
                                justify-between
                                gap-4
                                text-sm
                            "
                        >
                            <span className="text-slate-500">
                                Remaining ownership
                            </span>

                            <span className="font-bold text-slate-900">
                                {Number(
                                    ownershipSummary
                                        ?.remaining_ownership ||
                                        0
                                ).toFixed(
                                    2
                                )}
                                %
                            </span>
                        </div>

                        <div
                            className="
                                mt-2
                                flex
                                items-center
                                justify-between
                                gap-4
                                text-sm
                            "
                        >
                            <span className="text-slate-500">
                                Ownership complete
                            </span>

                            <span
                                className={
                                    ownershipSummary?.ownership_complete
                                        ? "font-semibold text-emerald-700"
                                        : "font-semibold text-amber-700"
                                }
                            >
                                {ownershipSummary?.ownership_complete
                                    ? "Yes"
                                    : "No"}
                            </span>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default PropertyDetailPage;

import {
    ArrowLeft,
    Building2,
    CalendarDays,
    Home,
    Mail,
    MapPin,
    Phone,
    RefreshCw,
    ShieldCheck,
    Users
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

                <button
                    type="button"
                    onClick={loadProperty}
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
                    "
                >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </button>
            </div>

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

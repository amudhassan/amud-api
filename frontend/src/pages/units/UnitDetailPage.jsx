import {
    ArrowLeft,
    Building2,
    CalendarDays,
    DoorOpen,
    Hash,
    Layers3,
    RefreshCw,
    Ruler,
    UserRound
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useState
} from "react";
import {
    useNavigate,
    useParams
} from "react-router-dom";

import apiClient from "../../api/apiClient";
import {
    ActionGroup,
    Button,
    IconButton
} from "../../components/ui/Button";

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to retrieve unit.";

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

function DetailItem({
    label,
    value
}) {
    return (
        <div
            className="
                rounded-xl
                border
                border-slate-200
                bg-slate-50/70
                px-4 py-3
            "
        >
            <p
                className="
                    text-xs
                    font-semibold
                    uppercase
                    tracking-wide
                    text-slate-400
                "
            >
                {label}
            </p>

            <p
                className="
                    mt-1.5
                    break-words
                    text-sm
                    font-medium
                    text-slate-800
                "
            >
                {value ?? "—"}
            </p>
        </div>
    );
}

function Section({
    icon: Icon,
    title,
    description,
    children
}) {
    return (
        <section
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
                    items-start
                    gap-3
                    border-b
                    border-slate-200
                    px-5 py-4
                "
            >
                <div
                    className="
                        flex h-10 w-10
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        bg-blue-50
                        text-blue-600
                    "
                >
                    <Icon className="h-5 w-5" />
                </div>

                <div>
                    <h2
                        className="
                            font-bold
                            text-slate-950
                        "
                    >
                        {title}
                    </h2>

                    {description && (
                        <p
                            className="
                                mt-1
                                text-sm
                                text-slate-500
                            "
                        >
                            {description}
                        </p>
                    )}
                </div>
            </div>

            <div className="p-5">
                {children}
            </div>
        </section>
    );
}

function UnitDetailPage() {
    const {
        unit_public_id
    } = useParams();

    const navigate = useNavigate();

    const [unit, setUnit] =
        useState(null);
    const [property, setProperty] =
        useState(null);
    const [createdBy, setCreatedBy] =
        useState(null);
    const [loading, setLoading] =
        useState(true);
    const [error, setError] =
        useState("");

    const loadUnit =
        useCallback(
            async () => {
                try {
                    setLoading(true);
                    setError("");

                    const response =
                        await apiClient.get(
                            `/units/${unit_public_id}`
                        );

                    const payload =
                        response?.data?.data ||
                        response?.data ||
                        {};

                    if (!payload.unit) {
                        throw new Error(
                            "Unit response did not contain unit data."
                        );
                    }

                    setUnit(payload.unit);
                    setProperty(
                        payload.property || null
                    );
                    setCreatedBy(
                        payload.created_by ||
                        null
                    );
                } catch (requestError) {
                    setUnit(null);
                    setProperty(null);
                    setCreatedBy(null);
                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            [unit_public_id]
        );

    useEffect(() => {
        loadUnit();
    }, [loadUnit]);

    if (loading) {
        return (
            <div
                className="
                    flex
                    min-h-[420px]
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
                Loading unit details...
            </div>
        );
    }

    if (error || !unit) {
        return (
            <div className="space-y-5">
                <Button
                    variant="secondary"
                    leftIcon={ArrowLeft}
                    onClick={() =>
                        navigate("/units")
                    }
                >
                    Back to Units
                </Button>

                <div
                    className="
                        rounded-2xl
                        border
                        border-rose-200
                        bg-rose-50
                        px-5 py-4
                        text-sm
                        text-rose-700
                    "
                >
                    {error ||
                        "Unit not found."}
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
                    xl:flex-row
                    xl:items-start
                    xl:justify-between
                "
            >
                <div>
                    <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={ArrowLeft}
                        onClick={() =>
                            navigate("/units")
                        }
                    >
                        Back to Units
                    </Button>

                    <div className="mt-4">
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
                                {unit.unit_name ||
                                    unit.unit_code}
                            </h1>

                            <span
                                className={`
                                    inline-flex
                                    rounded-full
                                    px-2.5 py-1
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
                        </div>

                        <p
                            className="
                                mt-2
                                text-sm
                                text-slate-500
                            "
                        >
                            {unit.unit_code}
                            {" · "}
                            {formatLabel(
                                unit.unit_type
                            )}
                        </p>
                    </div>
                </div>

                <ActionGroup>
                    <IconButton
                        label="Refresh unit details"
                        icon={RefreshCw}
                        onClick={loadUnit}
                    />
                </ActionGroup>
            </div>

            <div
                className="
                    grid
                    gap-4
                    md:grid-cols-2
                    xl:grid-cols-4
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
                    <Hash
                        className="
                            h-5 w-5
                            text-blue-600
                        "
                    />
                    <p
                        className="
                            mt-4
                            text-xs
                            font-semibold
                            uppercase
                            tracking-wide
                            text-slate-400
                        "
                    >
                        Unit Code
                    </p>
                    <p
                        className="
                            mt-1
                            font-bold
                            text-slate-950
                        "
                    >
                        {unit.unit_code}
                    </p>
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
                    <Layers3
                        className="
                            h-5 w-5
                            text-blue-600
                        "
                    />
                    <p
                        className="
                            mt-4
                            text-xs
                            font-semibold
                            uppercase
                            tracking-wide
                            text-slate-400
                        "
                    >
                        Floor
                    </p>
                    <p
                        className="
                            mt-1
                            font-bold
                            text-slate-950
                        "
                    >
                        {unit.floor_number ??
                            "—"}
                    </p>
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
                    <DoorOpen
                        className="
                            h-5 w-5
                            text-blue-600
                        "
                    />
                    <p
                        className="
                            mt-4
                            text-xs
                            font-semibold
                            uppercase
                            tracking-wide
                            text-slate-400
                        "
                    >
                        Layout
                    </p>
                    <p
                        className="
                            mt-1
                            font-bold
                            text-slate-950
                        "
                    >
                        {unit.bedrooms ?? 0}
                        {" bed · "}
                        {unit.bathrooms ?? 0}
                        {" bath"}
                    </p>
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
                    <Ruler
                        className="
                            h-5 w-5
                            text-blue-600
                        "
                    />
                    <p
                        className="
                            mt-4
                            text-xs
                            font-semibold
                            uppercase
                            tracking-wide
                            text-slate-400
                        "
                    >
                        Area
                    </p>
                    <p
                        className="
                            mt-1
                            font-bold
                            text-slate-950
                        "
                    >
                        {unit.area_size !==
                            null &&
                        unit.area_size !==
                            undefined
                            ? `${unit.area_size} ${formatLabel(
                                  unit.area_unit
                              )}`
                            : "—"}
                    </p>
                </div>
            </div>

            <Section
                icon={DoorOpen}
                title="Unit Information"
                description="Core identity and physical configuration."
            >
                <div
                    className="
                        grid
                        gap-4
                        md:grid-cols-2
                        xl:grid-cols-3
                    "
                >
                    <DetailItem
                        label="Public ID"
                        value={unit.public_id}
                    />
                    <DetailItem
                        label="Unit Code"
                        value={unit.unit_code}
                    />
                    <DetailItem
                        label="Unit Name"
                        value={
                            unit.unit_name ||
                            "—"
                        }
                    />
                    <DetailItem
                        label="Unit Type"
                        value={formatLabel(
                            unit.unit_type
                        )}
                    />
                    <DetailItem
                        label="Floor Number"
                        value={
                            unit.floor_number ??
                            "—"
                        }
                    />
                    <DetailItem
                        label="Operational Status"
                        value={formatLabel(
                            unit.operational_status
                        )}
                    />
                    <DetailItem
                        label="Bedrooms"
                        value={
                            unit.bedrooms ?? 0
                        }
                    />
                    <DetailItem
                        label="Bathrooms"
                        value={
                            unit.bathrooms ?? 0
                        }
                    />
                    <DetailItem
                        label="Area"
                        value={
                            unit.area_size !==
                                null &&
                            unit.area_size !==
                                undefined
                                ? `${unit.area_size} ${formatLabel(
                                      unit.area_unit
                                  )}`
                                : "—"
                        }
                    />
                </div>

                <div
                    className="
                        mt-4
                        rounded-xl
                        border
                        border-slate-200
                        bg-slate-50/70
                        px-4 py-3
                    "
                >
                    <p
                        className="
                            text-xs
                            font-semibold
                            uppercase
                            tracking-wide
                            text-slate-400
                        "
                    >
                        Description
                    </p>

                    <p
                        className="
                            mt-2
                            whitespace-pre-wrap
                            text-sm
                            leading-6
                            text-slate-700
                        "
                    >
                        {unit.description ||
                            "No description provided."}
                    </p>
                </div>
            </Section>

            <Section
                icon={Building2}
                title="Parent Property"
                description="Property relationship returned by the backend."
            >
                {property ? (
                    <div
                        className="
                            grid
                            gap-4
                            md:grid-cols-2
                            xl:grid-cols-3
                        "
                    >
                        <DetailItem
                            label="Property Name"
                            value={
                                property.property_name
                            }
                        />
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
                            label="Property Status"
                            value={formatLabel(
                                property.operational_status
                            )}
                        />
                        <DetailItem
                            label="Structure"
                            value={
                                property.is_multi_unit
                                    ? "Multi Unit"
                                    : "Single Unit"
                            }
                        />
                    </div>
                ) : (
                    <p
                        className="
                            text-sm
                            text-slate-500
                        "
                    >
                        Property details are not
                        available.
                    </p>
                )}
            </Section>

            <Section
                icon={CalendarDays}
                title="Record Information"
                description="Creation and latest update metadata."
            >
                <div
                    className="
                        grid
                        gap-4
                        md:grid-cols-2
                    "
                >
                    <DetailItem
                        label="Created At"
                        value={formatDateTime(
                            unit.created_at
                        )}
                    />
                    <DetailItem
                        label="Updated At"
                        value={formatDateTime(
                            unit.updated_at
                        )}
                    />
                </div>

                {createdBy && (
                    <div
                        className="
                            mt-4
                            flex
                            items-start
                            gap-3
                            rounded-xl
                            border
                            border-slate-200
                            bg-slate-50/70
                            px-4 py-3
                        "
                    >
                        <UserRound
                            className="
                                mt-0.5
                                h-5 w-5
                                shrink-0
                                text-slate-400
                            "
                        />

                        <div>
                            <p
                                className="
                                    text-xs
                                    font-semibold
                                    uppercase
                                    tracking-wide
                                    text-slate-400
                                "
                            >
                                Created By
                            </p>

                            <p
                                className="
                                    mt-1
                                    text-sm
                                    font-semibold
                                    text-slate-800
                                "
                            >
                                {createdBy.full_name}
                            </p>

                            <p
                                className="
                                    mt-0.5
                                    text-sm
                                    text-slate-500
                                "
                            >
                                {createdBy.email}
                            </p>
                        </div>
                    </div>
                )}
            </Section>
        </div>
    );
}

export default UnitDetailPage;

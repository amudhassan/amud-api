import {
    CalendarClock,
    Plus,
    RefreshCw,
    X
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

const CATEGORIES = [
    "plumbing",
    "electrical",
    "appliance",
    "structural",
    "roofing",
    "painting",
    "doors_windows",
    "security",
    "water_supply",
    "sanitation",
    "pest_control",
    "internet_communication",
    "cleaning",
    "common_area",
    "other"
];

const PRIORITIES = [
    "low",
    "medium",
    "high",
    "emergency"
];

const IMPACT_LEVELS = [
    "no_operational_impact",
    "partially_restricted",
    "uninhabitable"
];

const ACCESS_INSTRUCTIONS = [
    "contact_first",
    "tenant_must_be_present",
    "authorized_entry"
];

const FREQUENCIES = [
    "one_time",
    "weekly",
    "monthly",
    "quarterly",
    "semi_annual",
    "annual",
    "custom"
];

const emptyForm = () => ({
    owner_public_id: "",
    property_public_id: "",
    request_scope: "unit",
    unit_public_id: "",
    title: "",
    description: "",
    category: "",
    priority: "medium",
    impact_level: "no_operational_impact",
    location_details: "",
    access_instruction: "",
    frequency: "monthly",
    interval_value: "1",
    custom_interval_days: "",
    next_due_at: "",
    estimated_cost: "0",
    currency_code: "TZS"
});

const inputClassName = `
    mt-2 w-full rounded-xl
    border border-slate-300
    bg-white px-3 py-2.5
    text-sm text-slate-900
    outline-none transition
    placeholder:text-slate-400
    focus:border-blue-500
    focus:ring-2
    focus:ring-blue-100
    disabled:cursor-not-allowed
    disabled:bg-slate-100
    disabled:text-slate-500
`;

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to create preventive maintenance plan.";

const toIsoTimestamp = value => {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return null;
    }

    return parsed.toISOString();
};

const propertyRowsFrom = response =>
    Array.isArray(
        response?.data?.data?.properties
    )
        ? response.data.data.properties
        : [];

const unitRowsFrom = response => {
    const payload =
        response?.data?.data &&
        (
            response.data.data.units ||
            response.data.data.property
        )
            ? response.data.data
            : response?.data || {};

    return Array.isArray(
        payload.units
    )
        ? payload.units
        : [];
};

function FieldLabel({
    children,
    required = false
}) {
    return (
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {children}

            {required && (
                <span className="text-rose-500">
                    {" "}*
                </span>
            )}
        </span>
    );
}

function CreatePreventiveMaintenancePlanModal({
    open,
    isAdmin = false,
    onClose,
    onCreated
}) {
    const [
        form,
        setForm
    ] = useState(
        emptyForm
    );

    const [
        owners,
        setOwners
    ] = useState([]);

    const [
        properties,
        setProperties
    ] = useState([]);

    const [
        units,
        setUnits
    ] = useState([]);

    const [
        ownersLoading,
        setOwnersLoading
    ] = useState(false);

    const [
        propertiesLoading,
        setPropertiesLoading
    ] = useState(false);

    const [
        unitsLoading,
        setUnitsLoading
    ] = useState(false);

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const [
        selectorError,
        setSelectorError
    ] = useState("");

    const commonAreaMode =
        form.request_scope ===
        "property_common_area";

    const update = (
        field,
        value
    ) => {
        setForm(
            current => ({
                ...current,
                [field]: value
            })
        );

        if (error) {
            setError("");
        }
    };

    const loadOwners =
        useCallback(
            async () => {
                if (!open) {
                    return;
                }

                try {
                    setOwnersLoading(true);
                    setSelectorError("");

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
                        Array.isArray(
                            response?.data?.data
                        )
                            ? response.data.data
                            : [];

                    setOwners(
                        rows.filter(
                            owner =>
                                owner.status ===
                                    "active" &&
                                owner
                                    .can_manage_properties !==
                                    false
                        )
                    );
                } catch (
                    requestError
                ) {
                    setOwners([]);
                    setSelectorError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setOwnersLoading(false);
                }
            },
            [open]
        );

    const loadProperties =
        useCallback(
            async ownerPublicId => {
                if (
                    !open ||
                    !ownerPublicId
                ) {
                    setProperties([]);
                    return;
                }

                try {
                    setPropertiesLoading(true);
                    setSelectorError("");

                    const response =
                        await apiClient.get(
                            "/properties",
                            {
                                params: {
                                    owner_public_id:
                                        ownerPublicId,
                                    operational_status:
                                        "active",
                                    page: 1,
                                    limit: 100
                                }
                            }
                        );

                    setProperties(
                        propertyRowsFrom(
                            response
                        )
                    );
                } catch (
                    requestError
                ) {
                    setProperties([]);
                    setSelectorError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setPropertiesLoading(false);
                }
            },
            [open]
        );

    const loadUnits =
        useCallback(
            async propertyPublicId => {
                if (
                    !open ||
                    !propertyPublicId
                ) {
                    setUnits([]);
                    return;
                }

                try {
                    setUnitsLoading(true);
                    setSelectorError("");

                    const response =
                        await apiClient.get(
                            `/properties/${encodeURIComponent(
                                propertyPublicId
                            )}/units`,
                            {
                                params: {
                                    page: 1,
                                    limit: 100
                                }
                            }
                        );

                    setUnits(
                        unitRowsFrom(
                            response
                        )
                    );
                } catch (
                    requestError
                ) {
                    setUnits([]);
                    setSelectorError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setUnitsLoading(false);
                }
            },
            [open]
        );

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(
            emptyForm()
        );
        setOwners([]);
        setProperties([]);
        setUnits([]);
        setError("");
        setSelectorError("");
        setSubmitting(false);

        loadOwners();
    }, [
        loadOwners,
        open
    ]);

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(
            current => ({
                ...current,
                property_public_id: "",
                unit_public_id: ""
            })
        );
        setProperties([]);
        setUnits([]);

        if (
            form.owner_public_id
        ) {
            loadProperties(
                form.owner_public_id
            );
        }
    }, [
        form.owner_public_id,
        loadProperties,
        open
    ]);

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(
            current => ({
                ...current,
                unit_public_id: ""
            })
        );
        setUnits([]);

        if (
            form.property_public_id &&
            form.request_scope ===
                "unit"
        ) {
            loadUnits(
                form.property_public_id
            );
        }
    }, [
        form.property_public_id,
        form.request_scope,
        loadUnits,
        open
    ]);

    useEffect(() => {
        if (
            form.request_scope ===
            "property_common_area"
        ) {
            setForm(
                current => ({
                    ...current,
                    unit_public_id: ""
                })
            );
            setUnits([]);
        }
    }, [
        form.request_scope
    ]);

    useEffect(() => {
        if (
            form.frequency ===
            "one_time"
        ) {
            setForm(
                current => ({
                    ...current,
                    interval_value: "1",
                    custom_interval_days: ""
                })
            );
            return;
        }

        if (
            form.frequency !==
            "custom"
        ) {
            setForm(
                current => ({
                    ...current,
                    custom_interval_days: ""
                })
            );
        }
    }, [
        form.frequency
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown =
            event => {
                if (
                    event.key ===
                        "Escape" &&
                    !submitting
                ) {
                    onClose();
                }
            };

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () =>
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
    }, [
        onClose,
        open,
        submitting
    ]);

    if (!open) {
        return null;
    }

    const validate = () => {
        if (!form.owner_public_id) {
            return "Select an owner.";
        }

        if (!form.property_public_id) {
            return "Select a property.";
        }

        if (
            form.request_scope ===
                "unit" &&
            !form.unit_public_id
        ) {
            return "Select a unit.";
        }

        if (
            commonAreaMode &&
            !form.location_details.trim()
        ) {
            return "Location details are required for a property common-area plan.";
        }

        if (
            form.title.trim().length < 3 ||
            form.title.trim().length > 255
        ) {
            return "Title must contain between 3 and 255 characters.";
        }

        if (
            form.description.trim().length < 10 ||
            form.description.trim().length > 5000
        ) {
            return "Description must contain between 10 and 5000 characters.";
        }

        if (!form.category) {
            return "Maintenance category is required.";
        }

        const interval =
            Number(
                form.interval_value
            );

        if (
            !Number.isInteger(interval) ||
            interval < 1
        ) {
            return "Interval value must be a positive whole number.";
        }

        if (
            form.frequency ===
            "one_time" &&
            interval !== 1
        ) {
            return "One-time plans must use interval 1.";
        }

        if (
            form.frequency ===
            "custom"
        ) {
            const customDays =
                Number(
                    form.custom_interval_days
                );

            if (
                !Number.isInteger(
                    customDays
                ) ||
                customDays < 1
            ) {
                return "Custom interval days must be a positive whole number.";
            }
        }

        const nextDueAt =
            toIsoTimestamp(
                form.next_due_at
            );

        if (!nextDueAt) {
            return "Next due date and time is required.";
        }

        if (
            new Date(
                nextDueAt
            ).getTime() <=
                Date.now()
        ) {
            return "Next due date and time must be in the future.";
        }

        const estimatedCost =
            Number(
                form.estimated_cost
            );

        if (
            !Number.isFinite(
                estimatedCost
            ) ||
            estimatedCost < 0
        ) {
            return "Estimated cost must be zero or greater.";
        }

        if (
            !/^[A-Z]{3}$/.test(
                form.currency_code.trim()
            )
        ) {
            return "Currency code must contain exactly three uppercase letters.";
        }

        return "";
    };

    const submit =
        async event => {
            event.preventDefault();

            const validationError =
                validate();

            if (validationError) {
                setError(
                    validationError
                );
                return;
            }

            const payload = {
                owner_public_id:
                    form.owner_public_id,
                property_public_id:
                    form.property_public_id,
                request_scope:
                    form.request_scope,
                title:
                    form.title.trim(),
                description:
                    form.description.trim(),
                category:
                    form.category,
                priority:
                    form.priority,
                impact_level:
                    form.impact_level,
                frequency:
                    form.frequency,
                interval_value:
                    Number(
                        form.interval_value
                    ),
                next_due_at:
                    toIsoTimestamp(
                        form.next_due_at
                    ),
                estimated_cost:
                    Number(
                        form.estimated_cost
                    ),
                currency_code:
                    form.currency_code
                        .trim()
                        .toUpperCase()
            };

            if (
                form.request_scope ===
                "unit"
            ) {
                payload.unit_public_id =
                    form.unit_public_id;
            }

            const locationDetails =
                form.location_details
                    .trim();

            if (locationDetails) {
                payload.location_details =
                    locationDetails;
            }

            if (
                form.access_instruction
            ) {
                payload.access_instruction =
                    form.access_instruction;
            }

            if (
                form.frequency ===
                "custom"
            ) {
                payload.custom_interval_days =
                    Number(
                        form.custom_interval_days
                    );
            }

            const params = {};

            if (!isAdmin) {
                params.access_context =
                    "owner";
            }

            try {
                setSubmitting(true);
                setError("");

                const response =
                    await apiClient.post(
                        "/maintenance/preventive-plans",
                        payload,
                        {
                            params
                        }
                    );

                const createdPlan =
                    response?.data?.data
                        ?.preventive_maintenance_plan ||
                    response?.data?.data
                        ?.preventive_plan ||
                    null;

                onCreated(
                    createdPlan
                );
            } catch (
                requestError
            ) {
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setSubmitting(false);
            }
        };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                            <CalendarClock className="h-5 w-5" />
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-slate-950">
                                Create Preventive Maintenance Plan
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Create a one-time or recurring maintenance schedule.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={submitting}
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form
                    onSubmit={submit}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                        {(error || selectorError) && (
                            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                                {error || selectorError}
                            </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block">
                                <FieldLabel required>
                                    Owner
                                </FieldLabel>

                                <select
                                    value={form.owner_public_id}
                                    onChange={event =>
                                        update(
                                            "owner_public_id",
                                            event.target.value
                                        )
                                    }
                                    disabled={ownersLoading}
                                    className={inputClassName}
                                >
                                    <option value="">
                                        {ownersLoading
                                            ? "Loading owners..."
                                            : "Select owner"}
                                    </option>

                                    {owners.map(owner => (
                                        <option
                                            key={owner.public_id}
                                            value={owner.public_id}
                                        >
                                            {owner.display_name ||
                                                owner.owner_name ||
                                                owner.public_id}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block">
                                <FieldLabel required>
                                    Property
                                </FieldLabel>

                                <select
                                    value={form.property_public_id}
                                    onChange={event =>
                                        update(
                                            "property_public_id",
                                            event.target.value
                                        )
                                    }
                                    disabled={
                                        !form.owner_public_id ||
                                        propertiesLoading
                                    }
                                    className={inputClassName}
                                >
                                    <option value="">
                                        {propertiesLoading
                                            ? "Loading properties..."
                                            : "Select property"}
                                    </option>

                                    {properties.map(property => (
                                        <option
                                            key={property.public_id}
                                            value={property.public_id}
                                        >
                                            {property.property_name ||
                                                property.property_code ||
                                                property.public_id}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block">
                                <FieldLabel required>
                                    Scope
                                </FieldLabel>

                                <select
                                    value={form.request_scope}
                                    onChange={event =>
                                        update(
                                            "request_scope",
                                            event.target.value
                                        )
                                    }
                                    className={inputClassName}
                                >
                                    <option value="unit">
                                        Unit
                                    </option>
                                    <option value="property_common_area">
                                        Property Common Area
                                    </option>
                                </select>
                            </label>

                            {!commonAreaMode && (
                                <label className="block">
                                    <FieldLabel required>
                                        Unit
                                    </FieldLabel>

                                    <select
                                        value={form.unit_public_id}
                                        onChange={event =>
                                            update(
                                                "unit_public_id",
                                                event.target.value
                                            )
                                        }
                                        disabled={
                                            !form.property_public_id ||
                                            unitsLoading
                                        }
                                        className={inputClassName}
                                    >
                                        <option value="">
                                            {unitsLoading
                                                ? "Loading units..."
                                                : "Select unit"}
                                        </option>

                                        {units.map(unit => (
                                            <option
                                                key={unit.public_id}
                                                value={unit.public_id}
                                            >
                                                {unit.unit_name ||
                                                    unit.unit_code ||
                                                    unit.public_id}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            <label className="block md:col-span-2">
                                <FieldLabel required>
                                    Title
                                </FieldLabel>

                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={event =>
                                        update(
                                            "title",
                                            event.target.value
                                        )
                                    }
                                    maxLength={255}
                                    placeholder="Example: Monthly water pump inspection"
                                    className={inputClassName}
                                />
                            </label>

                            <label className="block md:col-span-2">
                                <FieldLabel required>
                                    Description
                                </FieldLabel>

                                <textarea
                                    value={form.description}
                                    onChange={event =>
                                        update(
                                            "description",
                                            event.target.value
                                        )
                                    }
                                    maxLength={5000}
                                    rows={4}
                                    placeholder="Describe the preventive work that should be performed."
                                    className={inputClassName}
                                />
                            </label>

                            <label className="block">
                                <FieldLabel required>
                                    Category
                                </FieldLabel>

                                <select
                                    value={form.category}
                                    onChange={event =>
                                        update(
                                            "category",
                                            event.target.value
                                        )
                                    }
                                    className={inputClassName}
                                >
                                    <option value="">
                                        Select category
                                    </option>

                                    {CATEGORIES.map(value => (
                                        <option
                                            key={value}
                                            value={value}
                                        >
                                            {formatLabel(value)}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block">
                                <FieldLabel required>
                                    Priority
                                </FieldLabel>

                                <select
                                    value={form.priority}
                                    onChange={event =>
                                        update(
                                            "priority",
                                            event.target.value
                                        )
                                    }
                                    className={inputClassName}
                                >
                                    {PRIORITIES.map(value => (
                                        <option
                                            key={value}
                                            value={value}
                                        >
                                            {formatLabel(value)}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block">
                                <FieldLabel required>
                                    Impact Level
                                </FieldLabel>

                                <select
                                    value={form.impact_level}
                                    onChange={event =>
                                        update(
                                            "impact_level",
                                            event.target.value
                                        )
                                    }
                                    className={inputClassName}
                                >
                                    {IMPACT_LEVELS.map(value => (
                                        <option
                                            key={value}
                                            value={value}
                                        >
                                            {formatLabel(value)}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block">
                                <FieldLabel>
                                    Access Instruction
                                </FieldLabel>

                                <select
                                    value={form.access_instruction}
                                    onChange={event =>
                                        update(
                                            "access_instruction",
                                            event.target.value
                                        )
                                    }
                                    className={inputClassName}
                                >
                                    <option value="">
                                        No default instruction
                                    </option>

                                    {ACCESS_INSTRUCTIONS.map(value => (
                                        <option
                                            key={value}
                                            value={value}
                                        >
                                            {formatLabel(value)}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block md:col-span-2">
                                <FieldLabel required={commonAreaMode}>
                                    Location Details
                                </FieldLabel>

                                <input
                                    type="text"
                                    value={form.location_details}
                                    onChange={event =>
                                        update(
                                            "location_details",
                                            event.target.value
                                        )
                                    }
                                    maxLength={500}
                                    placeholder={
                                        commonAreaMode
                                            ? "Example: Main water tank area"
                                            : "Optional location details"
                                    }
                                    className={inputClassName}
                                />
                            </label>

                            <div className="md:col-span-2 mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                <div className="flex items-center gap-2 text-emerald-800">
                                    <CalendarClock className="h-4 w-4" />
                                    <p className="text-sm font-semibold">
                                        Recurrence Schedule
                                    </p>
                                </div>
                            </div>

                            <label className="block">
                                <FieldLabel required>
                                    Frequency
                                </FieldLabel>

                                <select
                                    value={form.frequency}
                                    onChange={event =>
                                        update(
                                            "frequency",
                                            event.target.value
                                        )
                                    }
                                    className={inputClassName}
                                >
                                    {FREQUENCIES.map(value => (
                                        <option
                                            key={value}
                                            value={value}
                                        >
                                            {formatLabel(value)}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block">
                                <FieldLabel required>
                                    Interval Value
                                </FieldLabel>

                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={form.interval_value}
                                    disabled={
                                        form.frequency ===
                                        "one_time"
                                    }
                                    onChange={event =>
                                        update(
                                            "interval_value",
                                            event.target.value
                                        )
                                    }
                                    className={inputClassName}
                                />
                            </label>

                            {form.frequency ===
                                "custom" && (
                                <label className="block">
                                    <FieldLabel required>
                                        Custom Interval Days
                                    </FieldLabel>

                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={form.custom_interval_days}
                                        onChange={event =>
                                            update(
                                                "custom_interval_days",
                                                event.target.value
                                            )
                                        }
                                        className={inputClassName}
                                    />
                                </label>
                            )}

                            <label className="block">
                                <FieldLabel required>
                                    Next Due At
                                </FieldLabel>

                                <input
                                    type="datetime-local"
                                    value={form.next_due_at}
                                    onChange={event =>
                                        update(
                                            "next_due_at",
                                            event.target.value
                                        )
                                    }
                                    className={inputClassName}
                                />
                            </label>

                            <label className="block">
                                <FieldLabel required>
                                    Estimated Cost
                                </FieldLabel>

                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.estimated_cost}
                                    onChange={event =>
                                        update(
                                            "estimated_cost",
                                            event.target.value
                                        )
                                    }
                                    className={inputClassName}
                                />
                            </label>

                            <label className="block">
                                <FieldLabel required>
                                    Currency
                                </FieldLabel>

                                <input
                                    type="text"
                                    value={form.currency_code}
                                    onChange={event =>
                                        update(
                                            "currency_code",
                                            event.target.value
                                                .toUpperCase()
                                        )
                                    }
                                    maxLength={3}
                                    className={inputClassName}
                                />
                            </label>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={RefreshCw}
                            disabled={submitting}
                            onClick={() => {
                                setForm(
                                    emptyForm()
                                );
                                setProperties([]);
                                setUnits([]);
                                setError("");
                                setSelectorError("");
                                loadOwners();
                            }}
                        >
                            Reset
                        </Button>

                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={submitting}
                                onClick={onClose}
                            >
                                Cancel
                            </Button>

                            <Button
                                type="submit"
                                leftIcon={Plus}
                                disabled={submitting}
                            >
                                {submitting
                                    ? "Creating..."
                                    : "Create Plan"}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreatePreventiveMaintenancePlanModal;

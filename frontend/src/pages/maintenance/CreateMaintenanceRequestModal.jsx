import {
    Plus,
    RefreshCw,
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
    Button
} from "../../components/ui/Button";

const MAINTENANCE_CATEGORIES = [
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

const emptyForm = () => ({
    owner_public_id: "",
    property_public_id: "",
    request_scope: "unit",
    unit_public_id: "",
    lease_public_id: "",
    title: "",
    description: "",
    category: "",
    priority: "medium",
    impact_level:
        "no_operational_impact",
    location_details: "",
    problem_started_at: "",
    preferred_visit_at: "",
    access_instruction: "",
    currency_code: ""
});

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
    "Unable to complete maintenance request setup.";

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

const toIsoTimestamp = value => {
    if (!value) {
        return null;
    }

    const parsed =
        new Date(value);

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

const leaseRowsFrom = response =>
    Array.isArray(
        response?.data?.data?.leases
    )
        ? response.data.data.leases
        : [];

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

function LoadingHint({
    loading,
    emptyText
}) {
    if (loading) {
        return (
            <p className="mt-1 text-xs text-blue-600">
                Loading options...
            </p>
        );
    }

    if (emptyText) {
        return (
            <p className="mt-1 text-xs text-slate-500">
                {emptyText}
            </p>
        );
    }

    return null;
}

function CreateMaintenanceRequestModal({
    open,
    submissionContext = "owner",
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

    const [
        owners,
        setOwners
    ] = useState([]);

    const [
        ownersLoading,
        setOwnersLoading
    ] = useState(false);

    const [
        properties,
        setProperties
    ] = useState([]);

    const [
        propertiesLoading,
        setPropertiesLoading
    ] = useState(false);

    const [
        units,
        setUnits
    ] = useState([]);

    const [
        unitsLoading,
        setUnitsLoading
    ] = useState(false);

    const [
        leases,
        setLeases
    ] = useState([]);

    const [
        leasesLoading,
        setLeasesLoading
    ] = useState(false);

    const tenantMode =
        submissionContext ===
        "tenant";

    const commonAreaMode =
        !tenantMode &&
        form.request_scope ===
            "property_common_area";

    const selectedLease =
        useMemo(
            () =>
                leases.find(
                    lease =>
                        lease.public_id ===
                        form.lease_public_id
                ) || null,
            [
                leases,
                form.lease_public_id
            ]
        );

    const contextLabel =
        tenantMode
            ? "Tenant"
            : "Owner";

    const clearError = () => {
        if (error) {
            setError("");
        }
    };

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

        clearError();
    };

    const loadOwners =
        useCallback(
            async () => {
                if (
                    !open ||
                    tenantMode
                ) {
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
                                    status:
                                        "active",
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
            [
                open,
                tenantMode
            ]
        );

    const loadProperties =
        useCallback(
            async ownerPublicId => {
                if (
                    !open ||
                    tenantMode ||
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
            [
                open,
                tenantMode
            ]
        );

    const loadUnits =
        useCallback(
            async propertyPublicId => {
                if (
                    !open ||
                    tenantMode ||
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
            [
                open,
                tenantMode
            ]
        );

    const loadOwnerLeases =
        useCallback(
            async ({
                ownerPublicId,
                propertyPublicId,
                unitPublicId
            }) => {
                if (
                    !open ||
                    tenantMode ||
                    !ownerPublicId ||
                    !propertyPublicId ||
                    !unitPublicId
                ) {
                    setLeases([]);
                    return;
                }

                try {
                    setLeasesLoading(true);
                    setSelectorError("");

                    const response =
                        await apiClient.get(
                            "/leases",
                            {
                                params: {
                                    status:
                                        "active",
                                    owner_public_id:
                                        ownerPublicId,
                                    property_public_id:
                                        propertyPublicId,
                                    unit_public_id:
                                        unitPublicId,
                                    page: 1,
                                    limit: 100
                                }
                            }
                        );

                    setLeases(
                        leaseRowsFrom(
                            response
                        )
                    );
                } catch (
                    requestError
                ) {
                    setLeases([]);

                    setSelectorError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLeasesLoading(false);
                }
            },
            [
                open,
                tenantMode
            ]
        );

    const loadTenantLeases =
        useCallback(
            async () => {
                if (
                    !open ||
                    !tenantMode
                ) {
                    return;
                }

                try {
                    setLeasesLoading(true);
                    setSelectorError("");

                    const response =
                        await apiClient.get(
                            "/leases",
                            {
                                params: {
                                    status:
                                        "active",
                                    page: 1,
                                    limit: 100
                                }
                            }
                        );

                    setLeases(
                        leaseRowsFrom(
                            response
                        )
                    );
                } catch (
                    requestError
                ) {
                    setLeases([]);

                    setSelectorError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLeasesLoading(false);
                }
            },
            [
                open,
                tenantMode
            ]
        );

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(
            emptyForm()
        );
        setError("");
        setSelectorError("");
        setSubmitting(false);

        setOwners([]);
        setProperties([]);
        setUnits([]);
        setLeases([]);
    }, [
        open,
        submissionContext
    ]);

    useEffect(() => {
        if (
            !open
        ) {
            return;
        }

        if (tenantMode) {
            loadTenantLeases();
            return;
        }

        loadOwners();
    }, [
        loadOwners,
        loadTenantLeases,
        open,
        tenantMode
    ]);

    useEffect(() => {
        if (
            !open ||
            tenantMode
        ) {
            return;
        }

        setForm(
            current => ({
                ...current,
                property_public_id: "",
                unit_public_id: "",
                lease_public_id: "",
                currency_code: ""
            })
        );

        setProperties([]);
        setUnits([]);
        setLeases([]);

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
        open,
        tenantMode
    ]);

    useEffect(() => {
        if (
            !open ||
            tenantMode
        ) {
            return;
        }

        setForm(
            current => ({
                ...current,
                unit_public_id: "",
                lease_public_id: "",
                currency_code: ""
            })
        );

        setUnits([]);
        setLeases([]);

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
        open,
        tenantMode
    ]);

    useEffect(() => {
        if (
            !open ||
            tenantMode ||
            commonAreaMode
        ) {
            return;
        }

        setForm(
            current => ({
                ...current,
                lease_public_id: "",
                currency_code: ""
            })
        );

        setLeases([]);

        if (
            form.owner_public_id &&
            form.property_public_id &&
            form.unit_public_id
        ) {
            loadOwnerLeases({
                ownerPublicId:
                    form.owner_public_id,
                propertyPublicId:
                    form.property_public_id,
                unitPublicId:
                    form.unit_public_id
            });
        }
    }, [
        commonAreaMode,
        form.owner_public_id,
        form.property_public_id,
        form.unit_public_id,
        loadOwnerLeases,
        open,
        tenantMode
    ]);

    useEffect(() => {
        if (
            form.request_scope !==
            "property_common_area"
        ) {
            return;
        }

        setForm(
            current => ({
                ...current,
                unit_public_id: "",
                lease_public_id: ""
            })
        );

        setUnits([]);
        setLeases([]);
    }, [
        form.request_scope
    ]);

    useEffect(() => {
        if (!selectedLease) {
            return;
        }

        if (
            tenantMode
        ) {
            return;
        }

        if (
            selectedLease.currency_code
        ) {
            setForm(
                current => ({
                    ...current,
                    currency_code:
                        selectedLease.currency_code
                })
            );
        }
    }, [
        selectedLease,
        tenantMode
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
        const title =
            form.title.trim();

        const description =
            form.description.trim();

        if (
            title.length < 3 ||
            title.length > 255
        ) {
            return "Title must contain between 3 and 255 characters.";
        }

        if (
            description.length < 10 ||
            description.length > 5000
        ) {
            return "Description must contain between 10 and 5000 characters.";
        }

        if (!form.category) {
            return "Maintenance category is required.";
        }

        if (tenantMode) {
            if (
                !form.lease_public_id
            ) {
                return "Select an active lease for the maintenance request.";
            }
        } else {
            if (
                !form.owner_public_id
            ) {
                return "Select an owner.";
            }

            if (
                !form.property_public_id
            ) {
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
                !form.location_details
                    .trim()
            ) {
                return "Location details are required for property common-area requests.";
            }
        }

        if (
            form.currency_code &&
            !/^[A-Z]{3}$/.test(
                form.currency_code
            )
        ) {
            return "Currency code must contain exactly three uppercase letters.";
        }

        const problemStartedAt =
            toIsoTimestamp(
                form.problem_started_at
            );

        if (
            form.problem_started_at &&
            !problemStartedAt
        ) {
            return "Problem start date and time is invalid.";
        }

        if (
            problemStartedAt &&
            new Date(
                problemStartedAt
            ).getTime() >
                Date.now()
        ) {
            return "Problem start date and time cannot be in the future.";
        }

        const preferredVisitAt =
            toIsoTimestamp(
                form.preferred_visit_at
            );

        if (
            form.preferred_visit_at &&
            !preferredVisitAt
        ) {
            return "Preferred visit date and time is invalid.";
        }

        if (
            preferredVisitAt &&
            new Date(
                preferredVisitAt
            ).getTime() <=
                Date.now()
        ) {
            return "Preferred visit date and time must be in the future.";
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
                submission_context:
                    submissionContext,
                title:
                    form.title.trim(),
                description:
                    form.description.trim(),
                category:
                    form.category,
                priority:
                    form.priority,
                impact_level:
                    form.impact_level
            };

            if (tenantMode) {
                payload.lease_public_id =
                    form.lease_public_id;
            } else {
                payload.owner_public_id =
                    form.owner_public_id;

                payload.property_public_id =
                    form.property_public_id;

                payload.request_scope =
                    form.request_scope;

                if (
                    form.request_scope ===
                    "unit"
                ) {
                    payload.unit_public_id =
                        form.unit_public_id;

                    if (
                        form.lease_public_id
                    ) {
                        payload.lease_public_id =
                            form.lease_public_id;
                    }
                }

                if (
                    form.currency_code
                ) {
                    payload.currency_code =
                        form.currency_code;
                }
            }

            const locationDetails =
                form.location_details
                    .trim();

            if (locationDetails) {
                payload.location_details =
                    locationDetails;
            }

            const problemStartedAt =
                toIsoTimestamp(
                    form.problem_started_at
                );

            if (problemStartedAt) {
                payload.problem_started_at =
                    problemStartedAt;
            }

            const preferredVisitAt =
                toIsoTimestamp(
                    form.preferred_visit_at
                );

            if (preferredVisitAt) {
                payload.preferred_visit_at =
                    preferredVisitAt;
            }

            if (
                form.access_instruction
            ) {
                payload.access_instruction =
                    form.access_instruction;
            }

            try {
                setSubmitting(true);
                setError("");

                const response =
                    await apiClient.post(
                        "/maintenance/requests",
                        payload
                    );

                const createdRequest =
                    response?.data
                        ?.data
                        ?.maintenance_request;

                onCreated(
                    createdRequest ||
                    null
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-950">
                            New Maintenance Request
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            {contextLabel} submission context
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close create maintenance request"
                        disabled={submitting}
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                    <div className="space-y-6">
                        {error && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {error}
                            </div>
                        )}

                        {selectorError && (
                            <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                <span>
                                    {selectorError}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (tenantMode) {
                                            loadTenantLeases();
                                        } else {
                                            loadOwners();
                                        }
                                    }}
                                    className="inline-flex shrink-0 items-center gap-1 font-semibold text-amber-900 hover:underline"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Retry
                                </button>
                            </div>
                        )}

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                            Select records from the authorized options below. Public IDs are submitted to the backend automatically.
                        </div>

                        {tenantMode ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <label className="block">
                                    <FieldLabel required>
                                        Active Lease
                                    </FieldLabel>

                                    <select
                                        value={
                                            form.lease_public_id
                                        }
                                        disabled={
                                            leasesLoading
                                        }
                                        onChange={
                                            event =>
                                                update(
                                                    "lease_public_id",
                                                    event
                                                        .target
                                                        .value
                                                )
                                        }
                                        className={
                                            inputClassName
                                        }
                                    >
                                        <option value="">
                                            {leasesLoading
                                                ? "Loading active leases..."
                                                : "Select active lease"}
                                        </option>

                                        {leases.map(
                                            lease => (
                                                <option
                                                    key={
                                                        lease.public_id
                                                    }
                                                    value={
                                                        lease.public_id
                                                    }
                                                >
                                                    {[
                                                        lease.lease_number,
                                                        lease.property
                                                            ?.property_name ||
                                                            lease.property
                                                                ?.property_code,
                                                        lease.unit
                                                            ?.unit_name ||
                                                            lease.unit
                                                                ?.unit_code
                                                    ]
                                                        .filter(Boolean)
                                                        .join(
                                                            " — "
                                                        )}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </label>

                                <LoadingHint
                                    loading={
                                        leasesLoading
                                    }
                                    emptyText={
                                        !leasesLoading &&
                                        leases.length ===
                                            0
                                            ? "No active lease is available to this account."
                                            : ""
                                    }
                                />

                                {selectedLease && (
                                    <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                                        <span className="font-semibold">
                                            Selected:
                                        </span>{" "}
                                        {selectedLease
                                            .property
                                            ?.property_name ||
                                            selectedLease
                                                .property
                                                ?.property_code ||
                                            "Property"}{" "}
                                        /{" "}
                                        {selectedLease
                                            .unit
                                            ?.unit_name ||
                                            selectedLease
                                                .unit
                                                ?.unit_code ||
                                            "Unit"}
                                        {selectedLease
                                            .currency_code
                                            ? ` • ${selectedLease.currency_code}`
                                            : ""}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className="block">
                                        <FieldLabel required>
                                            Owner
                                        </FieldLabel>

                                        <select
                                            value={
                                                form.owner_public_id
                                            }
                                            disabled={
                                                ownersLoading
                                            }
                                            onChange={
                                                event =>
                                                    update(
                                                        "owner_public_id",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                            }
                                            className={
                                                inputClassName
                                            }
                                        >
                                            <option value="">
                                                {ownersLoading
                                                    ? "Loading owners..."
                                                    : "Select owner"}
                                            </option>

                                            {owners.map(
                                                owner => (
                                                    <option
                                                        key={
                                                            owner.public_id
                                                        }
                                                        value={
                                                            owner.public_id
                                                        }
                                                    >
                                                        {owner.display_name}
                                                        {owner.owner_type
                                                            ? ` — ${formatLabel(
                                                                  owner.owner_type
                                                              )}`
                                                            : ""}
                                                    </option>
                                                )
                                            )}
                                        </select>

                                        <LoadingHint
                                            loading={
                                                ownersLoading
                                            }
                                            emptyText={
                                                !ownersLoading &&
                                                owners.length ===
                                                    0
                                                    ? "No active authorized owner is available."
                                                    : ""
                                            }
                                        />
                                    </label>

                                    <label className="block">
                                        <FieldLabel required>
                                            Property
                                        </FieldLabel>

                                        <select
                                            value={
                                                form.property_public_id
                                            }
                                            disabled={
                                                !form.owner_public_id ||
                                                propertiesLoading
                                            }
                                            onChange={
                                                event =>
                                                    update(
                                                        "property_public_id",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                            }
                                            className={
                                                inputClassName
                                            }
                                        >
                                            <option value="">
                                                {!form.owner_public_id
                                                    ? "Select owner first"
                                                    : propertiesLoading
                                                      ? "Loading properties..."
                                                      : "Select property"}
                                            </option>

                                            {properties.map(
                                                property => (
                                                    <option
                                                        key={
                                                            property.public_id
                                                        }
                                                        value={
                                                            property.public_id
                                                        }
                                                    >
                                                        {property.property_name ||
                                                            property.property_code}
                                                        {property.property_code &&
                                                        property.property_name
                                                            ? ` (${property.property_code})`
                                                            : ""}
                                                    </option>
                                                )
                                            )}
                                        </select>

                                        <LoadingHint
                                            loading={
                                                propertiesLoading
                                            }
                                            emptyText={
                                                form.owner_public_id &&
                                                !propertiesLoading &&
                                                properties.length ===
                                                    0
                                                    ? "No active property is available for the selected owner."
                                                    : ""
                                            }
                                        />
                                    </label>

                                    <label className="block">
                                        <FieldLabel required>
                                            Request Scope
                                        </FieldLabel>

                                        <select
                                            value={
                                                form.request_scope
                                            }
                                            onChange={
                                                event =>
                                                    update(
                                                        "request_scope",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                            }
                                            className={
                                                inputClassName
                                            }
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
                                                value={
                                                    form.unit_public_id
                                                }
                                                disabled={
                                                    !form.property_public_id ||
                                                    unitsLoading
                                                }
                                                onChange={
                                                    event =>
                                                        update(
                                                            "unit_public_id",
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                }
                                                className={
                                                    inputClassName
                                                }
                                            >
                                                <option value="">
                                                    {!form.property_public_id
                                                        ? "Select property first"
                                                        : unitsLoading
                                                          ? "Loading units..."
                                                          : "Select unit"}
                                                </option>

                                                {units.map(
                                                    unit => (
                                                        <option
                                                            key={
                                                                unit.public_id
                                                            }
                                                            value={
                                                                unit.public_id
                                                            }
                                                        >
                                                            {unit.unit_name ||
                                                                unit.unit_code ||
                                                                unit.public_id}
                                                            {unit.unit_code &&
                                                            unit.unit_name
                                                                ? ` (${unit.unit_code})`
                                                                : ""}
                                                            {unit.operational_status
                                                                ? ` — ${formatLabel(
                                                                      unit.operational_status
                                                                  )}`
                                                                : ""}
                                                        </option>
                                                    )
                                                )}
                                            </select>

                                            <LoadingHint
                                                loading={
                                                    unitsLoading
                                                }
                                                emptyText={
                                                    form.property_public_id &&
                                                    !unitsLoading &&
                                                    units.length ===
                                                        0
                                                        ? "No current units are available under the selected property."
                                                        : ""
                                                }
                                            />
                                        </label>
                                    )}

                                    {!commonAreaMode && (
                                        <label className="block">
                                            <FieldLabel>
                                                Active Lease
                                            </FieldLabel>

                                            <select
                                                value={
                                                    form.lease_public_id
                                                }
                                                disabled={
                                                    !form.unit_public_id ||
                                                    leasesLoading
                                                }
                                                onChange={
                                                    event =>
                                                        update(
                                                            "lease_public_id",
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                }
                                                className={
                                                    inputClassName
                                                }
                                            >
                                                <option value="">
                                                    {!form.unit_public_id
                                                        ? "Select unit first"
                                                        : leasesLoading
                                                          ? "Loading active lease..."
                                                          : "No lease / select active lease"}
                                                </option>

                                                {leases.map(
                                                    lease => (
                                                        <option
                                                            key={
                                                                lease.public_id
                                                            }
                                                            value={
                                                                lease.public_id
                                                            }
                                                        >
                                                            {lease.lease_number ||
                                                                lease.public_id}
                                                            {lease.tenant
                                                                ?.display_name
                                                                ? ` — ${lease.tenant.display_name}`
                                                                : ""}
                                                        </option>
                                                    )
                                                )}
                                            </select>

                                            <LoadingHint
                                                loading={
                                                    leasesLoading
                                                }
                                                emptyText={
                                                    form.unit_public_id &&
                                                    !leasesLoading &&
                                                    leases.length ===
                                                        0
                                                        ? "No active lease is linked to the selected unit. Lease is optional for owner-side unit requests."
                                                        : ""
                                                }
                                            />
                                        </label>
                                    )}

                                    <label className="block">
                                        <FieldLabel>
                                            Currency Code
                                        </FieldLabel>

                                        <input
                                            type="text"
                                            value={
                                                form.currency_code
                                            }
                                            onChange={
                                                event =>
                                                    update(
                                                        "currency_code",
                                                        event
                                                            .target
                                                            .value
                                                            .toUpperCase()
                                                            .replace(
                                                                /[^A-Z]/g,
                                                                ""
                                                            )
                                                            .slice(
                                                                0,
                                                                3
                                                            )
                                                    )
                                            }
                                            maxLength={3}
                                            placeholder="TZS"
                                            className={
                                                inputClassName
                                            }
                                        />

                                        {selectedLease
                                            ?.currency_code && (
                                            <p className="mt-1 text-xs text-emerald-700">
                                                Auto-filled from selected active lease.
                                            </p>
                                        )}
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block md:col-span-2">
                                <FieldLabel required>
                                    Title
                                </FieldLabel>

                                <input
                                    type="text"
                                    value={
                                        form.title
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "title",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    minLength={3}
                                    maxLength={255}
                                    placeholder="Example: Kitchen sink leaking"
                                    className={
                                        inputClassName
                                    }
                                />
                            </label>

                            <label className="block md:col-span-2">
                                <FieldLabel required>
                                    Description
                                </FieldLabel>

                                <textarea
                                    value={
                                        form.description
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "description",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    minLength={10}
                                    maxLength={5000}
                                    rows={5}
                                    placeholder="Describe the problem clearly..."
                                    className={`${inputClassName} min-h-32 resize-y`}
                                />
                            </label>

                            <label className="block">
                                <FieldLabel required>
                                    Category
                                </FieldLabel>

                                <select
                                    value={
                                        form.category
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "category",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className={
                                        inputClassName
                                    }
                                >
                                    <option value="">
                                        Select category
                                    </option>

                                    {MAINTENANCE_CATEGORIES.map(
                                        value => (
                                            <option
                                                key={
                                                    value
                                                }
                                                value={
                                                    value
                                                }
                                            >
                                                {
                                                    formatLabel(
                                                        value
                                                    )
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="block">
                                <FieldLabel>
                                    Priority
                                </FieldLabel>

                                <select
                                    value={
                                        form.priority
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "priority",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className={
                                        inputClassName
                                    }
                                >
                                    {PRIORITIES.map(
                                        value => (
                                            <option
                                                key={
                                                    value
                                                }
                                                value={
                                                    value
                                                }
                                            >
                                                {
                                                    formatLabel(
                                                        value
                                                    )
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="block">
                                <FieldLabel>
                                    Impact Level
                                </FieldLabel>

                                <select
                                    value={
                                        form.impact_level
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "impact_level",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className={
                                        inputClassName
                                    }
                                >
                                    {IMPACT_LEVELS.map(
                                        value => (
                                            <option
                                                key={
                                                    value
                                                }
                                                value={
                                                    value
                                                }
                                            >
                                                {
                                                    formatLabel(
                                                        value
                                                    )
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="block">
                                <FieldLabel>
                                    Access Instruction
                                </FieldLabel>

                                <select
                                    value={
                                        form.access_instruction
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "access_instruction",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className={
                                        inputClassName
                                    }
                                >
                                    <option value="">
                                        None
                                    </option>

                                    {ACCESS_INSTRUCTIONS.map(
                                        value => (
                                            <option
                                                key={
                                                    value
                                                }
                                                value={
                                                    value
                                                }
                                            >
                                                {
                                                    formatLabel(
                                                        value
                                                    )
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="block md:col-span-2">
                                <FieldLabel
                                    required={
                                        commonAreaMode
                                    }
                                >
                                    Location Details
                                </FieldLabel>

                                <input
                                    type="text"
                                    value={
                                        form.location_details
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "location_details",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    maxLength={500}
                                    placeholder={
                                        commonAreaMode
                                            ? "Required: e.g. main staircase, parking area..."
                                            : "Optional precise location"
                                    }
                                    className={
                                        inputClassName
                                    }
                                />
                            </label>

                            <label className="block">
                                <FieldLabel>
                                    Problem Started At
                                </FieldLabel>

                                <input
                                    type="datetime-local"
                                    value={
                                        form.problem_started_at
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "problem_started_at",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className={
                                        inputClassName
                                    }
                                />

                                <p className="mt-1 text-xs text-slate-500">
                                    Must not be in the future.
                                </p>
                            </label>

                            <label className="block">
                                <FieldLabel>
                                    Preferred Visit At
                                </FieldLabel>

                                <input
                                    type="datetime-local"
                                    value={
                                        form.preferred_visit_at
                                    }
                                    onChange={
                                        event =>
                                            update(
                                                "preferred_visit_at",
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className={
                                        inputClassName
                                    }
                                />

                                <p className="mt-1 text-xs text-slate-500">
                                    Must be in the future.
                                </p>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
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
                        disabled={
                            submitting ||
                            ownersLoading ||
                            propertiesLoading ||
                            unitsLoading ||
                            leasesLoading
                        }
                    >
                        {submitting
                            ? "Creating..."
                            : "Create Request"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default CreateMaintenanceRequestModal;

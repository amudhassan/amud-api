import {
    Building2,
    RefreshCw,
    Save,
    ShieldCheck,
    X
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button,
    IconButton
} from "../../components/ui/Button";

import {
    useAuth
} from "../../contexts/AuthContext";

const OWNER_TYPES = [
    ["individual", "Individual"],
    ["company", "Company"],
    ["government", "Government"],
    ["organization", "Organization"],
    ["partnership", "Partnership"]
];

const OWNER_STATUSES = [
    ["active", "Active"],
    ["inactive", "Inactive"],
    ["blocked", "Blocked"]
];

const EMPTY_FORM = {
    owner_type: "individual",
    display_name: "",
    registration_number: "",
    tax_identification_number: "",
    email: "",
    phone_number: "",
    alternative_phone: "",
    address: "",
    city: "",
    region: "",
    country: "",
    status: "inactive"
};

const OPTIONAL_FIELDS = [
    "registration_number",
    "tax_identification_number",
    "email",
    "phone_number",
    "alternative_phone",
    "address",
    "city",
    "region"
];

const COMMON_FIELDS = [
    "display_name",
    ...OPTIONAL_FIELDS,
    "country"
];

const nullableString = value => {
    const trimmed =
        String(value ?? "").trim();

    return trimmed === ""
        ? null
        : trimmed;
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to update owner.";

const validateForm = form => {
    const displayName =
        form.display_name.trim();

    const country =
        form.country.trim();

    if (
        displayName.length < 2 ||
        displayName.length > 255
    ) {
        return "Owner display name must contain between 2 and 255 characters.";
    }

    if (
        country.length < 1 ||
        country.length > 100
    ) {
        return "Country is required and cannot exceed 100 characters.";
    }

    if (
        form.registration_number.trim().length >
        100
    ) {
        return "Registration number cannot exceed 100 characters.";
    }

    if (
        form.tax_identification_number.trim()
            .length > 100
    ) {
        return "Tax identification number cannot exceed 100 characters.";
    }

    if (
        form.email.trim() &&
        (
            form.email.trim().length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                form.email.trim()
            )
        )
    ) {
        return "Enter a valid email address.";
    }

    if (
        form.phone_number.trim().length > 30 ||
        form.alternative_phone.trim().length >
            30
    ) {
        return "Phone numbers cannot exceed 30 characters.";
    }

    if (
        form.city.trim().length > 100 ||
        form.region.trim().length > 100
    ) {
        return "City and region cannot exceed 100 characters.";
    }

    return "";
};

const createFormFromOwner = owner => ({
    owner_type:
        owner?.owner_type || "individual",
    display_name:
        owner?.display_name || "",
    registration_number:
        owner?.registration_number || "",
    tax_identification_number:
        owner?.tax_identification_number || "",
    email:
        owner?.email || "",
    phone_number:
        owner?.phone_number || "",
    alternative_phone:
        owner?.alternative_phone || "",
    address:
        owner?.address || "",
    city:
        owner?.city || "",
    region:
        owner?.region || "",
    country:
        owner?.country || "",
    status:
        owner?.status || "inactive"
});

const normalizedValue = (field, value) => {
    if (OPTIONAL_FIELDS.includes(field)) {
        const normalized = nullableString(value);

        if (field === "email" && normalized) {
            return normalized.toLowerCase();
        }

        return normalized;
    }

    return String(value ?? "").trim();
};

function EditOwnerModal({
    ownerPublicId,
    onClose,
    onUpdated
}) {
    const {
        user
    } = useAuth();

    const isAdmin =
        user?.role === "admin";

    const [
        owner,
        setOwner
    ] = useState(null);

    const [
        form,
        setForm
    ] = useState(
        EMPTY_FORM
    );

    const [
        loading,
        setLoading
    ] = useState(false);

    const [
        saving,
        setSaving
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const loadOwner = useCallback(
        async () => {
            if (!ownerPublicId) {
                return;
            }

            try {
                setLoading(true);
                setError("");

                const response =
                    await apiClient.get(
                        `/owners/${ownerPublicId}`
                    );

                const loadedOwner =
                    response?.data?.data ||
                    null;

                setOwner(loadedOwner);
                setForm(
                    createFormFromOwner(
                        loadedOwner
                    )
                );
            } catch (requestError) {
                setOwner(null);
                setForm(EMPTY_FORM);
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setLoading(false);
            }
        },
        [ownerPublicId]
    );

    useEffect(() => {
        if (!ownerPublicId) {
            setOwner(null);
            setForm(EMPTY_FORM);
            setError("");
            setSaving(false);
            return;
        }

        loadOwner();
    }, [
        ownerPublicId,
        loadOwner
    ]);

    useEffect(() => {
        if (!ownerPublicId) {
            return undefined;
        }

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !saving
            ) {
                onClose();
            }
        };

        document.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            document.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    }, [
        ownerPublicId,
        saving,
        onClose
    ]);

    const updateField =
        (field, value) => {
            setForm(
                current => ({
                    ...current,
                    [field]: value
                })
            );

            setError("");
        };

    const submit = async event => {
        event.preventDefault();

        if (
            !owner ||
            saving
        ) {
            return;
        }

        const validationError =
            validateForm(form);

        if (validationError) {
            setError(validationError);
            return;
        }

        const fields = isAdmin
            ? [
                ...COMMON_FIELDS,
                "owner_type",
                "status"
            ]
            : COMMON_FIELDS;

        const payload = {};

        fields.forEach(field => {
            const nextValue =
                normalizedValue(
                    field,
                    form[field]
                );

            const currentValue =
                normalizedValue(
                    field,
                    owner[field]
                );

            if (nextValue !== currentValue) {
                payload[field] = nextValue;
            }
        });

        if (
            Object.keys(payload).length === 0
        ) {
            setError(
                "No changes to save."
            );
            return;
        }

        try {
            setSaving(true);
            setError("");

            const response =
                await apiClient.patch(
                    `/owners/${ownerPublicId}`,
                    payload
                );

            await onUpdated?.(
                response?.data?.data ||
                    null
            );
        } catch (requestError) {
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setSaving(false);
        }
    };

    if (!ownerPublicId) {
        return null;
    }

    const inputClassName = `
        h-11 w-full rounded-xl
        border border-slate-200
        bg-white px-3
        text-sm text-slate-800
        outline-none transition
        placeholder:text-slate-400
        focus:border-blue-400
        focus:ring-2
        focus:ring-blue-100
        disabled:cursor-not-allowed
        disabled:bg-slate-100
    `;

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-[2px]"
            role="presentation"
            onMouseDown={event => {
                if (
                    event.target ===
                        event.currentTarget &&
                    !saving
                ) {
                    onClose();
                }
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-owner-title"
                className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <Building2 className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="edit-owner-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Edit Owner
                            </h2>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                Update owner identity, contact and location information.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close edit owner"
                        icon={X}
                        disabled={saving}
                        onClick={onClose}
                    />
                </div>

                {loading ? (
                    <div className="space-y-4 p-6">
                        {[1, 2, 3, 4, 5].map(item => (
                            <div
                                key={item}
                                className="h-14 animate-pulse rounded-2xl bg-slate-100"
                            />
                        ))}
                    </div>
                ) : !owner ? (
                    <div className="p-6">
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <span>
                                    {error ||
                                        "Owner could not be loaded."}
                                </span>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    leftIcon={RefreshCw}
                                    onClick={loadOwner}
                                >
                                    Retry
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form
                        onSubmit={submit}
                        className="space-y-6 px-6 py-5"
                    >
                        {error && (
                            <div
                                role="alert"
                                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
                            >
                                {error}
                            </div>
                        )}

                        {isAdmin && (
                            <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                                <div className="mb-3 flex items-start gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                                        <ShieldCheck className="h-4 w-4" />
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-900">
                                            Administrator Controls
                                        </h3>

                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                            Owner type and lifecycle status are restricted to administrators by the backend.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                            Owner Type
                                        </label>

                                        <select
                                            value={form.owner_type}
                                            disabled={saving}
                                            onChange={event =>
                                                updateField(
                                                    "owner_type",
                                                    event.target.value
                                                )
                                            }
                                            className={inputClassName}
                                        >
                                            {OWNER_TYPES.map(
                                                ([value, label]) => (
                                                    <option
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {label}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                            Status
                                        </label>

                                        <select
                                            value={form.status}
                                            disabled={saving}
                                            onChange={event =>
                                                updateField(
                                                    "status",
                                                    event.target.value
                                                )
                                            }
                                            className={inputClassName}
                                        >
                                            {OWNER_STATUSES.map(
                                                ([value, label]) => (
                                                    <option
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {label}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>
                                </div>
                            </section>
                        )}

                        <section>
                            <div className="mb-3">
                                <h3 className="text-sm font-semibold text-slate-900">
                                    Owner Identity
                                </h3>

                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    Display name and country remain required.
                                </p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Display Name *
                                    </label>

                                    <input
                                        value={form.display_name}
                                        disabled={saving}
                                        onChange={event =>
                                            updateField(
                                                "display_name",
                                                event.target.value
                                            )
                                        }
                                        className={inputClassName}
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Registration Number
                                    </label>

                                    <input
                                        value={form.registration_number}
                                        disabled={saving}
                                        onChange={event =>
                                            updateField(
                                                "registration_number",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Optional"
                                        className={inputClassName}
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Tax Identification Number
                                    </label>

                                    <input
                                        value={form.tax_identification_number}
                                        disabled={saving}
                                        onChange={event =>
                                            updateField(
                                                "tax_identification_number",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Optional"
                                        className={inputClassName}
                                    />
                                </div>
                            </div>
                        </section>

                        <section>
                            <div className="mb-3">
                                <h3 className="text-sm font-semibold text-slate-900">
                                    Contact
                                </h3>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Email
                                    </label>

                                    <input
                                        type="email"
                                        value={form.email}
                                        disabled={saving}
                                        onChange={event =>
                                            updateField(
                                                "email",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Optional"
                                        className={inputClassName}
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Phone Number
                                    </label>

                                    <input
                                        value={form.phone_number}
                                        disabled={saving}
                                        onChange={event =>
                                            updateField(
                                                "phone_number",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Optional"
                                        className={inputClassName}
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Alternative Phone
                                    </label>

                                    <input
                                        value={form.alternative_phone}
                                        disabled={saving}
                                        onChange={event =>
                                            updateField(
                                                "alternative_phone",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Optional"
                                        className={inputClassName}
                                    />
                                </div>
                            </div>
                        </section>

                        <section>
                            <div className="mb-3">
                                <h3 className="text-sm font-semibold text-slate-900">
                                    Address
                                </h3>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Address
                                    </label>

                                    <input
                                        value={form.address}
                                        disabled={saving}
                                        onChange={event =>
                                            updateField(
                                                "address",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Optional street or postal address"
                                        className={inputClassName}
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        City
                                    </label>

                                    <input
                                        value={form.city}
                                        disabled={saving}
                                        onChange={event =>
                                            updateField(
                                                "city",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Optional"
                                        className={inputClassName}
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Region
                                    </label>

                                    <input
                                        value={form.region}
                                        disabled={saving}
                                        onChange={event =>
                                            updateField(
                                                "region",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Optional"
                                        className={inputClassName}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Country *
                                    </label>

                                    <input
                                        value={form.country}
                                        disabled={saving}
                                        onChange={event =>
                                            updateField(
                                                "country",
                                                event.target.value
                                            )
                                        }
                                        className={inputClassName}
                                    />
                                </div>
                            </div>
                        </section>

                        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={saving}
                                onClick={onClose}
                            >
                                Cancel
                            </Button>

                            <Button
                                type="submit"
                                leftIcon={Save}
                                loading={saving}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default EditOwnerModal;

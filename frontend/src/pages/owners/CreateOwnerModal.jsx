import {
    Building2,
    Plus,
    X
} from "lucide-react";

import {
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button,
    IconButton
} from "../../components/ui/Button";

const OWNER_TYPES = [
    ["individual", "Individual"],
    ["company", "Company"],
    ["government", "Government"],
    ["organization", "Organization"],
    ["partnership", "Partnership"]
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
    country: ""
};

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
    "Unable to create owner.";

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

function CreateOwnerModal({
    open,
    onClose,
    onCreated
}) {
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
        error,
        setError
    ] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(
            EMPTY_FORM
        );

        setError("");
    }, [open]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown =
            event => {
                if (
                    event.key === "Escape" &&
                    !loading
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
        open,
        loading,
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

    const submit =
        async event => {
            event.preventDefault();

            if (loading) {
                return;
            }

            const validationError =
                validateForm(form);

            if (validationError) {
                setError(
                    validationError
                );
                return;
            }

            const payload = {
                owner_type:
                    form.owner_type,
                display_name:
                    form.display_name.trim(),
                registration_number:
                    nullableString(
                        form.registration_number
                    ),
                tax_identification_number:
                    nullableString(
                        form.tax_identification_number
                    ),
                email:
                    nullableString(
                        form.email
                    ),
                phone_number:
                    nullableString(
                        form.phone_number
                    ),
                alternative_phone:
                    nullableString(
                        form.alternative_phone
                    ),
                address:
                    nullableString(
                        form.address
                    ),
                city:
                    nullableString(
                        form.city
                    ),
                region:
                    nullableString(
                        form.region
                    ),
                country:
                    form.country.trim()
            };

            try {
                setLoading(true);
                setError("");

                const response =
                    await apiClient.post(
                        "/owners",
                        payload
                    );

                await onCreated?.(
                    response?.data?.data
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
                setLoading(false);
            }
        };

    if (!open) {
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
            className="
                fixed inset-0 z-[70]
                flex items-center
                justify-center
                bg-slate-950/55
                px-4 py-6
                backdrop-blur-[2px]
            "
            role="presentation"
            onMouseDown={
                event => {
                    if (
                        event.target ===
                            event.currentTarget &&
                        !loading
                    ) {
                        onClose();
                    }
                }
            }
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-owner-title"
                className="
                    max-h-[92vh]
                    w-full max-w-3xl
                    overflow-y-auto
                    rounded-3xl
                    border border-slate-200
                    bg-white
                    shadow-2xl
                "
            >
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <Building2 className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="create-owner-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Create Owner
                            </h2>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                Register an individual, company, government entity, organization or partnership.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close"
                        icon={X}
                        disabled={loading}
                        onClick={onClose}
                    />
                </div>

                <form
                    onSubmit={submit}
                    className="space-y-6 px-6 py-5"
                >
                    <section>
                        <div className="mb-3">
                            <h3 className="text-sm font-semibold text-slate-900">
                                Owner Identity
                            </h3>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                Owner type, display name and country are required.
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Owner Type *
                                </label>

                                <select
                                    value={form.owner_type}
                                    disabled={loading}
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
                                    Display Name *
                                </label>

                                <input
                                    value={form.display_name}
                                    disabled={loading}
                                    onChange={event =>
                                        updateField(
                                            "display_name",
                                            event.target.value
                                        )
                                    }
                                    placeholder="Owner or business name"
                                    className={inputClassName}
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Registration Number
                                </label>

                                <input
                                    value={form.registration_number}
                                    disabled={loading}
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
                                    disabled={loading}
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
                                Contact Information
                            </h3>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Email
                                </label>

                                <input
                                    type="email"
                                    value={form.email}
                                    disabled={loading}
                                    onChange={event =>
                                        updateField(
                                            "email",
                                            event.target.value
                                        )
                                    }
                                    placeholder="owner@example.com"
                                    className={inputClassName}
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Phone Number
                                </label>

                                <input
                                    value={form.phone_number}
                                    disabled={loading}
                                    onChange={event =>
                                        updateField(
                                            "phone_number",
                                            event.target.value
                                        )
                                    }
                                    placeholder="+255..."
                                    className={inputClassName}
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Alternative Phone
                                </label>

                                <input
                                    value={form.alternative_phone}
                                    disabled={loading}
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
                                    disabled={loading}
                                    onChange={event =>
                                        updateField(
                                            "address",
                                            event.target.value
                                        )
                                    }
                                    placeholder="Street, building or postal address"
                                    className={inputClassName}
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    City
                                </label>

                                <input
                                    value={form.city}
                                    disabled={loading}
                                    onChange={event =>
                                        updateField(
                                            "city",
                                            event.target.value
                                        )
                                    }
                                    placeholder="City"
                                    className={inputClassName}
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Region / State
                                </label>

                                <input
                                    value={form.region}
                                    disabled={loading}
                                    onChange={event =>
                                        updateField(
                                            "region",
                                            event.target.value
                                        )
                                    }
                                    placeholder="Region or state"
                                    className={inputClassName}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Country *
                                </label>

                                <input
                                    value={form.country}
                                    disabled={loading}
                                    onChange={event =>
                                        updateField(
                                            "country",
                                            event.target.value
                                        )
                                    }
                                    placeholder="Country"
                                    className={inputClassName}
                                />
                            </div>
                        </div>
                    </section>

                    <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-700">
                        The backend controls access automatically. A regular user creating an owner is linked as the primary owner representative; an administrator may create an owner without creating that representative link.
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
                        >
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={loading}
                            onClick={onClose}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            leftIcon={Plus}
                            loading={loading}
                        >
                            Create Owner
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateOwnerModal;

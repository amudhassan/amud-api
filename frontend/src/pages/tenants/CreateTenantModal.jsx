import {
    Plus,
    UserRoundPlus,
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

const TENANT_TYPES = [
    "individual",
    "company",
    "government",
    "organization",
    "partnership"
];

const INITIAL_FORM = {
    tenant_type: "individual",
    display_name: "",
    national_id: "",
    passport_number: "",
    registration_number: "",
    tax_identification_number: "",
    email: "",
    phone_number: "",
    alternative_phone: "",
    address: "",
    city: "",
    region: "",
    country: "",
    notes: ""
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
    "Unable to create tenant.";

const cleanPayload = form => {
    const payload = {
        tenant_type: form.tenant_type,
        display_name:
            form.display_name.trim()
    };

    [
        "national_id",
        "passport_number",
        "registration_number",
        "tax_identification_number",
        "email",
        "phone_number",
        "alternative_phone",
        "address",
        "city",
        "region",
        "country",
        "notes"
    ].forEach(field => {
        const value =
            form[field]?.trim();

        if (value) {
            payload[field] = value;
        }
    });

    return payload;
};

function CreateTenantModal({
    open,
    owner,
    onClose,
    onCreated
}) {
    const [form, setForm] =
        useState(INITIAL_FORM);
    const [loading, setLoading] =
        useState(false);
    const [error, setError] =
        useState("");

    useEffect(() => {
        if (open) {
            setForm(INITIAL_FORM);
            setError("");
        }
    }, [open, owner?.public_id]);

    if (!open || !owner) {
        return null;
    }

    const updateField = event => {
        const { name, value } =
            event.target;

        setForm(current => ({
            ...current,
            [name]: value
        }));
    };

    const handleSubmit = async event => {
        event.preventDefault();

        const displayName =
            form.display_name.trim();

        if (displayName.length < 2) {
            setError(
                "Tenant display name must contain at least 2 characters."
            );
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response =
                await apiClient.post(
                    "/tenants",
                    {
                        owner_public_id:
                            owner.public_id,
                        ...cleanPayload(form)
                    }
                );

            const result =
                response?.data?.data || {};

            onCreated?.(
                result.tenant || result
            );
        } catch (requestError) {
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setLoading(false);
        }
    };

    const inputClassName =
        "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-tenant-title"
        >
            <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <UserRoundPlus className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="create-tenant-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Add Tenant
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Create a tenant profile under {owner.display_name}.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close add tenant dialog"
                        icon={X}
                        onClick={onClose}
                        disabled={loading}
                    />
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="flex max-h-[calc(92vh-82px)] flex-col"
                >
                    <div className="overflow-y-auto p-5">
                        {error && (
                            <div
                                role="alert"
                                className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                            >
                                {error}
                            </div>
                        )}

                        <div className="grid gap-5 md:grid-cols-2">
                            <label className="text-sm font-medium text-slate-700">
                                Tenant Type <span className="text-rose-500">*</span>
                                <select
                                    name="tenant_type"
                                    value={form.tenant_type}
                                    onChange={updateField}
                                    disabled={loading}
                                    className={inputClassName}
                                >
                                    {TENANT_TYPES.map(type => (
                                        <option
                                            key={type}
                                            value={type}
                                        >
                                            {formatLabel(type)}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="text-sm font-medium text-slate-700">
                                Display Name <span className="text-rose-500">*</span>
                                <input
                                    name="display_name"
                                    value={form.display_name}
                                    onChange={updateField}
                                    disabled={loading}
                                    minLength={2}
                                    maxLength={200}
                                    required
                                    placeholder="Tenant full or business name"
                                    className={inputClassName}
                                />
                            </label>

                            <label className="text-sm font-medium text-slate-700">
                                National ID
                                <input
                                    name="national_id"
                                    value={form.national_id}
                                    onChange={updateField}
                                    disabled={loading}
                                    maxLength={100}
                                    className={inputClassName}
                                />
                            </label>

                            <label className="text-sm font-medium text-slate-700">
                                Passport Number
                                <input
                                    name="passport_number"
                                    value={form.passport_number}
                                    onChange={updateField}
                                    disabled={loading}
                                    maxLength={100}
                                    className={inputClassName}
                                />
                            </label>

                            <label className="text-sm font-medium text-slate-700">
                                Registration Number
                                <input
                                    name="registration_number"
                                    value={form.registration_number}
                                    onChange={updateField}
                                    disabled={loading}
                                    maxLength={150}
                                    className={inputClassName}
                                />
                            </label>

                            <label className="text-sm font-medium text-slate-700">
                                Tax Identification Number
                                <input
                                    name="tax_identification_number"
                                    value={form.tax_identification_number}
                                    onChange={updateField}
                                    disabled={loading}
                                    maxLength={150}
                                    className={inputClassName}
                                />
                            </label>

                            <label className="text-sm font-medium text-slate-700">
                                Email
                                <input
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={updateField}
                                    disabled={loading}
                                    maxLength={255}
                                    placeholder="tenant@example.com"
                                    className={inputClassName}
                                />
                            </label>

                            <label className="text-sm font-medium text-slate-700">
                                Phone Number
                                <input
                                    name="phone_number"
                                    value={form.phone_number}
                                    onChange={updateField}
                                    disabled={loading}
                                    minLength={5}
                                    maxLength={50}
                                    className={inputClassName}
                                />
                            </label>

                            <label className="text-sm font-medium text-slate-700">
                                Alternative Phone
                                <input
                                    name="alternative_phone"
                                    value={form.alternative_phone}
                                    onChange={updateField}
                                    disabled={loading}
                                    minLength={5}
                                    maxLength={50}
                                    className={inputClassName}
                                />
                            </label>

                            <label className="text-sm font-medium text-slate-700">
                                Country
                                <input
                                    name="country"
                                    value={form.country}
                                    onChange={updateField}
                                    disabled={loading}
                                    maxLength={100}
                                    className={inputClassName}
                                />
                            </label>

                            <label className="text-sm font-medium text-slate-700">
                                City
                                <input
                                    name="city"
                                    value={form.city}
                                    onChange={updateField}
                                    disabled={loading}
                                    maxLength={100}
                                    className={inputClassName}
                                />
                            </label>

                            <label className="text-sm font-medium text-slate-700">
                                Region
                                <input
                                    name="region"
                                    value={form.region}
                                    onChange={updateField}
                                    disabled={loading}
                                    maxLength={100}
                                    className={inputClassName}
                                />
                            </label>

                            <label className="text-sm font-medium text-slate-700 md:col-span-2">
                                Address
                                <input
                                    name="address"
                                    value={form.address}
                                    onChange={updateField}
                                    disabled={loading}
                                    className={inputClassName}
                                />
                            </label>

                            <label className="text-sm font-medium text-slate-700 md:col-span-2">
                                Notes
                                <textarea
                                    name="notes"
                                    value={form.notes}
                                    onChange={updateField}
                                    disabled={loading}
                                    rows={4}
                                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            leftIcon={Plus}
                            loading={loading}
                        >
                            Add Tenant
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateTenantModal;

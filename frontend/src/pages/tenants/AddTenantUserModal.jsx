import {
    ShieldCheck,
    UserPlus,
    X
} from "lucide-react";
import {
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";
import {
    Button,
    IconButton
} from "../../components/ui/Button";

const ROLE_DEFAULTS = {
    primary_contact: {
        is_primary: true,
        can_view_leases: true,
        can_view_finances: true,
        can_make_payments: true,
        can_submit_maintenance: true,
        can_manage_tenant_users: true
    },
    authorized_representative: {
        is_primary: false,
        can_view_leases: true,
        can_view_finances: false,
        can_make_payments: false,
        can_submit_maintenance: true,
        can_manage_tenant_users: false
    },
    accountant: {
        is_primary: false,
        can_view_leases: true,
        can_view_finances: true,
        can_make_payments: true,
        can_submit_maintenance: false,
        can_manage_tenant_users: false
    },
    occupant: {
        is_primary: false,
        can_view_leases: true,
        can_view_finances: false,
        can_make_payments: false,
        can_submit_maintenance: true,
        can_manage_tenant_users: false
    },
    viewer: {
        is_primary: false,
        can_view_leases: true,
        can_view_finances: false,
        can_make_payments: false,
        can_submit_maintenance: false,
        can_manage_tenant_users: false
    }
};

const ROLE_OPTIONS = [
    ["primary_contact", "Primary Contact"],
    ["authorized_representative", "Authorized Representative"],
    ["accountant", "Accountant"],
    ["occupant", "Occupant"],
    ["viewer", "Viewer"]
];

const PERMISSIONS = [
    ["can_view_leases", "View leases", "View lease agreements linked to the tenant."],
    ["can_view_finances", "View finances", "View invoices, balances, payments and receipts."],
    ["can_make_payments", "Make payments", "Initiate or record tenant payments where supported."],
    ["can_submit_maintenance", "Submit maintenance", "Submit eligible maintenance requests."],
    ["can_manage_tenant_users", "Manage tenant users", "Manage other users linked to this tenant."]
];

const makeForm = role => ({
    user_public_id: "",
    relationship_role: role,
    ...ROLE_DEFAULTS[role]
});

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to add tenant user.";

function AddTenantUserModal({
    open,
    tenantPublicId,
    onClose,
    onAdded
}) {
    const [form, setForm] =
        useState(makeForm("viewer"));
    const [loading, setLoading] =
        useState(false);
    const [error, setError] =
        useState("");

    useEffect(() => {
        if (open) {
            setForm(makeForm("viewer"));
            setError("");
        }
    }, [open]);

    const validationError =
        useMemo(() => {
            if (
                !/^[A-Za-z0-9_-]{30}$/.test(
                    form.user_public_id.trim()
                )
            ) {
                return "Enter the exact 30-character user public ID.";
            }

            if (
                form.relationship_role === "primary_contact" &&
                form.is_primary !== true
            ) {
                return "Primary contact must be marked as primary.";
            }

            if (
                form.is_primary === true &&
                form.relationship_role !== "primary_contact"
            ) {
                return "Only a primary contact can be marked as primary.";
            }

            if (
                form.is_primary === true &&
                form.can_manage_tenant_users !== true
            ) {
                return "Primary contact must be allowed to manage tenant users.";
            }

            if (
                form.can_make_payments === true &&
                form.can_view_finances !== true
            ) {
                return "Payment permission requires finance-view permission.";
            }

            return "";
        }, [form]);

    if (!open) {
        return null;
    }

    const setRole = role => {
        setForm(current => ({
            user_public_id:
                current.user_public_id,
            relationship_role: role,
            ...ROLE_DEFAULTS[role]
        }));
        setError("");
    };

    const togglePermission = field => {
        setForm(current => {
            const next = {
                ...current,
                [field]:
                    !current[field]
            };

            if (
                field === "can_view_finances" &&
                next.can_view_finances === false
            ) {
                next.can_make_payments = false;
            }

            if (
                field === "can_make_payments" &&
                next.can_make_payments === true
            ) {
                next.can_view_finances = true;
            }

            return next;
        });
    };

    const handleSubmit = async event => {
        event.preventDefault();

        if (validationError) {
            setError(validationError);
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response =
                await apiClient.post(
                    `/tenants/${tenantPublicId}/users`,
                    {
                        user_public_id:
                            form.user_public_id.trim(),
                        relationship_role:
                            form.relationship_role,
                        is_primary:
                            form.is_primary,
                        can_view_leases:
                            form.can_view_leases,
                        can_view_finances:
                            form.can_view_finances,
                        can_make_payments:
                            form.can_make_payments,
                        can_submit_maintenance:
                            form.can_submit_maintenance,
                        can_manage_tenant_users:
                            form.can_manage_tenant_users
                    }
                );

            onAdded?.(
                response?.data?.data?.user ||
                null
            );
        } catch (requestError) {
            setError(
                getErrorMessage(requestError)
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-tenant-user-title"
        >
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <UserPlus className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="add-tenant-user-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Add Tenant User
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Link an existing verified login account to this tenant.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close add tenant user dialog"
                        icon={X}
                        onClick={onClose}
                        disabled={loading}
                    />
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-5 p-5">
                        {error && (
                            <div
                                role="alert"
                                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                            >
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                User Public ID
                            </label>

                            <input
                                value={form.user_public_id}
                                onChange={event =>
                                    setForm(current => ({
                                        ...current,
                                        user_public_id:
                                            event.target.value
                                    }))
                                }
                                placeholder="Paste user public ID"
                                autoComplete="off"
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />

                            <p className="mt-1.5 text-xs leading-5 text-slate-500">
                                Paste the exact public_id from the users table. User IDs in this system are 30-character Nano IDs and do not use a user_ prefix. The account must also be verified and not deleted.
                            </p>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                Relationship Role
                            </label>

                            <select
                                value={form.relationship_role}
                                onChange={event =>
                                    setRole(event.target.value)
                                }
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            >
                                {ROLE_OPTIONS.map(
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

                            <p className="mt-1.5 text-xs leading-5 text-slate-500">
                                Selecting a role applies the backend-aligned default permission set. You can then adjust permissions before saving.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                        Primary contact
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                        Only one current primary contact is allowed per tenant.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (
                                            form.relationship_role !==
                                            "primary_contact"
                                        ) {
                                            return;
                                        }

                                        setForm(current => ({
                                            ...current,
                                            is_primary: true
                                        }));
                                    }}
                                    disabled={
                                        form.relationship_role !==
                                        "primary_contact"
                                    }
                                    className={`relative h-6 w-11 rounded-full transition ${
                                        form.is_primary
                                            ? "bg-blue-600"
                                            : "bg-slate-300"
                                    } disabled:cursor-not-allowed disabled:opacity-50`}
                                    aria-label="Primary contact status"
                                >
                                    <span
                                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                                            form.is_primary
                                                ? "left-5"
                                                : "left-0.5"
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>

                        <div>
                            <div className="mb-3 flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-slate-500" />
                                <h3 className="text-sm font-semibold text-slate-900">
                                    Permissions
                                </h3>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                {PERMISSIONS.map(
                                    ([field, label, description]) => (
                                        <label
                                            key={field}
                                            className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form[field]}
                                                onChange={() =>
                                                    togglePermission(field)
                                                }
                                                disabled={
                                                    form.relationship_role ===
                                                        "primary_contact" &&
                                                    field ===
                                                        "can_manage_tenant_users"
                                                }
                                                className="mt-1 h-4 w-4 rounded border-slate-300"
                                            />

                                            <span>
                                                <span className="block text-sm font-semibold text-slate-800">
                                                    {label}
                                                </span>

                                                <span className="mt-1 block text-xs leading-5 text-slate-500">
                                                    {description}
                                                </span>
                                            </span>
                                        </label>
                                    )
                                )}
                            </div>
                        </div>

                        {validationError && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                {validationError}
                            </div>
                        )}
                    </div>

                    <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            leftIcon={UserPlus}
                            loading={loading}
                            disabled={Boolean(validationError)}
                        >
                            Add Tenant User
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AddTenantUserModal;

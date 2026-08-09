import {
    AlertTriangle,
    Check,
    Pencil,
    ShieldCheck,
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

const makeForm = user => ({
    relationship_role: user?.relationship_role || "viewer",
    is_primary: user?.is_primary === true,
    can_view_leases: user?.can_view_leases === true,
    can_view_finances: user?.can_view_finances === true,
    can_make_payments: user?.can_make_payments === true,
    can_submit_maintenance: user?.can_submit_maintenance === true,
    can_manage_tenant_users: user?.can_manage_tenant_users === true
});

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to update tenant user.";

function UpdateTenantUserModal({
    open,
    tenantPublicId,
    user,
    onClose,
    onUpdated
}) {
    const [form, setForm] = useState(makeForm(user));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(makeForm(user));
        setError("");
    }, [open, user]);

    const original = useMemo(
        () => makeForm(user),
        [user]
    );

    const isCurrentPrimary = user?.is_primary === true;
    const primaryTransferRequested =
        !isCurrentPrimary && form.is_primary === true;

    const hasChanges = Object.keys(original).some(
        key => original[key] !== form[key]
    );

    const togglePermission = key => {
        if (
            isCurrentPrimary &&
            key === "can_manage_tenant_users"
        ) {
            return;
        }

        setForm(current => {
            const nextValue = !current[key];
            const next = {
                ...current,
                [key]: nextValue
            };

            if (
                key === "can_make_payments" &&
                nextValue
            ) {
                next.can_view_finances = true;
            }

            if (
                key === "can_view_finances" &&
                !nextValue
            ) {
                next.can_make_payments = false;
            }

            if (isCurrentPrimary) {
                next.can_manage_tenant_users = true;
            }

            return next;
        });

        setError("");
    };

    const changeRole = nextRole => {
        if (isCurrentPrimary) {
            return;
        }

        setForm({
            relationship_role: nextRole,
            ...ROLE_DEFAULTS[nextRole]
        });

        setError("");
    };

    const submit = async event => {
        event.preventDefault();

        if (loading || !user || !hasChanges) {
            return;
        }

        if (
            form.relationship_role === "primary_contact" &&
            form.is_primary !== true
        ) {
            setError("Primary Contact must be marked as primary.");
            return;
        }

        if (
            form.is_primary === true &&
            form.relationship_role !== "primary_contact"
        ) {
            setError("Only Primary Contact can be marked as primary.");
            return;
        }

        if (
            form.is_primary === true &&
            form.can_manage_tenant_users !== true
        ) {
            setError("Primary Contact must have permission to manage tenant users.");
            return;
        }

        if (
            form.can_make_payments === true &&
            form.can_view_finances !== true
        ) {
            setError("Payment permission requires financial-viewing permission.");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response = await apiClient.patch(
                `/tenants/${tenantPublicId}/users/${user.link_public_id}`,
                {
                    relationship_role: form.relationship_role,
                    is_primary: form.is_primary,
                    can_view_leases: form.can_view_leases,
                    can_view_finances: form.can_view_finances,
                    can_make_payments: form.can_make_payments,
                    can_submit_maintenance: form.can_submit_maintenance,
                    can_manage_tenant_users: form.can_manage_tenant_users
                }
            );

            await onUpdated?.(
                response?.data?.data,
                user
            );
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setLoading(false);
        }
    };

    if (!open || !user) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-[2px]"
            role="presentation"
            onMouseDown={event => {
                if (
                    event.target === event.currentTarget &&
                    !loading
                ) {
                    onClose();
                }
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="update-tenant-user-title"
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <Pencil className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="update-tenant-user-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Update Tenant User
                            </h2>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                Update relationship role, primary status and tenant-portal permissions.
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

                <form onSubmit={submit} className="space-y-5 px-6 py-5">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-900">
                            {user.full_name || "Unnamed user"}
                        </p>

                        <p className="mt-1 break-all text-sm text-slate-500">
                            {user.email || "—"}
                        </p>

                        {isCurrentPrimary && (
                            <div className="mt-3 flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs leading-5 text-violet-700">
                                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                                This is the current primary contact. To replace this primary, promote another active tenant user instead of demoting this record directly.
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                            Relationship Role
                        </label>

                        <select
                            value={form.relationship_role}
                            disabled={loading || isCurrentPrimary}
                            onChange={event => changeRole(event.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                        >
                            {ROLE_OPTIONS.map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>

                        {!isCurrentPrimary && (
                            <p className="mt-1.5 text-xs leading-5 text-slate-500">
                                Selecting Primary Contact requests an atomic primary transfer. The current primary contact will be demoted by the backend when the update succeeds.
                            </p>
                        )}
                    </div>

                    {primaryTransferRequested && (
                        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                            <div>
                                <p className="font-semibold">
                                    Primary contact transfer
                                </p>
                                <p>
                                    Saving this change will make {user.full_name || "this user"} the tenant's primary contact and demote the previous primary contact.
                                </p>
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="mb-3">
                            <h3 className="text-sm font-semibold text-slate-900">
                                Permissions
                            </h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                Adjust only the permissions this tenant user should have.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {PERMISSIONS.map(([key, label, description]) => {
                                const checked = form[key] === true;
                                const locked =
                                    isCurrentPrimary &&
                                    key === "can_manage_tenant_users";

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        disabled={loading || locked}
                                        onClick={() => togglePermission(key)}
                                        className={`rounded-2xl border p-4 text-left transition ${
                                            checked
                                                ? "border-blue-200 bg-blue-50"
                                                : "border-slate-200 bg-white hover:bg-slate-50"
                                        } ${
                                            locked
                                                ? "cursor-not-allowed opacity-75"
                                                : ""
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span
                                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                                    checked
                                                        ? "border-blue-600 bg-blue-600 text-white"
                                                        : "border-slate-300 bg-white text-transparent"
                                                }`}
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                            </span>

                                            <span>
                                                <span className="block text-sm font-semibold text-slate-800">
                                                    {label}
                                                </span>
                                                <span className="mt-1 block text-xs leading-5 text-slate-500">
                                                    {description}
                                                </span>
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
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
                            leftIcon={Pencil}
                            loading={loading}
                            disabled={!hasChanges}
                        >
                            Save Changes
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default UpdateTenantUserModal;

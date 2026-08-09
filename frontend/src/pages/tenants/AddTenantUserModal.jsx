import {
    CheckCircle2,
    ChevronDown,
    Search,
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

    const [
        userSearch,
        setUserSearch
    ] = useState("");

    const [
        userOptions,
        setUserOptions
    ] = useState([]);

    const [
        usersLoading,
        setUsersLoading
    ] = useState(false);

    const [
        usersError,
        setUsersError
    ] = useState("");

    const [
        selectedUser,
        setSelectedUser
    ] = useState(null);

    const [
        showUserOptions,
        setShowUserOptions
    ] = useState(false);

    useEffect(() => {
        if (open) {
            setForm(makeForm("viewer"));
            setError("");
            setUserSearch("");
            setUserOptions([]);
            setUsersError("");
            setSelectedUser(null);
            setShowUserOptions(false);
        }
    }, [open]);

    useEffect(() => {
        if (
            !open ||
            !showUserOptions
        ) {
            return undefined;
        }

        const timeoutId =
            window.setTimeout(
                async () => {
                    try {
                        setUsersLoading(true);
                        setUsersError("");

                        const params = {
                            page: 1,
                            limit: 20
                        };

                        if (userSearch.trim()) {
                            params.search =
                                userSearch.trim();
                        }

                        const response =
                            await apiClient.get(
                                "/users",
                                {
                                    params
                                }
                            );

                        const users =
                            Array.isArray(
                                response?.data?.users
                            )
                                ? response.data.users
                                : [];

                        setUserOptions(
                            users.filter(
                                user =>
                                    user.is_verified ===
                                        true &&
                                    !user.deleted_at
                            )
                        );
                    } catch (
                        requestError
                    ) {
                        setUserOptions([]);

                        if (
                            requestError
                                ?.response
                                ?.status === 403
                        ) {
                            setUsersError(
                                "Only an administrator can search the system user directory."
                            );
                        } else {
                            setUsersError(
                                getErrorMessage(
                                    requestError
                                )
                            );
                        }
                    } finally {
                        setUsersLoading(false);
                    }
                },
                300
            );

        return () => {
            window.clearTimeout(
                timeoutId
            );
        };
    }, [
        open,
        showUserOptions,
        userSearch
    ]);

    const validationError =
        useMemo(() => {
            if (
                !selectedUser ||
                !form.user_public_id
            ) {
                return "Select a verified active user account.";
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
        }, [
            form,
            selectedUser
        ]);

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

    const selectUser = user => {
        setSelectedUser(user);

        setUserSearch(
            user.full_name ||
            user.email ||
            ""
        );

        setForm(current => ({
            ...current,
            user_public_id:
                user.public_id
        }));

        setShowUserOptions(false);
        setUsersError("");
        setError("");
    };

    const toggleUserOptions = () => {
        setShowUserOptions(
            current => !current
        );
        setUsersError("");
    };

    const handleUserSearchChange =
        event => {
            const value =
                event.target.value;

            setUserSearch(value);
            setSelectedUser(null);

            setForm(current => ({
                ...current,
                user_public_id: ""
            }));

            setShowUserOptions(true);
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
                                Select User
                            </label>

                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />

                                <input
                                    value={userSearch}
                                    onChange={
                                        handleUserSearchChange
                                    }
                                    placeholder="Search by name or email"
                                    autoComplete="off"
                                    role="combobox"
                                    aria-expanded={
                                        showUserOptions
                                    }
                                    aria-autocomplete="list"
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-12 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />

                                <button
                                    type="button"
                                    onClick={
                                        toggleUserOptions
                                    }
                                    aria-label={
                                        showUserOptions
                                            ? "Close user list"
                                            : "Select from user list"
                                    }
                                    title={
                                        showUserOptions
                                            ? "Close user list"
                                            : "Select user"
                                    }
                                    className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                >
                                    <ChevronDown
                                        className={`h-4 w-4 transition-transform ${
                                            showUserOptions
                                                ? "rotate-180"
                                                : ""
                                        }`}
                                    />
                                </button>

                                {showUserOptions && (
                                    <div
                                        role="listbox"
                                        className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
                                    >
                                        {usersLoading ? (
                                            <div className="px-3 py-4 text-sm text-slate-500">
                                                Searching users...
                                            </div>
                                        ) : usersError ? (
                                            <div className="px-3 py-4 text-sm text-rose-600">
                                                {usersError}
                                            </div>
                                        ) : userOptions.length ===
                                          0 ? (
                                            <div className="px-3 py-4 text-sm text-slate-500">
                                                No verified active users found.
                                            </div>
                                        ) : (
                                            userOptions.map(
                                                user => (
                                                    <button
                                                        key={
                                                            user.public_id
                                                        }
                                                        type="button"
                                                        role="option"
                                                        aria-selected={
                                                            selectedUser?.public_id ===
                                                            user.public_id
                                                        }
                                                        onClick={() =>
                                                            selectUser(
                                                                user
                                                            )
                                                        }
                                                        className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-slate-50"
                                                    >
                                                        <span className="min-w-0">
                                                            <span className="block truncate text-sm font-semibold text-slate-900">
                                                                {
                                                                    user.full_name
                                                                }
                                                            </span>

                                                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                                                                {
                                                                    user.email
                                                                }
                                                            </span>
                                                        </span>

                                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Verified
                                                        </span>
                                                    </button>
                                                )
                                            )
                                        )}
                                    </div>
                                )}
                            </div>

                            {selectedUser && (
                                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-emerald-900">
                                                {
                                                    selectedUser.full_name
                                                }
                                            </p>

                                            <p className="mt-0.5 break-all text-xs text-emerald-700">
                                                {
                                                    selectedUser.email
                                                }
                                            </p>

                                            <p className="mt-1 text-xs font-medium text-emerald-700">
                                                Selected account ·{" "}
                                                {
                                                    selectedUser.role
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <p className="mt-1.5 text-xs leading-5 text-slate-500">
                                Type a name or email to search, or use the select icon to browse verified active users. The public ID is attached automatically.
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

import {
    KeyRound,
    LoaderCircle,
    ShieldCheck,
    UserRoundCog,
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

import {
    useAuth
} from "../../contexts/AuthContext";

const ADMIN_ROLES = [
    ["owner", "Owner"],
    ["representative", "Representative"],
    ["manager", "Manager"],
    ["accountant", "Accountant"],
    ["viewer", "Viewer"]
];

const REGULAR_ROLES = [
    ["representative", "Representative"],
    ["manager", "Manager"],
    ["accountant", "Accountant"],
    ["viewer", "Viewer"]
];

const PRIMARY_ELIGIBLE_ROLES = [
    "owner",
    "representative",
    "manager"
];

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.msg ||
    error?.message ||
    "Unable to update owner user.";

const PermissionToggle = ({
    checked,
    disabled,
    label,
    description,
    onChange
}) => (
    <button
        type="button"
        disabled={disabled}
        onClick={() => {
            if (!disabled) {
                onChange(!checked);
            }
        }}
        className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition ${
            checked
                ? "border-blue-200 bg-blue-50"
                : "border-slate-200 bg-white"
        } ${
            disabled
                ? "cursor-not-allowed opacity-55"
                : "hover:border-blue-200 hover:bg-blue-50/60"
        }`}
    >
        <div>
            <p className="text-sm font-semibold text-slate-900">
                {label}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
                {description}
            </p>
        </div>

        <span
            aria-hidden="true"
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                checked
                    ? "bg-blue-600"
                    : "bg-slate-300"
            }`}
        >
            <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                    checked
                        ? "left-6"
                        : "left-1"
                }`}
            />
        </span>
    </button>
);

function EditOwnerUserModal({
    owner,
    linkedUser,
    onClose,
    onUpdated
}) {
    const {
        user
    } = useAuth();

    const isAdmin =
        user?.role === "admin";

    const ownerPublicId =
        owner?.public_id || null;

    const linkPublicId =
        linkedUser?.link_public_id || null;

    const initial =
        useMemo(
            () => ({
                relationship_role:
                    linkedUser?.relationship_role ||
                    "viewer",
                is_primary:
                    linkedUser?.is_primary === true,
                can_manage_properties:
                    linkedUser
                        ?.can_manage_properties ===
                    true,
                can_manage_finances:
                    linkedUser
                        ?.can_manage_finances ===
                    true
            }),
            [linkedUser]
        );

    const [form, setForm] =
        useState(initial);

    const [submitting, setSubmitting] =
        useState(false);

    const [error, setError] =
        useState("");

    useEffect(() => {
        setForm(initial);
        setError("");
    }, [initial]);

    useEffect(() => {
        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !submitting
            ) {
                onClose();
            }
        };

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    }, [onClose, submitting]);

    const roleOptions =
        useMemo(
            () => {
                if (isAdmin) {
                    return ADMIN_ROLES;
                }

                if (
                    initial.relationship_role ===
                    "owner"
                ) {
                    return [
                        [
                            "owner",
                            "Owner (admin-only to assign)"
                        ],
                        ...REGULAR_ROLES
                    ];
                }

                return REGULAR_ROLES;
            },
            [isAdmin, initial.relationship_role]
        );

    const canGrantProperties =
        isAdmin ||
        owner?.can_manage_properties === true;

    const canGrantFinances =
        isAdmin ||
        owner?.can_manage_finances === true;

    const canChangePrimary =
        isAdmin &&
        initial.is_primary !== true &&
        PRIMARY_ELIGIBLE_ROLES.includes(
            form.relationship_role
        );

    const roleChangeWouldBreakPrimary =
        form.is_primary === true &&
        !PRIMARY_ELIGIBLE_ROLES.includes(
            form.relationship_role
        );

    const payload =
        useMemo(
            () => {
                const next = {};

                if (
                    form.relationship_role !==
                    initial.relationship_role
                ) {
                    next.relationship_role =
                        form.relationship_role;
                }

                if (
                    isAdmin &&
                    form.is_primary !==
                        initial.is_primary
                ) {
                    next.is_primary =
                        form.is_primary;
                }

                if (
                    form.can_manage_properties !==
                    initial.can_manage_properties
                ) {
                    next.can_manage_properties =
                        form.can_manage_properties;
                }

                if (
                    form.can_manage_finances !==
                    initial.can_manage_finances
                ) {
                    next.can_manage_finances =
                        form.can_manage_finances;
                }

                return next;
            },
            [form, initial, isAdmin]
        );

    const hasChanges =
        Object.keys(payload).length > 0;

    const canSubmit =
        Boolean(
            ownerPublicId &&
            linkPublicId &&
            hasChanges &&
            !roleChangeWouldBreakPrimary &&
            !submitting
        );

    const setField = (
        field,
        value
    ) => {
        setForm(current => ({
            ...current,
            [field]: value
        }));
        setError("");
    };

    const handleRoleChange = event => {
        const nextRole =
            event.target.value;

        if (
            !isAdmin &&
            nextRole === "owner"
        ) {
            return;
        }

        setForm(current => ({
            ...current,
            relationship_role: nextRole,
            is_primary:
                current.is_primary &&
                !PRIMARY_ELIGIBLE_ROLES.includes(
                    nextRole
                ) &&
                initial.is_primary !== true
                    ? false
                    : current.is_primary
        }));
        setError("");
    };

    const handleSubmit = async event => {
        event.preventDefault();

        if (!hasChanges) {
            setError(
                "No changes to save."
            );
            return;
        }

        if (roleChangeWouldBreakPrimary) {
            setError(
                "A primary representative must keep the Owner, Representative, or Manager relationship role."
            );
            return;
        }

        if (!canSubmit) {
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const response =
                await apiClient.patch(
                    `/owners/${ownerPublicId}/users/${linkPublicId}`,
                    payload
                );

            onUpdated(
                response?.data?.data ||
                response?.data ||
                null
            );
        } catch (requestError) {
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (
        !ownerPublicId ||
        !linkPublicId
    ) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
            onMouseDown={event => {
                if (
                    !submitting &&
                    event.target ===
                        event.currentTarget
                ) {
                    onClose();
                }
            }}
        >
            <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                            <UserRoundCog className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                                Edit Owner User
                            </p>
                            <h2 className="mt-1 truncate text-xl font-bold text-slate-950 sm:text-2xl">
                                {linkedUser?.full_name ||
                                    "Owner user"}
                            </h2>
                            <p className="mt-1 break-all text-sm text-slate-500">
                                {linkedUser?.email ||
                                    "No email available"}
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close edit owner user"
                        icon={X}
                        onClick={onClose}
                        disabled={submitting}
                    />
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="overflow-y-auto p-5 sm:p-6">
                        {error && (
                            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
                                {error}
                            </div>
                        )}

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Owner
                                    </p>
                                    <p className="mt-1 font-bold text-slate-900">
                                        {owner?.display_name ||
                                            "Owner"}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                    <KeyRound className="h-4 w-4 text-blue-600" />
                                    Server-authorized access
                                </div>
                            </div>
                        </div>

                        <div className="mt-5">
                            <label
                                htmlFor="owner-user-edit-role"
                                className="mb-2 block text-sm font-semibold text-slate-800"
                            >
                                Relationship Role
                            </label>

                            <select
                                id="owner-user-edit-role"
                                value={form.relationship_role}
                                onChange={handleRoleChange}
                                disabled={submitting}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {roleOptions.map(
                                    ([value, label]) => (
                                        <option
                                            key={value}
                                            value={value}
                                            disabled={
                                                (!isAdmin &&
                                                    value ===
                                                        "owner") ||
                                                (initial.is_primary ===
                                                    true &&
                                                    !PRIMARY_ELIGIBLE_ROLES.includes(
                                                        value
                                                    ))
                                            }
                                        >
                                            {label}
                                        </option>
                                    )
                                )}
                            </select>

                            {!isAdmin && (
                                <p className="mt-2 text-xs leading-5 text-slate-500">
                                    Only administrators can assign the Owner relationship role or change primary representative status.
                                </p>
                            )}
                        </div>

                        <div className="mt-6">
                            <div className="mb-3 flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-slate-500" />
                                <h3 className="text-sm font-bold text-slate-800">
                                    Primary representative
                                </h3>
                            </div>

                            {isAdmin ? (
                                <PermissionToggle
                                    checked={form.is_primary}
                                    disabled={
                                        submitting ||
                                        initial.is_primary ||
                                        !canChangePrimary
                                    }
                                    label={
                                        initial.is_primary
                                            ? "Current primary representative"
                                            : "Make primary representative"
                                    }
                                    description={
                                        initial.is_primary
                                            ? "The current primary cannot be demoted directly. Promote another eligible owner user instead; the backend will transfer primary status atomically."
                                            : PRIMARY_ELIGIBLE_ROLES.includes(
                                                    form.relationship_role
                                                )
                                              ? "Promoting this user will automatically demote the previous primary representative."
                                              : "Primary status is available only for Owner, Representative, or Manager roles."
                                    }
                                    onChange={value =>
                                        setField(
                                            "is_primary",
                                            value
                                        )
                                    }
                                />
                            ) : (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                    <p className="font-semibold text-slate-800">
                                        {initial.is_primary
                                            ? "Primary: Yes"
                                            : "Primary: No"}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                        Primary representative status is administrator-controlled.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6">
                            <div className="mb-3 flex items-center gap-2">
                                <KeyRound className="h-4 w-4 text-slate-500" />
                                <h3 className="text-sm font-bold text-slate-800">
                                    Permissions
                                </h3>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <PermissionToggle
                                    checked={
                                        form.can_manage_properties
                                    }
                                    disabled={
                                        submitting ||
                                        (!canGrantProperties &&
                                            form.can_manage_properties ===
                                                false)
                                    }
                                    label="Manage properties"
                                    description={
                                        canGrantProperties
                                            ? "Allow property-management operations for this owner."
                                            : form.can_manage_properties
                                              ? "You may remove this permission, but cannot grant it again because your own owner relationship lacks property-management permission."
                                              : "Your owner relationship does not allow granting property-management permission."
                                    }
                                    onChange={value =>
                                        setField(
                                            "can_manage_properties",
                                            value
                                        )
                                    }
                                />

                                <PermissionToggle
                                    checked={
                                        form.can_manage_finances
                                    }
                                    disabled={
                                        submitting ||
                                        (!canGrantFinances &&
                                            form.can_manage_finances ===
                                                false)
                                    }
                                    label="Manage finances"
                                    description={
                                        canGrantFinances
                                            ? "Allow financial-management operations for this owner."
                                            : form.can_manage_finances
                                              ? "You may remove this permission, but cannot grant it again because your own owner relationship lacks financial permission."
                                              : "Your owner relationship does not allow granting financial permission."
                                    }
                                    onChange={value =>
                                        setField(
                                            "can_manage_finances",
                                            value
                                        )
                                    }
                                />
                            </div>
                        </div>

                        {roleChangeWouldBreakPrimary && (
                            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                A primary representative must use the Owner, Representative, or Manager role. Transfer primary status to another user before choosing Accountant or Viewer.
                            </div>
                        )}

                        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-5 text-blue-800">
                            The frontend sends only fields that changed. Backend authorization, primary-transfer rules, and anti-privilege-escalation checks remain authoritative.
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            disabled={!canSubmit}
                        >
                            {submitting ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                                <UserRoundCog className="h-4 w-4" />
                            )}
                            {submitting
                                ? "Saving..."
                                : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EditOwnerUserModal;

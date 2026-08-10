import {
    CheckCircle2,
    ChevronDown,
    KeyRound,
    LoaderCircle,
    Search,
    ShieldCheck,
    UserPlus,
    UserRound,
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
    "Unable to add owner user.";

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

function AddOwnerUserModal({
    owner,
    onClose,
    onAdded
}) {
    const {
        user
    } = useAuth();

    const isAdmin =
        user?.role === "admin";

    const [form, setForm] =
        useState({
            user_public_id: "",
            relationship_role: "viewer",
            is_primary: false,
            can_manage_properties: false,
            can_manage_finances: false
        });

    const [submitting, setSubmitting] =
        useState(false);

    const [error, setError] =
        useState("");

    const [eligibleUsers, setEligibleUsers] =
        useState([]);

    const [eligibleLoading, setEligibleLoading] =
        useState(false);

    const [eligibleError, setEligibleError] =
        useState("");

    const [selectorOpen, setSelectorOpen] =
        useState(false);

    const [userSearch, setUserSearch] =
        useState("");

    const ownerPublicId =
        owner?.public_id || null;

    const roleOptions =
        isAdmin
            ? ADMIN_ROLES
            : REGULAR_ROLES;

    const canGrantProperties =
        isAdmin ||
        owner?.can_manage_properties === true;

    const canGrantFinances =
        isAdmin ||
        owner?.can_manage_finances === true;

    const canAssignPrimary =
        isAdmin &&
        PRIMARY_ELIGIBLE_ROLES.includes(
            form.relationship_role
        );

    const normalizedUserPublicId =
        form.user_public_id.trim();

    const selectedUser =
        useMemo(
            () =>
                eligibleUsers.find(
                    eligibleUser =>
                        eligibleUser.public_id ===
                        normalizedUserPublicId
                ) || null,
            [
                eligibleUsers,
                normalizedUserPublicId
            ]
        );

    const filteredEligibleUsers =
        useMemo(
            () => {
                const normalizedSearch =
                    userSearch
                        .trim()
                        .toLowerCase();

                if (!normalizedSearch) {
                    return eligibleUsers;
                }

                return eligibleUsers.filter(
                    eligibleUser =>
                        [
                            eligibleUser.full_name,
                            eligibleUser.email,
                            eligibleUser.role
                        ]
                            .filter(Boolean)
                            .some(value =>
                                String(value)
                                    .toLowerCase()
                                    .includes(
                                        normalizedSearch
                                    )
                            )
                );
            },
            [
                eligibleUsers,
                userSearch
            ]
        );

    const canSubmit =
        useMemo(
            () =>
                Boolean(
                    ownerPublicId &&
                    normalizedUserPublicId &&
                    selectedUser &&
                    !submitting
                ),
            [
                ownerPublicId,
                normalizedUserPublicId,
                selectedUser,
                submitting
            ]
        );

    useEffect(() => {
        if (!ownerPublicId) {
            return;
        }

        let active = true;

        const loadEligibleUsers =
            async () => {
                try {
                    setEligibleLoading(true);
                    setEligibleError("");

                    const response =
                        await apiClient.get(
                            `/owners/${ownerPublicId}/users/eligible`
                        );

                    if (!active) {
                        return;
                    }

                    const payload =
                        response?.data?.data ||
                        response?.data ||
                        {};

                    setEligibleUsers(
                        Array.isArray(
                            payload?.users
                        )
                            ? payload.users
                            : []
                    );
                } catch (requestError) {
                    if (!active) {
                        return;
                    }

                    setEligibleUsers([]);
                    setEligibleError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    if (active) {
                        setEligibleLoading(false);
                    }
                }
            };

        loadEligibleUsers();

        return () => {
            active = false;
        };
    }, [ownerPublicId]);

    useEffect(() => {
        const handleKeyDown = event => {
            if (
                event.key !== "Escape" ||
                submitting
            ) {
                return;
            }

            if (selectorOpen) {
                setSelectorOpen(false);
                return;
            }

            onClose();
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
    }, [
        onClose,
        selectorOpen,
        submitting
    ]);

    useEffect(() => {
        if (
            form.is_primary &&
            !canAssignPrimary
        ) {
            setForm(current => ({
                ...current,
                is_primary: false
            }));
        }
    }, [
        form.is_primary,
        canAssignPrimary
    ]);

    if (!ownerPublicId) {
        return null;
    }

    const updateField = (
        field,
        value
    ) => {
        setForm(current => ({
            ...current,
            [field]: value
        }));
        setError("");
    };

    const selectEligibleUser =
        eligibleUser => {
            setForm(current => ({
                ...current,
                user_public_id:
                    eligibleUser.public_id
            }));
            setUserSearch("");
            setSelectorOpen(false);
            setError("");
        };

    const clearSelectedUser = () => {
        setForm(current => ({
            ...current,
            user_public_id: ""
        }));
        setUserSearch("");
        setSelectorOpen(true);
        setError("");
    };

    const handleSubmit =
        async event => {
            event.preventDefault();

            if (!canSubmit) {
                return;
            }

            try {
                setSubmitting(true);
                setError("");

                const requestBody = {
                    user_public_id:
                        normalizedUserPublicId,
                    relationship_role:
                        form.relationship_role,
                    is_primary:
                        isAdmin
                            ? form.is_primary
                            : false,
                    can_manage_properties:
                        canGrantProperties
                            ? form.can_manage_properties
                            : false,
                    can_manage_finances:
                        canGrantFinances
                            ? form.can_manage_finances
                            : false
                };

                const response =
                    await apiClient.post(
                        `/owners/${ownerPublicId}/users`,
                        requestBody
                    );

                const payload =
                    response?.data?.data ||
                    response?.data ||
                    {};

                await onAdded?.(payload);
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

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
            onMouseDown={event => {
                if (
                    event.target ===
                        event.currentTarget &&
                    !submitting
                ) {
                    onClose();
                }
            }}
        >
            <form
                onSubmit={handleSubmit}
                className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                            <UserPlus className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                                Add Owner User
                            </p>

                            <h2 className="mt-1 truncate text-xl font-bold text-slate-950 sm:text-2xl">
                                {owner?.display_name ||
                                    "Owner"}
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Link an existing verified login account to this owner.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close add owner user"
                        icon={X}
                        onClick={onClose}
                        disabled={submitting}
                    />
                </div>

                <div className="overflow-y-auto p-5 sm:p-6">
                    {error && (
                        <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                            <p className="font-semibold">
                                Owner user was not added
                            </p>
                            <p className="mt-1">
                                {error}
                            </p>
                        </div>
                    )}

                    <div className="space-y-5">
                        <div>
                            <label
                                className="text-sm font-semibold text-slate-800"
                            >
                                Select User
                            </label>

                            <div className="relative mt-2">
                                <button
                                    type="button"
                                    autoFocus
                                    disabled={
                                        eligibleLoading ||
                                        submitting
                                    }
                                    onClick={() =>
                                        setSelectorOpen(
                                            current =>
                                                !current
                                        )
                                    }
                                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left outline-none transition hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
                                >
                                    <span className="flex min-w-0 items-center gap-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                                            {eligibleLoading ? (
                                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <UserRound className="h-4 w-4" />
                                            )}
                                        </span>

                                        <span className="min-w-0">
                                            {selectedUser ? (
                                                <>
                                                    <span className="block truncate text-sm font-semibold text-slate-900">
                                                        {selectedUser.full_name}
                                                    </span>
                                                    <span className="block truncate text-xs text-slate-500">
                                                        {selectedUser.email}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="block text-sm font-medium text-slate-700">
                                                        {eligibleLoading
                                                            ? "Loading eligible users..."
                                                            : "Choose a verified user"}
                                                    </span>
                                                    <span className="block text-xs text-slate-500">
                                                        Search by name or email
                                                    </span>
                                                </>
                                            )}
                                        </span>
                                    </span>

                                    <ChevronDown
                                        className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                                            selectorOpen
                                                ? "rotate-180"
                                                : ""
                                        }`}
                                    />
                                </button>

                                {selectorOpen &&
                                    !eligibleLoading && (
                                    <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                                        <div className="border-b border-slate-100 p-3">
                                            <div className="relative">
                                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                                                <input
                                                    type="search"
                                                    autoComplete="off"
                                                    value={
                                                        userSearch
                                                    }
                                                    onChange={event =>
                                                        setUserSearch(
                                                            event.target.value
                                                        )
                                                    }
                                                    placeholder="Search by name or email..."
                                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                                                />
                                            </div>
                                        </div>

                                        <div className="max-h-64 overflow-y-auto p-2">
                                            {eligibleError ? (
                                                <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                                                    {eligibleError}
                                                </div>
                                            ) : filteredEligibleUsers.length ===
                                              0 ? (
                                                <div className="px-3 py-6 text-center">
                                                    <p className="text-sm font-semibold text-slate-700">
                                                        No eligible users found
                                                    </p>
                                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                                        Only verified users without an active link to this owner appear here.
                                                    </p>
                                                </div>
                                            ) : (
                                                filteredEligibleUsers.map(
                                                    eligibleUser => (
                                                        <button
                                                            key={
                                                                eligibleUser.public_id
                                                            }
                                                            type="button"
                                                            onClick={() =>
                                                                selectEligibleUser(
                                                                    eligibleUser
                                                                )
                                                            }
                                                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition ${
                                                                selectedUser?.public_id ===
                                                                eligibleUser.public_id
                                                                    ? "bg-blue-50"
                                                                    : "hover:bg-slate-50"
                                                            }`}
                                                        >
                                                            <span className="min-w-0">
                                                                <span className="block truncate text-sm font-semibold text-slate-900">
                                                                    {eligibleUser.full_name}
                                                                </span>
                                                                <span className="mt-0.5 block truncate text-xs text-slate-500">
                                                                    {eligibleUser.email}
                                                                </span>

                                                                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                                                    <CheckCircle2 className="h-3 w-3" />
                                                                    Verified
                                                                </span>
                                                            </span>

                                                            <span className="shrink-0 text-xs font-semibold text-slate-500">
                                                                {String(
                                                                    eligibleUser.role ||
                                                                        "user"
                                                                )
                                                                    .replaceAll(
                                                                        "_",
                                                                        " "
                                                                    )
                                                                    .replace(
                                                                        /\b\w/g,
                                                                        character =>
                                                                            character.toUpperCase()
                                                                    )}
                                                            </span>
                                                        </button>
                                                    )
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {selectedUser && (
                                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                                    <p className="min-w-0 truncate text-xs text-slate-500">
                                        Selected account:{" "}
                                        <span className="font-semibold text-slate-700">
                                            {selectedUser.full_name}
                                        </span>
                                    </p>

                                    <button
                                        type="button"
                                        onClick={
                                            clearSelectedUser
                                        }
                                        disabled={
                                            submitting
                                        }
                                        className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                                    >
                                        Change
                                    </button>
                                </div>
                            )}

                            {!eligibleLoading &&
                                !eligibleError &&
                                eligibleUsers.length === 0 && (
                                <p className="mt-2 text-xs leading-5 text-amber-700">
                                    There are currently no verified users available to link to this owner.
                                </p>
                            )}

                            {eligibleError && (
                                <p className="mt-2 text-xs leading-5 text-rose-600">
                                    {eligibleError}
                                </p>
                            )}

                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                Only eligible verified accounts are displayed. The selected account's public ID is sent to the API automatically.
                            </p>
                        </div>

                        <div>
                            <label
                                htmlFor="owner-user-role"
                                className="text-sm font-semibold text-slate-800"
                            >
                                Relationship Role
                            </label>

                            <select
                                id="owner-user-role"
                                value={
                                    form.relationship_role
                                }
                                onChange={event =>
                                    updateField(
                                        "relationship_role",
                                        event.target.value
                                    )
                                }
                                className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                {roleOptions.map(
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

                            {!isAdmin && (
                                <p className="mt-2 text-xs leading-5 text-slate-500">
                                    Only administrators can assign the owner relationship role.
                                </p>
                            )}
                        </div>

                        <div>
                            <div className="mb-2 flex items-center gap-2">
                                <KeyRound className="h-4 w-4 text-slate-500" />
                                <h3 className="text-sm font-bold text-slate-900">
                                    Permissions
                                </h3>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <PermissionToggle
                                    checked={
                                        form.can_manage_properties
                                    }
                                    disabled={
                                        !canGrantProperties
                                    }
                                    label="Manage properties"
                                    description={
                                        canGrantProperties
                                            ? "Allow property-management operations for this owner."
                                            : "You cannot grant a property permission that your own link does not have."
                                    }
                                    onChange={value =>
                                        updateField(
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
                                        !canGrantFinances
                                    }
                                    label="Manage finances"
                                    description={
                                        canGrantFinances
                                            ? "Allow financial-management operations for this owner."
                                            : "You cannot grant a finance permission that your own link does not have."
                                    }
                                    onChange={value =>
                                        updateField(
                                            "can_manage_finances",
                                            value
                                        )
                                    }
                                />
                            </div>
                        </div>

                        <div
                            className={`rounded-2xl border p-4 ${
                                canAssignPrimary
                                    ? "border-amber-200 bg-amber-50"
                                    : "border-slate-200 bg-slate-50"
                            }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck
                                        className={`mt-0.5 h-5 w-5 ${
                                            canAssignPrimary
                                                ? "text-amber-700"
                                                : "text-slate-400"
                                        }`}
                                    />

                                    <div>
                                        <p className="text-sm font-bold text-slate-900">
                                            Primary representative
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                            Only one active primary link is allowed for an owner. Primary assignment is an administrator-controlled action.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    disabled={
                                        !canAssignPrimary
                                    }
                                    onClick={() =>
                                        updateField(
                                            "is_primary",
                                            !form.is_primary
                                        )
                                    }
                                    className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${
                                        form.is_primary
                                            ? "bg-amber-600"
                                            : "bg-slate-300"
                                    } ${
                                        !canAssignPrimary
                                            ? "cursor-not-allowed opacity-50"
                                            : ""
                                    }`}
                                >
                                    <span
                                        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                                            form.is_primary
                                                ? "left-6"
                                                : "left-1"
                                        }`}
                                    />
                                </button>
                            </div>

                            {isAdmin &&
                                !PRIMARY_ELIGIBLE_ROLES.includes(
                                    form.relationship_role
                                ) && (
                                <p className="mt-3 text-xs font-medium text-slate-500">
                                    Choose Owner, Representative or Manager before assigning primary status.
                                </p>
                            )}
                        </div>

                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
                                <div>
                                    <p className="text-sm font-semibold text-emerald-900">
                                        Backend remains authoritative
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-emerald-800">
                                        Duplicate active links, unverified users, second primary links and unauthorized permission grants are rejected by the API even if a request is manually constructed.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
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
                        <UserPlus className="h-4 w-4" />
                        {submitting
                            ? "Adding..."
                            : "Add Owner User"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default AddOwnerUserModal;

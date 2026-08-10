import {
    Check,
    Pencil,
    Plus,
    RefreshCw,
    ShieldCheck,
    UserMinus,
    UserRound,
    UsersRound,
    X,
    XCircle
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import AddOwnerUserModal from "./AddOwnerUserModal";
import EditOwnerUserModal from "./EditOwnerUserModal";
import RevokeOwnerUserModal from "./RevokeOwnerUserModal";

import {
    useAuth
} from "../../contexts/AuthContext";

import {
    Button,
    IconButton
} from "../../components/ui/Button";

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

const formatDateTime = value => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString();
};

const getInitials = value => {
    const words = String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);

    if (!words.length) {
        return "OU";
    }

    return words
        .map(word => word[0])
        .join("")
        .toUpperCase();
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load owner users.";

const PermissionBadge = ({
    allowed,
    label
}) => (
    <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
            allowed
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-slate-100 text-slate-500 ring-slate-200"
        }`}
    >
        {allowed ? (
            <Check className="h-3.5 w-3.5" />
        ) : (
            <XCircle className="h-3.5 w-3.5" />
        )}
        {label}
    </span>
);

function OwnerUsersModal({
    owner,
    onClose
}) {
    const {
        user
    } = useAuth();

    const [data, setData] =
        useState(null);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");

    const [addOpen, setAddOpen] =
        useState(false);

    const [editUser, setEditUser] =
        useState(null);

    const [revokeUser, setRevokeUser] =
        useState(null);

    const [success, setSuccess] =
        useState("");

    const ownerPublicId =
        owner?.public_id || null;

    const canManageOwnerUsers =
        user?.role === "admin" ||
        Boolean(
            owner?.is_primary &&
            [
                "owner",
                "representative",
                "manager"
            ].includes(
                owner?.relationship_role
            )
        );

    const canAddOwnerUser =
        canManageOwnerUsers;

    const canEditOwnerUser =
        canManageOwnerUsers;

    const canRevokeOwnerUser =
        canManageOwnerUsers;

    const canRevokeLink = linkedUser =>
        canRevokeOwnerUser &&
        linkedUser?.is_primary !== true &&
        (
            user?.role === "admin" ||
            linkedUser?.relationship_role !==
                "owner"
        );

    const getRevokeProtectionLabel =
        linkedUser => {
            if (linkedUser?.is_primary) {
                return "Primary protected";
            }

            if (
                user?.role !== "admin" &&
                linkedUser?.relationship_role ===
                    "owner"
            ) {
                return "Owner role protected";
            }

            return "";
        };

    const loadOwnerUsers =
        useCallback(
            async () => {
                if (!ownerPublicId) {
                    return;
                }

                try {
                    setLoading(true);
                    setError("");

                    const response =
                        await apiClient.get(
                            `/owners/${ownerPublicId}/users`
                        );

                    const payload =
                        response?.data?.data ||
                        response?.data ||
                        {};

                    setData({
                        owner:
                            payload?.owner ||
                            owner,
                        users:
                            Array.isArray(
                                payload?.users
                            )
                                ? payload.users
                                : []
                    });
                } catch (requestError) {
                    setData(null);
                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            [ownerPublicId, owner]
        );

    useEffect(() => {
        if (!ownerPublicId) {
            return undefined;
        }

        loadOwnerUsers();

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !addOpen &&
                !editUser &&
                !revokeUser
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
    }, [
        ownerPublicId,
        loadOwnerUsers,
        onClose,
        addOpen,
        editUser,
        revokeUser
    ]);

    const users =
        data?.users || [];

    const primaryCount =
        useMemo(
            () =>
                users.filter(
                    linkedUser =>
                        linkedUser.is_primary
                ).length,
            [users]
        );

    if (!ownerPublicId) {
        return null;
    }

    const displayOwner =
        data?.owner || owner;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
            onMouseDown={event => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    onClose();
                }
            }}
        >
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                            <UsersRound className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                                Owner Users
                            </p>

                            <h2 className="mt-1 truncate text-xl font-bold text-slate-950 sm:text-2xl">
                                {displayOwner?.display_name ||
                                    "Owner"}
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Active users linked to this owner and their current access permissions.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close owner users"
                        icon={X}
                        onClick={onClose}
                    />
                </div>

                <div className="overflow-y-auto p-5 sm:p-6">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Linked users
                            </p>
                            <p className="mt-2 text-2xl font-bold text-slate-950">
                                {users.length}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Primary links
                            </p>
                            <p className="mt-2 text-2xl font-bold text-slate-950">
                                {primaryCount}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Owner status
                            </p>
                            <p className="mt-2 text-base font-bold text-slate-950">
                                {formatLabel(
                                    displayOwner?.status
                                ) || "—"}
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-base font-bold text-slate-950">
                                Access Directory
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                                Active linked users and their current access. Role and permission changes are controlled by the backend authority model.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={loadOwnerUsers}
                                disabled={loading}
                            >
                                <RefreshCw
                                    className={`h-4 w-4 ${
                                        loading
                                            ? "animate-spin"
                                            : ""
                                    }`}
                                />
                                Refresh
                            </Button>

                            {canAddOwnerUser && (
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setSuccess("");
                                        setAddOpen(true);
                                    }}
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Owner User
                                </Button>
                            )}
                        </div>
                    </div>

                    {success && (
                        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                            <p className="font-semibold">
                                {success}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                            <p className="font-semibold">
                                Could not load owner users
                            </p>
                            <p className="mt-1">
                                {error}
                            </p>

                            <button
                                type="button"
                                onClick={loadOwnerUsers}
                                className="mt-3 font-semibold text-rose-800 underline underline-offset-4"
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {loading && !data ? (
                        <div className="mt-5 flex min-h-52 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                            <div className="text-center">
                                <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                                <p className="mt-3 text-sm font-medium text-slate-600">
                                    Loading owner users...
                                </p>
                            </div>
                        </div>
                    ) : !error &&
                      users.length === 0 ? (
                        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                            <UsersRound className="mx-auto h-8 w-8 text-slate-400" />
                            <h4 className="mt-3 font-bold text-slate-800">
                                No active owner users
                            </h4>
                            <p className="mt-1 text-sm text-slate-500">
                                This owner currently has no active linked user records visible to your account.
                            </p>
                        </div>
                    ) : !error ? (
                        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                            <div className="hidden overflow-x-auto lg:block">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            <th className="px-5 py-3">
                                                User
                                            </th>
                                            <th className="px-4 py-3">
                                                Relationship
                                            </th>
                                            <th className="px-4 py-3">
                                                Permissions
                                            </th>
                                            <th className="px-4 py-3">
                                                Account
                                            </th>
                                            <th className="px-5 py-3">
                                                Linked
                                            </th>
                                            <th className="px-5 py-3 text-right">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {users.map(linkedUser => (
                                            <tr
                                                key={linkedUser.link_public_id}
                                                className="align-top"
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-start gap-3">
                                                        {linkedUser.profile_image_url ? (
                                                            <img
                                                                src={linkedUser.profile_image_url}
                                                                alt=""
                                                                className="h-10 w-10 rounded-2xl object-cover ring-1 ring-slate-200"
                                                            />
                                                        ) : (
                                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-xs font-bold text-blue-700">
                                                                {getInitials(
                                                                    linkedUser.full_name
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-slate-900">
                                                                {linkedUser.full_name ||
                                                                    "Unnamed user"}
                                                            </p>
                                                            <p className="mt-1 break-all text-xs text-slate-500">
                                                                {linkedUser.email ||
                                                                    "—"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <div className="space-y-2">
                                                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                                                            {formatLabel(
                                                                linkedUser.relationship_role
                                                            ) || "—"}
                                                        </span>

                                                        {linkedUser.is_primary && (
                                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                                Primary representative
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <div className="flex max-w-sm flex-wrap gap-2">
                                                        <PermissionBadge
                                                            allowed={Boolean(
                                                                linkedUser.can_manage_properties
                                                            )}
                                                            label="Properties"
                                                        />
                                                        <PermissionBadge
                                                            allowed={Boolean(
                                                                linkedUser.can_manage_finances
                                                            )}
                                                            label="Finances"
                                                        />
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <div className="space-y-1 text-sm">
                                                        <p className="font-medium text-slate-700">
                                                            {formatLabel(
                                                                linkedUser.user_role
                                                            ) || "User"}
                                                        </p>
                                                        <p
                                                            className={`text-xs font-semibold ${
                                                                linkedUser.is_verified
                                                                    ? "text-emerald-700"
                                                                    : "text-amber-700"
                                                            }`}
                                                        >
                                                            {linkedUser.is_verified
                                                                ? "Verified"
                                                                : "Not verified"}
                                                        </p>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-xs text-slate-500">
                                                    <p>
                                                        {formatDateTime(
                                                            linkedUser.created_at
                                                        )}
                                                    </p>
                                                    <p className="mt-1">
                                                        Updated: {formatDateTime(
                                                            linkedUser.updated_at
                                                        )}
                                                    </p>
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    {canManageOwnerUsers ? (
                                                        <div className="flex flex-col items-end gap-2">
                                                            {canEditOwnerUser && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSuccess(
                                                                            ""
                                                                        );
                                                                        setEditUser(
                                                                            linkedUser
                                                                        );
                                                                    }}
                                                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                    Edit access
                                                                </button>
                                                            )}

                                                            {canRevokeLink(
                                                                linkedUser
                                                            ) ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSuccess(
                                                                            ""
                                                                        );
                                                                        setRevokeUser(
                                                                            linkedUser
                                                                        );
                                                                    }}
                                                                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                                                                >
                                                                    <UserMinus className="h-3.5 w-3.5" />
                                                                    Revoke access
                                                                </button>
                                                            ) : getRevokeProtectionLabel(
                                                                linkedUser
                                                            ) ? (
                                                                <span className="text-xs font-medium text-slate-400">
                                                                    {getRevokeProtectionLabel(
                                                                        linkedUser
                                                                    )}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">
                                                            View only
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="divide-y divide-slate-100 lg:hidden">
                                {users.map(linkedUser => (
                                    <article
                                        key={linkedUser.link_public_id}
                                        className="space-y-4 p-4"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-xs font-bold text-blue-700">
                                                {getInitials(
                                                    linkedUser.full_name
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-900">
                                                    {linkedUser.full_name ||
                                                        "Unnamed user"}
                                                </p>
                                                <p className="mt-1 break-all text-xs text-slate-500">
                                                    {linkedUser.email ||
                                                        "—"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                                                {formatLabel(
                                                    linkedUser.relationship_role
                                                ) || "—"}
                                            </span>

                                            {linkedUser.is_primary && (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                                                    <ShieldCheck className="h-3.5 w-3.5" />
                                                    Primary
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <PermissionBadge
                                                allowed={Boolean(
                                                    linkedUser.can_manage_properties
                                                )}
                                                label="Properties"
                                            />
                                            <PermissionBadge
                                                allowed={Boolean(
                                                    linkedUser.can_manage_finances
                                                )}
                                                label="Finances"
                                            />
                                        </div>

                                        <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                                            <p>
                                                <span className="font-semibold text-slate-700">
                                                    Account:
                                                </span>{" "}
                                                {formatLabel(
                                                    linkedUser.user_role
                                                ) || "User"}
                                            </p>
                                            <p>
                                                <span className="font-semibold text-slate-700">
                                                    Verification:
                                                </span>{" "}
                                                {linkedUser.is_verified
                                                    ? "Verified"
                                                    : "Not verified"}
                                            </p>
                                        </div>

                                        {canManageOwnerUsers && (
                                            <div className="flex flex-wrap gap-2">
                                                {canEditOwnerUser && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        onClick={() => {
                                                            setSuccess(
                                                                ""
                                                            );
                                                            setEditUser(
                                                                linkedUser
                                                            );
                                                        }}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                        Edit access
                                                    </Button>
                                                )}

                                                {canRevokeLink(
                                                    linkedUser
                                                ) ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSuccess(
                                                                ""
                                                            );
                                                            setRevokeUser(
                                                                linkedUser
                                                            );
                                                        }}
                                                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                                                    >
                                                        <UserMinus className="h-4 w-4" />
                                                        Revoke access
                                                    </button>
                                                ) : getRevokeProtectionLabel(
                                                    linkedUser
                                                ) ? (
                                                    <span className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                                                        {getRevokeProtectionLabel(
                                                            linkedUser
                                                        )}
                                                    </span>
                                                ) : null}
                                            </div>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                    <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
                        <UserRound className="h-4 w-4" />
                        Only active, non-revoked links are listed.
                    </div>

                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                    >
                        Close
                    </Button>
                </div>
            </div>

            {addOpen && (
                <AddOwnerUserModal
                    owner={owner}
                    onClose={() =>
                        setAddOpen(false)
                    }
                    onAdded={async result => {
                        const addedUser =
                            result?.user;

                        setAddOpen(false);
                        setSuccess(
                            `${
                                addedUser?.full_name ||
                                "Owner user"
                            } linked successfully.`
                        );

                        await loadOwnerUsers();
                    }}
                />
            )}

            {editUser && (
                <EditOwnerUserModal
                    owner={owner}
                    linkedUser={editUser}
                    onClose={() =>
                        setEditUser(null)
                    }
                    onUpdated={async () => {
                        const updatedName =
                            editUser?.full_name ||
                            "Owner user";

                        setEditUser(null);
                        setSuccess(
                            `${updatedName} access updated successfully.`
                        );

                        await loadOwnerUsers();
                    }}
                />
            )}

            {revokeUser && (
                <RevokeOwnerUserModal
                    owner={owner}
                    linkedUser={revokeUser}
                    onClose={() =>
                        setRevokeUser(null)
                    }
                    onRevoked={async result => {
                        const revokedName =
                            result?.user?.full_name ||
                            revokeUser?.full_name ||
                            "Owner user";

                        setRevokeUser(null);
                        setSuccess(
                            `${revokedName} access revoked successfully.`
                        );

                        await loadOwnerUsers();
                    }}
                />
            )}
        </div>
    );
}

export default OwnerUsersModal;

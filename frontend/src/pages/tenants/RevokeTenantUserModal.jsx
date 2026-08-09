import {
    AlertTriangle,
    Trash2,
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
    error?.message ||
    "Unable to revoke the tenant user.";

function RevokeTenantUserModal({
    open,
    tenantPublicId,
    user,
    onClose,
    onRevoked
}) {
    const [
        loading,
        setLoading
    ] = useState(false);

    const [error, setError] =
        useState("");

    useEffect(() => {
        if (!open) {
            setError("");
            setLoading(false);
            return undefined;
        }

        const handleKeyDown =
            event => {
                if (
                    event.key ===
                        "Escape" &&
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

    if (
        !open ||
        !user
    ) {
        return null;
    }

    const revoke =
        async () => {
            if (
                loading ||
                !user.link_public_id
            ) {
                return;
            }

            if (
                user.is_primary ===
                true
            ) {
                setError(
                    "The current primary contact cannot be revoked directly. Promote another active tenant user to primary first."
                );
                return;
            }

            try {
                setLoading(true);
                setError("");

                const response =
                    await apiClient.delete(
                        `/tenants/${tenantPublicId}/users/${user.link_public_id}`
                    );

                await onRevoked?.(
                    response?.data?.data,
                    user
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
                aria-labelledby="revoke-tenant-user-title"
                className="
                    w-full max-w-lg
                    overflow-hidden
                    rounded-3xl
                    border border-slate-200
                    bg-white
                    shadow-2xl
                "
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                            <AlertTriangle className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="revoke-tenant-user-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Revoke Tenant User
                            </h2>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                Remove this user's current tenant-portal access while preserving the relationship history for audit.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close"
                        icon={X}
                        disabled={
                            loading
                        }
                        onClick={
                            onClose
                        }
                    />
                </div>

                <div className="space-y-4 px-6 py-5">
                    <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
                        <p className="text-sm font-semibold text-rose-900">
                            {user.full_name ||
                                "Unnamed user"}
                        </p>

                        <p className="mt-1 break-all text-sm text-rose-700">
                            {user.email ||
                                "—"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                                {formatLabel(
                                    user.relationship_role
                                )}
                            </span>

                            {user.can_manage_tenant_users && (
                                <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                                    Tenant Manager
                                </span>
                            )}
                        </div>
                    </div>

                    <p className="text-sm leading-6 text-slate-600">
                        Revoking this relationship does not delete the login account. It only ends this active tenant-user relationship.
                    </p>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                        Primary contacts cannot be revoked directly. Another active tenant user must first be promoted to Primary Contact.
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
                        >
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={
                            loading
                        }
                        onClick={
                            onClose
                        }
                    >
                        Cancel
                    </Button>

                    <button
                        type="button"
                        disabled={
                            loading ||
                            user.is_primary ===
                                true
                        }
                        onClick={
                            revoke
                        }
                        className="
                            inline-flex min-h-10
                            items-center justify-center
                            gap-2 rounded-xl
                            bg-rose-600
                            px-4 py-2.5
                            text-sm font-semibold
                            text-white
                            shadow-sm
                            transition
                            hover:bg-rose-700
                            focus:outline-none
                            focus:ring-4
                            focus:ring-rose-100
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                        "
                    >
                        <Trash2 className="h-4 w-4" />

                        {loading
                            ? "Revoking..."
                            : "Revoke Access"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default RevokeTenantUserModal;

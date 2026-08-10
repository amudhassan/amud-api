import {
    AlertTriangle,
    ShieldAlert,
    UserMinus,
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
    error?.response?.data?.errors?.[0]?.msg ||
    error?.message ||
    "Unable to revoke owner-user access.";

function RevokeOwnerUserModal({
    owner,
    linkedUser,
    onClose,
    onRevoked
}) {
    const [revoking, setRevoking] =
        useState(false);

    const [error, setError] =
        useState("");

    const ownerPublicId =
        owner?.public_id || null;

    const linkPublicId =
        linkedUser?.link_public_id || null;

    useEffect(() => {
        setError("");
        setRevoking(false);
    }, [linkPublicId]);

    useEffect(() => {
        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !revoking
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
    }, [onClose, revoking]);

    if (
        !ownerPublicId ||
        !linkPublicId ||
        !linkedUser
    ) {
        return null;
    }

    const revokeAccess = async () => {
        if (revoking) {
            return;
        }

        try {
            setRevoking(true);
            setError("");

            const response =
                await apiClient.delete(
                    `/owners/${ownerPublicId}/users/${linkPublicId}`
                );

            onRevoked?.(
                response?.data?.data || {
                    owner,
                    user: {
                        public_id:
                            linkedUser.user_public_id,
                        full_name:
                            linkedUser.full_name,
                        email:
                            linkedUser.email
                    },
                    link: {
                        link_public_id:
                            linkPublicId
                    }
                }
            );
        } catch (requestError) {
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setRevoking(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
            <button
                type="button"
                aria-label="Close revoke owner user dialog"
                onClick={() => {
                    if (!revoking) {
                        onClose();
                    }
                }}
                className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]"
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="revoke-owner-user-title"
                className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                            <UserMinus className="h-5 w-5" />
                        </div>

                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">
                                Owner Access
                            </p>

                            <h2
                                id="revoke-owner-user-title"
                                className="mt-1 text-lg font-bold text-slate-950"
                            >
                                Revoke Owner User
                            </h2>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                Remove this user&apos;s current access to {owner?.display_name || "this owner"}.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close"
                        icon={X}
                        disabled={revoking}
                        onClick={onClose}
                    />
                </div>

                <div className="space-y-4 px-5 py-5 sm:px-6">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            User
                        </p>

                        <p className="mt-2 text-base font-bold text-slate-950">
                            {linkedUser.full_name ||
                                "Unnamed user"}
                        </p>

                        <p className="mt-1 break-all text-sm text-slate-500">
                            {linkedUser.email || "—"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                                {formatLabel(
                                    linkedUser.relationship_role
                                ) || "—"}
                            </span>

                            {linkedUser.can_manage_properties && (
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                                    Properties
                                </span>
                            )}

                            {linkedUser.can_manage_finances && (
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                                    Finances
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                        <div className="space-y-2 text-sm leading-6 text-amber-900">
                            <p className="font-semibold">
                                This revokes the relationship, not the login account.
                            </p>

                            <p>
                                The user will disappear from the active Owner Users list and will no longer receive authorization through this owner relationship. Historical relationship data remains preserved for audit.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />

                        <p className="text-sm leading-6 text-slate-600">
                            Primary representatives are protected by the backend and cannot be revoked directly. Another eligible user must be promoted to primary first.
                        </p>
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

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={revoking}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <button
                        type="button"
                        disabled={revoking}
                        onClick={revokeAccess}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <UserMinus className="h-4 w-4" />
                        {revoking
                            ? "Revoking..."
                            : "Revoke Access"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default RevokeOwnerUserModal;

import {
    ShieldCheck,
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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to unblock owner-tenant relationship.";

function UnblockOwnerTenantRelationshipModal({
    open,
    tenant,
    owner,
    relationship,
    ownerPublicId,
    onClose,
    onUnblocked
}) {
    const [loading, setLoading] =
        useState(false);
    const [error, setError] =
        useState("");

    useEffect(() => {
        if (open) {
            setError("");
        }
    }, [open]);

    if (
        !open ||
        !tenant ||
        !owner ||
        !ownerPublicId
    ) {
        return null;
    }

    const canUnblock =
        relationship?.relationship_status ===
            "blocked";

    const handleUnblock = async () => {
        if (!canUnblock) {
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response =
                await apiClient.patch(
                    `/tenants/${tenant.public_id}/relationship/unblock`,
                    undefined,
                    {
                        params: {
                            owner_public_id:
                                ownerPublicId
                        }
                    }
                );

            onUnblocked?.(
                response?.data?.data
                    ?.owner_relationship ||
                    null
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

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unblock-owner-tenant-relationship-title"
        >
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                            <ShieldCheck className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="unblock-owner-tenant-relationship-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Unblock Owner–Tenant Relationship
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Return the selected owner's relationship with this tenant to active.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close relationship unblock dialog"
                        icon={X}
                        onClick={onClose}
                        disabled={loading}
                    />
                </div>

                <div className="space-y-4 p-5">
                    {error && (
                        <div
                            role="alert"
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                        >
                            {error}
                        </div>
                    )}

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-900">
                            {tenant.display_name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                            Tenant profile status: {tenant.status}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                            Owner: {owner.display_name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                            Relationship status: {relationship?.relationship_status || "—"}
                        </p>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                        Unblocking changes only this owner–tenant relationship back to active. The tenant profile status is not changed.
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                        The primary relationship flag is not automatically restored. This prevents the action from silently replacing another current primary owner relationship.
                    </div>

                    {!canUnblock && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                            Only a current blocked owner–tenant relationship can be unblocked.
                        </div>
                    )}
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
                        variant="success"
                        leftIcon={ShieldCheck}
                        onClick={handleUnblock}
                        loading={loading}
                        disabled={!canUnblock}
                    >
                        Unblock Relationship
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default UnblockOwnerTenantRelationshipModal;

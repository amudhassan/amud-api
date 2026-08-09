import {
    ShieldOff,
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
    "Unable to block owner-tenant relationship.";

function BlockOwnerTenantRelationshipModal({
    open,
    tenant,
    owner,
    relationship,
    ownerPublicId,
    onClose,
    onBlocked
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

    const canBlock =
        relationship?.relationship_status ===
            "active";

    const handleBlock = async () => {
        if (!canBlock) {
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response =
                await apiClient.patch(
                    `/tenants/${tenant.public_id}/relationship/block`,
                    undefined,
                    {
                        params: {
                            owner_public_id:
                                ownerPublicId
                        }
                    }
                );

            onBlocked?.(
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
            aria-labelledby="block-owner-tenant-relationship-title"
        >
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                            <ShieldOff className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="block-owner-tenant-relationship-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Block Owner–Tenant Relationship
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Restrict this tenant relationship only for the selected owner.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close relationship block dialog"
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

                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">
                        This blocks only the owner–tenant relationship. It does not block the tenant profile globally and does not delete historical records.
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                        If a draft, scheduled or active lease still depends on this relationship, the backend will reject the operation with a conflict response.
                    </div>

                    {relationship?.is_primary_owner_relationship && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                            This relationship is currently primary. Blocking it will safely clear the primary flag because a blocked relationship cannot remain primary.
                        </div>
                    )}

                    {!canBlock && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                            Only a current active owner–tenant relationship can be blocked.
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
                        variant="dangerSolid"
                        leftIcon={ShieldOff}
                        onClick={handleBlock}
                        loading={loading}
                        disabled={!canBlock}
                    >
                        Block Relationship
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default BlockOwnerTenantRelationshipModal;

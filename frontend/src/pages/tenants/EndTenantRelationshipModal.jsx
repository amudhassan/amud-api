import {
    Link2Off,
    X
} from "lucide-react";
import {
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
    "Unable to end owner-tenant relationship.";

function EndTenantRelationshipModal({
    open,
    tenant,
    owner,
    relationship,
    ownerPublicId,
    onClose,
    onEnded
}) {
    const [loading, setLoading] =
        useState(false);
    const [error, setError] =
        useState("");

    if (
        !open ||
        !tenant ||
        !owner ||
        !ownerPublicId
    ) {
        return null;
    }

    const handleEnd = async () => {
        try {
            setLoading(true);
            setError("");

            const response =
                await apiClient.patch(
                    `/tenants/${tenant.public_id}/relationship/end`,
                    undefined,
                    {
                        params: {
                            owner_public_id:
                                ownerPublicId
                        }
                    }
                );

            onEnded?.(
                response?.data?.data || null
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
            aria-labelledby="end-tenant-relationship-title"
        >
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                            <Link2Off className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="end-tenant-relationship-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                End Owner–Tenant Relationship
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                This ends the current relationship without deleting the tenant profile or its history.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close end relationship dialog"
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
                            Owner: {owner.display_name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                            Current relationship: {relationship?.relationship_status || "—"}
                        </p>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        If a draft, scheduled or active lease still depends on this relationship, the backend will block this operation.
                    </div>

                    <p className="text-sm leading-6 text-slate-600">
                        After the relationship is ended, this page will keep the tenant details in memory so you can complete a separate soft-delete action. If you leave or refresh first, the ended relationship will no longer appear in the selected owner's current tenant list.
                    </p>
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
                        variant="danger"
                        leftIcon={Link2Off}
                        onClick={handleEnd}
                        loading={loading}
                    >
                        End Relationship
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default EndTenantRelationshipModal;

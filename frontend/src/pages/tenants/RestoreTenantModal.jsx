import {
    RotateCcw,
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
    "Unable to restore tenant.";

function RestoreTenantModal({
    open,
    tenant,
    owner,
    ownerPublicId,
    onClose,
    onRestored
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

    const handleRestore = async () => {
        try {
            setLoading(true);
            setError("");

            const response =
                await apiClient.patch(
                    `/tenants/${tenant.public_id}/restore`,
                    undefined,
                    {
                        params: {
                            owner_public_id:
                                ownerPublicId
                        }
                    }
                );

            onRestored?.(
                response?.data?.data ||
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
            aria-labelledby="restore-tenant-title"
        >
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                            <RotateCcw className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="restore-tenant-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Restore Tenant
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Restore this soft-deleted tenant profile into the selected owner context.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close restore tenant dialog"
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

                        <p className="mt-1 text-xs text-slate-400">
                            {tenant.public_id}
                        </p>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Restore returns the tenant profile as inactive and creates a fresh active primary owner relationship. Historical ended relationships remain preserved.
                    </div>

                    <p className="text-sm leading-6 text-slate-600">
                        Restore may be blocked if one of this tenant's legal identifiers is already being used by another current tenant.
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
                        leftIcon={RotateCcw}
                        onClick={handleRestore}
                        loading={loading}
                    >
                        Restore Tenant
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default RestoreTenantModal;

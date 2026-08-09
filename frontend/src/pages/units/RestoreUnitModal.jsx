import {
    ArchiveRestore,
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
    "Unable to restore unit.";

function RestoreUnitModal({
    open,
    unit,
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
    }, [open, unit?.public_id]);

    if (!open || !unit) {
        return null;
    }

    const property = unit.property || {};

    const parentDeleted =
        Boolean(property.deleted_at);
    const parentSold =
        property.operational_status ===
        "sold";

    const blocked =
        parentDeleted || parentSold;

    const handleRestore = async () => {
        if (blocked || loading) {
            return;
        }

        try {
            setLoading(true);
            setError("");

            await apiClient.patch(
                `/units/${unit.public_id}/restore`
            );

            onRestored?.(unit);
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
            aria-labelledby="restore-unit-title"
        >
            <div
                className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <ArchiveRestore className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                            <h2
                                id="restore-unit-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Restore Unit
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Return this soft-deleted unit to the active records list.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close restore dialog"
                        icon={X}
                        onClick={onClose}
                        disabled={loading}
                    />
                </div>

                <div className="space-y-4 p-5">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-bold text-slate-950">
                            {unit.unit_name ||
                                unit.unit_code}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            {unit.unit_code}
                            {property.property_name
                                ? ` · ${property.property_name}`
                                : ""}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        After restore, the unit returns with status <strong>Inactive</strong>. It must be activated separately before becoming available.
                    </div>

                    {parentDeleted && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            Restore is blocked because the parent property is soft-deleted.
                        </div>
                    )}

                    {parentSold && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            Restore is blocked because the parent property is sold.
                        </div>
                    )}

                    {error && (
                        <div
                            role="alert"
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                        >
                            {error}
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
                        leftIcon={ArchiveRestore}
                        loading={loading}
                        disabled={blocked}
                        onClick={handleRestore}
                    >
                        Restore Unit
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default RestoreUnitModal;

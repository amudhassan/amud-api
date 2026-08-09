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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to delete owner.";

function DeleteOwnerModal({
    owner,
    onClose,
    onDeleted
}) {
    const [
        deleting,
        setDeleting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    useEffect(() => {
        if (!owner) {
            setDeleting(false);
            setError("");
            return undefined;
        }

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !deleting
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
        owner,
        deleting,
        onClose
    ]);

    if (!owner) {
        return null;
    }

    const deleteOwner = async () => {
        if (deleting) {
            return;
        }

        try {
            setDeleting(true);
            setError("");

            const response =
                await apiClient.delete(
                    `/owners/${owner.public_id}`
                );

            onDeleted?.(
                response?.data?.data || {
                    owner
                }
            );
        } catch (requestError) {
            setError(
                getErrorMessage(
                    requestError
                )
            );
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <button
                type="button"
                aria-label="Close delete owner dialog"
                onClick={() => {
                    if (!deleting) {
                        onClose();
                    }
                }}
                className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-owner-title"
                className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                            <Trash2 className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="delete-owner-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Delete Owner
                            </h2>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                Confirm the soft deletion of this owner record.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close"
                        icon={X}
                        disabled={deleting}
                        onClick={onClose}
                    />
                </div>

                <div className="space-y-4 px-5 py-5 sm:px-6">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Owner
                        </p>

                        <p className="mt-2 text-base font-bold text-slate-950">
                            {owner.display_name}
                        </p>

                        <p className="mt-1 break-all text-xs text-slate-500">
                            {owner.public_id}
                        </p>
                    </div>

                    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                        <div className="space-y-2 text-sm leading-6 text-amber-900">
                            <p className="font-semibold">
                                This is a controlled soft delete.
                            </p>

                            <p>
                                The owner will become inactive and disappear from the normal Owners list. Active owner-user links will also be revoked by the backend.
                            </p>

                            <p>
                                Deletion will be blocked if active property ownership or active shareholder/shareholding relationships still depend on this owner.
                            </p>
                        </div>
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
                        disabled={deleting}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <button
                        type="button"
                        disabled={deleting}
                        onClick={deleteOwner}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Trash2 className="h-4 w-4" />
                        {deleting
                            ? "Deleting..."
                            : "Delete Owner"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DeleteOwnerModal;

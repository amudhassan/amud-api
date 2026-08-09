import {
    AlertTriangle,
    Trash2,
    X
} from "lucide-react";

import {
    useEffect,
    useState
} from "react";

import apiClient from "../../../api/apiClient";

import {
    Button
} from "../../../components/ui/Button";

const getDeleteErrorMessage =
    error =>
        error?.response?.data?.message ||
        error?.message ||
        "Unable to delete the user.";

function DeleteUserModal({
    user,
    onClose,
    onDeleted
}) {
    const [
        deleting,
        setDeleting
    ] = useState(false);

    const [error, setError] =
        useState("");

    useEffect(() => {
        if (!user) {
            setError("");
            setDeleting(false);
            return undefined;
        }

        const handleKeyDown =
            event => {
                if (
                    event.key ===
                        "Escape" &&
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
        user,
        deleting,
        onClose
    ]);

    if (!user) {
        return null;
    }

    const confirmDelete =
        async () => {
            if (deleting) {
                return;
            }

            try {
                setDeleting(true);
                setError("");

                const response =
                    await apiClient.delete(
                        `/users/${user.public_id}`
                    );

                await onDeleted?.(
                    response?.data
                );
            } catch (
                requestError
            ) {
                setError(
                    getDeleteErrorMessage(
                        requestError
                    )
                );
            } finally {
                setDeleting(false);
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
                        !deleting
                    ) {
                        onClose();
                    }
                }
            }
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-user-title"
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
                                id="delete-user-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Delete User
                            </h2>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                This performs a soft delete. Historical records remain preserved.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        aria-label="Close delete user dialog"
                        disabled={
                            deleting
                        }
                        onClick={
                            onClose
                        }
                        className="
                            inline-flex h-9 w-9
                            items-center justify-center
                            rounded-xl
                            text-slate-400
                            transition
                            hover:bg-slate-100
                            hover:text-slate-700
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                        "
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-4 px-6 py-5">
                    <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
                        <p className="text-sm font-semibold text-rose-900">
                            {
                                user.full_name
                            }
                        </p>

                        <p className="mt-1 break-all text-sm text-rose-700">
                            {
                                user.email
                            }
                        </p>
                    </div>

                    <p className="text-sm leading-6 text-slate-600">
                        Deleting this account revokes access to the system. The operation may be blocked if the user still has protected active relationships or administrator constraints.
                    </p>

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
                            deleting
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
                            deleting
                        }
                        onClick={
                            confirmDelete
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
                            disabled:opacity-60
                        "
                    >
                        <Trash2 className="h-4 w-4" />

                        {deleting
                            ? "Deleting..."
                            : "Delete User"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DeleteUserModal;

import {
    RotateCcw,
    UserCheck,
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

const getRestoreErrorMessage =
    error =>
        error?.response?.data?.message ||
        error?.message ||
        "Unable to restore the user.";

function RestoreUserModal({
    user,
    onClose,
    onRestored
}) {
    const [
        restoring,
        setRestoring
    ] = useState(false);

    const [error, setError] =
        useState("");

    useEffect(() => {
        if (!user) {
            setError("");
            setRestoring(false);
            return undefined;
        }

        const handleKeyDown =
            event => {
                if (
                    event.key ===
                        "Escape" &&
                    !restoring
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
        restoring,
        onClose
    ]);

    if (!user) {
        return null;
    }

    const confirmRestore =
        async () => {
            if (restoring) {
                return;
            }

            try {
                setRestoring(true);
                setError("");

                const response =
                    await apiClient.patch(
                        `/auth/restore-account/${user.public_id}`
                    );

                await onRestored?.(
                    response?.data
                );
            } catch (
                requestError
            ) {
                setError(
                    getRestoreErrorMessage(
                        requestError
                    )
                );
            } finally {
                setRestoring(false);
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
                        !restoring
                    ) {
                        onClose();
                    }
                }
            }
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="restore-user-title"
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
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                            <UserCheck className="h-5 w-5" />
                        </div>

                        <div>
                            <h2
                                id="restore-user-title"
                                className="text-lg font-bold text-slate-950"
                            >
                                Restore User
                            </h2>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                Reactivate this login account without recreating historical relationships or sessions.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        aria-label="Close restore user dialog"
                        disabled={
                            restoring
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
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                        <p className="text-sm font-semibold text-emerald-900">
                            {
                                user.full_name
                            }
                        </p>

                        <p className="mt-1 break-all text-sm text-emerald-700">
                            {
                                user.email
                            }
                        </p>
                    </div>

                    <p className="text-sm leading-6 text-slate-600">
                        The account becomes active again. Previously revoked sessions, refresh tokens, owner-user relationships and tenant-user relationships are not automatically reactivated.
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
                            restoring
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
                            restoring
                        }
                        onClick={
                            confirmRestore
                        }
                        className="
                            inline-flex min-h-10
                            items-center justify-center
                            gap-2 rounded-xl
                            bg-emerald-600
                            px-4 py-2.5
                            text-sm font-semibold
                            text-white
                            shadow-sm
                            transition
                            hover:bg-emerald-700
                            focus:outline-none
                            focus:ring-4
                            focus:ring-emerald-100
                            disabled:cursor-not-allowed
                            disabled:opacity-60
                        "
                    >
                        <RotateCcw className="h-4 w-4" />

                        {restoring
                            ? "Restoring..."
                            : "Restore User"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default RestoreUserModal;

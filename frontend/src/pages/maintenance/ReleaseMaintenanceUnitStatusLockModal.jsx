import {
    LockOpen,
    X
} from "lucide-react";

import {
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

const formatDateTime = value => {
    if (!value) {
        return "—";
    }

    const parsed =
        new Date(value);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return String(value);
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(parsed);
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to release the maintenance unit-status lock.";

function ReleaseMaintenanceUnitStatusLockModal({
    open,
    maintenanceRequest,
    accessContext,
    onClose,
    onReleased
}) {
    const [
        reason,
        setReason
    ] = useState("");

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }

        setReason("");
        setError("");
        setSubmitting(false);
    }, [
        open,
        maintenanceRequest
            ?.public_id,
        maintenanceRequest
            ?.active_unit_status_lock
            ?.public_id
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown =
            event => {
                if (
                    event.key ===
                        "Escape" &&
                    !submitting
                ) {
                    onClose();
                }
            };

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () =>
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
    }, [
        onClose,
        open,
        submitting
    ]);

    if (
        !open ||
        !maintenanceRequest
    ) {
        return null;
    }

    const lock =
        maintenanceRequest
            .active_unit_status_lock;

    const eligible =
        Boolean(
            lock?.is_active
        );

    const submit =
        async event => {
            event.preventDefault();

            if (!eligible) {
                setError(
                    "There is no active maintenance unit-status lock to release."
                );
                return;
            }

            const cleanReason =
                reason.trim();

            if (
                cleanReason.length < 5 ||
                cleanReason.length > 2000
            ) {
                setError(
                    "Maintenance unit-status lock release reason must contain between 5 and 2000 characters."
                );
                return;
            }

            try {
                setSubmitting(true);
                setError("");

                const config = {};

                if (accessContext) {
                    config.params = {
                        access_context:
                            accessContext
                    };
                }

                await apiClient.post(
                    `/maintenance/requests/${encodeURIComponent(
                        maintenanceRequest.public_id
                    )}/unit-status-lock/release`,
                    {
                        reason:
                            cleanReason
                    },
                    config
                );

                onReleased();
            } catch (
                requestError
            ) {
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setSubmitting(false);
            }
        };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Release Unit Maintenance Lock
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Release the active unit-status lock and allow backend restoration rules to run.
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close release unit maintenance lock modal"
                        disabled={
                            submitting
                        }
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                    <div className="space-y-5">
                        {error && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {error}
                            </div>
                        )}

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
                            When this is the final active maintenance lock for the unit, the backend restores the unit to the saved restoration status.
                        </div>

                        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-slate-500">
                                    Request
                                </span>

                                <span className="font-semibold text-slate-900">
                                    {maintenanceRequest.request_number ||
                                        maintenanceRequest.public_id}
                                </span>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <span className="text-slate-500">
                                    Unit
                                </span>

                                <span className="font-semibold text-slate-900">
                                    {maintenanceRequest
                                        ?.unit
                                        ?.unit_name ||
                                        maintenanceRequest
                                            ?.unit
                                            ?.unit_code ||
                                        maintenanceRequest
                                            ?.unit
                                            ?.public_id ||
                                        "—"}
                                </span>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <span className="text-slate-500">
                                    Current Unit Status
                                </span>

                                <span className="font-semibold text-amber-700">
                                    {formatLabel(
                                        maintenanceRequest
                                            ?.unit
                                            ?.operational_status
                                    ) ||
                                        "—"}
                                </span>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <span className="text-slate-500">
                                    Restoration Status
                                </span>

                                <span className="font-semibold text-emerald-700">
                                    {formatLabel(
                                        lock
                                            ?.restoration_status
                                    ) ||
                                        "Managed by backend"}
                                </span>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <span className="text-slate-500">
                                    Lock Applied At
                                </span>

                                <span className="font-semibold text-slate-900">
                                    {formatDateTime(
                                        lock
                                            ?.applied_at
                                    )}
                                </span>
                            </div>
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Release Reason *
                            </span>

                            <textarea
                                value={reason}
                                disabled={
                                    submitting
                                }
                                minLength={5}
                                maxLength={2000}
                                rows={5}
                                placeholder="Explain why the unit maintenance lock can now be released..."
                                onChange={
                                    event => {
                                        setReason(
                                            event
                                                .target
                                                .value
                                        );

                                        if (
                                            error
                                        ) {
                                            setError(
                                                ""
                                            );
                                        }
                                    }
                                }
                                className="mt-2 min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {reason.length}
                                /2000
                            </p>
                        </label>
                    </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={
                            submitting
                        }
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        leftIcon={LockOpen}
                        disabled={
                            submitting ||
                            !eligible
                        }
                    >
                        {submitting
                            ? "Releasing..."
                            : "Release Maintenance Lock"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default ReleaseMaintenanceUnitStatusLockModal;

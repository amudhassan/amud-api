import {
    Ban,
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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to decline maintenance assignment.";

function DeclineMaintenanceAssignmentModal({
    open,
    maintenanceRequestPublicId,
    assignment,
    accessContext,
    onClose,
    onDeclined
}) {
    const [
        authoritativeAssignment,
        setAuthoritativeAssignment
    ] = useState(null);

    const [
        declineReason,
        setDeclineReason
    ] = useState("");

    const [
        loadingAssignment,
        setLoadingAssignment
    ] = useState(false);

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

        setAuthoritativeAssignment(null);
        setDeclineReason("");
        setSubmitting(false);
        setError("");
    }, [
        open,
        assignment?.public_id
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
                    !submitting &&
                    !loadingAssignment
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
        loadingAssignment,
        onClose,
        open,
        submitting
    ]);

    useEffect(() => {
        if (
            !open ||
            !maintenanceRequestPublicId ||
            !assignment?.public_id
        ) {
            return;
        }

        let cancelled = false;

        const loadAssignment =
            async () => {
                try {
                    setLoadingAssignment(true);
                    setError("");

                    const config = {};

                    if (accessContext) {
                        config.params = {
                            access_context:
                                accessContext
                        };
                    }

                    const response =
                        await apiClient.get(
                            `/maintenance/requests/${encodeURIComponent(
                                maintenanceRequestPublicId
                            )}/assignments/${encodeURIComponent(
                                assignment.public_id
                            )}`,
                            config
                        );

                    const row =
                        response?.data?.data
                            ?.maintenance_assignment;

                    if (!row) {
                        throw new Error(
                            "Maintenance assignment was not returned by the server."
                        );
                    }

                    if (!cancelled) {
                        setAuthoritativeAssignment(
                            row
                        );
                    }
                } catch (
                    requestError
                ) {
                    if (!cancelled) {
                        setError(
                            getErrorMessage(
                                requestError
                            )
                        );
                    }
                } finally {
                    if (!cancelled) {
                        setLoadingAssignment(false);
                    }
                }
            };

        loadAssignment();

        return () => {
            cancelled = true;
        };
    }, [
        accessContext,
        assignment?.public_id,
        maintenanceRequestPublicId,
        open
    ]);

    if (
        !open ||
        !maintenanceRequestPublicId ||
        !assignment
    ) {
        return null;
    }

    const submit =
        async event => {
            event.preventDefault();

            if (
                !authoritativeAssignment
            ) {
                setError(
                    "Refresh the assignment before declining."
                );
                return;
            }

            if (
                authoritativeAssignment
                    .status !==
                "pending"
            ) {
                setError(
                    `Assignment cannot be declined from ${formatLabel(
                        authoritativeAssignment
                            .status
                    )}.`
                );
                return;
            }

            if (
                !authoritativeAssignment
                    .updated_at
            ) {
                setError(
                    "Assignment updated-at timestamp is missing. Close and reopen the maintenance request."
                );
                return;
            }

            const reason =
                declineReason.trim();

            if (
                reason.length < 3 ||
                reason.length > 2000
            ) {
                setError(
                    "Assignment decline reason must contain between 3 and 2000 characters."
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
                        maintenanceRequestPublicId
                    )}/assignments/${encodeURIComponent(
                        authoritativeAssignment.public_id
                    )}/decline`,
                    {
                        expected_status:
                            "pending",
                        expected_updated_at:
                            authoritativeAssignment.updated_at,
                        decline_reason:
                            reason
                    },
                    config
                );

                onDeclined();
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
                className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Decline Maintenance Assignment
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Pending assignment response
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close decline assignment modal"
                        disabled={
                            submitting ||
                            loadingAssignment
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

                        {loadingAssignment && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                Refreshing assignment state...
                            </div>
                        )}

                        {authoritativeAssignment && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-700">
                                Current status:{" "}
                                <strong>
                                    {formatLabel(
                                        authoritativeAssignment.status
                                    )}
                                </strong>
                            </div>
                        )}

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Decline Reason{" "}
                                <span className="text-rose-500">
                                    *
                                </span>
                            </span>

                            <textarea
                                value={
                                    declineReason
                                }
                                disabled={
                                    submitting ||
                                    loadingAssignment
                                }
                                minLength={3}
                                maxLength={2000}
                                rows={6}
                                placeholder="Explain why this assignment is being declined..."
                                onChange={
                                    event => {
                                        setDeclineReason(
                                            event.target.value
                                        );

                                        if (error) {
                                            setError("");
                                        }
                                    }
                                }
                                className="mt-2 min-h-36 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {declineReason.length}/2000
                            </p>
                        </label>
                    </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={
                            submitting ||
                            loadingAssignment
                        }
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        leftIcon={Ban}
                        disabled={
                            submitting ||
                            loadingAssignment ||
                            !authoritativeAssignment
                        }
                    >
                        {submitting
                            ? "Declining..."
                            : "Decline Assignment"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default DeclineMaintenanceAssignmentModal;

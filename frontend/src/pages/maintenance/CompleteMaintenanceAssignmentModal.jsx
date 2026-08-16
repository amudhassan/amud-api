import {
    CheckCircle2,
    RefreshCw,
    X
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

const inputClassName = `
    mt-2 w-full rounded-xl
    border border-slate-300
    bg-white px-3 py-2.5
    text-sm text-slate-900
    outline-none transition
    placeholder:text-slate-400
    focus:border-blue-500
    focus:ring-2
    focus:ring-blue-100
    disabled:cursor-not-allowed
    disabled:bg-slate-100
    disabled:text-slate-500
`;

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
    "Unable to complete maintenance assignment.";

const extractAssignment = response =>
    response?.data?.data
        ?.maintenance_assignment ||
    response?.data
        ?.maintenance_assignment ||
    response?.data?.data
        ?.assignment ||
    response?.data?.assignment ||
    null;

function CompleteMaintenanceAssignmentModal({
    open,
    maintenanceRequestPublicId,
    assignment,
    accessContext,
    onClose,
    onCompleted
}) {
    const [
        authoritativeAssignment,
        setAuthoritativeAssignment
    ] = useState(null);

    const [
        completionNotes,
        setCompletionNotes
    ] = useState("");

    const [
        loading,
        setLoading
    ] = useState(false);

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const loadAssignment =
        useCallback(
            async () => {
                if (
                    !open ||
                    !maintenanceRequestPublicId ||
                    !assignment?.public_id
                ) {
                    return;
                }

                try {
                    setLoading(true);
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

                    const loadedAssignment =
                        extractAssignment(
                            response
                        );

                    if (
                        !loadedAssignment
                    ) {
                        throw new Error(
                            "Assignment response did not include the maintenance assignment."
                        );
                    }

                    if (
                        !loadedAssignment
                            .updated_at
                    ) {
                        throw new Error(
                            "Assignment updated-at timestamp is missing. Refresh and try again."
                        );
                    }

                    setAuthoritativeAssignment(
                        loadedAssignment
                    );
                } catch (
                    requestError
                ) {
                    setAuthoritativeAssignment(
                        null
                    );

                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            [
                accessContext,
                assignment?.public_id,
                maintenanceRequestPublicId,
                open
            ]
        );

    useEffect(() => {
        if (!open) {
            return;
        }

        setAuthoritativeAssignment(
            null
        );
        setCompletionNotes("");
        setError("");
        setSubmitting(false);

        loadAssignment();
    }, [
        loadAssignment,
        open
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
                    "Refresh the assignment before completion."
                );
                return;
            }

            if (
                authoritativeAssignment
                    .status !== "active"
            ) {
                setError(
                    `Assignment cannot be completed from ${formatLabel(
                        authoritativeAssignment
                            .status
                    )}.`
                );
                return;
            }

            const trimmedNotes =
                completionNotes.trim();

            if (
                trimmedNotes.length < 3 ||
                trimmedNotes.length > 5000
            ) {
                setError(
                    "Assignment completion notes must contain between 3 and 5000 characters."
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
                        authoritativeAssignment
                            .public_id
                    )}/complete`,
                    {
                        expected_status:
                            "active",
                        expected_updated_at:
                            authoritativeAssignment
                                .updated_at,
                        completion_notes:
                            trimmedNotes
                    },
                    config
                );

                onCompleted();
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Complete Maintenance Assignment
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            {assignment.public_id}
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close complete maintenance assignment"
                        disabled={submitting}
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

                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold">
                                        Assignment lifecycle
                                    </p>

                                    <p className="mt-1 text-xs">
                                        Status:{" "}
                                        <strong>
                                            {loading
                                                ? "Loading..."
                                                : formatLabel(
                                                      authoritativeAssignment
                                                          ?.status ||
                                                          assignment.status
                                                  )}
                                        </strong>
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    disabled={
                                        loading ||
                                        submitting
                                    }
                                    onClick={
                                        loadAssignment
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Refresh
                                </button>
                            </div>

                            <p className="mt-3 text-xs">
                                Updated:{" "}
                                {formatDateTime(
                                    authoritativeAssignment
                                        ?.updated_at
                                )}
                            </p>
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Completion Notes{" "}
                                <span className="text-rose-500">
                                    *
                                </span>
                            </span>

                            <textarea
                                value={
                                    completionNotes
                                }
                                disabled={
                                    submitting
                                }
                                minLength={3}
                                maxLength={5000}
                                rows={6}
                                placeholder="Summarize the assignment outcome and work completed..."
                                onChange={
                                    event => {
                                        setCompletionNotes(
                                            event
                                                .target
                                                .value
                                        );

                                        if (error) {
                                            setError("");
                                        }
                                    }
                                }
                                className={`${inputClassName} min-h-36 resize-y`}
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {
                                    completionNotes
                                        .length
                                }
                                /5000
                            </p>
                        </label>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                            Completing the assignment ends the active work assignment. Maintenance resolution remains a separate audited lifecycle step.
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={submitting}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        leftIcon={
                            CheckCircle2
                        }
                        disabled={
                            loading ||
                            submitting ||
                            !authoritativeAssignment
                        }
                    >
                        {submitting
                            ? "Completing..."
                            : "Complete Assignment"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default CompleteMaintenanceAssignmentModal;

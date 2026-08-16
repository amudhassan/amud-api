import {
    Ban,
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
    "Unable to reject maintenance reopening request.";

function RejectMaintenanceReopenRequestModal({
    open,
    maintenanceRequest,
    accessContext,
    onClose,
    onRejected
}) {
    const [
        pendingReopen,
        setPendingReopen
    ] = useState(null);

    const [
        loading,
        setLoading
    ] = useState(false);

    const [
        decisionNote,
        setDecisionNote
    ] = useState("");

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const loadPendingReopen =
        useCallback(
            async () => {
                if (
                    !open ||
                    !maintenanceRequest
                        ?.public_id
                ) {
                    return;
                }

                try {
                    setLoading(true);
                    setError("");
                    setPendingReopen(
                        null
                    );

                    const params = {
                        status: "pending",
                        sort_order: "desc",
                        page: 1,
                        limit: 1
                    };

                    if (accessContext) {
                        params.access_context =
                            accessContext;
                    }

                    const response =
                        await apiClient.get(
                            `/maintenance/requests/${encodeURIComponent(
                                maintenanceRequest.public_id
                            )}/reopen-requests`,
                            {
                                params
                            }
                        );

                    const rows =
                        response?.data?.data
                            ?.maintenance_reopen_requests;

                    const candidate =
                        Array.isArray(rows)
                            ? rows[0]
                            : null;

                    if (!candidate) {
                        throw new Error(
                            "No pending reopening request was found for this maintenance request."
                        );
                    }

                    if (
                        !candidate.public_id ||
                        !candidate.requested_at
                    ) {
                        throw new Error(
                            "Pending reopening request is missing its public ID or requested-at timestamp."
                        );
                    }

                    if (
                        candidate.status !==
                        "pending"
                    ) {
                        throw new Error(
                            "The reopening request is no longer pending."
                        );
                    }

                    setPendingReopen(
                        candidate
                    );
                } catch (
                    requestError
                ) {
                    setPendingReopen(
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
                maintenanceRequest
                    ?.public_id,
                open
            ]
        );

    useEffect(() => {
        if (!open) {
            return;
        }

        setDecisionNote("");
        setSubmitting(false);
        setError("");
        setPendingReopen(null);

        loadPendingReopen();
    }, [
        loadPendingReopen,
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
        !maintenanceRequest
    ) {
        return null;
    }

    const submit =
        async event => {
            event.preventDefault();

            if (!pendingReopen) {
                setError(
                    "Load the pending reopening request before rejection."
                );
                return;
            }

            if (
                ![
                    "closed",
                    "rejected",
                    "cancelled"
                ].includes(
                    maintenanceRequest.status
                )
            ) {
                setError(
                    "The maintenance request is no longer in a terminal status."
                );
                return;
            }

            if (
                !maintenanceRequest.updated_at
            ) {
                setError(
                    "Maintenance request updated-at timestamp is missing. Close and reopen the detail view."
                );
                return;
            }

            if (
                pendingReopen.status !==
                "pending"
            ) {
                setError(
                    "The reopening request is no longer pending."
                );
                return;
            }

            if (
                !pendingReopen.requested_at
            ) {
                setError(
                    "Reopening requested-at timestamp is missing."
                );
                return;
            }

            const note =
                decisionNote.trim();

            if (
                note.length < 5 ||
                note.length > 2000
            ) {
                setError(
                    "Rejection decision note must contain between 5 and 2000 characters."
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
                    )}/reopen-requests/${encodeURIComponent(
                        pendingReopen.public_id
                    )}/reject`,
                    {
                        expected_request_status:
                            maintenanceRequest.status,
                        expected_request_updated_at:
                            maintenanceRequest.updated_at,
                        expected_reopen_status:
                            "pending",
                        expected_reopen_requested_at:
                            pendingReopen.requested_at,
                        decision_note:
                            note
                    },
                    config
                );

                onRejected();
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
                            Reject Reopen Request
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            {maintenanceRequest.request_number ||
                                maintenanceRequest.public_id}
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close reject reopening request modal"
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

                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-semibold">
                                        Pending reopening request
                                    </p>

                                    {pendingReopen ? (
                                        <div className="mt-2 space-y-1 text-xs leading-5">
                                            <p>
                                                From:{" "}
                                                <strong>
                                                    {formatLabel(
                                                        pendingReopen.from_status
                                                    )}
                                                </strong>
                                            </p>

                                            <p>
                                                Target:{" "}
                                                <strong>
                                                    {formatLabel(
                                                        pendingReopen.target_status
                                                    )}
                                                </strong>
                                            </p>

                                            <p>
                                                Requested:{" "}
                                                <strong>
                                                    {formatDateTime(
                                                        pendingReopen.requested_at
                                                    )}
                                                </strong>
                                            </p>

                                            <p className="pt-1">
                                                {pendingReopen.reason}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-xs">
                                            {loading
                                                ? "Loading pending reopening request..."
                                                : "No pending reopening request loaded."}
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    disabled={
                                        loading ||
                                        submitting
                                    }
                                    onClick={
                                        loadPendingReopen
                                    }
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Refresh
                                </button>
                            </div>
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Rejection Decision Note{" "}
                                <span className="text-rose-500">
                                    *
                                </span>
                            </span>

                            <textarea
                                value={
                                    decisionNote
                                }
                                disabled={
                                    submitting
                                }
                                minLength={5}
                                maxLength={2000}
                                rows={6}
                                placeholder="Explain why this reopening request should be rejected..."
                                onChange={
                                    event => {
                                        setDecisionNote(
                                            event.target.value
                                        );

                                        if (error) {
                                            setError("");
                                        }
                                    }
                                }
                                className={`${inputClassName} min-h-36 resize-y`}
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {decisionNote.length}/2000
                            </p>
                        </label>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                            Rejecting the reopening request keeps the maintenance request in its current terminal status.
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
                        leftIcon={Ban}
                        disabled={
                            loading ||
                            submitting ||
                            !pendingReopen
                        }
                    >
                        {submitting
                            ? "Rejecting..."
                            : "Reject Reopen"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default RejectMaintenanceReopenRequestModal;

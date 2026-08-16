import {
    EyeOff,
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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to hide maintenance comment.";

function HideMaintenanceCommentModal({
    open,
    maintenanceRequest,
    maintenanceComment,
    accessContext,
    onClose,
    onHidden
}) {
    const [
        moderationReason,
        setModerationReason
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

        setModerationReason("");
        setSubmitting(false);
        setError("");
    }, [
        open,
        maintenanceComment?.public_id
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
        !maintenanceRequest ||
        !maintenanceComment
    ) {
        return null;
    }

    const submit =
        async event => {
            event.preventDefault();

            if (
                !maintenanceRequest
                    .updated_at
            ) {
                setError(
                    "Maintenance request updated-at timestamp is missing. Refresh the request and try again."
                );
                return;
            }

            if (
                !maintenanceComment
                    .public_id
            ) {
                setError(
                    "Maintenance comment public ID is missing."
                );
                return;
            }

            const reason =
                moderationReason.trim();

            if (
                reason.length < 5 ||
                reason.length > 2000
            ) {
                setError(
                    "Moderation reason must contain between 5 and 2000 characters."
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
                    )}/comments/${encodeURIComponent(
                        maintenanceComment.public_id
                    )}/hide`,
                    {
                        expected_request_status:
                            maintenanceRequest.status,
                        expected_request_updated_at:
                            maintenanceRequest.updated_at,
                        moderation_reason:
                            reason
                    },
                    config
                );

                await onHidden();
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
                            Hide Maintenance Comment
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Comment moderation keeps the record for audit history.
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close comment moderation modal"
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

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Selected Comment
                            </p>

                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                                {maintenanceComment.message}
                            </p>
                        </div>

                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Moderation Reason{" "}
                                <span className="text-rose-500">
                                    *
                                </span>
                            </span>

                            <textarea
                                value={
                                    moderationReason
                                }
                                disabled={
                                    submitting
                                }
                                minLength={5}
                                maxLength={2000}
                                rows={5}
                                placeholder="Explain why this comment should be hidden..."
                                onChange={
                                    event => {
                                        setModerationReason(
                                            event.target.value
                                        );

                                        if (error) {
                                            setError("");
                                        }
                                    }
                                }
                                className={`${inputClassName} min-h-32 resize-y`}
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {moderationReason.length}/2000
                            </p>
                        </label>
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
                        leftIcon={EyeOff}
                        disabled={submitting}
                    >
                        {submitting
                            ? "Hiding..."
                            : "Hide Comment"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default HideMaintenanceCommentModal;

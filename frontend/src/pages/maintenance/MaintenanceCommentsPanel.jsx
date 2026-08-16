import {
    MessageSquareText,
    RefreshCw,
    Send
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

import HideMaintenanceCommentModal from "./HideMaintenanceCommentModal";

const CREATE_ALLOWED_STATUSES = [
    "reported",
    "under_review",
    "assigned",
    "in_progress",
    "on_hold",
    "resolved"
];

const ADMIN_OWNER_COMMENT_TYPES = [
    "public_update",
    "internal_note",
    "tenant_message",
    "technician_update",
    "resolution_feedback"
];

const TENANT_COMMENT_TYPES = [
    "tenant_message",
    "resolution_feedback"
];

const ADMIN_OWNER_VISIBILITIES = [
    "internal",
    "tenant_visible",
    "technician_visible",
    "shared"
];

const TENANT_VISIBILITIES = [
    "tenant_visible",
    "shared"
];

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

    const parsed = new Date(value);

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
    "Unable to process maintenance comments.";

function MaintenanceCommentsPanel({
    maintenanceRequest,
    accessContext,
    onChanged
}) {
    const [
        comments,
        setComments
    ] = useState([]);

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

    const [
        commentType,
        setCommentType
    ] = useState("");

    const [
        visibility,
        setVisibility
    ] = useState("");

    const [
        message,
        setMessage
    ] = useState("");

    const [
        commentToHide,
        setCommentToHide
    ] = useState(null);

    const isTenant =
        accessContext === "tenant";

    const commentTypes =
        useMemo(
            () =>
                isTenant
                    ? TENANT_COMMENT_TYPES
                    : ADMIN_OWNER_COMMENT_TYPES,
            [
                isTenant
            ]
        );

    const visibilityOptions =
        useMemo(
            () =>
                isTenant
                    ? TENANT_VISIBILITIES
                    : ADMIN_OWNER_VISIBILITIES,
            [
                isTenant
            ]
        );

    const canCreate =
        CREATE_ALLOWED_STATUSES.includes(
            maintenanceRequest?.status
        );

    const canModerate =
        !accessContext ||
        accessContext === "owner";

    useEffect(() => {
        if (isTenant) {
            setCommentType(
                "tenant_message"
            );
            setVisibility(
                "tenant_visible"
            );
            return;
        }

        setCommentType(
            "public_update"
        );
        setVisibility(
            "shared"
        );
    }, [
        isTenant,
        maintenanceRequest?.public_id
    ]);

    const loadComments =
        useCallback(
            async () => {
                if (
                    !maintenanceRequest
                        ?.public_id
                ) {
                    return;
                }

                try {
                    setLoading(true);
                    setError("");

                    const params = {
                        sort_order: "desc",
                        page: 1,
                        limit: 20
                    };

                    if (accessContext) {
                        params.access_context =
                            accessContext;
                    }

                    const response =
                        await apiClient.get(
                            `/maintenance/requests/${encodeURIComponent(
                                maintenanceRequest.public_id
                            )}/comments`,
                            {
                                params
                            }
                        );

                    const rows =
                        response?.data?.data
                            ?.maintenance_comments;

                    setComments(
                        Array.isArray(rows)
                            ? rows
                            : []
                    );
                } catch (
                    requestError
                ) {
                    setComments([]);
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
                    ?.public_id
            ]
        );

    useEffect(() => {
        loadComments();
    }, [
        loadComments
    ]);

    const submit =
        async event => {
            event.preventDefault();

            if (!canCreate) {
                setError(
                    "Comments cannot be added after the maintenance request reaches a terminal status."
                );
                return;
            }

            if (
                !maintenanceRequest
                    ?.updated_at
            ) {
                setError(
                    "Maintenance request updated-at timestamp is missing. Refresh the request and try again."
                );
                return;
            }

            const trimmed =
                message.trim();

            if (
                trimmed.length < 1 ||
                trimmed.length > 5000
            ) {
                setError(
                    "Comment message must contain between 1 and 5000 characters."
                );
                return;
            }

            if (
                !commentTypes.includes(
                    commentType
                )
            ) {
                setError(
                    "Selected comment type is not allowed in this access context."
                );
                return;
            }

            if (
                !visibilityOptions.includes(
                    visibility
                )
            ) {
                setError(
                    "Selected comment visibility is not allowed in this access context."
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
                    )}/comments`,
                    {
                        expected_request_status:
                            maintenanceRequest.status,
                        expected_request_updated_at:
                            maintenanceRequest.updated_at,
                        comment_type:
                            commentType,
                        visibility,
                        message:
                            trimmed
                    },
                    config
                );

                setMessage("");

                await loadComments();

                onChanged?.();
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
        <>
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-slate-100 p-2 text-slate-600">
                        <MessageSquareText className="h-5 w-5" />
                    </span>

                    <div>
                        <h3 className="text-base font-bold text-slate-900">
                            Maintenance Comments
                        </h3>

                        <p className="mt-0.5 text-xs text-slate-500">
                            Visible communication and progress updates for this request.
                        </p>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="secondary"
                    leftIcon={RefreshCw}
                    disabled={loading}
                    onClick={
                        loadComments
                    }
                >
                    Refresh Comments
                </Button>
            </div>

            <div className="space-y-5 p-4 sm:p-5">
                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}

                {canCreate && (
                    <form
                        onSubmit={submit}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Comment Type
                                </span>

                                <select
                                    value={
                                        commentType
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            setCommentType(
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    {commentTypes.map(
                                        item => (
                                            <option
                                                key={
                                                    item
                                                }
                                                value={
                                                    item
                                                }
                                            >
                                                {formatLabel(
                                                    item
                                                )}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Visibility
                                </span>

                                <select
                                    value={
                                        visibility
                                    }
                                    disabled={
                                        submitting
                                    }
                                    onChange={
                                        event =>
                                            setVisibility(
                                                event
                                                    .target
                                                    .value
                                            )
                                    }
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    {visibilityOptions.map(
                                        item => (
                                            <option
                                                key={
                                                    item
                                                }
                                                value={
                                                    item
                                                }
                                            >
                                                {formatLabel(
                                                    item
                                                )}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>
                        </div>

                        <label className="mt-4 block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Message
                            </span>

                            <textarea
                                value={message}
                                disabled={
                                    submitting
                                }
                                minLength={1}
                                maxLength={5000}
                                rows={4}
                                placeholder="Write a maintenance update or message..."
                                onChange={
                                    event => {
                                        setMessage(
                                            event
                                                .target
                                                .value
                                        );

                                        if (error) {
                                            setError(
                                                ""
                                            );
                                        }
                                    }
                                }
                                className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>

                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-xs text-slate-400">
                                {message.length}/5000
                            </span>

                            <Button
                                type="submit"
                                leftIcon={Send}
                                disabled={
                                    submitting ||
                                    !message.trim()
                                }
                            >
                                {submitting
                                    ? "Posting..."
                                    : "Post Comment"}
                            </Button>
                        </div>
                    </form>
                )}

                {!canCreate && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                        This request is terminal. Existing comments remain readable, but new comments cannot be added through this endpoint.
                    </div>
                )}

                <div className="space-y-3">
                    {loading && (
                        <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                            Loading comments...
                        </div>
                    )}

                    {!loading &&
                        comments.length ===
                            0 && (
                            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                                No visible maintenance comments yet.
                            </div>
                        )}

                    {!loading &&
                        comments.map(
                            comment => (
                                <article
                                    key={
                                        comment.public_id ||
                                        `${comment.created_at}-${comment.message}`
                                    }
                                    className="rounded-2xl border border-slate-200 bg-white p-4"
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                            {formatLabel(
                                                comment.comment_type
                                            )}
                                        </span>

                                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                            {formatLabel(
                                                comment.visibility
                                            )}
                                        </span>

                                        {comment.hidden_at && (
                                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                                Hidden
                                            </span>
                                        )}
                                    </div>

                                    {canModerate &&
                                        !comment.hidden_at &&
                                        comment.public_id && (
                                            <div className="mt-3">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() =>
                                                        setCommentToHide(
                                                            comment
                                                        )
                                                    }
                                                >
                                                    Hide Comment
                                                </Button>
                                            </div>
                                        )}

                                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                                        {comment.message}
                                    </p>

                                    <p className="mt-3 text-xs text-slate-400">
                                        {formatDateTime(
                                            comment.created_at
                                        )}
                                    </p>
                                </article>
                            )
                        )}
                </div>
            </div>
        </section>

        <HideMaintenanceCommentModal
            open={Boolean(
                commentToHide
            )}
            maintenanceRequest={
                maintenanceRequest
            }
            maintenanceComment={
                commentToHide
            }
            accessContext={
                accessContext
            }
            onClose={() =>
                setCommentToHide(
                    null
                )
            }
            onHidden={async () => {
                setCommentToHide(
                    null
                );

                await loadComments();

                onChanged?.();
            }}
        />
        </>
    );
}

export default MaintenanceCommentsPanel;

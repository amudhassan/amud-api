import {
    Archive,
    RotateCcw,
    Bell,
    ExternalLink,
    MailOpen,
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

    if (Number.isNaN(parsed.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    ).format(parsed);
};


const isPlainObject = value =>
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);

const looksLikeDateTime = value =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);

const formatPayloadValue = value => {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }

    if (looksLikeDateTime(value)) {
        return formatDateTime(value);
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return "None";
        }

        if (value.every(item =>
            item === null ||
            ["string", "number", "boolean"].includes(typeof item)
        )) {
            return value
                .map(item =>
                    item === null
                        ? "—"
                        : String(item)
                )
                .join(", ");
        }

        return `${value.length} item${value.length === 1 ? "" : "s"}`;
    }

    return String(value);
};

const flattenPayload = (value, path = [], rows = []) => {
    if (!isPlainObject(value)) {
        return rows;
    }

    Object.entries(value).forEach(([key, child]) => {
        const nextPath = [...path, key];

        if (isPlainObject(child)) {
            flattenPayload(child, nextPath, rows);
            return;
        }

        rows.push({
            key: nextPath.join("."),
            label: nextPath
                .map(part => formatLabel(part))
                .join(" · "),
            value: formatPayloadValue(child)
        });
    });

    return rows;
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load notification details.";

const extractNotification = response => {
    const root = response?.data || {};
    const data = root?.data || {};

    return (
        data.notification ||
        root.notification ||
        (
            data &&
            typeof data === "object" &&
            data.public_id
                ? data
                : null
        )
    );
};

function DetailRow({
    label,
    value,
    mono = false
}) {
    return (
        <div className="grid gap-1 border-b border-slate-100 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </dt>

            <dd
                className={
                    mono
                        ? "break-all font-mono text-sm text-slate-800"
                        : "break-words text-sm text-slate-800"
                }
            >
                {value ?? "—"}
            </dd>
        </div>
    );
}

function NotificationDetailModal({
    notificationPublicId,
    fallbackNotification,
    onClose,
    onOpenAction,
    onMarkRead,
    markingRead = false,
    onArchive,
    archiving = false,
    onRestore,
    restoring = false
}) {
    const [notification, setNotification] =
        useState(fallbackNotification || null);
    const [loading, setLoading] =
        useState(false);
    const [error, setError] =
        useState("");

    const loadNotification =
        useCallback(async () => {
            if (!notificationPublicId) {
                return;
            }

            setLoading(true);
            setError("");

            try {
                const response =
                    await apiClient.get(
                        `/notifications/${encodeURIComponent(notificationPublicId)}`
                    );

                const loaded =
                    extractNotification(response);

                if (!loaded) {
                    throw new Error(
                        "Notification detail response did not contain a notification record."
                    );
                }

                setNotification(loaded);
            } catch (loadError) {
                setError(
                    getErrorMessage(loadError)
                );
            } finally {
                setLoading(false);
            }
        }, [notificationPublicId]);

    useEffect(() => {
        setNotification(
            fallbackNotification || null
        );
        loadNotification();
    }, [
        fallbackNotification,
        loadNotification
    ]);

    if (!notificationPublicId) {
        return null;
    }

    const handleMarkRead = async () => {
        if (
            notification?.is_read ||
            markingRead ||
            !onMarkRead
        ) {
            return;
        }

        setError("");

        try {
            await onMarkRead(
                notificationPublicId
            );

            setNotification(current =>
                current
                    ? {
                        ...current,
                        is_read: true
                    }
                    : current
            );

            await loadNotification();
        } catch (mutationError) {
            setError(
                mutationError?.response?.data?.message ||
                mutationError?.response?.data?.errors?.[0]?.message ||
                mutationError?.message ||
                "Unable to mark the notification as read."
            );
        }
    };

    const handleArchive = async () => {
        if (
            notification?.is_archived ||
            archiving ||
            !onArchive
        ) {
            return;
        }

        setError("");

        try {
            await onArchive(
                notificationPublicId
            );

            setNotification(current =>
                current
                    ? {
                        ...current,
                        is_read: true,
                        is_archived: true
                    }
                    : current
            );

            await loadNotification();
        } catch (mutationError) {
            setError(
                mutationError?.response?.data?.message ||
                mutationError?.response?.data?.errors?.[0]?.message ||
                mutationError?.message ||
                "Unable to archive the notification."
            );
        }
    };

    const handleRestore = async () => {
        if (
            !notification?.is_archived ||
            restoring ||
            !onRestore
        ) {
            return;
        }

        setError("");

        try {
            await onRestore(
                notificationPublicId
            );

            setNotification(current =>
                current
                    ? {
                        ...current,
                        is_archived: false
                    }
                    : current
            );

            await loadNotification();
        } catch (mutationError) {
            setError(
                mutationError?.response?.data?.message ||
                mutationError?.response?.data?.errors?.[0]?.message ||
                mutationError?.message ||
                "Unable to restore the notification."
            );
        }
    };

    const source =
        notification?.source || {};

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <Bell className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                            <h2 className="truncate text-lg font-bold text-slate-900">
                                {notification?.title || "Notification Detail"}
                            </h2>

                            <p className="mt-1 text-xs text-slate-500">
                                {notificationPublicId}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        aria-label="Close notification detail"
                        onClick={onClose}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="max-h-[calc(92vh-86px)] overflow-y-auto px-6 py-5">
                    {error && (
                        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="mb-5 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${notification?.is_read ? "border-slate-200 bg-slate-100 text-slate-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                            {notification?.is_read ? "Read" : "Unread"}
                        </span>

                        {notification?.is_archived && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                Archived
                            </span>
                        )}

                        {notification?.priority && (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                {formatLabel(notification.priority)} Priority
                            </span>
                        )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                            {notification?.message || "—"}
                        </p>
                    </div>

                    <dl className="mt-5 rounded-2xl border border-slate-200 px-4">
                        <DetailRow
                            label="Public ID"
                            value={notification?.public_id || notificationPublicId}
                            mono
                        />
                        <DetailRow
                            label="Type"
                            value={formatLabel(notification?.notification_type)}
                        />
                        <DetailRow
                            label="Category"
                            value={formatLabel(notification?.category)}
                        />
                        <DetailRow
                            label="Priority"
                            value={formatLabel(notification?.priority)}
                        />
                        <DetailRow
                            label="Read At"
                            value={formatDateTime(notification?.read_at)}
                        />
                        <DetailRow
                            label="Archived At"
                            value={formatDateTime(notification?.archived_at)}
                        />
                        <DetailRow
                            label="Available At"
                            value={formatDateTime(notification?.available_at)}
                        />
                        <DetailRow
                            label="Expires At"
                            value={formatDateTime(notification?.expires_at)}
                        />
                        <DetailRow
                            label="Created At"
                            value={formatDateTime(notification?.created_at)}
                        />
                        <DetailRow
                            label="Updated At"
                            value={formatDateTime(notification?.updated_at)}
                        />
                        <DetailRow
                            label="Source Module"
                            value={formatLabel(source.module || notification?.source_module)}
                        />
                        <DetailRow
                            label="Source Entity"
                            value={formatLabel(source.entity_type || notification?.source_entity_type)}
                        />
                        <DetailRow
                            label="Source Entity ID"
                            value={source.entity_public_id || notification?.source_entity_public_id || "—"}
                            mono
                        />
                        <DetailRow
                            label="Source Event"
                            value={formatLabel(source.event_type || notification?.source_event_type)}
                        />
                        <DetailRow
                            label="Action Path"
                            value={notification?.action_path || "—"}
                            mono
                        />
                    </dl>

                    {notification?.payload &&
                        Object.keys(notification.payload).length > 0 && (
                            <div className="mt-5">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900">
                                        Additional Details
                                    </h3>

                                    <p className="mt-1 text-xs text-slate-500">
                                        Notification information in a readable format.
                                    </p>
                                </div>

                                <dl className="mt-3 rounded-2xl border border-slate-200 px-4">
                                    {flattenPayload(notification.payload)
                                        .map(row => (
                                            <DetailRow
                                                key={row.key}
                                                label={row.label}
                                                value={row.value}
                                                mono={
                                                    row.key.endsWith("public_id") ||
                                                    row.key.endsWith("idempotency_key")
                                                }
                                            />
                                        ))}
                                </dl>
                            </div>
                        )}

                    <div className="mt-6 flex flex-wrap justify-end gap-2">
                        {!notification?.is_read && (
                            <Button
                                type="button"
                                variant="secondary"
                                leftIcon={MailOpen}
                                disabled={loading || markingRead}
                                onClick={handleMarkRead}
                            >
                                {markingRead
                                    ? "Marking..."
                                    : "Mark as Read"}
                            </Button>
                        )}

                        {notification?.is_archived ? (
                            <Button
                                type="button"
                                variant="secondary"
                                leftIcon={RotateCcw}
                                disabled={loading || restoring}
                                onClick={handleRestore}
                            >
                                {restoring
                                    ? "Restoring..."
                                    : "Restore"}
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="secondary"
                                leftIcon={Archive}
                                disabled={loading || archiving}
                                onClick={handleArchive}
                            >
                                {archiving
                                    ? "Archiving..."
                                    : "Archive"}
                            </Button>
                        )}

                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={RefreshCw}
                            disabled={
                                loading ||
                                markingRead ||
                                archiving ||
                                restoring
                            }
                            onClick={loadNotification}
                        >
                            {loading ? "Refreshing..." : "Refresh"}
                        </Button>

                        {notification?.action_path && (
                            <Button
                                type="button"
                                leftIcon={ExternalLink}
                                onClick={() =>
                                    onOpenAction?.(
                                        notification.action_path
                                    )
                                }
                            >
                                Open Action
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default NotificationDetailModal;

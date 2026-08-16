import {
    Archive,
    RotateCcw,
    Bell,
    BellRing,
    CheckCheck,
    ChevronLeft,
    ChevronRight,
    Eye,
    MailOpen,
    RefreshCw,
    Settings2
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import {
    useNavigate
} from "react-router-dom";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

import NotificationDetailModal from "./NotificationDetailModal";
import NotificationPreferencesModal from "./NotificationPreferencesModal";

const NOTIFICATION_CATEGORIES = [
    "access",
    "lease",
    "billing",
    "payment",
    "maintenance",
    "preventive_maintenance",
    "system"
];

const EMPTY_PAGINATION = {
    page: 1,
    limit: 20,
    total_records: 0,
    total_pages: 0
};

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
            minute: "2-digit"
        }
    ).format(parsed);
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load notifications.";

const extractNotifications = response => {
    const root = response?.data || {};
    const data = root?.data || {};

    if (Array.isArray(data.notifications)) {
        return data.notifications;
    }

    if (Array.isArray(root.notifications)) {
        return root.notifications;
    }

    if (Array.isArray(data)) {
        return data;
    }

    return [];
};

const extractPagination = (
    response,
    fallbackPage,
    fallbackLimit,
    loadedCount
) => {
    const root = response?.data || {};
    const data = root?.data || {};
    const raw =
        data.pagination ||
        root.pagination ||
        {};

    const page =
        Number(raw.page) || fallbackPage;
    const limit =
        Number(raw.limit) || fallbackLimit;
    const totalRecords =
        Number(
            raw.total_records ??
            raw.total ??
            root.total_records ??
            root.total
        );

    const safeTotal =
        Number.isFinite(totalRecords)
            ? totalRecords
            : loadedCount;

    const rawTotalPages =
        Number(
            raw.total_pages ??
            raw.pages
        );

    const totalPages =
        Number.isFinite(rawTotalPages) &&
        rawTotalPages >= 0
            ? rawTotalPages
            : (
                safeTotal > 0
                    ? Math.ceil(
                        safeTotal / limit
                    )
                    : 0
            );

    return {
        page,
        limit,
        total_records: safeTotal,
        total_pages: totalPages
    };
};

const extractUnreadCount = response => {
    const root = response?.data || {};
    const data = root?.data || {};

    const candidates = [
        data.unread_count,
        data.count,
        root.unread_count,
        root.count
    ];

    for (const candidate of candidates) {
        const parsed = Number(candidate);

        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return 0;
};

const priorityClassName = priority => {
    switch (priority) {
        case "urgent":
            return "border-rose-200 bg-rose-50 text-rose-700";

        case "high":
            return "border-orange-200 bg-orange-50 text-orange-700";

        case "normal":
            return "border-blue-200 bg-blue-50 text-blue-700";

        case "low":
            return "border-slate-200 bg-slate-50 text-slate-700";

        default:
            return "border-slate-200 bg-white text-slate-700";
    }
};

function NotificationsPage() {
    const navigate = useNavigate();

    const [notifications, setNotifications] =
        useState([]);
    const [unreadCount, setUnreadCount] =
        useState(0);
    const [pagination, setPagination] =
        useState(EMPTY_PAGINATION);
    const [loading, setLoading] =
        useState(true);
    const [error, setError] =
        useState("");
    const [stateFilter, setStateFilter] =
        useState("all");
    const [categoryFilter, setCategoryFilter] =
        useState("");
    const [selectedNotification, setSelectedNotification] =
        useState(null);
    const [markingReadId, setMarkingReadId] =
        useState("");
    const [markingAllRead, setMarkingAllRead] =
        useState(false);
    const [archiveFilter, setArchiveFilter] =
        useState("active");
    const [archivingId, setArchivingId] =
        useState("");
    const [restoringId, setRestoringId] =
        useState("");
    const [archivingAll, setArchivingAll] =
        useState(false);
    const [selectedNotificationIds, setSelectedNotificationIds] =
        useState([]);
    const [bulkReading, setBulkReading] =
        useState(false);
    const [bulkArchiving, setBulkArchiving] =
        useState(false);
    const [preferencesOpen, setPreferencesOpen] =
        useState(false);

    const loadUnreadCount =
        useCallback(async () => {
            try {
                const response =
                    await apiClient.get(
                        "/notifications/unread-count"
                    );

                const nextUnreadCount =
                    extractUnreadCount(response);

                setUnreadCount(
                    nextUnreadCount
                );

                window.dispatchEvent(
                    new CustomEvent(
                        "rental-manager:notification-unread-count",
                        {
                            detail: {
                                unread_count:
                                    nextUnreadCount
                            }
                        }
                    )
                );
            } catch {
                // Keep notification listing usable even if the
                // independent unread-count request fails.
            }
        }, []);

    const loadNotifications =
        useCallback(
            async ({
                page = 1,
                limit = pagination.limit,
                archiveState = archiveFilter
            } = {}) => {
                setLoading(true);
                setError("");

                try {
                    const response =
                        await apiClient.get(
                            "/notifications",
                            {
                                params: {
                                    page,
                                    limit,
                                    archive_state:
                                        archiveState
                                }
                            }
                        );

                    const loaded =
                        extractNotifications(
                            response
                        );

                    setNotifications(loaded);
                    setSelectedNotificationIds([]);
                    setPagination(
                        extractPagination(
                            response,
                            page,
                            limit,
                            loaded.length
                        )
                    );

                    await loadUnreadCount();
                } catch (loadError) {
                    setNotifications([]);
                    setError(
                        getErrorMessage(
                            loadError
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            [
                archiveFilter,
                loadUnreadCount,
                pagination.limit
            ]
        );

    useEffect(() => {
        loadNotifications({
            page: 1,
            limit: 20,
            archiveState: "active"
        });
    }, []);

    const visibleNotifications =
        useMemo(
            () => notifications.filter(
                notification => {
                    if (
                        stateFilter === "unread" &&
                        notification.is_read
                    ) {
                        return false;
                    }

                    if (
                        stateFilter === "read" &&
                        !notification.is_read
                    ) {
                        return false;
                    }

                    if (
                        categoryFilter &&
                        notification.category !==
                            categoryFilter
                    ) {
                        return false;
                    }

                    if (
                        archiveFilter === "active" &&
                        notification.is_archived
                    ) {
                        return false;
                    }

                    if (
                        archiveFilter === "archived" &&
                        !notification.is_archived
                    ) {
                        return false;
                    }

                    return true;
                }
            ),
            [
                archiveFilter,
                categoryFilter,
                notifications,
                stateFilter
            ]
        );

    const selectableVisibleNotifications =
        useMemo(
            () => visibleNotifications.filter(
                notification =>
                    !notification.is_archived
            ),
            [visibleNotifications]
        );

    const selectedNotifications =
        useMemo(
            () => notifications.filter(
                notification =>
                    selectedNotificationIds.includes(
                        notification.public_id
                    )
            ),
            [notifications, selectedNotificationIds]
        );

    const selectedUnreadIds =
        useMemo(
            () => selectedNotifications
                .filter(
                    notification =>
                        !notification.is_read &&
                        !notification.is_archived
                )
                .map(
                    notification =>
                        notification.public_id
                ),
            [selectedNotifications]
        );

    const selectedActiveIds =
        useMemo(
            () => selectedNotifications
                .filter(
                    notification =>
                        !notification.is_archived
                )
                .map(
                    notification =>
                        notification.public_id
                ),
            [selectedNotifications]
        );

    const allVisibleSelected =
        selectableVisibleNotifications.length > 0 &&
        selectableVisibleNotifications.every(
            notification =>
                selectedNotificationIds.includes(
                    notification.public_id
                )
        );

    useEffect(() => {
        setSelectedNotificationIds([]);
    }, [
        archiveFilter,
        categoryFilter,
        stateFilter
    ]);

    const toggleNotificationSelection =
        notificationPublicId => {
            setSelectedNotificationIds(current =>
                current.includes(notificationPublicId)
                    ? current.filter(
                        publicId =>
                            publicId !== notificationPublicId
                    )
                    : [
                        ...current,
                        notificationPublicId
                    ]
            );
        };

    const toggleSelectAllVisible = () => {
        const visibleIds =
            selectableVisibleNotifications.map(
                notification =>
                    notification.public_id
            );

        if (allVisibleSelected) {
            setSelectedNotificationIds(current =>
                current.filter(
                    publicId =>
                        !visibleIds.includes(publicId)
                )
            );
            return;
        }

        setSelectedNotificationIds(current =>
            Array.from(
                new Set([
                    ...current,
                    ...visibleIds
                ])
            )
        );
    };

    const pageRangeText =
        useMemo(() => {
            if (
                pagination.total_records === 0
            ) {
                return "0 records";
            }

            const first =
                (
                    pagination.page - 1
                ) * pagination.limit + 1;

            const last = Math.min(
                pagination.page *
                    pagination.limit,
                pagination.total_records
            );

            return `${first}-${last} of ${pagination.total_records}`;
        }, [pagination]);

    const openAction = path => {
        if (
            typeof path !== "string" ||
            !path.startsWith("/") ||
            path.startsWith("//")
        ) {
            return;
        }

        navigate(path);
    };

    const markNotificationAsRead =
        useCallback(
            async notificationPublicId => {
                if (!notificationPublicId) {
                    return;
                }

                setMarkingReadId(
                    notificationPublicId
                );
                setError("");

                try {
                    await apiClient.patch(
                        `/notifications/${encodeURIComponent(notificationPublicId)}/read`
                    );

                    setNotifications(current =>
                        current.map(notification =>
                            notification.public_id ===
                            notificationPublicId
                                ? {
                                    ...notification,
                                    is_read: true
                                }
                                : notification
                        )
                    );

                    setSelectedNotification(
                        current =>
                            current?.public_id ===
                            notificationPublicId
                                ? {
                                    ...current,
                                    is_read: true
                                }
                                : current
                    );

                    setUnreadCount(current =>
                        Math.max(0, current - 1)
                    );

                    await loadUnreadCount();
                } catch (mutationError) {
                    setError(
                        mutationError?.response?.data?.message ||
                        mutationError?.response?.data?.errors?.[0]?.message ||
                        mutationError?.message ||
                        "Unable to mark the notification as read."
                    );

                    throw mutationError;
                } finally {
                    setMarkingReadId("");
                }
            },
            [loadUnreadCount]
        );

    const markAllNotificationsAsRead =
        useCallback(async () => {
            setMarkingAllRead(true);
            setError("");

            try {
                await apiClient.patch(
                    "/notifications/read-all"
                );

                setNotifications(current =>
                    current.map(notification => ({
                        ...notification,
                        is_read: true
                    }))
                );

                setSelectedNotification(
                    current =>
                        current
                            ? {
                                ...current,
                                is_read: true
                            }
                            : current
                );

                setUnreadCount(0);
                await loadUnreadCount();
            } catch (mutationError) {
                setError(
                    mutationError?.response?.data?.message ||
                    mutationError?.response?.data?.errors?.[0]?.message ||
                    mutationError?.message ||
                    "Unable to mark all notifications as read."
                );
            } finally {
                setMarkingAllRead(false);
            }
        }, [loadUnreadCount]);

    const archiveNotification =
        useCallback(
            async notificationPublicId => {
                if (!notificationPublicId) {
                    return;
                }

                const currentNotification =
                    notifications.find(
                        notification =>
                            notification.public_id ===
                            notificationPublicId
                    );

                setArchivingId(notificationPublicId);
                setError("");

                try {
                    await apiClient.patch(
                        `/notifications/${encodeURIComponent(notificationPublicId)}/archive`
                    );

                    setNotifications(current =>
                        current.map(notification =>
                            notification.public_id ===
                            notificationPublicId
                                ? {
                                    ...notification,
                                    is_read: true,
                                    is_archived: true
                                }
                                : notification
                        )
                    );

                    setSelectedNotification(current =>
                        current?.public_id ===
                        notificationPublicId
                            ? {
                                ...current,
                                is_read: true,
                                is_archived: true
                            }
                            : current
                    );

                    if (
                        currentNotification &&
                        !currentNotification.is_read
                    ) {
                        setUnreadCount(current =>
                            Math.max(0, current - 1)
                        );
                    }

                    setSelectedNotificationIds(current =>
                        current.filter(
                            publicId =>
                                publicId !== notificationPublicId
                        )
                    );

                    await loadUnreadCount();
                } catch (mutationError) {
                    setError(
                        mutationError?.response?.data?.message ||
                        mutationError?.response?.data?.errors?.[0]?.message ||
                        mutationError?.message ||
                        "Unable to archive the notification."
                    );

                    throw mutationError;
                } finally {
                    setArchivingId("");
                }
            },
            [
                loadUnreadCount,
                notifications
            ]
        );

    const restoreNotification =
        useCallback(
            async notificationPublicId => {
                if (!notificationPublicId) {
                    return;
                }

                setRestoringId(notificationPublicId);
                setError("");

                try {
                    await apiClient.patch(
                        `/notifications/${encodeURIComponent(notificationPublicId)}/restore`
                    );

                    setNotifications(current =>
                        current.map(notification =>
                            notification.public_id ===
                            notificationPublicId
                                ? {
                                    ...notification,
                                    is_archived: false
                                }
                                : notification
                        )
                    );

                    setSelectedNotification(current =>
                        current?.public_id ===
                        notificationPublicId
                            ? {
                                ...current,
                                is_archived: false
                            }
                            : current
                    );
                } catch (mutationError) {
                    setError(
                        mutationError?.response?.data?.message ||
                        mutationError?.response?.data?.errors?.[0]?.message ||
                        mutationError?.message ||
                        "Unable to restore the notification."
                    );

                    throw mutationError;
                } finally {
                    setRestoringId("");
                }
            },
            []
        );

    const archiveAllNotifications =
        useCallback(async () => {
            setArchivingAll(true);
            setError("");

            try {
                await apiClient.patch(
                    "/notifications/archive-all"
                );

                setNotifications(current =>
                    current.map(notification => ({
                        ...notification,
                        is_read: true,
                        is_archived: true
                    }))
                );

                setSelectedNotification(current =>
                    current
                        ? {
                            ...current,
                            is_read: true,
                            is_archived: true
                        }
                        : current
                );

                setUnreadCount(0);
                setSelectedNotificationIds([]);
                await loadUnreadCount();
            } catch (mutationError) {
                setError(
                    mutationError?.response?.data?.message ||
                    mutationError?.response?.data?.errors?.[0]?.message ||
                    mutationError?.message ||
                    "Unable to archive all notifications."
                );
            } finally {
                setArchivingAll(false);
            }
        }, [loadUnreadCount]);

    const bulkMarkNotificationsAsRead =
        useCallback(async () => {
            if (selectedUnreadIds.length === 0) {
                return;
            }

            setBulkReading(true);
            setError("");

            try {
                await apiClient.patch(
                    "/notifications/bulk-read",
                    {
                        notification_public_ids:
                            selectedUnreadIds
                    }
                );

                const updatedIds =
                    new Set(selectedUnreadIds);

                setNotifications(current =>
                    current.map(notification =>
                        updatedIds.has(
                            notification.public_id
                        )
                            ? {
                                ...notification,
                                is_read: true
                            }
                            : notification
                    )
                );

                setSelectedNotification(current =>
                    current &&
                    updatedIds.has(current.public_id)
                        ? {
                            ...current,
                            is_read: true
                        }
                        : current
                );

                setSelectedNotificationIds([]);
                await loadUnreadCount();
            } catch (mutationError) {
                setError(
                    mutationError?.response?.data?.message ||
                    mutationError?.response?.data?.errors?.[0]?.message ||
                    mutationError?.message ||
                    "Unable to mark the selected notifications as read."
                );
            } finally {
                setBulkReading(false);
            }
        }, [
            loadUnreadCount,
            selectedUnreadIds
        ]);

    const bulkArchiveNotifications =
        useCallback(async () => {
            if (selectedActiveIds.length === 0) {
                return;
            }

            setBulkArchiving(true);
            setError("");

            try {
                await apiClient.patch(
                    "/notifications/bulk-archive",
                    {
                        notification_public_ids:
                            selectedActiveIds
                    }
                );

                const updatedIds =
                    new Set(selectedActiveIds);

                setNotifications(current =>
                    current.map(notification =>
                        updatedIds.has(
                            notification.public_id
                        )
                            ? {
                                ...notification,
                                is_read: true,
                                is_archived: true
                            }
                            : notification
                    )
                );

                setSelectedNotification(current =>
                    current &&
                    updatedIds.has(current.public_id)
                        ? {
                            ...current,
                            is_read: true,
                            is_archived: true
                        }
                        : current
                );

                setSelectedNotificationIds([]);
                await loadUnreadCount();
            } catch (mutationError) {
                setError(
                    mutationError?.response?.data?.message ||
                    mutationError?.response?.data?.errors?.[0]?.message ||
                    mutationError?.message ||
                    "Unable to archive the selected notifications."
                );
            } finally {
                setBulkArchiving(false);
            }
        }, [
            loadUnreadCount,
            selectedActiveIds
        ]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <Bell className="h-5 w-5" />
                    </div>

                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            Notifications
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            View system and business notifications delivered to your account.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        leftIcon={Settings2}
                        disabled={loading}
                        onClick={() =>
                            setPreferencesOpen(true)
                        }
                    >
                        Preferences
                    </Button>

                    <Button
                        type="button"
                        variant="secondary"
                        leftIcon={CheckCheck}
                        disabled={
                            loading ||
                            markingAllRead ||
                            unreadCount <= 0
                        }
                        onClick={markAllNotificationsAsRead}
                    >
                        {markingAllRead
                            ? "Marking All..."
                            : "Mark All as Read"}
                    </Button>

                    <Button
                        type="button"
                        variant="secondary"
                        leftIcon={Archive}
                        disabled={
                            loading ||
                            markingAllRead ||
                            archivingAll ||
                            notifications.length === 0 ||
                            notifications.every(
                                notification =>
                                    notification.is_archived
                            )
                        }
                        onClick={archiveAllNotifications}
                    >
                        {archivingAll
                            ? "Archiving All..."
                            : "Archive All"}
                    </Button>

                    <Button
                        type="button"
                        variant="secondary"
                        leftIcon={RefreshCw}
                        disabled={
                            loading ||
                            markingAllRead ||
                            archivingAll
                        }
                        onClick={() =>
                            loadNotifications({
                                page: pagination.page
                            })
                        }
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Unread
                            </p>
                            <p className="mt-2 text-3xl font-bold text-slate-900">
                                {unreadCount}
                            </p>
                        </div>

                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <BellRing className="h-5 w-5" />
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-1 xl:col-span-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Current Page
                    </p>

                    <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-2">
                        <span className="text-2xl font-bold text-slate-900">
                            {notifications.length}
                        </span>
                        <span className="text-sm text-slate-500">
                            notifications loaded
                        </span>
                        <span className="text-sm text-slate-400">
                            {pageRangeText}
                        </span>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Read State
                        </span>
                        <select
                            value={stateFilter}
                            onChange={event =>
                                setStateFilter(
                                    event.target.value
                                )
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        >
                            <option value="all">
                                All on this page
                            </option>
                            <option value="unread">
                                Unread
                            </option>
                            <option value="read">
                                Read
                            </option>
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Category
                        </span>
                        <select
                            value={categoryFilter}
                            onChange={event =>
                                setCategoryFilter(
                                    event.target.value
                                )
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        >
                            <option value="">
                                All categories on this page
                            </option>
                            {NOTIFICATION_CATEGORIES.map(
                                category => (
                                    <option
                                        key={category}
                                        value={category}
                                    >
                                        {formatLabel(category)}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Archive State
                        </span>
                        <select
                            value={archiveFilter}
                            onChange={event => {
                                const nextArchiveState =
                                    event.target.value;

                                setArchiveFilter(
                                    nextArchiveState
                                );

                                loadNotifications({
                                    page: 1,
                                    archiveState:
                                        nextArchiveState
                                });
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        >
                            <option value="active">
                                Active
                            </option>
                            <option value="archived">
                                Archived
                            </option>
                            <option value="all">
                                All on this page
                            </option>
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Per Page
                        </span>
                        <select
                            value={pagination.limit}
                            onChange={event =>
                                loadNotifications({
                                    page: 1,
                                    limit: Number(
                                        event.target.value
                                    )
                                })
                            }
                            disabled={loading}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                        >
                            {[10, 20, 50, 100].map(
                                limit => (
                                    <option
                                        key={limit}
                                        value={limit}
                                    >
                                        {limit}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <div className="flex items-end">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={
                                stateFilter === "all" &&
                                categoryFilter === "" &&
                                archiveFilter === "active"
                            }
                            onClick={() => {
                                setStateFilter("all");
                                setCategoryFilter("");
                                setArchiveFilter("active");
                            }}
                        >
                            Clear Filters
                        </Button>
                    </div>
                </div>

                <p className="mt-3 text-xs text-slate-400">
                    Archive state is loaded from the backend. Read-state and category filters are applied to the currently loaded page, while backend pagination remains authoritative.
                </p>
            </div>

            {selectedNotificationIds.length > 0 && (
                <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-blue-900">
                            {selectedNotificationIds.length} notification{selectedNotificationIds.length === 1 ? "" : "s"} selected
                        </p>
                        <p className="mt-1 text-xs text-blue-700">
                            Bulk actions apply only to the selected active notifications on this loaded page.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={CheckCheck}
                            disabled={
                                bulkReading ||
                                bulkArchiving ||
                                selectedUnreadIds.length === 0
                            }
                            onClick={bulkMarkNotificationsAsRead}
                        >
                            {bulkReading
                                ? "Marking Selected..."
                                : `Mark Selected Read (${selectedUnreadIds.length})`}
                        </Button>

                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={Archive}
                            disabled={
                                bulkReading ||
                                bulkArchiving ||
                                selectedActiveIds.length === 0
                            }
                            onClick={bulkArchiveNotifications}
                        >
                            {bulkArchiving
                                ? "Archiving Selected..."
                                : `Archive Selected (${selectedActiveIds.length})`}
                        </Button>

                        <Button
                            type="button"
                            variant="secondary"
                            disabled={
                                bulkReading ||
                                bulkArchiving
                            }
                            onClick={() =>
                                setSelectedNotificationIds([])
                            }
                        >
                            Clear Selection
                        </Button>
                    </div>
                </div>
            )}

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="w-12 px-5 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        aria-label="Select all active notifications visible on this page"
                                        checked={allVisibleSelected}
                                        disabled={
                                            selectableVisibleNotifications.length === 0 ||
                                            bulkReading ||
                                            bulkArchiving
                                        }
                                        onChange={toggleSelectAllVisible}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Notification
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Category
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Priority
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    State
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Created
                                </th>
                                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Action
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-5 py-12 text-center text-sm text-slate-500"
                                    >
                                        Loading notifications...
                                    </td>
                                </tr>
                            ) : visibleNotifications.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-5 py-12 text-center text-sm text-slate-500"
                                    >
                                        {notifications.length === 0
                                            ? "No notifications found."
                                            : "No notifications on this page match the selected filters."}
                                    </td>
                                </tr>
                            ) : (
                                visibleNotifications.map(
                                    notification => (
                                        <tr
                                            key={notification.public_id}
                                            className={
                                                notification.is_read
                                                    ? "hover:bg-slate-50/70"
                                                    : "bg-blue-50/30 hover:bg-blue-50/60"
                                            }
                                        >
                                            <td className="w-12 px-5 py-4 align-top">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Select ${notification.title || "notification"}`}
                                                    checked={
                                                        selectedNotificationIds.includes(
                                                            notification.public_id
                                                        )
                                                    }
                                                    disabled={
                                                        notification.is_archived ||
                                                        bulkReading ||
                                                        bulkArchiving
                                                    }
                                                    onChange={() =>
                                                        toggleNotificationSelection(
                                                            notification.public_id
                                                        )
                                                    }
                                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                                                />
                                            </td>

                                            <td className="max-w-xl px-5 py-4 align-top">
                                                <div className="flex items-start gap-3">
                                                    <span
                                                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notification.is_read ? "bg-slate-300" : "bg-blue-500"}`}
                                                    />

                                                    <div className="min-w-0">
                                                        <p className={`truncate text-sm text-slate-900 ${notification.is_read ? "font-medium" : "font-bold"}`}>
                                                            {notification.title || "Untitled notification"}
                                                        </p>

                                                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                                            {notification.message || "—"}
                                                        </p>

                                                        <p className="mt-1 truncate font-mono text-[11px] text-slate-400">
                                                            {notification.public_id}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-5 py-4 align-top text-sm text-slate-700">
                                                {formatLabel(notification.category)}
                                            </td>

                                            <td className="px-5 py-4 align-top">
                                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClassName(notification.priority)}`}>
                                                    {formatLabel(notification.priority)}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4 align-top">
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${notification.is_read ? "border-slate-200 bg-slate-100 text-slate-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                                                        {notification.is_read ? "Read" : "Unread"}
                                                    </span>

                                                    {notification.is_archived && (
                                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                                            Archived
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 align-top text-xs text-slate-500">
                                                {formatDateTime(notification.created_at)}
                                            </td>

                                            <td className="px-5 py-4 text-right align-top">
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    {!notification.is_read && (
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            leftIcon={MailOpen}
                                                            disabled={
                                                                markingAllRead ||
                                                                markingReadId ===
                                                                    notification.public_id
                                                            }
                                                            onClick={() =>
                                                                markNotificationAsRead(
                                                                    notification.public_id
                                                                ).catch(() => {})
                                                            }
                                                        >
                                                            {markingReadId ===
                                                            notification.public_id
                                                                ? "Marking..."
                                                                : "Mark Read"}
                                                        </Button>
                                                    )}

                                                    {notification.is_archived ? (
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            leftIcon={RotateCcw}
                                                            disabled={
                                                                restoringId ===
                                                                    notification.public_id
                                                            }
                                                            onClick={() =>
                                                                restoreNotification(
                                                                    notification.public_id
                                                                ).catch(() => {})
                                                            }
                                                        >
                                                            {restoringId ===
                                                            notification.public_id
                                                                ? "Restoring..."
                                                                : "Restore"}
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            leftIcon={Archive}
                                                            disabled={
                                                                archivingAll ||
                                                                archivingId ===
                                                                    notification.public_id
                                                            }
                                                            onClick={() =>
                                                                archiveNotification(
                                                                    notification.public_id
                                                                ).catch(() => {})
                                                            }
                                                        >
                                                            {archivingId ===
                                                            notification.public_id
                                                                ? "Archiving..."
                                                                : "Archive"}
                                                        </Button>
                                                    )}

                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        leftIcon={Eye}
                                                        onClick={() =>
                                                            setSelectedNotification(
                                                                notification
                                                            )
                                                        }
                                                    >
                                                        View
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                )
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-500">
                        Page {pagination.page}
                        {pagination.total_pages > 0 &&
                            ` of ${pagination.total_pages}`}
                        {` · ${pageRangeText}`}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={ChevronLeft}
                            disabled={
                                loading ||
                                pagination.page <= 1
                            }
                            onClick={() =>
                                loadNotifications({
                                    page:
                                        pagination.page - 1
                                })
                            }
                        >
                            Previous
                        </Button>

                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={ChevronRight}
                            disabled={
                                loading ||
                                pagination.total_pages === 0 ||
                                pagination.page >=
                                    pagination.total_pages
                            }
                            onClick={() =>
                                loadNotifications({
                                    page:
                                        pagination.page + 1
                                })
                            }
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>

            <NotificationPreferencesModal
                open={preferencesOpen}
                onClose={() =>
                    setPreferencesOpen(false)
                }
                onSaved={() => {
                    loadUnreadCount();
                    loadNotifications({
                        page: 1
                    });
                }}
            />

            <NotificationDetailModal
                notificationPublicId={
                    selectedNotification?.public_id
                }
                fallbackNotification={
                    selectedNotification
                }
                onClose={() =>
                    setSelectedNotification(null)
                }
                onOpenAction={openAction}
                onMarkRead={markNotificationAsRead}
                markingRead={
                    markingReadId ===
                    selectedNotification?.public_id
                }
                onArchive={archiveNotification}
                archiving={
                    archivingId ===
                    selectedNotification?.public_id
                }
                onRestore={restoreNotification}
                restoring={
                    restoringId ===
                    selectedNotification?.public_id
                }
            />
        </div>
    );
}

export default NotificationsPage;

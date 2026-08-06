const asyncHandler = require(
    "../../utils/asyncHandler"
);

const AppError = require(
    "../../utils/AppError"
);

const {
    getNotifications,
    getUnreadNotificationCount,
    getSingleNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead
} = require(
    "../../services/notifications/inboxService"
);

const handleNotificationReadError = ({
    error,
    next,
    operationMessage
}) => {
    if (
        error.code === "40001" ||
        error.code === "40P01"
    ) {
        return next(
            new AppError(
                `${operationMessage} could not be completed because of a concurrent operation. Please try again.`,
                409
            )
        );
    }

    return next(error);
};

const handleNotificationWriteError = ({
    error,
    next,
    operationMessage
}) => {
    if (error.code === "P0001") {
        return next(
            new AppError(
                error.message ||
                    `${operationMessage} violates a notification lifecycle rule.`,
                409
            )
        );
    }

    if (error.code === "23514") {
        return next(
            new AppError(
                `${operationMessage} violates a notification validation rule.`,
                422
            )
        );
    }

    if (error.code === "23503") {
        return next(
            new AppError(
                "A related notification record is no longer available.",
                409
            )
        );
    }

    if (
        error.code === "40001" ||
        error.code === "40P01"
    ) {
        return next(
            new AppError(
                `${operationMessage} conflicted with another operation. Please try again.`,
                409
            )
        );
    }

    return next(error);
};

const getNotificationsController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await getNotifications({
                        filters: req.query,
                        authenticatedUser:
                            req.user
                    });

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Notifications retrieved successfully.",
                        data: {
                            notifications:
                                result.notifications,
                            pagination:
                                result.pagination
                        }
                    });
            } catch (error) {
                return handleNotificationReadError({
                    error,
                    next,
                    operationMessage:
                        "The notification inbox request"
                });
            }
        }
    );

const getUnreadNotificationCountController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await getUnreadNotificationCount({
                        authenticatedUser:
                            req.user
                    });

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Unread notification count retrieved successfully.",
                        data: result
                    });
            } catch (error) {
                return handleNotificationReadError({
                    error,
                    next,
                    operationMessage:
                        "The unread notification count request"
                });
            }
        }
    );

const getSingleNotificationController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await getSingleNotification({
                        notificationPublicId:
                            req.params
                                .notification_public_id,
                        authenticatedUser:
                            req.user
                    });

                if (result.notificationNotFound) {
                    return next(
                        new AppError(
                            "Notification not found.",
                            404
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Notification retrieved successfully.",
                        data: {
                            notification:
                                result.notification
                        }
                    });
            } catch (error) {
                return handleNotificationReadError({
                    error,
                    next,
                    operationMessage:
                        "The notification detail request"
                });
            }
        }
    );

const markNotificationAsReadController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await markNotificationAsRead({
                        notificationPublicId:
                            req.params
                                .notification_public_id,
                        authenticatedUser:
                            req.user
                    });

                if (result.notificationNotFound) {
                    return next(
                        new AppError(
                            "Notification not found.",
                            404
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message: result.noChanges
                            ? "Notification was already marked as read."
                            : "Notification marked as read successfully.",
                        data: {
                            changed:
                                !result.noChanges,
                            notification:
                                result.notification
                        }
                    });
            } catch (error) {
                return handleNotificationWriteError({
                    error,
                    next,
                    operationMessage:
                        "The notification read update"
                });
            }
        }
    );

const markAllNotificationsAsReadController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await markAllNotificationsAsRead({
                        authenticatedUser:
                            req.user
                    });

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            result.marked_count === 0
                                ? "No unread notifications required updating."
                                : "All available notifications marked as read successfully.",
                        data: {
                            marked_count:
                                result.marked_count,
                            read_at:
                                result.read_at
                        }
                    });
            } catch (error) {
                return handleNotificationWriteError({
                    error,
                    next,
                    operationMessage:
                        "The mark-all-notifications-as-read operation"
                });
            }
        }
    );

module.exports = {
    getNotificationsController,
    getUnreadNotificationCountController,
    getSingleNotificationController,
    markNotificationAsReadController,
    markAllNotificationsAsReadController
};

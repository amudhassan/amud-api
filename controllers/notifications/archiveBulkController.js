const asyncHandler = require(
    "../../utils/asyncHandler"
);

const AppError = require(
    "../../utils/AppError"
);

const {
    archiveSingleNotification,
    archiveAllNotifications,
    restoreSingleNotification,
    bulkReadNotifications,
    bulkArchiveNotifications
} = require(
    "../../services/notifications/archiveBulkService"
);

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

const archiveSingleNotificationController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await archiveSingleNotification({
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

                if (
                    result.notificationNotAvailable
                ) {
                    return next(
                        new AppError(
                            "Notification is not currently available for archiving.",
                            409
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message: result.noChanges
                            ? "Notification was already archived."
                            : "Notification archived successfully.",
                        data: {
                            changed:
                                !result.noChanges,
                            newly_read:
                                result.newlyRead,
                            notification:
                                result.notification
                        }
                    });
            } catch (error) {
                return handleNotificationWriteError({
                    error,
                    next,
                    operationMessage:
                        "The notification archive operation"
                });
            }
        }
    );

const archiveAllNotificationsController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await archiveAllNotifications({
                        authenticatedUser:
                            req.user
                    });

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            result.archived_count === 0
                                ? "No active notifications required archiving."
                                : "All active notifications archived successfully.",
                        data: result
                    });
            } catch (error) {
                return handleNotificationWriteError({
                    error,
                    next,
                    operationMessage:
                        "The archive-all-notifications operation"
                });
            }
        }
    );

const restoreSingleNotificationController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await restoreSingleNotification({
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
                            ? "Notification was already active."
                            : "Notification restored successfully.",
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
                        "The notification restore operation"
                });
            }
        }
    );

const bulkReadNotificationsController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await bulkReadNotifications({
                        notificationPublicIds:
                            req.body
                                .notification_public_ids,
                        authenticatedUser:
                            req.user
                    });

                if (result.notificationsNotFound) {
                    return next(
                        new AppError(
                            "One or more notifications were not found.",
                            404
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            result.marked_count === 0
                                ? "All selected notifications were already read."
                                : "Selected notifications marked as read successfully.",
                        data: result
                    });
            } catch (error) {
                return handleNotificationWriteError({
                    error,
                    next,
                    operationMessage:
                        "The bulk notification read operation"
                });
            }
        }
    );

const bulkArchiveNotificationsController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await bulkArchiveNotifications({
                        notificationPublicIds:
                            req.body
                                .notification_public_ids,
                        authenticatedUser:
                            req.user
                    });

                if (result.notificationsNotFound) {
                    return next(
                        new AppError(
                            "One or more notifications were not found.",
                            404
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Selected notifications archived successfully.",
                        data: result
                    });
            } catch (error) {
                return handleNotificationWriteError({
                    error,
                    next,
                    operationMessage:
                        "The bulk notification archive operation"
                });
            }
        }
    );

module.exports = {
    archiveSingleNotificationController,
    archiveAllNotificationsController,
    restoreSingleNotificationController,
    bulkReadNotificationsController,
    bulkArchiveNotificationsController
};

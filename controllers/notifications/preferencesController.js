const asyncHandler = require(
    "../../utils/asyncHandler"
);

const AppError = require(
    "../../utils/AppError"
);

const {
    getNotificationPreferences,
    updateNotificationPreferences,
    resetNotificationPreferences
} = require(
    "../../services/notifications/preferencesService"
);

const handlePreferenceError = ({
    error,
    next,
    operationMessage
}) => {
    if (error.code === "P0001") {
        return next(
            new AppError(
                error.message ||
                    `${operationMessage} violates a notification preference rule.`,
                422
            )
        );
    }

    if (error.code === "23514") {
        return next(
            new AppError(
                `${operationMessage} violates a notification preference validation rule.`,
                422
            )
        );
    }

    if (error.code === "23503") {
        return next(
            new AppError(
                "A related notification preference record is no longer available.",
                409
            )
        );
    }

    if (error.code === "23505") {
        return next(
            new AppError(
                "The notification preference record conflicts with an existing record.",
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

const getNotificationPreferencesController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await getNotificationPreferences({
                        authenticatedUser:
                            req.user
                    });

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Notification preferences retrieved successfully.",
                        data: {
                            preferences:
                                result.preferences
                        }
                    });
            } catch (error) {
                return handlePreferenceError({
                    error,
                    next,
                    operationMessage:
                        "The notification preference request"
                });
            }
        }
    );

const updateNotificationPreferencesController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await updateNotificationPreferences({
                        preferenceData:
                            req.body,
                        authenticatedUser:
                            req.user
                    });

                if (result.invalidQuietHours) {
                    return next(
                        new AppError(
                            "Quiet hours require different start and end times when enabled.",
                            422
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            result.noChanges
                                ? "Notification preferences already match the requested values."
                                : "Notification preferences updated successfully.",
                        data: {
                            changed:
                                !result.noChanges,
                            preferences:
                                result.preferences
                        }
                    });
            } catch (error) {
                return handlePreferenceError({
                    error,
                    next,
                    operationMessage:
                        "The notification preference update"
                });
            }
        }
    );

const resetNotificationPreferencesController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await resetNotificationPreferences({
                        authenticatedUser:
                            req.user
                    });

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            result.noChanges
                                ? "Notification preferences already use the default values."
                                : "Notification preferences reset successfully.",
                        data: {
                            changed:
                                !result.noChanges,
                            preferences:
                                result.preferences
                        }
                    });
            } catch (error) {
                return handlePreferenceError({
                    error,
                    next,
                    operationMessage:
                        "The notification preference reset"
                });
            }
        }
    );

module.exports = {
    getNotificationPreferencesController,
    updateNotificationPreferencesController,
    resetNotificationPreferencesController
};

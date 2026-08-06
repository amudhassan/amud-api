/*
 * Run from the project root:
 * node scripts/checkNotificationBatchD.js
 */

const notificationRoutes = require(
    "../routes/notificationRoutes"
);

const preferencesRoutes = require(
    "../routes/notifications/preferencesRoutes"
);

const preferencesService = require(
    "../services/notifications/preferencesService"
);

const preferencesController = require(
    "../controllers/notifications/preferencesController"
);

const preferencesValidator = require(
    "../validators/notifications/preferencesValidator"
);

if (typeof notificationRoutes !== "function") {
    throw new TypeError(
        "Notification routes did not export an Express router function."
    );
}

if (typeof preferencesRoutes !== "function") {
    throw new TypeError(
        "Notification preference routes did not export an Express router function."
    );
}

[
    "getNotificationPreferences",
    "updateNotificationPreferences",
    "resetNotificationPreferences"
].forEach(functionName => {
    if (
        typeof preferencesService[functionName] !==
            "function"
    ) {
        throw new TypeError(
            `Notification preference service export is invalid: ${functionName}.`
        );
    }
});

[
    "getNotificationPreferencesController",
    "updateNotificationPreferencesController",
    "resetNotificationPreferencesController"
].forEach(functionName => {
    if (
        typeof preferencesController[functionName] !==
            "function"
    ) {
        throw new TypeError(
            `Notification preference controller export is invalid: ${functionName}.`
        );
    }
});

[
    "getNotificationPreferencesValidator",
    "updateNotificationPreferencesValidator",
    "resetNotificationPreferencesValidator"
].forEach(exportName => {
    if (
        !Array.isArray(
            preferencesValidator[exportName]
        )
    ) {
        throw new TypeError(
            `Notification preference validator export is invalid: ${exportName}.`
        );
    }
});

console.log(
    "Notification Batch D import and route check passed."
);

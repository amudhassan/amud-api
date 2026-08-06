/*
 * Run from the project root:
 * node scripts/checkNotificationBatchC.js
 */

const notificationRoutes = require(
    "../routes/notificationRoutes"
);

const archiveBulkRoutes = require(
    "../routes/notifications/archiveBulkRoutes"
);

if (typeof notificationRoutes !== "function") {
    throw new TypeError(
        "Notification routes did not export an Express router function."
    );
}

if (typeof archiveBulkRoutes !== "function") {
    throw new TypeError(
        "Notification archive/bulk routes did not export an Express router function."
    );
}

console.log(
    "Notification Batch C import and route check passed."
);

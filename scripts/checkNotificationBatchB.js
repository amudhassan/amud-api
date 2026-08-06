/*
 * Run from the project root:
 * node scripts/checkNotificationBatchB.js
 */

const notificationRoutes = require(
    "../routes/notificationRoutes"
);

if (typeof notificationRoutes !== "function") {
    throw new TypeError(
        "Notification routes did not export an Express router function."
    );
}

console.log(
    "Notification Batch B import and route check passed."
);

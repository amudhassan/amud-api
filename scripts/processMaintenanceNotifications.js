/*
 * One-off processor for local testing, cron or manual recovery.
 *
 * Run from the project root:
 * node scripts/processMaintenanceNotifications.js
 */

const {
    processMaintenanceNotificationEvents
} = require(
    "../services/notifications/maintenanceEventProcessorService"
);

const run = async () => {
    const summary =
        await processMaintenanceNotificationEvents({
            limit:
                process.env
                    .NOTIFICATION_MAINTENANCE_BATCH_LIMIT,
            maxAttempts:
                process.env
                    .NOTIFICATION_MAINTENANCE_MAX_ATTEMPTS,
            retryBaseSeconds:
                process.env
                    .NOTIFICATION_MAINTENANCE_RETRY_BASE_SECONDS
        });

    console.log(
        JSON.stringify(summary, null, 2)
    );
};

run()
    .then(() => {
        process.exitCode = 0;
    })
    .catch(error => {
        console.error(
            "Maintenance notification processing failed:",
            error
        );

        process.exitCode = 1;
    });

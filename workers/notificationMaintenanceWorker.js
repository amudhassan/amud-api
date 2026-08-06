const {
    processMaintenanceNotificationEvents
} = require(
    "../services/notifications/maintenanceEventProcessorService"
);

let intervalHandle = null;
let runInProgress = false;

const parsePositiveInteger = ({
    value,
    fallback,
    maximum = Number.MAX_SAFE_INTEGER
}) => {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isInteger(parsed) || parsed < 1) {
        return fallback;
    }

    return Math.min(parsed, maximum);
};

const getWorkerConfiguration = () => ({
    enabled:
        String(
            process.env
                .NOTIFICATION_MAINTENANCE_WORKER_ENABLED ||
            "false"
        ).toLowerCase() === "true",

    intervalMilliseconds:
        parsePositiveInteger({
            value:
                process.env
                    .NOTIFICATION_MAINTENANCE_WORKER_INTERVAL_MS,
            fallback: 30000,
            maximum: 3600000
        }),

    batchLimit:
        parsePositiveInteger({
            value:
                process.env
                    .NOTIFICATION_MAINTENANCE_BATCH_LIMIT,
            fallback: 25,
            maximum: 100
        }),

    maxAttempts:
        parsePositiveInteger({
            value:
                process.env
                    .NOTIFICATION_MAINTENANCE_MAX_ATTEMPTS,
            fallback: 5,
            maximum: 20
        }),

    retryBaseSeconds:
        parsePositiveInteger({
            value:
                process.env
                    .NOTIFICATION_MAINTENANCE_RETRY_BASE_SECONDS,
            fallback: 60,
            maximum: 3600
        })
});

const runNotificationMaintenanceWorkerOnce = async () => {
    if (runInProgress) {
        return {
            skipped: true,
            reason:
                "notification_maintenance_worker_already_running"
        };
    }

    runInProgress = true;

    try {
        const configuration =
            getWorkerConfiguration();

        const summary =
            await processMaintenanceNotificationEvents({
                limit:
                    configuration.batchLimit,
                maxAttempts:
                    configuration.maxAttempts,
                retryBaseSeconds:
                    configuration.retryBaseSeconds
            });

        if (
            summary.claimed_events > 0 ||
            summary.failures.length > 0
        ) {
            console.log(
                "Notification maintenance worker summary:",
                JSON.stringify(summary)
            );
        }

        return summary;
    } catch (error) {
        console.error(
            "Notification maintenance worker failed:",
            error
        );

        return {
            failed: true,
            error:
                error && error.message
                    ? error.message
                    : "Unknown worker error."
        };
    } finally {
        runInProgress = false;
    }
};

const startNotificationMaintenanceWorker = () => {
    const configuration =
        getWorkerConfiguration();

    if (!configuration.enabled) {
        console.log(
            "Notification maintenance worker is disabled."
        );

        return {
            started: false,
            reason: "disabled"
        };
    }

    if (intervalHandle) {
        return {
            started: false,
            reason: "already_started"
        };
    }

    setImmediate(() => {
        runNotificationMaintenanceWorkerOnce();
    });

    intervalHandle = setInterval(
        () => {
            runNotificationMaintenanceWorkerOnce();
        },
        configuration.intervalMilliseconds
    );

    if (
        intervalHandle &&
        typeof intervalHandle.unref === "function"
    ) {
        intervalHandle.unref();
    }

    console.log(
        `Notification maintenance worker started with interval ${configuration.intervalMilliseconds} ms.`
    );

    return {
        started: true,
        interval_milliseconds:
            configuration.intervalMilliseconds
    };
};

const stopNotificationMaintenanceWorker = () => {
    if (!intervalHandle) {
        return {
            stopped: false,
            reason: "not_started"
        };
    }

    clearInterval(intervalHandle);
    intervalHandle = null;

    return {
        stopped: true
    };
};

module.exports = {
    getWorkerConfiguration,
    runNotificationMaintenanceWorkerOnce,
    startNotificationMaintenanceWorker,
    stopNotificationMaintenanceWorker
};

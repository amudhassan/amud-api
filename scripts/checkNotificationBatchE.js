/*
 * Run from the project root:
 * node scripts/checkNotificationBatchE.js
 */

const templateService = require(
    "../services/notifications/maintenanceEventTemplateService"
);

const processorService = require(
    "../services/notifications/maintenanceEventProcessorService"
);

const worker = require(
    "../workers/notificationMaintenanceWorker"
);

if (
    !Array.isArray(
        templateService
            .supportedMaintenanceEventTypes
    ) ||
    templateService
        .supportedMaintenanceEventTypes
        .length !== 14
) {
    throw new TypeError(
        "Maintenance notification event catalog is invalid."
    );
}

[
    "buildMaintenanceNotificationTemplate"
].forEach(functionName => {
    if (
        typeof templateService[functionName] !==
            "function"
    ) {
        throw new TypeError(
            `Maintenance notification template export is invalid: ${functionName}.`
        );
    }
});

[
    "normalizeProcessorOptions",
    "processSingleMaintenanceEvent",
    "processMaintenanceNotificationEvents"
].forEach(functionName => {
    if (
        typeof processorService[functionName] !==
            "function"
    ) {
        throw new TypeError(
            `Maintenance notification processor export is invalid: ${functionName}.`
        );
    }
});

[
    "getWorkerConfiguration",
    "runNotificationMaintenanceWorkerOnce",
    "startNotificationMaintenanceWorker",
    "stopNotificationMaintenanceWorker"
].forEach(functionName => {
    if (
        typeof worker[functionName] !==
            "function"
    ) {
        throw new TypeError(
            `Notification worker export is invalid: ${functionName}.`
        );
    }
});

const sampleTemplate =
    templateService
        .buildMaintenanceNotificationTemplate({
            event: {
                public_id:
                    "maintenance_event_batch_e_check",
                event_type:
                    "maintenance_status_changed",
                idempotency_key:
                    "batch-e-import-check",
                payload: {
                    new_status: "in_progress"
                }
            },
            request: {
                public_id:
                    "maintenance_batch_e_check",
                request_number:
                    "MNT-2026-CHECK001",
                title:
                    "Batch E import check",
                priority: "medium",
                status: "in_progress",
                is_preventive_plan: false
            }
        });

if (
    sampleTemplate.category !== "maintenance" ||
    sampleTemplate.priority !== "normal" ||
    sampleTemplate.source_event_type !==
        "maintenance_status_changed"
) {
    throw new TypeError(
        "Maintenance notification template output is invalid."
    );
}

console.log(
    "Notification Batch E import and worker check passed."
);

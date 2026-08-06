const supportedMaintenanceEventTypes = [
    "maintenance_reported",
    "maintenance_assigned",
    "maintenance_visit_scheduled",
    "maintenance_visit_rescheduled",
    "maintenance_status_changed",
    "maintenance_cost_submitted",
    "maintenance_cost_approved",
    "maintenance_resolved",
    "maintenance_resolution_disputed",
    "maintenance_closed",
    "maintenance_overdue",
    "maintenance_emergency_escalated",
    "preventive_maintenance_due",
    "preventive_request_created"
];

const financialMaintenanceEventTypes = new Set([
    "maintenance_cost_submitted",
    "maintenance_cost_approved"
]);

const tenantVisibleMaintenanceEventTypes = new Set([
    "maintenance_reported",
    "maintenance_assigned",
    "maintenance_visit_scheduled",
    "maintenance_visit_rescheduled",
    "maintenance_status_changed",
    "maintenance_resolved",
    "maintenance_resolution_disputed",
    "maintenance_closed",
    "maintenance_overdue",
    "maintenance_emergency_escalated",
    "preventive_request_created"
]);

const technicianVisibleMaintenanceEventTypes = new Set([
    "maintenance_assigned",
    "maintenance_visit_scheduled",
    "maintenance_visit_rescheduled",
    "maintenance_status_changed",
    "maintenance_cost_approved",
    "maintenance_resolved",
    "maintenance_resolution_disputed",
    "maintenance_closed",
    "maintenance_overdue",
    "maintenance_emergency_escalated",
    "preventive_request_created"
]);

const priorityMap = {
    low: "low",
    medium: "normal",
    normal: "normal",
    high: "high",
    urgent: "urgent",
    emergency: "urgent"
};

const humanizeStatus = value => {
    if (!value || typeof value !== "string") {
        return "updated";
    }

    return value
        .replace(/_/g, " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );
};

const requestReference = request =>
    request.request_number ||
    request.public_id ||
    "maintenance request";

const buildMaintenanceNotificationTemplate = ({
    event,
    request
}) => {
    if (
        !event ||
        !supportedMaintenanceEventTypes.includes(
            event.event_type
        )
    ) {
        throw new Error(
            "Unsupported maintenance notification event type."
        );
    }

    if (!request || !request.public_id) {
        throw new Error(
            "Maintenance notification event requires a maintenance request or preventive plan context."
        );
    }

    if (
        event.event_type ===
            "preventive_maintenance_due" &&
        request.is_preventive_plan !== true
    ) {
        throw new Error(
            "Preventive-maintenance-due event requires preventive plan context."
        );
    }

    const payload = event.payload || {};
    const reference = requestReference(request);
    const requestTitle = request.title ||
        "Maintenance request";

    const common = {
        notification_type: event.event_type,
        category:
            event.event_type.startsWith(
                "preventive_"
            )
                ? "preventive_maintenance"
                : "maintenance",
        priority:
            priorityMap[request.priority] ||
            "normal",
        action_path:
            request.is_preventive_plan === true
                ? `/maintenance/preventive-plans/${request.public_id}`
                : `/maintenance/requests/${request.public_id}`,
        source_module:
            event.event_type.startsWith(
                "preventive_"
            )
                ? "preventive_maintenance"
                : "maintenance",
        source_entity_type:
            request.is_preventive_plan === true
                ? "preventive_maintenance_plan"
                : "maintenance_request",
        source_entity_public_id:
            request.public_id,
        source_event_public_id:
            event.public_id,
        source_event_type:
            event.event_type,
        source_event_idempotency_key:
            event.idempotency_key,
        payload: {
            maintenance_request_public_id:
                request.is_preventive_plan === true
                    ? null
                    : request.public_id,
            preventive_plan_public_id:
                request.is_preventive_plan === true
                    ? request.public_id
                    : null,
            request_number:
                request.request_number,
            request_title: request.title,
            request_status: request.status,
            request_priority: request.priority,
            event: payload
        }
    };

    const templates = {
        maintenance_reported: {
            title:
                `Maintenance request ${reference} reported`,
            message:
                `${requestTitle} has been reported and is awaiting review.`
        },

        maintenance_assigned: {
            title:
                `Maintenance work assigned for ${reference}`,
            message:
                `${requestTitle} has been assigned for action.`
        },

        maintenance_visit_scheduled: {
            title:
                `Maintenance visit scheduled for ${reference}`,
            message:
                `${requestTitle} now has a scheduled maintenance visit.`
        },

        maintenance_visit_rescheduled: {
            title:
                `Maintenance visit rescheduled for ${reference}`,
            message:
                `${requestTitle} has a revised maintenance visit schedule.`
        },

        maintenance_status_changed: {
            title:
                `Maintenance status updated for ${reference}`,
            message:
                `${requestTitle} is now ${humanizeStatus(
                    payload.new_status
                )}.`
        },

        maintenance_cost_submitted: {
            title:
                `Maintenance cost submitted for ${reference}`,
            message:
                `A maintenance cost has been submitted for ${requestTitle}.`
        },

        maintenance_cost_approved: {
            title:
                `Maintenance cost approved for ${reference}`,
            message:
                `A maintenance cost has been approved for ${requestTitle}.`
        },

        maintenance_resolved: {
            title:
                `Maintenance request ${reference} resolved`,
            message:
                `${requestTitle} has been marked as resolved.`
        },

        maintenance_resolution_disputed: {
            title:
                `Maintenance resolution disputed for ${reference}`,
            message:
                `The resolution of ${requestTitle} has been disputed and requires review.`
        },

        maintenance_closed: {
            title:
                `Maintenance request ${reference} closed`,
            message:
                `${requestTitle} has been closed.`
        },

        maintenance_overdue: {
            title:
                `Maintenance request ${reference} is overdue`,
            message:
                `${requestTitle} has exceeded one or more service targets.`
        },

        maintenance_emergency_escalated: {
            title:
                `Emergency maintenance escalated: ${reference}`,
            message:
                `${requestTitle} requires urgent attention because an emergency service target was exceeded.`
        },

        preventive_maintenance_due: {
            title:
                `Preventive maintenance is due`,
            message:
                `Preventive maintenance linked to ${requestTitle} is due for action.`
        },

        preventive_request_created: {
            title:
                `Preventive maintenance request created`,
            message:
                `${requestTitle} was created from a preventive maintenance schedule.`
        }
    };

    return {
        ...common,
        ...templates[event.event_type]
    };
};

module.exports = {
    supportedMaintenanceEventTypes,
    financialMaintenanceEventTypes,
    tenantVisibleMaintenanceEventTypes,
    technicianVisibleMaintenanceEventTypes,
    buildMaintenanceNotificationTemplate
};

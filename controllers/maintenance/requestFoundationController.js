const asyncHandler = require(
    "../../utils/asyncHandler"
);

const AppError = require(
    "../../utils/AppError"
);

const {
    updateMaintenanceRequestDetails,
    getMaintenanceStatusHistory,
    getMaintenanceActivityHistory,
    updateMaintenanceSlaTargets,
    escalateMaintenanceRequest,
    getOverdueMaintenanceRequests,
    applyMaintenanceUnitStatusLock,
    releaseMaintenanceUnitStatusLock
} = require(
    "../../services/maintenance/requestFoundationService"
);

/*
 * Translate PostgreSQL errors shared by Batch A lifecycle
 * writes into the maintenance API contract.
 */
const handleMaintenanceWriteError = ({
    error,
    next,
    operationMessage
}) => {
    console.error("MAINTENANCE WRITE DATABASE ERROR:", {
    message: error.message,
    code: error.code,
    constraint: error.constraint,
    detail: error.detail,
    table: error.table,
    schema: error.schema,
    where: error.where
});
    if (error.code === "P0001") {
        return next(
            new AppError(
                error.message ||
                    `${operationMessage} violates a maintenance business rule.`,
                409
            )
        );
    }

    if (error.code === "23514") {
        return next(
            new AppError(
                `${operationMessage} violates a validation rule.`,
                422
            )
        );
    }

    if (error.code === "23503") {
        return next(
            new AppError(
                "A related maintenance record is no longer available.",
                409
            )
        );
    }

    if (error.code === "23505") {
        return next(
            new AppError(
                `${operationMessage} conflicts with an existing maintenance record.`,
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
                `${operationMessage} conflicted with another operation. Refresh the request and try again.`,
                409
            )
        );
    }

    return next(error);
};

/*
 * Translate transaction conflicts shared by Batch A reads.
 */
const handleMaintenanceReadError = ({
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

    if (error.code === "P0001") {
        return next(
            new AppError(
                error.message ||
                    `${operationMessage} violates a maintenance business rule.`,
                409
            )
        );
    }

    return next(error);
};

const rejectInvalidAccessContext = ({
    result,
    next
}) => {
    if (!result.invalidAccessContext) {
        return false;
    }

    next(
        new AppError(
            "Invalid maintenance access context.",
            422
        )
    );

    return true;
};

const rejectMissingRequest = ({
    result,
    next
}) => {
    if (!result.requestNotFound) {
        return false;
    }

    next(
        new AppError(
            "Maintenance request not found.",
            404
        )
    );

    return true;
};

/*
 * PATCH /api/maintenance/requests/
 * :maintenance_request_public_id
 */
const updateMaintenanceRequestDetailsController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await updateMaintenanceRequestDetails({
                        maintenanceRequestPublicId:
                            req.params
                                .maintenance_request_public_id,
                        updateData: req.body,
                        accessContext:
                            req.query.access_context,
                        authenticatedUser:
                            req.user
                    });

                if (
                    rejectInvalidAccessContext({
                        result,
                        next
                    }) ||
                    rejectMissingRequest({
                        result,
                        next
                    })
                ) {
                    return;
                }

                if (result.lifecycleConflict) {
                    return next(
                        new AppError(
                            "Terminal maintenance requests cannot have their request details updated.",
                            409
                        )
                    );
                }

                if (result.staleRequest) {
                    return res
                        .status(409)
                        .json({
                            success: false,
                            message:
                                "Maintenance request details changed after they were last read. Refresh the request and try again.",
                            data: {
                                expected_updated_at:
                                    req.body
                                        .expected_updated_at,
                                current_updated_at:
                                    result
                                        .current_updated_at
                            }
                        });
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message: result.noChanges
                            ? "No maintenance request details required updating."
                            : "Maintenance request details updated successfully.",
                        data: {
                            changed_fields:
                                result.changed_fields || [],
                            maintenance_request:
                                result
                                    .maintenance_request
                        }
                    });
            } catch (error) {
                return handleMaintenanceWriteError({
                    error,
                    next,
                    operationMessage:
                        "The maintenance request update"
                });
            }
        }
    );

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/status-history
 */
const getMaintenanceStatusHistoryController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await getMaintenanceStatusHistory({
                        maintenanceRequestPublicId:
                            req.params
                                .maintenance_request_public_id,
                        filters: req.query,
                        authenticatedUser:
                            req.user
                    });

                if (
                    rejectInvalidAccessContext({
                        result,
                        next
                    }) ||
                    rejectMissingRequest({
                        result,
                        next
                    })
                ) {
                    return;
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Maintenance status history retrieved successfully.",
                        count:
                            result.status_history.length,
                        pagination:
                            result.pagination,
                        data: {
                            maintenance_request:
                                result
                                    .maintenance_request,
                            access_context:
                                result.access_context,
                            status_history:
                                result.status_history
                        }
                    });
            } catch (error) {
                return handleMaintenanceReadError({
                    error,
                    next,
                    operationMessage:
                        "Maintenance status-history retrieval"
                });
            }
        }
    );

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/activity-history
 */
const getMaintenanceActivityHistoryController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await getMaintenanceActivityHistory({
                        maintenanceRequestPublicId:
                            req.params
                                .maintenance_request_public_id,
                        filters: req.query,
                        authenticatedUser:
                            req.user
                    });

                if (
                    rejectInvalidAccessContext({
                        result,
                        next
                    }) ||
                    rejectMissingRequest({
                        result,
                        next
                    })
                ) {
                    return;
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Maintenance activity history retrieved successfully.",
                        count:
                            result.activity_history.length,
                        pagination:
                            result.pagination,
                        data: {
                            maintenance_request:
                                result
                                    .maintenance_request,
                            access_context:
                                result.access_context,
                            activity_history:
                                result.activity_history
                        }
                    });
            } catch (error) {
                return handleMaintenanceReadError({
                    error,
                    next,
                    operationMessage:
                        "Maintenance activity-history retrieval"
                });
            }
        }
    );

/*
 * PATCH /api/maintenance/requests/
 * :maintenance_request_public_id/sla-targets
 */
const updateMaintenanceSlaTargetsController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await updateMaintenanceSlaTargets({
                        maintenanceRequestPublicId:
                            req.params
                                .maintenance_request_public_id,
                        updateData: req.body,
                        accessContext:
                            req.query.access_context,
                        authenticatedUser:
                            req.user
                    });

                if (
                    rejectInvalidAccessContext({
                        result,
                        next
                    }) ||
                    rejectMissingRequest({
                        result,
                        next
                    })
                ) {
                    return;
                }

                if (result.lifecycleConflict) {
                    return next(
                        new AppError(
                            "SLA targets cannot be changed for a terminal maintenance request.",
                            409
                        )
                    );
                }

                if (result.staleRequest) {
                    return res
                        .status(409)
                        .json({
                            success: false,
                            message:
                                "Maintenance request SLA data changed after it was last read. Refresh the request and try again.",
                            data: {
                                expected_updated_at:
                                    req.body
                                        .expected_updated_at,
                                current_updated_at:
                                    result
                                        .current_updated_at
                            }
                        });
                }

                if (result.invalidSlaTargets) {
                    return next(
                        new AppError(
                            "Maintenance SLA targets must follow review, work-start and resolution order.",
                            422
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message: result.noChanges
                            ? "No maintenance SLA targets required updating."
                            : "Maintenance SLA targets updated successfully.",
                        data: {
                            changed_fields:
                                result.changed_fields || [],
                            maintenance_request:
                                result
                                    .maintenance_request
                        }
                    });
            } catch (error) {
                return handleMaintenanceWriteError({
                    error,
                    next,
                    operationMessage:
                        "The maintenance SLA-target update"
                });
            }
        }
    );

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/escalate
 */
const escalateMaintenanceRequestController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await escalateMaintenanceRequest({
                        maintenanceRequestPublicId:
                            req.params
                                .maintenance_request_public_id,
                        expectedPriority:
                            req.body.expected_priority,
                        reason: req.body.reason,
                        accessContext:
                            req.query.access_context,
                        authenticatedUser:
                            req.user
                    });

                if (
                    rejectInvalidAccessContext({
                        result,
                        next
                    }) ||
                    rejectMissingRequest({
                        result,
                        next
                    })
                ) {
                    return;
                }

                if (result.lifecycleConflict) {
                    return next(
                        new AppError(
                            "A terminal maintenance request cannot be escalated.",
                            409
                        )
                    );
                }

                if (result.alreadyEmergency) {
                    return next(
                        new AppError(
                            "Maintenance request priority is already emergency.",
                            409
                        )
                    );
                }

                if (result.priorityConflict) {
                    return res
                        .status(409)
                        .json({
                            success: false,
                            message:
                                "Maintenance request priority has changed. Refresh the request and try again.",
                            data: {
                                expected_priority:
                                    req.body
                                        .expected_priority,
                                current_priority:
                                    result
                                        .current_priority
                            }
                        });
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Maintenance request escalated to emergency successfully.",
                        data: {
                            maintenance_request:
                                result
                                    .maintenance_request
                        }
                    });
            } catch (error) {
                return handleMaintenanceWriteError({
                    error,
                    next,
                    operationMessage:
                        "The maintenance escalation"
                });
            }
        }
    );

/*
 * GET /api/maintenance/sla/overdue
 */
const getOverdueMaintenanceRequestsController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await getOverdueMaintenanceRequests({
                        filters: req.query,
                        authenticatedUser:
                            req.user
                    });

                if (
                    rejectInvalidAccessContext({
                        result,
                        next
                    })
                ) {
                    return;
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Overdue maintenance requests retrieved successfully.",
                        count:
                            result
                                .maintenance_requests
                                .length,
                        pagination:
                            result.pagination,
                        summary:
                            result.summary,
                        data: {
                            access_context:
                                result.access_context,
                            maintenance_requests:
                                result
                                    .maintenance_requests
                        }
                    });
            } catch (error) {
                return handleMaintenanceReadError({
                    error,
                    next,
                    operationMessage:
                        "Overdue maintenance retrieval"
                });
            }
        }
    );

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/unit-status-lock
 */
const applyMaintenanceUnitStatusLockController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await applyMaintenanceUnitStatusLock({
                        maintenanceRequestPublicId:
                            req.params
                                .maintenance_request_public_id,
                        reason: req.body.reason,
                        accessContext:
                            req.query.access_context,
                        authenticatedUser:
                            req.user
                    });

                if (
                    rejectInvalidAccessContext({
                        result,
                        next
                    }) ||
                    rejectMissingRequest({
                        result,
                        next
                    })
                ) {
                    return;
                }

                if (result.lifecycleConflict) {
                    return next(
                        new AppError(
                            "A unit-status lock cannot be applied to a terminal maintenance request.",
                            409
                        )
                    );
                }

                if (result.lockNotApplicable) {
                    return next(
                        new AppError(
                            "A maintenance unit-status lock requires an uninhabitable unit-scoped request.",
                            409
                        )
                    );
                }

                if (result.unitStatusAlreadyLocked) {
                    return res
                        .status(409)
                        .json({
                            success: false,
                            message:
                                "This maintenance request already has an active unit-status lock.",
                            data: {
                                unit_status_lock_public_id:
                                    result
                                        .unit_status_lock_public_id
                            }
                        });
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Maintenance unit-status lock applied successfully.",
                        data: {
                            unit_status_lock:
                                result
                                    .unit_status_lock
                        }
                    });
            } catch (error) {
                return handleMaintenanceWriteError({
                    error,
                    next,
                    operationMessage:
                        "The maintenance unit-status lock"
                });
            }
        }
    );

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/unit-status-lock/release
 */
const releaseMaintenanceUnitStatusLockController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await releaseMaintenanceUnitStatusLock({
                        maintenanceRequestPublicId:
                            req.params
                                .maintenance_request_public_id,
                        reason: req.body.reason,
                        accessContext:
                            req.query.access_context,
                        authenticatedUser:
                            req.user
                    });

                if (
                    rejectInvalidAccessContext({
                        result,
                        next
                    }) ||
                    rejectMissingRequest({
                        result,
                        next
                    })
                ) {
                    return;
                }

                if (
                    result
                        .activeUnitStatusLockNotFound
                ) {
                    return next(
                        new AppError(
                            "Maintenance request does not have an active unit-status lock to release.",
                            409
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Maintenance unit-status lock released successfully.",
                        data: {
                            unit_status_lock:
                                result
                                    .unit_status_lock
                        }
                    });
            } catch (error) {
                return handleMaintenanceWriteError({
                    error,
                    next,
                    operationMessage:
                        "The maintenance unit-status lock release"
                });
            }
        }
    );

module.exports = {
    updateMaintenanceRequestDetailsController,
    getMaintenanceStatusHistoryController,
    getMaintenanceActivityHistoryController,
    updateMaintenanceSlaTargetsController,
    escalateMaintenanceRequestController,
    getOverdueMaintenanceRequestsController,
    applyMaintenanceUnitStatusLockController,
    releaseMaintenanceUnitStatusLockController
};

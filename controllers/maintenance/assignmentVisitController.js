const asyncHandler = require(
    "../../utils/asyncHandler"
);

const AppError = require(
    "../../utils/AppError"
);

const {
    createMaintenanceAssignment,
    getMaintenanceAssignments,
    getSingleMaintenanceAssignment,
    acceptMaintenanceAssignment,
    declineMaintenanceAssignment,
    activateMaintenanceAssignment,
    completeMaintenanceAssignment,
    revokeMaintenanceAssignment,

    createMaintenanceVisit,
    getMaintenanceVisits,
    getSingleMaintenanceVisit,
    respondToMaintenanceVisit,
    rescheduleMaintenanceVisit,
    startMaintenanceVisit,
    completeMaintenanceVisit,
    markMaintenanceVisitMissed,
    cancelMaintenanceVisit,
    getMaintenanceVisitHistory
} = require(
    "../../services/maintenance/assignmentVisitService"
);

/*
 * Convert controlled service results into the maintenance
 * API status-code contract.
 */
const resultErrors = {
    invalid_access_context: {
        statusCode: 422,
        message: "Invalid maintenance access context."
    },
    request_not_found: {
        statusCode: 404,
        message: "Maintenance request not found."
    },
    assignment_not_found: {
        statusCode: 404,
        message: "Maintenance assignment not found."
    },
    visit_not_found: {
        statusCode: 404,
        message: "Maintenance visit not found."
    },
    assigned_user_not_found: {
        statusCode: 404,
        message: "Assigned technician user not found."
    },
    assignment_actor_forbidden: {
        statusCode: 404,
        message: "Maintenance assignment not found."
    },
    visit_actor_forbidden: {
        statusCode: 404,
        message: "Maintenance visit not found."
    },
    request_status_conflict: {
        statusCode: 409,
        message: "Maintenance request status changed or does not allow this operation."
    },
    request_version_conflict: {
        statusCode: 409,
        message: "Maintenance request changed after it was last read. Refresh it and try again."
    },
    assignment_status_conflict: {
        statusCode: 409,
        message: "Maintenance assignment status changed or does not allow this operation."
    },
    assignment_version_conflict: {
        statusCode: 409,
        message: "Maintenance assignment changed after it was last read. Refresh it and try again."
    },
    visit_status_conflict: {
        statusCode: 409,
        message: "Maintenance visit status changed or does not allow this operation."
    },
    visit_version_conflict: {
        statusCode: 409,
        message: "Maintenance visit changed after it was last read. Refresh it and try again."
    },
    active_assignment_conflict: {
        statusCode: 409,
        message: "Maintenance request already has a current assignment."
    },
    active_visit_dependency_conflict: {
        statusCode: 409,
        message: "The assignment cannot be changed while a linked visit is in progress."
    },
    assignment_dependency_conflict: {
        statusCode: 409,
        message: "The maintenance visit requires an eligible current assignment."
    },
    tenant_confirmation_dependency_conflict: {
        statusCode: 409,
        message: "Tenant confirmation cannot be required because no eligible active lease is available."
    },
    tenant_confirmation_conflict: {
        statusCode: 409,
        message: "The tenant-confirmation state does not allow this operation."
    },
    schedule_conflict: {
        statusCode: 409,
        message: "The maintenance visit schedule conflicts with its lifecycle or time requirements."
    },
    identifier_conflict: {
        statusCode: 409,
        message: "A unique maintenance identifier could not be generated. Please try again."
    }
};

const rejectServiceError = ({ result, next }) => {
    if (!result || !result.error) {
        return false;
    }

    const mappedError = resultErrors[result.error];

    if (mappedError) {
        next(
            new AppError(
                mappedError.message,
                mappedError.statusCode
            )
        );

        return true;
    }

    next(
        new AppError(
            "The maintenance operation could not be completed.",
            409
        )
    );

    return true;
};

/*
 * Map PostgreSQL failures shared by assignment and visit
 * writes into safe API responses.
 */
const handleMaintenanceWriteError = ({
    error,
    next,
    operationMessage
}) => {
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
                `${operationMessage} conflicted with another operation. Refresh the record and try again.`,
                409
            )
        );
    }

    return next(error);
};

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

const requestPublicId = req =>
    req.params.maintenance_request_public_id;

const assignmentPublicId = req =>
    req.params.maintenance_assignment_public_id;

const visitPublicId = req =>
    req.params.maintenance_visit_public_id;

const sendLifecycleSuccess = ({
    res,
    message,
    result,
    resourceKey
}) => res.status(200).json({
    success: true,
    message,
    data: {
        maintenance_request:
            result.maintenance_request || undefined,
        [resourceKey]: result[resourceKey]
    }
});

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/assignments
 */
const createMaintenanceAssignmentController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await createMaintenanceAssignment({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    assignmentData: req.body,
                    accessContext:
                        req.query.access_context,
                    authenticatedUser: req.user
                });

            if (rejectServiceError({ result, next })) {
                return;
            }

            return res.status(201).json({
                success: true,
                message:
                    "Maintenance assignment created successfully.",
                data: {
                    maintenance_request:
                        result.maintenance_request,
                    maintenance_assignment:
                        result.maintenance_assignment
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance assignment creation"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/assignments
 */
const getMaintenanceAssignmentsController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getMaintenanceAssignments({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    filters: req.query,
                    authenticatedUser: req.user
                });

            if (rejectServiceError({ result, next })) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance assignments retrieved successfully.",
                count:
                    result.maintenance_assignments.length,
                pagination: result.pagination,
                data: {
                    maintenance_request:
                        result.maintenance_request,
                    maintenance_assignments:
                        result.maintenance_assignments
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance assignment listing"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/assignments/
 * :maintenance_assignment_public_id
 */
const getSingleMaintenanceAssignmentController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getSingleMaintenanceAssignment({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceAssignmentPublicId:
                        assignmentPublicId(req),
                    accessContext:
                        req.query.access_context,
                    authenticatedUser: req.user
                });

            if (rejectServiceError({ result, next })) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance assignment retrieved successfully.",
                data: {
                    maintenance_assignment:
                        result.maintenance_assignment
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance assignment read"
            });
        }
    });

const runAssignmentLifecycle = async ({
    req,
    res,
    next,
    service,
    serviceInput,
    successMessage,
    operationMessage
}) => {
    try {
        const result = await service({
            maintenanceRequestPublicId:
                requestPublicId(req),
            maintenanceAssignmentPublicId:
                assignmentPublicId(req),
            expectedStatus:
                req.body.expected_status,
            expectedUpdatedAt:
                req.body.expected_updated_at,
            accessContext:
                req.query.access_context,
            authenticatedUser: req.user,
            ...serviceInput
        });

        if (rejectServiceError({ result, next })) {
            return;
        }

        return sendLifecycleSuccess({
            res,
            message: successMessage,
            result,
            resourceKey:
                "maintenance_assignment"
        });
    } catch (error) {
        return handleMaintenanceWriteError({
            error,
            next,
            operationMessage
        });
    }
};

const acceptMaintenanceAssignmentController =
    asyncHandler((req, res, next) =>
        runAssignmentLifecycle({
            req,
            res,
            next,
            service:
                acceptMaintenanceAssignment,
            serviceInput: {
                reason: req.body.reason
            },
            successMessage:
                "Maintenance assignment accepted successfully.",
            operationMessage:
                "The maintenance assignment acceptance"
        })
    );

const declineMaintenanceAssignmentController =
    asyncHandler((req, res, next) =>
        runAssignmentLifecycle({
            req,
            res,
            next,
            service:
                declineMaintenanceAssignment,
            serviceInput: {
                declineReason:
                    req.body.decline_reason
            },
            successMessage:
                "Maintenance assignment declined successfully.",
            operationMessage:
                "The maintenance assignment decline"
        })
    );

const activateMaintenanceAssignmentController =
    asyncHandler((req, res, next) =>
        runAssignmentLifecycle({
            req,
            res,
            next,
            service:
                activateMaintenanceAssignment,
            serviceInput: {
                reason: req.body.reason
            },
            successMessage:
                "Maintenance assignment activated successfully.",
            operationMessage:
                "The maintenance assignment activation"
        })
    );

const completeMaintenanceAssignmentController =
    asyncHandler((req, res, next) =>
        runAssignmentLifecycle({
            req,
            res,
            next,
            service:
                completeMaintenanceAssignment,
            serviceInput: {
                completionNotes:
                    req.body.completion_notes
            },
            successMessage:
                "Maintenance assignment completed successfully.",
            operationMessage:
                "The maintenance assignment completion"
        })
    );

const revokeMaintenanceAssignmentController =
    asyncHandler((req, res, next) =>
        runAssignmentLifecycle({
            req,
            res,
            next,
            service:
                revokeMaintenanceAssignment,
            serviceInput: {
                revocationReason:
                    req.body.revocation_reason
            },
            successMessage:
                "Maintenance assignment revoked successfully.",
            operationMessage:
                "The maintenance assignment revocation"
        })
    );

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/visits
 */
const createMaintenanceVisitController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await createMaintenanceVisit({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    visitData: req.body,
                    accessContext:
                        req.query.access_context,
                    authenticatedUser: req.user
                });

            if (rejectServiceError({ result, next })) {
                return;
            }

            return res.status(201).json({
                success: true,
                message:
                    "Maintenance visit created successfully.",
                data: {
                    maintenance_visit:
                        result.maintenance_visit
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance visit creation"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/visits
 */
const getMaintenanceVisitsController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getMaintenanceVisits({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    filters: req.query,
                    authenticatedUser: req.user
                });

            if (rejectServiceError({ result, next })) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance visits retrieved successfully.",
                count:
                    result.maintenance_visits.length,
                pagination: result.pagination,
                data: {
                    maintenance_request:
                        result.maintenance_request,
                    maintenance_visits:
                        result.maintenance_visits
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance visit listing"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/visits/
 * :maintenance_visit_public_id
 */
const getSingleMaintenanceVisitController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getSingleMaintenanceVisit({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceVisitPublicId:
                        visitPublicId(req),
                    accessContext:
                        req.query.access_context,
                    authenticatedUser: req.user
                });

            if (rejectServiceError({ result, next })) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance visit retrieved successfully.",
                data: {
                    maintenance_visit:
                        result.maintenance_visit
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance visit read"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/visits/
 * :maintenance_visit_public_id/respond
 */
const respondToMaintenanceVisitController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await respondToMaintenanceVisit({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceVisitPublicId:
                        visitPublicId(req),
                    expectedStatus:
                        req.body.expected_status,
                    expectedTenantConfirmationStatus:
                        req.body
                            .expected_tenant_confirmation_status,
                    expectedUpdatedAt:
                        req.body.expected_updated_at,
                    response: req.body.response,
                    note: req.body.note,
                    accessContext:
                        req.query.access_context,
                    authenticatedUser: req.user
                });

            if (rejectServiceError({ result, next })) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    req.body.response === "confirmed"
                        ? "Maintenance visit schedule confirmed successfully."
                        : "Maintenance visit schedule declined successfully.",
                data: {
                    maintenance_visit:
                        result.maintenance_visit
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance visit response"
            });
        }
    });

const runVisitLifecycle = async ({
    req,
    res,
    next,
    service,
    serviceInput,
    successMessage,
    operationMessage
}) => {
    try {
        const result = await service({
            maintenanceRequestPublicId:
                requestPublicId(req),
            maintenanceVisitPublicId:
                visitPublicId(req),
            expectedStatus:
                req.body.expected_status,
            expectedUpdatedAt:
                req.body.expected_updated_at,
            accessContext:
                req.query.access_context,
            authenticatedUser: req.user,
            ...serviceInput
        });

        if (rejectServiceError({ result, next })) {
            return;
        }

        return sendLifecycleSuccess({
            res,
            message: successMessage,
            result,
            resourceKey: "maintenance_visit"
        });
    } catch (error) {
        return handleMaintenanceWriteError({
            error,
            next,
            operationMessage
        });
    }
};

const rescheduleMaintenanceVisitController =
    asyncHandler((req, res, next) =>
        runVisitLifecycle({
            req,
            res,
            next,
            service:
                rescheduleMaintenanceVisit,
            serviceInput: {
                scheduledStartAt:
                    req.body.scheduled_start_at,
                scheduledEndAt:
                    req.body.scheduled_end_at,
                reason: req.body.reason
            },
            successMessage:
                "Maintenance visit rescheduled successfully.",
            operationMessage:
                "The maintenance visit reschedule"
        })
    );

const startMaintenanceVisitController =
    asyncHandler((req, res, next) =>
        runVisitLifecycle({
            req,
            res,
            next,
            service:
                startMaintenanceVisit,
            serviceInput: {
                arrivalAt: req.body.arrival_at,
                reason: req.body.reason
            },
            successMessage:
                "Maintenance visit started successfully.",
            operationMessage:
                "The maintenance visit start"
        })
    );

const completeMaintenanceVisitController =
    asyncHandler((req, res, next) =>
        runVisitLifecycle({
            req,
            res,
            next,
            service:
                completeMaintenanceVisit,
            serviceInput: {
                departureAt:
                    req.body.departure_at,
                completionNotes:
                    req.body.completion_notes
            },
            successMessage:
                "Maintenance visit completed successfully.",
            operationMessage:
                "The maintenance visit completion"
        })
    );

const markMaintenanceVisitMissedController =
    asyncHandler((req, res, next) =>
        runVisitLifecycle({
            req,
            res,
            next,
            service:
                markMaintenanceVisitMissed,
            serviceInput: {
                missedReason:
                    req.body.missed_reason,
                missedNotes:
                    req.body.missed_notes,
                reason: req.body.reason
            },
            successMessage:
                "Maintenance visit marked as missed successfully.",
            operationMessage:
                "The maintenance visit missed update"
        })
    );

const cancelMaintenanceVisitController =
    asyncHandler((req, res, next) =>
        runVisitLifecycle({
            req,
            res,
            next,
            service:
                cancelMaintenanceVisit,
            serviceInput: {
                cancellationReason:
                    req.body.cancellation_reason
            },
            successMessage:
                "Maintenance visit cancelled successfully.",
            operationMessage:
                "The maintenance visit cancellation"
        })
    );

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/visits/
 * :maintenance_visit_public_id/history
 */
const getMaintenanceVisitHistoryController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getMaintenanceVisitHistory({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceVisitPublicId:
                        visitPublicId(req),
                    filters: req.query,
                    authenticatedUser: req.user
                });

            if (rejectServiceError({ result, next })) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance visit history retrieved successfully.",
                count:
                    result
                        .maintenance_visit_history
                        .length,
                pagination: result.pagination,
                data: {
                    maintenance_visit:
                        result.maintenance_visit,
                    maintenance_visit_history:
                        result
                            .maintenance_visit_history
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance visit-history read"
            });
        }
    });

module.exports = {
    createMaintenanceAssignmentController,
    getMaintenanceAssignmentsController,
    getSingleMaintenanceAssignmentController,
    acceptMaintenanceAssignmentController,
    declineMaintenanceAssignmentController,
    activateMaintenanceAssignmentController,
    completeMaintenanceAssignmentController,
    revokeMaintenanceAssignmentController,

    createMaintenanceVisitController,
    getMaintenanceVisitsController,
    getSingleMaintenanceVisitController,
    respondToMaintenanceVisitController,
    rescheduleMaintenanceVisitController,
    startMaintenanceVisitController,
    completeMaintenanceVisitController,
    markMaintenanceVisitMissedController,
    cancelMaintenanceVisitController,
    getMaintenanceVisitHistoryController
};

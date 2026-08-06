const asyncHandler = require(
    "../../utils/asyncHandler"
);

const AppError = require(
    "../../utils/AppError"
);

const {
    createMaintenanceCost,
    getMaintenanceCosts,
    getSingleMaintenanceCost,
    updateMaintenanceCost,
    submitMaintenanceCost,
    approveMaintenanceCost,
    rejectMaintenanceCost,
    cancelMaintenanceCost,
    incurMaintenanceCost,
    getMaintenanceCostApprovalHistory,
    determineMaintenanceResponsibility,
    createMaintenanceResponsibilityAllocation,
    getMaintenanceResponsibilityAllocations,
    revokeMaintenanceResponsibilityAllocation
} = require(
    "../../services/maintenance/costResponsibilityService"
);

/*
 * Translate controlled service outcomes into the maintenance
 * API status-code contract without exposing inaccessible data.
 */
const rejectServiceFailure = ({
    result,
    next
}) => {
    if (!result) {
        next(
            new AppError(
                "The maintenance operation could not be completed.",
                409
            )
        );

        return true;
    }

    if (result.invalidAccessContext) {
        next(
            new AppError(
                "Invalid maintenance access context.",
                422
            )
        );

        return true;
    }

    if (result.requestNotFound) {
        next(
            new AppError(
                "Maintenance request not found.",
                404
            )
        );

        return true;
    }

    if (result.costNotFound) {
        next(
            new AppError(
                "Maintenance cost not found.",
                404
            )
        );

        return true;
    }

    if (result.assignmentNotFound) {
        next(
            new AppError(
                "Maintenance assignment not found.",
                404
            )
        );

        return true;
    }

    if (result.responsibilityNotFound) {
        next(
            new AppError(
                "Maintenance responsibility record not found.",
                404
            )
        );

        return true;
    }

    if (result.allocationNotFound) {
        next(
            new AppError(
                "Maintenance responsibility allocation not found.",
                404
            )
        );

        return true;
    }

    if (result.tenantNotFound) {
        next(
            new AppError(
                "Eligible maintenance tenant not found.",
                404
            )
        );

        return true;
    }

    if (result.concurrencyConflict) {
        next(
            new AppError(
                result.conflict_reason ||
                    "The maintenance record changed after it was last read. Refresh it and try again.",
                409
            )
        );

        return true;
    }

    if (result.currencyConflict) {
        next(
            new AppError(
                result.conflict_reason ||
                    "The maintenance cost currency conflicts with the request currency.",
                409
            )
        );

        return true;
    }

    if (result.lifecycleConflict) {
        next(
            new AppError(
                result.conflict_reason ||
                    "The maintenance lifecycle does not allow this operation.",
                409
            )
        );

        return true;
    }

    if (result.approvalNotFound) {
        next(
            new AppError(
                "Pending maintenance cost approval not found.",
                409
            )
        );

        return true;
    }

    if (result.identifierConflict) {
        next(
            new AppError(
                "A unique maintenance identifier could not be generated. Please try again.",
                409
            )
        );

        return true;
    }

    return false;
};

/*
 * Translate PostgreSQL failures shared by Batch C lifecycle
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

    if (
        error.code === "23514" ||
        error.code === "23502" ||
        error.code === "22003" ||
        error.code === "22P02"
    ) {
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

/*
 * Translate transaction failures shared by Batch C reads.
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

const requestPublicId = req =>
    req.params.maintenance_request_public_id;

const costPublicId = req =>
    req.params.maintenance_cost_public_id;

const allocationPublicId = req =>
    req.params
        .maintenance_responsibility_allocation_public_id;

const accessContext = req =>
    req.query.access_context;

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/costs
 */
const createMaintenanceCostController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await createMaintenanceCost({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    costData: req.body,
                    accessContext:
                        accessContext(req),
                    authenticatedUser: req.user
                });

            if (
                rejectServiceFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res.status(201).json({
                success: true,
                message:
                    "Maintenance cost created successfully.",
                data: {
                    maintenance_cost:
                        result.maintenance_cost
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance cost creation"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/costs
 */
const getMaintenanceCostsController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getMaintenanceCosts({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    filters: req.query,
                    authenticatedUser: req.user
                });

            if (
                rejectServiceFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance costs retrieved successfully.",
                count:
                    result.maintenance_costs.length,
                pagination: result.pagination,
                summary: result.summary,
                data: {
                    maintenance_costs:
                        result.maintenance_costs
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance cost list retrieval"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/costs/
 * :maintenance_cost_public_id
 */
const getSingleMaintenanceCostController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getSingleMaintenanceCost({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceCostPublicId:
                        costPublicId(req),
                    accessContext:
                        accessContext(req),
                    authenticatedUser: req.user
                });

            if (
                rejectServiceFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance cost retrieved successfully.",
                data: {
                    maintenance_cost:
                        result.maintenance_cost
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance cost retrieval"
            });
        }
    });

/*
 * PATCH /api/maintenance/requests/
 * :maintenance_request_public_id/costs/
 * :maintenance_cost_public_id
 */
const updateMaintenanceCostController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await updateMaintenanceCost({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceCostPublicId:
                        costPublicId(req),
                    updateData: req.body,
                    accessContext:
                        accessContext(req),
                    authenticatedUser: req.user
                });

            if (
                rejectServiceFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance cost updated successfully.",
                data: {
                    maintenance_cost:
                        result.maintenance_cost
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance cost update"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/costs/
 * :maintenance_cost_public_id/submit
 */
const submitMaintenanceCostController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await submitMaintenanceCost({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceCostPublicId:
                        costPublicId(req),
                    submissionData: req.body,
                    accessContext:
                        accessContext(req),
                    authenticatedUser: req.user
                });

            if (
                rejectServiceFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance cost submitted for approval successfully.",
                data: {
                    maintenance_cost:
                        result.maintenance_cost,
                    cost_approval:
                        result.cost_approval
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance cost submission"
            });
        }
    });

const runCostDecision = async ({
    req,
    res,
    next,
    service,
    successMessage,
    operationMessage
}) => {
    try {
        const result = await service({
            maintenanceRequestPublicId:
                requestPublicId(req),
            maintenanceCostPublicId:
                costPublicId(req),
            decisionData: req.body,
            accessContext:
                accessContext(req),
            authenticatedUser: req.user
        });

        if (
            rejectServiceFailure({
                result,
                next
            })
        ) {
            return;
        }

        return res.status(200).json({
            success: true,
            message: successMessage,
            data: {
                maintenance_cost:
                    result.maintenance_cost,
                cost_approval:
                    result.cost_approval
            }
        });
    } catch (error) {
        return handleMaintenanceWriteError({
            error,
            next,
            operationMessage
        });
    }
};

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/costs/
 * :maintenance_cost_public_id/approve
 */
const approveMaintenanceCostController =
    asyncHandler((req, res, next) =>
        runCostDecision({
            req,
            res,
            next,
            service: approveMaintenanceCost,
            successMessage:
                "Maintenance cost approved successfully.",
            operationMessage:
                "The maintenance cost approval"
        })
    );

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/costs/
 * :maintenance_cost_public_id/reject
 */
const rejectMaintenanceCostController =
    asyncHandler((req, res, next) =>
        runCostDecision({
            req,
            res,
            next,
            service: rejectMaintenanceCost,
            successMessage:
                "Maintenance cost rejected successfully.",
            operationMessage:
                "The maintenance cost rejection"
        })
    );

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/costs/
 * :maintenance_cost_public_id/cancel
 */
const cancelMaintenanceCostController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await cancelMaintenanceCost({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceCostPublicId:
                        costPublicId(req),
                    cancellationData: req.body,
                    accessContext:
                        accessContext(req),
                    authenticatedUser: req.user
                });

            if (
                rejectServiceFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance cost cancelled successfully.",
                data: {
                    maintenance_cost:
                        result.maintenance_cost,
                    cost_approval:
                        result.cost_approval
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance cost cancellation"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/costs/
 * :maintenance_cost_public_id/incur
 */
const incurMaintenanceCostController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await incurMaintenanceCost({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceCostPublicId:
                        costPublicId(req),
                    incurrenceData: req.body,
                    accessContext:
                        accessContext(req),
                    authenticatedUser: req.user
                });

            if (
                rejectServiceFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance cost marked as incurred successfully.",
                data: {
                    maintenance_cost:
                        result.maintenance_cost
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance cost incurrence"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/costs/
 * :maintenance_cost_public_id/approval-history
 */
const getMaintenanceCostApprovalHistoryController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getMaintenanceCostApprovalHistory({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceCostPublicId:
                        costPublicId(req),
                    filters: req.query,
                    authenticatedUser: req.user
                });

            if (
                rejectServiceFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance cost approval history retrieved successfully.",
                count:
                    result.cost_approvals.length,
                pagination: result.pagination,
                data: {
                    cost_approvals:
                        result.cost_approvals
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance cost approval-history retrieval"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/responsibility/determine
 */
const determineMaintenanceResponsibilityController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await determineMaintenanceResponsibility({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    responsibilityData: req.body,
                    accessContext:
                        accessContext(req),
                    authenticatedUser: req.user
                });

            if (
                rejectServiceFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance responsibility determined successfully.",
                data: {
                    maintenance_responsibility:
                        result
                            .maintenance_responsibility
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance responsibility determination"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/responsibility/
 * allocations
 */
const createMaintenanceResponsibilityAllocationController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await createMaintenanceResponsibilityAllocation({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    allocationData: req.body,
                    accessContext:
                        accessContext(req),
                    authenticatedUser: req.user
                });

            if (
                rejectServiceFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res.status(201).json({
                success: true,
                message:
                    "Maintenance responsibility allocation created successfully.",
                data: {
                    maintenance_responsibility:
                        result
                            .maintenance_responsibility,
                    responsibility_allocation:
                        result
                            .responsibility_allocation
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance responsibility allocation creation"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/responsibility/
 * allocations
 */
const getMaintenanceResponsibilityAllocationsController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getMaintenanceResponsibilityAllocations({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    filters: req.query,
                    authenticatedUser: req.user
                });

            if (
                rejectServiceFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance responsibility allocations retrieved successfully.",
                count:
                    result
                        .responsibility_allocations
                        .length,
                pagination: result.pagination,
                data: {
                    maintenance_responsibility:
                        result
                            .maintenance_responsibility,
                    responsibility_allocations:
                        result
                            .responsibility_allocations
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance responsibility allocation retrieval"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/responsibility/
 * allocations/
 * :maintenance_responsibility_allocation_public_id/revoke
 */
const revokeMaintenanceResponsibilityAllocationController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await revokeMaintenanceResponsibilityAllocation({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceResponsibilityAllocationPublicId:
                        allocationPublicId(req),
                    revocationData: req.body,
                    accessContext:
                        accessContext(req),
                    authenticatedUser: req.user
                });

            if (
                rejectServiceFailure({
                    result,
                    next
                })
            ) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Maintenance responsibility allocation revoked successfully.",
                data: {
                    maintenance_responsibility:
                        result
                            .maintenance_responsibility,
                    responsibility_allocation:
                        result
                            .responsibility_allocation
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance responsibility allocation revocation"
            });
        }
    });

module.exports = {
    createMaintenanceCostController,
    getMaintenanceCostsController,
    getSingleMaintenanceCostController,
    updateMaintenanceCostController,
    submitMaintenanceCostController,
    approveMaintenanceCostController,
    rejectMaintenanceCostController,
    cancelMaintenanceCostController,
    incurMaintenanceCostController,
    getMaintenanceCostApprovalHistoryController,
    determineMaintenanceResponsibilityController,
    createMaintenanceResponsibilityAllocationController,
    getMaintenanceResponsibilityAllocationsController,
    revokeMaintenanceResponsibilityAllocationController
};

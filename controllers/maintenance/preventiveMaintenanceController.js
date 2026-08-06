const asyncHandler = require(
    "../../utils/asyncHandler"
);

const AppError = require(
    "../../utils/AppError"
);

const {
    createPreventiveMaintenancePlan,
    getPreventiveMaintenancePlans,
    getDuePreventiveMaintenancePlans,
    getSinglePreventiveMaintenancePlan,
    updatePreventiveMaintenancePlan,
    pausePreventiveMaintenancePlan,
    resumePreventiveMaintenancePlan,
    completePreventiveMaintenancePlan,
    cancelPreventiveMaintenancePlan,
    createPreventiveMaintenanceOccurrence,
    getPreventiveMaintenanceOccurrences,
    getSinglePreventiveMaintenanceOccurrence,
    generatePreventiveMaintenanceOccurrence,
    skipPreventiveMaintenanceOccurrence,
    failPreventiveMaintenanceOccurrence,
    cancelPreventiveMaintenanceOccurrence,
    processDuePreventiveMaintenancePlans
} = require(
    "../../services/maintenance/preventiveMaintenanceService"
);

/*
 * Public parameter and access-context helpers keep controller
 * calls consistent across every preventive-maintenance route.
 */
const preventivePlanPublicId = req =>
    req.params.preventive_plan_public_id;

const preventiveOccurrencePublicId = req =>
    req.params.preventive_occurrence_public_id;

const requestedAccessContext = req =>
    req.query.access_context;

/*
 * Convert controlled service outcomes into the public API
 * contract without revealing inaccessible records.
 */
const rejectServiceFailure = ({
    result,
    next
}) => {
    if (!result) {
        next(
            new AppError(
                "The preventive maintenance operation could not be completed.",
                409
            )
        );

        return true;
    }

    if (!result.error) {
        return false;
    }

    const failures = {
        invalid_access_context: {
            message:
                "Invalid preventive maintenance access context.",
            statusCode: 422
        },
        forbidden: {
            message:
                "You are not authorized to perform this preventive maintenance operation.",
            statusCode: 403
        },
        owner_not_found: {
            message: "Owner not found.",
            statusCode: 404
        },
        property_not_found: {
            message: "Property not found.",
            statusCode: 404
        },
        unit_not_found: {
            message: "Unit not found.",
            statusCode: 404
        },
        assigned_user_not_found: {
            message:
                "Eligible internal maintenance technician not found.",
            statusCode: 404
        },
        plan_not_found: {
            message:
                "Preventive maintenance plan not found.",
            statusCode: 404
        },
        occurrence_not_found: {
            message:
                "Preventive maintenance occurrence not found.",
            statusCode: 404
        },
        plan_status_conflict: {
            message:
                "The preventive maintenance plan lifecycle does not allow this operation.",
            statusCode: 409
        },
        plan_version_conflict: {
            message:
                "The preventive maintenance plan changed after it was last read. Refresh it and try again.",
            statusCode: 409
        },
        occurrence_status_conflict: {
            message:
                "The preventive maintenance occurrence lifecycle does not allow this operation.",
            statusCode: 409
        },
        occurrence_version_conflict: {
            message:
                "The preventive maintenance occurrence changed after it was last read. Refresh it and try again.",
            statusCode: 409
        },
        occurrence_duplicate: {
            message:
                "A preventive maintenance occurrence already exists for the selected plan and due time.",
            statusCode: 409
        },
        identifier_conflict: {
            message:
                "A unique preventive maintenance identifier could not be generated. Please try again.",
            statusCode: 409
        },
        request_identifier_conflict: {
            message:
                "A unique maintenance request identifier could not be generated. Please try again.",
            statusCode: 409
        }
    };

    const failure = failures[result.error] || {
        message:
            "The preventive maintenance operation conflicts with the current record state.",
        statusCode: 409
    };

    next(
        new AppError(
            result.message || failure.message,
            failure.statusCode
        )
    );

    return true;
};

/*
 * Translate PostgreSQL failures shared by Batch E writes into
 * stable API responses.
 */
const handlePreventiveWriteError = ({
    error,
    next,
    operationMessage
}) => {
    if (error.code === "P0001") {
        return next(
            new AppError(
                error.message ||
                    `${operationMessage} violates a preventive maintenance business rule.`,
                409
            )
        );
    }

    if (
        error.code === "23514" ||
        error.code === "23502" ||
        error.code === "22001" ||
        error.code === "22003" ||
        error.code === "22P02" ||
        error.code === "22007" ||
        error.code === "22008"
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
                "A related preventive maintenance record is no longer available.",
                409
            )
        );
    }

    if (error.code === "23505") {
        return next(
            new AppError(
                `${operationMessage} conflicts with an existing preventive maintenance record.`,
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
 * Translate transaction failures shared by Batch E reads.
 */
const handlePreventiveReadError = ({
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
                    `${operationMessage} violates a preventive maintenance business rule.`,
                409
            )
        );
    }

    return next(error);
};

/*
 * POST /api/maintenance/preventive-plans
 */
const createPreventiveMaintenancePlanController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await createPreventiveMaintenancePlan({
                    planData: req.body,
                    requestedAccessContext:
                        requestedAccessContext(req),
                    authenticatedUser: req.user
                });

            if (rejectServiceFailure({ result, next })) {
                return;
            }

            return res.status(201).json({
                success: true,
                message:
                    "Preventive maintenance plan created successfully.",
                data: {
                    access_context:
                        result.access_context,
                    preventive_plan:
                        result.preventive_plan
                }
            });
        } catch (error) {
            return handlePreventiveWriteError({
                error,
                next,
                operationMessage:
                    "The preventive maintenance plan creation"
            });
        }
    });

/*
 * GET /api/maintenance/preventive-plans
 */
const getPreventiveMaintenancePlansController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getPreventiveMaintenancePlans({
                    filters: req.query,
                    requestedAccessContext:
                        requestedAccessContext(req),
                    authenticatedUser: req.user
                });

            if (rejectServiceFailure({ result, next })) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Preventive maintenance plans retrieved successfully.",
                data: {
                    access_context:
                        result.access_context,
                    preventive_plans:
                        result.preventive_plans,
                    pagination: result.pagination
                }
            });
        } catch (error) {
            return handlePreventiveReadError({
                error,
                next,
                operationMessage:
                    "The preventive maintenance plans query"
            });
        }
    });

/*
 * GET /api/maintenance/preventive-plans/due
 */
const getDuePreventiveMaintenancePlansController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getDuePreventiveMaintenancePlans({
                    filters: req.query,
                    requestedAccessContext:
                        requestedAccessContext(req),
                    authenticatedUser: req.user
                });

            if (rejectServiceFailure({ result, next })) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Due preventive maintenance plans retrieved successfully.",
                data: {
                    access_context:
                        result.access_context,
                    preventive_plans:
                        result.preventive_plans,
                    pagination: result.pagination
                }
            });
        } catch (error) {
            return handlePreventiveReadError({
                error,
                next,
                operationMessage:
                    "The due preventive maintenance plans query"
            });
        }
    });

/*
 * GET /api/maintenance/preventive-plans/
 * :preventive_plan_public_id
 */
const getSinglePreventiveMaintenancePlanController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getSinglePreventiveMaintenancePlan({
                    preventivePlanPublicId:
                        preventivePlanPublicId(req),
                    requestedAccessContext:
                        requestedAccessContext(req),
                    authenticatedUser: req.user
                });

            if (rejectServiceFailure({ result, next })) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Preventive maintenance plan retrieved successfully.",
                data: {
                    access_context:
                        result.access_context,
                    preventive_plan:
                        result.preventive_plan
                }
            });
        } catch (error) {
            return handlePreventiveReadError({
                error,
                next,
                operationMessage:
                    "The preventive maintenance plan query"
            });
        }
    });

/*
 * PATCH /api/maintenance/preventive-plans/
 * :preventive_plan_public_id
 */
const updatePreventiveMaintenancePlanController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await updatePreventiveMaintenancePlan({
                    preventivePlanPublicId:
                        preventivePlanPublicId(req),
                    updateData: req.body,
                    requestedAccessContext:
                        requestedAccessContext(req),
                    authenticatedUser: req.user
                });

            if (rejectServiceFailure({ result, next })) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Preventive maintenance plan updated successfully.",
                data: {
                    access_context:
                        result.access_context,
                    preventive_plan:
                        result.preventive_plan
                }
            });
        } catch (error) {
            return handlePreventiveWriteError({
                error,
                next,
                operationMessage:
                    "The preventive maintenance plan update"
            });
        }
    });

/*
 * Shared plan lifecycle-controller factory.
 */
const planLifecycleController = ({
    service,
    bodyArgument,
    successMessage,
    operationMessage
}) => asyncHandler(async (req, res, next) => {
    try {
        const result = await service({
            preventivePlanPublicId:
                preventivePlanPublicId(req),
            [bodyArgument]: req.body,
            requestedAccessContext:
                requestedAccessContext(req),
            authenticatedUser: req.user
        });

        if (rejectServiceFailure({ result, next })) {
            return;
        }

        return res.status(200).json({
            success: true,
            message: successMessage,
            data: {
                access_context:
                    result.access_context,
                preventive_plan:
                    result.preventive_plan
            }
        });
    } catch (error) {
        return handlePreventiveWriteError({
            error,
            next,
            operationMessage
        });
    }
});

/*
 * POST /api/maintenance/preventive-plans/
 * :preventive_plan_public_id/pause
 */
const pausePreventiveMaintenancePlanController =
    planLifecycleController({
        service: pausePreventiveMaintenancePlan,
        bodyArgument: "pauseData",
        successMessage:
            "Preventive maintenance plan paused successfully.",
        operationMessage:
            "The preventive maintenance plan pause"
    });

/*
 * POST /api/maintenance/preventive-plans/
 * :preventive_plan_public_id/resume
 */
const resumePreventiveMaintenancePlanController =
    planLifecycleController({
        service: resumePreventiveMaintenancePlan,
        bodyArgument: "resumeData",
        successMessage:
            "Preventive maintenance plan resumed successfully.",
        operationMessage:
            "The preventive maintenance plan resume"
    });

/*
 * POST /api/maintenance/preventive-plans/
 * :preventive_plan_public_id/complete
 */
const completePreventiveMaintenancePlanController =
    planLifecycleController({
        service: completePreventiveMaintenancePlan,
        bodyArgument: "completeData",
        successMessage:
            "Preventive maintenance plan completed successfully.",
        operationMessage:
            "The preventive maintenance plan completion"
    });

/*
 * POST /api/maintenance/preventive-plans/
 * :preventive_plan_public_id/cancel
 */
const cancelPreventiveMaintenancePlanController =
    planLifecycleController({
        service: cancelPreventiveMaintenancePlan,
        bodyArgument: "cancelData",
        successMessage:
            "Preventive maintenance plan cancelled successfully.",
        operationMessage:
            "The preventive maintenance plan cancellation"
    });

/*
 * POST /api/maintenance/preventive-plans/
 * :preventive_plan_public_id/occurrences
 */
const createPreventiveMaintenanceOccurrenceController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await createPreventiveMaintenanceOccurrence({
                    preventivePlanPublicId:
                        preventivePlanPublicId(req),
                    occurrenceData: req.body,
                    requestedAccessContext:
                        requestedAccessContext(req),
                    authenticatedUser: req.user
                });

            if (rejectServiceFailure({ result, next })) {
                return;
            }

            return res.status(201).json({
                success: true,
                message:
                    "Preventive maintenance occurrence created successfully.",
                data: {
                    access_context:
                        result.access_context,
                    preventive_occurrence:
                        result.preventive_occurrence
                }
            });
        } catch (error) {
            return handlePreventiveWriteError({
                error,
                next,
                operationMessage:
                    "The preventive maintenance occurrence creation"
            });
        }
    });

/*
 * GET /api/maintenance/preventive-plans/
 * :preventive_plan_public_id/occurrences
 */
const getPreventiveMaintenanceOccurrencesController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getPreventiveMaintenanceOccurrences({
                    preventivePlanPublicId:
                        preventivePlanPublicId(req),
                    filters: req.query,
                    requestedAccessContext:
                        requestedAccessContext(req),
                    authenticatedUser: req.user
                });

            if (rejectServiceFailure({ result, next })) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Preventive maintenance occurrences retrieved successfully.",
                data: {
                    access_context:
                        result.access_context,
                    preventive_occurrences:
                        result.preventive_occurrences,
                    pagination: result.pagination
                }
            });
        } catch (error) {
            return handlePreventiveReadError({
                error,
                next,
                operationMessage:
                    "The preventive maintenance occurrences query"
            });
        }
    });

/*
 * GET /api/maintenance/preventive-plans/
 * :preventive_plan_public_id/occurrences/
 * :preventive_occurrence_public_id
 */
const getSinglePreventiveMaintenanceOccurrenceController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getSinglePreventiveMaintenanceOccurrence({
                    preventivePlanPublicId:
                        preventivePlanPublicId(req),
                    preventiveOccurrencePublicId:
                        preventiveOccurrencePublicId(req),
                    requestedAccessContext:
                        requestedAccessContext(req),
                    authenticatedUser: req.user
                });

            if (rejectServiceFailure({ result, next })) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Preventive maintenance occurrence retrieved successfully.",
                data: {
                    access_context:
                        result.access_context,
                    preventive_occurrence:
                        result.preventive_occurrence
                }
            });
        } catch (error) {
            return handlePreventiveReadError({
                error,
                next,
                operationMessage:
                    "The preventive maintenance occurrence query"
            });
        }
    });

/*
 * POST /api/maintenance/preventive-plans/
 * :preventive_plan_public_id/occurrences/
 * :preventive_occurrence_public_id/generate
 */
const generatePreventiveMaintenanceOccurrenceController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await generatePreventiveMaintenanceOccurrence({
                    preventivePlanPublicId:
                        preventivePlanPublicId(req),
                    preventiveOccurrencePublicId:
                        preventiveOccurrencePublicId(req),
                    generationData: req.body,
                    requestedAccessContext:
                        requestedAccessContext(req),
                    authenticatedUser: req.user
                });

            if (rejectServiceFailure({ result, next })) {
                return;
            }

            return res.status(200).json({
                success: true,
                message: result.idempotent
                    ? "Preventive maintenance request was already generated for this occurrence."
                    : "Preventive maintenance request generated successfully.",
                data: {
                    idempotent:
                        result.idempotent === true,
                    access_context:
                        result.access_context,
                    preventive_occurrence:
                        result.preventive_occurrence
                }
            });
        } catch (error) {
            return handlePreventiveWriteError({
                error,
                next,
                operationMessage:
                    "The preventive maintenance request generation"
            });
        }
    });

/*
 * Shared occurrence lifecycle-controller factory.
 */
const occurrenceLifecycleController = ({
    service,
    bodyArgument,
    successMessage,
    operationMessage
}) => asyncHandler(async (req, res, next) => {
    try {
        const result = await service({
            preventivePlanPublicId:
                preventivePlanPublicId(req),
            preventiveOccurrencePublicId:
                preventiveOccurrencePublicId(req),
            [bodyArgument]: req.body,
            requestedAccessContext:
                requestedAccessContext(req),
            authenticatedUser: req.user
        });

        if (rejectServiceFailure({ result, next })) {
            return;
        }

        return res.status(200).json({
            success: true,
            message: successMessage,
            data: {
                access_context:
                    result.access_context,
                preventive_occurrence:
                    result.preventive_occurrence
            }
        });
    } catch (error) {
        return handlePreventiveWriteError({
            error,
            next,
            operationMessage
        });
    }
});

/*
 * POST /api/maintenance/preventive-plans/
 * :preventive_plan_public_id/occurrences/
 * :preventive_occurrence_public_id/skip
 */
const skipPreventiveMaintenanceOccurrenceController =
    occurrenceLifecycleController({
        service: skipPreventiveMaintenanceOccurrence,
        bodyArgument: "skipData",
        successMessage:
            "Preventive maintenance occurrence skipped successfully.",
        operationMessage:
            "The preventive maintenance occurrence skip"
    });

/*
 * POST /api/maintenance/preventive-plans/
 * :preventive_plan_public_id/occurrences/
 * :preventive_occurrence_public_id/fail
 */
const failPreventiveMaintenanceOccurrenceController =
    occurrenceLifecycleController({
        service: failPreventiveMaintenanceOccurrence,
        bodyArgument: "failData",
        successMessage:
            "Preventive maintenance occurrence marked as failed successfully.",
        operationMessage:
            "The preventive maintenance occurrence failure"
    });

/*
 * POST /api/maintenance/preventive-plans/
 * :preventive_plan_public_id/occurrences/
 * :preventive_occurrence_public_id/cancel
 */
const cancelPreventiveMaintenanceOccurrenceController =
    occurrenceLifecycleController({
        service: cancelPreventiveMaintenanceOccurrence,
        bodyArgument: "cancelData",
        successMessage:
            "Preventive maintenance occurrence cancelled successfully.",
        operationMessage:
            "The preventive maintenance occurrence cancellation"
    });

/*
 * POST /api/maintenance/preventive-plans/process-due
 */
const processDuePreventiveMaintenancePlansController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await processDuePreventiveMaintenancePlans({
                    processData: req.body,
                    authenticatedUser: req.user
                });

            if (rejectServiceFailure({ result, next })) {
                return;
            }

            return res.status(200).json({
                success: true,
                message:
                    "Due preventive maintenance plans processed successfully.",
                data: {
                    due_through: result.due_through,
                    summary: result.summary,
                    results: result.results
                }
            });
        } catch (error) {
            return handlePreventiveWriteError({
                error,
                next,
                operationMessage:
                    "The due preventive maintenance processing"
            });
        }
    });

module.exports = {
    createPreventiveMaintenancePlanController,
    getPreventiveMaintenancePlansController,
    getDuePreventiveMaintenancePlansController,
    getSinglePreventiveMaintenancePlanController,
    updatePreventiveMaintenancePlanController,
    pausePreventiveMaintenancePlanController,
    resumePreventiveMaintenancePlanController,
    completePreventiveMaintenancePlanController,
    cancelPreventiveMaintenancePlanController,
    createPreventiveMaintenanceOccurrenceController,
    getPreventiveMaintenanceOccurrencesController,
    getSinglePreventiveMaintenanceOccurrenceController,
    generatePreventiveMaintenanceOccurrenceController,
    skipPreventiveMaintenanceOccurrenceController,
    failPreventiveMaintenanceOccurrenceController,
    cancelPreventiveMaintenanceOccurrenceController,
    processDuePreventiveMaintenancePlansController
};

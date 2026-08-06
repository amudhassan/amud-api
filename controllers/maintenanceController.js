const asyncHandler = require(
    "../utils/asyncHandler"
);

const AppError = require(
    "../utils/AppError"
);

const {
    createMaintenanceRequest,
    getMaintenanceRequests,
    getSingleMaintenanceRequest,
    changeMaintenanceRequestStatus
} = require(
    "../services/maintenanceService"
);

/*
 * POST /api/maintenance/requests
 */
const createMaintenanceRequestController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await createMaintenanceRequest({
                        requestData:
                            req.body,

                        authenticatedUser:
                            req.user
                    });

                /*
                 * Defense-in-depth. The validator normally
                 * prevents unsupported submission contexts.
                 */
                if (
                    result.invalidSubmissionContext
                ) {
                    return next(
                        new AppError(
                            "Invalid maintenance submission context.",
                            422
                        )
                    );
                }

                /*
                 * Missing and inaccessible owners use the
                 * same response to prevent access disclosure.
                 */
                if (result.ownerNotFound) {
                    return next(
                        new AppError(
                            "Owner not found.",
                            404
                        )
                    );
                }

                /*
                 * Property must be current and owned by the
                 * selected owner.
                 */
                if (result.propertyNotFound) {
                    return next(
                        new AppError(
                            "Property not found.",
                            404
                        )
                    );
                }

                /*
                 * Unit must be current and belong to the
                 * selected property.
                 */
                if (result.unitNotFound) {
                    return next(
                        new AppError(
                            "Unit not found.",
                            404
                        )
                    );
                }

                /*
                 * This response also covers an inactive,
                 * expired, mismatched or inaccessible lease.
                 */
                if (result.leaseNotFound) {
                    return next(
                        new AppError(
                            "Eligible active lease not found.",
                            404
                        )
                    );
                }

                /*
                 * Public-ID and request-number generation is
                 * retried by the service before this result.
                 */
                if (result.identifierConflict) {
                    return next(
                        new AppError(
                            "A unique maintenance request identifier could not be generated. Please try again.",
                            409
                        )
                    );
                }

                return res
                    .status(201)
                    .json({
                        success: true,
                        message:
                            "Maintenance request created successfully.",
                        data: {
                            maintenance_request:
                                result
                                    .maintenance_request
                        }
                    });
            } catch (error) {
                /*
                 * Public-ID or request-number uniqueness
                 * conflict not absorbed by service retry.
                 */
                if (error.code === "23505") {
                    return next(
                        new AppError(
                            "The generated maintenance request identifier conflicts with an existing request. Please try again.",
                            409
                        )
                    );
                }

                /*
                 * Database CHECK constraint violation.
                 */
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The supplied maintenance request violates a business rule.",
                            422
                        )
                    );
                }

                /*
                 * Foreign-key integrity conflict caused by a
                 * related record changing concurrently.
                 */
                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The maintenance request references a related record that is no longer available.",
                            409
                        )
                    );
                }

                /*
                 * Controlled database-integrity trigger
                 * exception from migration 027.
                 */
                if (error.code === "P0001") {
                    return next(
                        new AppError(
                            error.message ||
                                "The maintenance request violates a business integrity rule.",
                            422
                        )
                    );
                }

                /*
                 * Serialization failure or deadlock. The
                 * client may safely submit the request again.
                 */
                if (
                    error.code === "40001" ||
                    error.code === "40P01"
                ) {
                    return next(
                        new AppError(
                            "The maintenance request conflicted with another operation. Please try again.",
                            409
                        )
                    );
                }

                return next(error);
            }
        }
    );


/*
 * GET /api/maintenance/requests
 */
const getMaintenanceRequestsController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await getMaintenanceRequests({
                        filters:
                            req.query,

                        authenticatedUser:
                            req.user
                    });

                /*
                 * Defense-in-depth. The validator normally
                 * requires an owner or tenant context for
                 * regular users.
                 */
                if (
                    result.invalidAccessContext
                ) {
                    return next(
                        new AppError(
                            "Invalid maintenance access context.",
                            422
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Maintenance requests retrieved successfully.",
                        count:
                            result
                                .maintenance_requests
                                .length,
                        pagination:
                            result.pagination,
                        summary:
                            result.summary,
                        data: {
                            maintenance_requests:
                                result
                                    .maintenance_requests
                        }
                    });
            } catch (error) {
                /*
                 * A repeatable-read transaction may need to
                 * be retried after concurrent database work.
                 */
                if (
                    error.code === "40001" ||
                    error.code === "40P01"
                ) {
                    return next(
                        new AppError(
                            "Maintenance requests could not be retrieved because of a concurrent operation. Please try again.",
                            409
                        )
                    );
                }

                return next(error);
            }
        }
    );


/*
 * GET /api/maintenance/requests/:maintenance_request_public_id
 */
const getSingleMaintenanceRequestController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await getSingleMaintenanceRequest({
                        maintenanceRequestPublicId:
                            req.params
                                .maintenance_request_public_id,

                        filters:
                            req.query,

                        authenticatedUser:
                            req.user
                    });

                /*
                 * Defense-in-depth. The validator normally
                 * requires an owner or tenant context for
                 * regular users.
                 */
                if (
                    result.invalidAccessContext
                ) {
                    return next(
                        new AppError(
                            "Invalid maintenance access context.",
                            422
                        )
                    );
                }

                /*
                 * A missing request and an inaccessible
                 * request intentionally share the same
                 * response to prevent identifier disclosure.
                 */
                if (result.requestNotFound) {
                    return next(
                        new AppError(
                            "Maintenance request not found.",
                            404
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Maintenance request retrieved successfully.",
                        data: {
                            maintenance_request:
                                result
                                    .maintenance_request
                        }
                    });
            } catch (error) {
                /*
                 * A repeatable-read transaction may need to
                 * be retried after concurrent database work.
                 */
                if (
                    error.code === "40001" ||
                    error.code === "40P01"
                ) {
                    return next(
                        new AppError(
                            "The maintenance request could not be retrieved because of a concurrent operation. Please try again.",
                            409
                        )
                    );
                }

                return next(error);
            }
        }
    );


/*
 * PATCH
 * /api/maintenance/requests/:maintenance_request_public_id/status
 */
const changeMaintenanceRequestStatusController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await changeMaintenanceRequestStatus({
                        maintenanceRequestPublicId:
                            req.params
                                .maintenance_request_public_id,

                        expectedStatus:
                            req.body.expected_status,

                        newStatus:
                            req.body.status,

                        reason:
                            req.body.reason,

                        accessContext:
                            req.query.access_context,

                        authenticatedUser:
                            req.user
                    });

                /*
                 * Defense-in-depth. Validator rules normally
                 * restrict a regular user to owner context.
                 */
                if (
                    result.invalidAccessContext
                ) {
                    return next(
                        new AppError(
                            "Invalid maintenance access context.",
                            422
                        )
                    );
                }

                /*
                 * Missing and inaccessible requests share the
                 * same response to prevent identifier
                 * disclosure.
                 */
                if (result.requestNotFound) {
                    return next(
                        new AppError(
                            "Maintenance request not found.",
                            404
                        )
                    );
                }

                /*
                 * The request changed after the caller last
                 * read it. Return both statuses so the caller
                 * can refresh safely.
                 */
                if (result.statusConflict) {
                    return res
                        .status(409)
                        .json({
                            success: false,
                            message:
                                "Maintenance request status has changed. Refresh the request and try again.",
                            data: {
                                expected_status:
                                    result
                                        .expected_status,
                                current_status:
                                    result
                                        .current_status
                            }
                        });
                }

                /*
                 * Dedicated lifecycle operations and invalid
                 * direct transitions are rejected here even
                 * when validator protection is bypassed.
                 */
                if (result.invalidTransition) {
                    return res
                        .status(409)
                        .json({
                            success: false,
                            message:
                                `Invalid maintenance request transition from ${result.current_status} to ${result.requested_status}.`,
                            data: {
                                current_status:
                                    result
                                        .current_status,
                                requested_status:
                                    result
                                        .requested_status
                            }
                        });
                }

                /*
                 * Active work must be closed through its own
                 * API before the request can be cancelled.
                 */
                if (
                    result.dependencyConflict
                ) {
                    return res
                        .status(409)
                        .json({
                            success: false,
                            message:
                                "Maintenance request cannot be cancelled while active dependencies remain.",
                            data: {
                                dependencies:
                                    result
                                        .dependencies
                            }
                        });
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Maintenance request status updated successfully.",
                        data: {
                            maintenance_request:
                                result
                                    .maintenance_request
                        }
                    });
            } catch (error) {
                /*
                 * Controlled maintenance-integrity exception,
                 * including lifecycle and state-dependent
                 * trigger protection.
                 */
                if (error.code === "P0001") {
                    return next(
                        new AppError(
                            error.message ||
                                "The maintenance status change violates a business integrity rule.",
                            409
                        )
                    );
                }

                /*
                 * Database CHECK validation.
                 */
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The maintenance status change violates a validation rule.",
                            422
                        )
                    );
                }

                /*
                 * A related request dependency changed during
                 * the operation.
                 */
                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "A related maintenance record is no longer available.",
                            409
                        )
                    );
                }

                /*
                 * Serializable transaction conflict or
                 * deadlock. The caller may retry safely after
                 * refreshing the request.
                 */
                if (
                    error.code === "40001" ||
                    error.code === "40P01"
                ) {
                    return next(
                        new AppError(
                            "The maintenance status change conflicted with another operation. Refresh the request and try again.",
                            409
                        )
                    );
                }

                return next(error);
            }
        }
    );

module.exports = {
    createMaintenanceRequestController,
    getMaintenanceRequestsController,
    getSingleMaintenanceRequestController,
    changeMaintenanceRequestStatusController
};

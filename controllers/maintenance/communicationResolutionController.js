const asyncHandler = require(
    "../../utils/asyncHandler"
);

const AppError = require(
    "../../utils/AppError"
);

const {
    createMaintenanceComment,
    getMaintenanceComments,
    getSingleMaintenanceComment,
    hideMaintenanceComment,
    createMaintenanceAttachment,
    getMaintenanceAttachments,
    getSingleMaintenanceAttachment,
    revokeMaintenanceAttachment,
    resolveMaintenanceRequest,
    getMaintenanceResolutions,
    getSingleMaintenanceResolution,
    confirmMaintenanceResolution,
    disputeMaintenanceResolution,
    markMaintenanceResolutionNoResponse,
    closeMaintenanceRequest,
    createMaintenanceReopenRequest,
    getMaintenanceReopenRequests,
    getSingleMaintenanceReopenRequest,
    approveMaintenanceReopenRequest,
    rejectMaintenanceReopenRequest,
    cancelMaintenanceReopenRequest
} = require(
    "../../services/maintenance/communicationResolutionService"
);

/*
 * Convert controlled service outcomes into the public API
 * status-code contract without revealing inaccessible records.
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

    if (result.commentNotFound) {
        next(
            new AppError(
                "Maintenance comment not found.",
                404
            )
        );

        return true;
    }

    if (result.attachmentNotFound) {
        next(
            new AppError(
                "Maintenance attachment not found.",
                404
            )
        );

        return true;
    }

    if (result.childContextNotFound) {
        next(
            new AppError(
                "The selected maintenance attachment context was not found.",
                404
            )
        );

        return true;
    }

    if (result.resolutionNotFound) {
        next(
            new AppError(
                "Maintenance resolution not found.",
                404
            )
        );

        return true;
    }

    if (result.reopenRequestNotFound) {
        next(
            new AppError(
                "Maintenance reopening request not found.",
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

    if (result.visibilityConflict) {
        next(
            new AppError(
                result.conflict_reason ||
                    "The requested maintenance visibility is not allowed.",
                409
            )
        );

        return true;
    }

    if (result.deadlineConflict) {
        next(
            new AppError(
                result.conflict_reason ||
                    "The maintenance confirmation deadline does not allow this operation.",
                409
            )
        );

        return true;
    }

    if (result.identifierConflict) {
        next(
            new AppError(
                result.conflict_reason ||
                    "A unique maintenance identifier could not be generated. Please try again.",
                409
            )
        );

        return true;
    }

    return false;
};

/*
 * Translate PostgreSQL failures shared by Batch D lifecycle
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
        error.code === "22001" ||
        error.code === "22003" ||
        error.code === "22P02" ||
        error.code === "22007"
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
 * Translate transaction failures shared by Batch D reads.
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

const commentPublicId = req =>
    req.params.maintenance_comment_public_id;

const attachmentPublicId = req =>
    req.params.maintenance_attachment_public_id;

const resolutionPublicId = req =>
    req.params.maintenance_resolution_public_id;

const reopenPublicId = req =>
    req.params.maintenance_reopen_public_id;

const accessContext = req =>
    req.query.access_context;

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/comments
 */
const createMaintenanceCommentController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await createMaintenanceComment({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    commentData: req.body,
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
                    "Maintenance comment created successfully.",
                data: {
                    maintenance_comment:
                        result.maintenance_comment
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance comment creation"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/comments
 */
const getMaintenanceCommentsController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getMaintenanceComments({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    filters: req.query,
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
                    "Maintenance comments retrieved successfully.",
                count:
                    result.maintenance_comments.length,
                pagination: result.pagination,
                data: {
                    maintenance_comments:
                        result.maintenance_comments
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance comment retrieval"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/comments/
 * :maintenance_comment_public_id
 */
const getSingleMaintenanceCommentController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getSingleMaintenanceComment({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceCommentPublicId:
                        commentPublicId(req),
                    filters: req.query,
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
                    "Maintenance comment retrieved successfully.",
                data: {
                    maintenance_comment:
                        result.maintenance_comment
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance comment retrieval"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/comments/
 * :maintenance_comment_public_id/hide
 */
const hideMaintenanceCommentController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await hideMaintenanceComment({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceCommentPublicId:
                        commentPublicId(req),
                    moderationData: req.body,
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
                    "Maintenance comment hidden successfully.",
                data: {
                    maintenance_comment:
                        result.maintenance_comment
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance comment moderation"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/attachments
 */
const createMaintenanceAttachmentController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await createMaintenanceAttachment({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    attachmentData: req.body,
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
                    "Maintenance attachment registered successfully.",
                data: {
                    maintenance_attachment:
                        result.maintenance_attachment
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance attachment registration"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/attachments
 */
const getMaintenanceAttachmentsController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getMaintenanceAttachments({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    filters: req.query,
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
                    "Maintenance attachments retrieved successfully.",
                count:
                    result.maintenance_attachments.length,
                pagination: result.pagination,
                data: {
                    maintenance_attachments:
                        result.maintenance_attachments
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance attachment retrieval"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/attachments/
 * :maintenance_attachment_public_id
 */
const getSingleMaintenanceAttachmentController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getSingleMaintenanceAttachment({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceAttachmentPublicId:
                        attachmentPublicId(req),
                    filters: req.query,
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
                    "Maintenance attachment retrieved successfully.",
                data: {
                    maintenance_attachment:
                        result.maintenance_attachment
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance attachment retrieval"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/attachments/
 * :maintenance_attachment_public_id/revoke
 */
const revokeMaintenanceAttachmentController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await revokeMaintenanceAttachment({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceAttachmentPublicId:
                        attachmentPublicId(req),
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
                    "Maintenance attachment revoked successfully.",
                data: {
                    maintenance_attachment:
                        result.maintenance_attachment
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance attachment revocation"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/resolve
 */
const resolveMaintenanceRequestController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await resolveMaintenanceRequest({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    resolutionData: req.body,
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
                    "Maintenance request resolved successfully.",
                data: {
                    maintenance_request:
                        result.maintenance_request,
                    maintenance_resolution:
                        result.maintenance_resolution
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance request resolution"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/resolutions
 */
const getMaintenanceResolutionsController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getMaintenanceResolutions({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    filters: req.query,
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
                    "Maintenance resolutions retrieved successfully.",
                count:
                    result.maintenance_resolutions.length,
                pagination: result.pagination,
                data: {
                    maintenance_resolutions:
                        result.maintenance_resolutions
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance resolution retrieval"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/resolutions/
 * :maintenance_resolution_public_id
 */
const getSingleMaintenanceResolutionController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getSingleMaintenanceResolution({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceResolutionPublicId:
                        resolutionPublicId(req),
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
                    "Maintenance resolution retrieved successfully.",
                data: {
                    maintenance_resolution:
                        result.maintenance_resolution
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance resolution retrieval"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/resolutions/
 * :maintenance_resolution_public_id/confirm
 */
const confirmMaintenanceResolutionController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await confirmMaintenanceResolution({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceResolutionPublicId:
                        resolutionPublicId(req),
                    confirmationData: req.body,
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
                    "Maintenance resolution confirmed successfully.",
                data: {
                    maintenance_request:
                        result.maintenance_request,
                    maintenance_resolution:
                        result.maintenance_resolution
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance resolution confirmation"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/resolutions/
 * :maintenance_resolution_public_id/dispute
 */
const disputeMaintenanceResolutionController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await disputeMaintenanceResolution({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceResolutionPublicId:
                        resolutionPublicId(req),
                    disputeData: req.body,
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
                    "Maintenance resolution disputed successfully.",
                data: {
                    maintenance_request:
                        result.maintenance_request,
                    maintenance_resolution:
                        result.maintenance_resolution
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance resolution dispute"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/resolutions/
 * :maintenance_resolution_public_id/no-response
 */
const markMaintenanceResolutionNoResponseController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await markMaintenanceResolutionNoResponse({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceResolutionPublicId:
                        resolutionPublicId(req),
                    noResponseData: req.body,
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
                    "Maintenance resolution marked as no response successfully.",
                data: {
                    maintenance_request:
                        result.maintenance_request,
                    maintenance_resolution:
                        result.maintenance_resolution
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance resolution no-response update"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/close
 */
const closeMaintenanceRequestController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await closeMaintenanceRequest({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    closureData: req.body,
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
                    "Maintenance request closed successfully.",
                data: {
                    maintenance_request:
                        result.maintenance_request
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance request closure"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/reopen-requests
 */
const createMaintenanceReopenRequestController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await createMaintenanceReopenRequest({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    reopenData: req.body,
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
                    "Maintenance reopening request created successfully.",
                data: {
                    maintenance_reopen_request:
                        result.maintenance_reopen_request
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance reopening request creation"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/reopen-requests
 */
const getMaintenanceReopenRequestsController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getMaintenanceReopenRequests({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    filters: req.query,
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
                    "Maintenance reopening requests retrieved successfully.",
                count:
                    result.maintenance_reopen_requests.length,
                pagination: result.pagination,
                data: {
                    maintenance_reopen_requests:
                        result.maintenance_reopen_requests
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance reopening request retrieval"
            });
        }
    });

/*
 * GET /api/maintenance/requests/
 * :maintenance_request_public_id/reopen-requests/
 * :maintenance_reopen_public_id
 */
const getSingleMaintenanceReopenRequestController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await getSingleMaintenanceReopenRequest({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceReopenPublicId:
                        reopenPublicId(req),
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
                    "Maintenance reopening request retrieved successfully.",
                data: {
                    maintenance_reopen_request:
                        result.maintenance_reopen_request
                }
            });
        } catch (error) {
            return handleMaintenanceReadError({
                error,
                next,
                operationMessage:
                    "The maintenance reopening request retrieval"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/reopen-requests/
 * :maintenance_reopen_public_id/approve
 */
const approveMaintenanceReopenRequestController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await approveMaintenanceReopenRequest({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceReopenPublicId:
                        reopenPublicId(req),
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
                message:
                    "Maintenance reopening request approved successfully.",
                data: {
                    maintenance_request:
                        result.maintenance_request,
                    maintenance_reopen_request:
                        result.maintenance_reopen_request
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance reopening request approval"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/reopen-requests/
 * :maintenance_reopen_public_id/reject
 */
const rejectMaintenanceReopenRequestController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await rejectMaintenanceReopenRequest({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceReopenPublicId:
                        reopenPublicId(req),
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
                message:
                    "Maintenance reopening request rejected successfully.",
                data: {
                    maintenance_reopen_request:
                        result.maintenance_reopen_request
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance reopening request rejection"
            });
        }
    });

/*
 * POST /api/maintenance/requests/
 * :maintenance_request_public_id/reopen-requests/
 * :maintenance_reopen_public_id/cancel
 */
const cancelMaintenanceReopenRequestController =
    asyncHandler(async (req, res, next) => {
        try {
            const result =
                await cancelMaintenanceReopenRequest({
                    maintenanceRequestPublicId:
                        requestPublicId(req),
                    maintenanceReopenPublicId:
                        reopenPublicId(req),
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
                message:
                    "Maintenance reopening request cancelled successfully.",
                data: {
                    maintenance_reopen_request:
                        result.maintenance_reopen_request
                }
            });
        } catch (error) {
            return handleMaintenanceWriteError({
                error,
                next,
                operationMessage:
                    "The maintenance reopening request cancellation"
            });
        }
    });

module.exports = {
    createMaintenanceCommentController,
    getMaintenanceCommentsController,
    getSingleMaintenanceCommentController,
    hideMaintenanceCommentController,
    createMaintenanceAttachmentController,
    getMaintenanceAttachmentsController,
    getSingleMaintenanceAttachmentController,
    revokeMaintenanceAttachmentController,
    resolveMaintenanceRequestController,
    getMaintenanceResolutionsController,
    getSingleMaintenanceResolutionController,
    confirmMaintenanceResolutionController,
    disputeMaintenanceResolutionController,
    markMaintenanceResolutionNoResponseController,
    closeMaintenanceRequestController,
    createMaintenanceReopenRequestController,
    getMaintenanceReopenRequestsController,
    getSingleMaintenanceReopenRequestController,
    approveMaintenanceReopenRequestController,
    rejectMaintenanceReopenRequestController,
    cancelMaintenanceReopenRequestController
};

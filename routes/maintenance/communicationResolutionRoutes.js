const express = require("express");

const router = express.Router();

const {
    authMiddleware
} = require(
    "../../middleware/authMiddleware"
);

const validateRequest = require(
    "../../middleware/validateRequest"
);

const {
    createMaintenanceCommentValidator,
    getMaintenanceCommentsValidator,
    getSingleMaintenanceCommentValidator,
    hideMaintenanceCommentValidator,
    createMaintenanceAttachmentValidator,
    getMaintenanceAttachmentsValidator,
    getSingleMaintenanceAttachmentValidator,
    revokeMaintenanceAttachmentValidator,
    resolveMaintenanceRequestValidator,
    getMaintenanceResolutionsValidator,
    getSingleMaintenanceResolutionValidator,
    confirmMaintenanceResolutionValidator,
    disputeMaintenanceResolutionValidator,
    markMaintenanceResolutionNoResponseValidator,
    closeMaintenanceRequestValidator,
    createMaintenanceReopenRequestValidator,
    getMaintenanceReopenRequestsValidator,
    getSingleMaintenanceReopenRequestValidator,
    approveMaintenanceReopenRequestValidator,
    rejectMaintenanceReopenRequestValidator,
    cancelMaintenanceReopenRequestValidator
} = require(
    "../../validators/maintenance/communicationResolutionValidator"
);

const {
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
} = require(
    "../../controllers/maintenance/communicationResolutionController"
);

/*
 * =========================================================
 * MAINTENANCE COMMENTS
 * =========================================================
 */

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/comments
 */
router.post(
    "/requests/:maintenance_request_public_id/comments",
    authMiddleware,
    createMaintenanceCommentValidator,
    validateRequest,
    createMaintenanceCommentController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/comments
 */
router.get(
    "/requests/:maintenance_request_public_id/comments",
    authMiddleware,
    getMaintenanceCommentsValidator,
    validateRequest,
    getMaintenanceCommentsController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/comments/:maintenance_comment_public_id
 */
router.get(
    "/requests/:maintenance_request_public_id/comments/:maintenance_comment_public_id",
    authMiddleware,
    getSingleMaintenanceCommentValidator,
    validateRequest,
    getSingleMaintenanceCommentController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/comments/:maintenance_comment_public_id/hide
 */
router.post(
    "/requests/:maintenance_request_public_id/comments/:maintenance_comment_public_id/hide",
    authMiddleware,
    hideMaintenanceCommentValidator,
    validateRequest,
    hideMaintenanceCommentController
);

/*
 * =========================================================
 * MAINTENANCE ATTACHMENTS
 * =========================================================
 */

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/attachments
 */
router.post(
    "/requests/:maintenance_request_public_id/attachments",
    authMiddleware,
    createMaintenanceAttachmentValidator,
    validateRequest,
    createMaintenanceAttachmentController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/attachments
 */
router.get(
    "/requests/:maintenance_request_public_id/attachments",
    authMiddleware,
    getMaintenanceAttachmentsValidator,
    validateRequest,
    getMaintenanceAttachmentsController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/attachments/:maintenance_attachment_public_id
 */
router.get(
    "/requests/:maintenance_request_public_id/attachments/:maintenance_attachment_public_id",
    authMiddleware,
    getSingleMaintenanceAttachmentValidator,
    validateRequest,
    getSingleMaintenanceAttachmentController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/attachments/:maintenance_attachment_public_id/revoke
 */
router.post(
    "/requests/:maintenance_request_public_id/attachments/:maintenance_attachment_public_id/revoke",
    authMiddleware,
    revokeMaintenanceAttachmentValidator,
    validateRequest,
    revokeMaintenanceAttachmentController
);

/*
 * =========================================================
 * MAINTENANCE RESOLUTION AND CLOSURE
 * =========================================================
 */

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/resolve
 */
router.post(
    "/requests/:maintenance_request_public_id/resolve",
    authMiddleware,
    resolveMaintenanceRequestValidator,
    validateRequest,
    resolveMaintenanceRequestController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/resolutions
 */
router.get(
    "/requests/:maintenance_request_public_id/resolutions",
    authMiddleware,
    getMaintenanceResolutionsValidator,
    validateRequest,
    getMaintenanceResolutionsController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/resolutions/:maintenance_resolution_public_id
 */
router.get(
    "/requests/:maintenance_request_public_id/resolutions/:maintenance_resolution_public_id",
    authMiddleware,
    getSingleMaintenanceResolutionValidator,
    validateRequest,
    getSingleMaintenanceResolutionController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/resolutions/:maintenance_resolution_public_id/confirm
 */
router.post(
    "/requests/:maintenance_request_public_id/resolutions/:maintenance_resolution_public_id/confirm",
    authMiddleware,
    confirmMaintenanceResolutionValidator,
    validateRequest,
    confirmMaintenanceResolutionController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/resolutions/:maintenance_resolution_public_id/dispute
 */
router.post(
    "/requests/:maintenance_request_public_id/resolutions/:maintenance_resolution_public_id/dispute",
    authMiddleware,
    disputeMaintenanceResolutionValidator,
    validateRequest,
    disputeMaintenanceResolutionController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/resolutions/:maintenance_resolution_public_id/no-response
 */
router.post(
    "/requests/:maintenance_request_public_id/resolutions/:maintenance_resolution_public_id/no-response",
    authMiddleware,
    markMaintenanceResolutionNoResponseValidator,
    validateRequest,
    markMaintenanceResolutionNoResponseController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/close
 */
router.post(
    "/requests/:maintenance_request_public_id/close",
    authMiddleware,
    closeMaintenanceRequestValidator,
    validateRequest,
    closeMaintenanceRequestController
);

/*
 * =========================================================
 * MAINTENANCE REOPENING WORKFLOW
 * =========================================================
 */

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/reopen-requests
 */
router.post(
    "/requests/:maintenance_request_public_id/reopen-requests",
    authMiddleware,
    createMaintenanceReopenRequestValidator,
    validateRequest,
    createMaintenanceReopenRequestController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/reopen-requests
 */
router.get(
    "/requests/:maintenance_request_public_id/reopen-requests",
    authMiddleware,
    getMaintenanceReopenRequestsValidator,
    validateRequest,
    getMaintenanceReopenRequestsController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/reopen-requests/:maintenance_reopen_public_id
 */
router.get(
    "/requests/:maintenance_request_public_id/reopen-requests/:maintenance_reopen_public_id",
    authMiddleware,
    getSingleMaintenanceReopenRequestValidator,
    validateRequest,
    getSingleMaintenanceReopenRequestController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/reopen-requests/:maintenance_reopen_public_id/approve
 */
router.post(
    "/requests/:maintenance_request_public_id/reopen-requests/:maintenance_reopen_public_id/approve",
    authMiddleware,
    approveMaintenanceReopenRequestValidator,
    validateRequest,
    approveMaintenanceReopenRequestController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/reopen-requests/:maintenance_reopen_public_id/reject
 */
router.post(
    "/requests/:maintenance_request_public_id/reopen-requests/:maintenance_reopen_public_id/reject",
    authMiddleware,
    rejectMaintenanceReopenRequestValidator,
    validateRequest,
    rejectMaintenanceReopenRequestController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/reopen-requests/:maintenance_reopen_public_id/cancel
 */
router.post(
    "/requests/:maintenance_request_public_id/reopen-requests/:maintenance_reopen_public_id/cancel",
    authMiddleware,
    cancelMaintenanceReopenRequestValidator,
    validateRequest,
    cancelMaintenanceReopenRequestController
);

module.exports = router;

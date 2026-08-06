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
    createMaintenanceAssignmentValidator,
    getMaintenanceAssignmentsValidator,
    getSingleMaintenanceAssignmentValidator,
    acceptMaintenanceAssignmentValidator,
    declineMaintenanceAssignmentValidator,
    activateMaintenanceAssignmentValidator,
    completeMaintenanceAssignmentValidator,
    revokeMaintenanceAssignmentValidator,
    createMaintenanceVisitValidator,
    getMaintenanceVisitsValidator,
    getSingleMaintenanceVisitValidator,
    respondToMaintenanceVisitValidator,
    rescheduleMaintenanceVisitValidator,
    startMaintenanceVisitValidator,
    completeMaintenanceVisitValidator,
    markMaintenanceVisitMissedValidator,
    cancelMaintenanceVisitValidator,
    getMaintenanceVisitHistoryValidator
} = require(
    "../../validators/maintenance/assignmentVisitValidator"
);

const {
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
} = require(
    "../../controllers/maintenance/assignmentVisitController"
);

/*
 * =========================================================
 * MAINTENANCE ASSIGNMENTS
 * =========================================================
 */

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/assignments
 */
router.post(
    "/requests/:maintenance_request_public_id/assignments",
    authMiddleware,
    createMaintenanceAssignmentValidator,
    validateRequest,
    createMaintenanceAssignmentController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/assignments
 */
router.get(
    "/requests/:maintenance_request_public_id/assignments",
    authMiddleware,
    getMaintenanceAssignmentsValidator,
    validateRequest,
    getMaintenanceAssignmentsController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id
 */
router.get(
    "/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id",
    authMiddleware,
    getSingleMaintenanceAssignmentValidator,
    validateRequest,
    getSingleMaintenanceAssignmentController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/accept
 */
router.post(
    "/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/accept",
    authMiddleware,
    acceptMaintenanceAssignmentValidator,
    validateRequest,
    acceptMaintenanceAssignmentController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/decline
 */
router.post(
    "/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/decline",
    authMiddleware,
    declineMaintenanceAssignmentValidator,
    validateRequest,
    declineMaintenanceAssignmentController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/activate
 */
router.post(
    "/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/activate",
    authMiddleware,
    activateMaintenanceAssignmentValidator,
    validateRequest,
    activateMaintenanceAssignmentController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/complete
 */
router.post(
    "/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/complete",
    authMiddleware,
    completeMaintenanceAssignmentValidator,
    validateRequest,
    completeMaintenanceAssignmentController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/revoke
 */
router.post(
    "/requests/:maintenance_request_public_id/assignments/:maintenance_assignment_public_id/revoke",
    authMiddleware,
    revokeMaintenanceAssignmentValidator,
    validateRequest,
    revokeMaintenanceAssignmentController
);

/*
 * =========================================================
 * MAINTENANCE VISITS
 * =========================================================
 */

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/visits
 */
router.post(
    "/requests/:maintenance_request_public_id/visits",
    authMiddleware,
    createMaintenanceVisitValidator,
    validateRequest,
    createMaintenanceVisitController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/visits
 */
router.get(
    "/requests/:maintenance_request_public_id/visits",
    authMiddleware,
    getMaintenanceVisitsValidator,
    validateRequest,
    getMaintenanceVisitsController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id
 */
router.get(
    "/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id",
    authMiddleware,
    getSingleMaintenanceVisitValidator,
    validateRequest,
    getSingleMaintenanceVisitController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/respond
 */
router.post(
    "/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/respond",
    authMiddleware,
    respondToMaintenanceVisitValidator,
    validateRequest,
    respondToMaintenanceVisitController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/reschedule
 */
router.post(
    "/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/reschedule",
    authMiddleware,
    rescheduleMaintenanceVisitValidator,
    validateRequest,
    rescheduleMaintenanceVisitController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/start
 */
router.post(
    "/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/start",
    authMiddleware,
    startMaintenanceVisitValidator,
    validateRequest,
    startMaintenanceVisitController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/complete
 */
router.post(
    "/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/complete",
    authMiddleware,
    completeMaintenanceVisitValidator,
    validateRequest,
    completeMaintenanceVisitController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/missed
 */
router.post(
    "/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/missed",
    authMiddleware,
    markMaintenanceVisitMissedValidator,
    validateRequest,
    markMaintenanceVisitMissedController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/cancel
 */
router.post(
    "/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/cancel",
    authMiddleware,
    cancelMaintenanceVisitValidator,
    validateRequest,
    cancelMaintenanceVisitController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/history
 */
router.get(
    "/requests/:maintenance_request_public_id/visits/:maintenance_visit_public_id/history",
    authMiddleware,
    getMaintenanceVisitHistoryValidator,
    validateRequest,
    getMaintenanceVisitHistoryController
);

module.exports = router;

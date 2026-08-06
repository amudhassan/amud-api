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
    updateMaintenanceRequestDetailsValidator,
    getMaintenanceStatusHistoryValidator,
    getMaintenanceActivityHistoryValidator,
    updateMaintenanceSlaTargetsValidator,
    escalateMaintenanceRequestValidator,
    getOverdueMaintenanceRequestsValidator,
    applyMaintenanceUnitStatusLockValidator,
    releaseMaintenanceUnitStatusLockValidator
} = require(
    "../../validators/maintenance/requestFoundationValidator"
);

const {
    updateMaintenanceRequestDetailsController,
    getMaintenanceStatusHistoryController,
    getMaintenanceActivityHistoryController,
    updateMaintenanceSlaTargetsController,
    escalateMaintenanceRequestController,
    getOverdueMaintenanceRequestsController,
    applyMaintenanceUnitStatusLockController,
    releaseMaintenanceUnitStatusLockController
} = require(
    "../../controllers/maintenance/requestFoundationController"
);

/*
 * PATCH
 * /api/maintenance/requests/:maintenance_request_public_id
 */
router.patch(
    "/requests/:maintenance_request_public_id",
    authMiddleware,
    updateMaintenanceRequestDetailsValidator,
    validateRequest,
    updateMaintenanceRequestDetailsController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/status-history
 */
router.get(
    "/requests/:maintenance_request_public_id/status-history",
    authMiddleware,
    getMaintenanceStatusHistoryValidator,
    validateRequest,
    getMaintenanceStatusHistoryController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/activity-history
 */
router.get(
    "/requests/:maintenance_request_public_id/activity-history",
    authMiddleware,
    getMaintenanceActivityHistoryValidator,
    validateRequest,
    getMaintenanceActivityHistoryController
);

/*
 * PATCH
 * /api/maintenance/requests/:maintenance_request_public_id/sla-targets
 */
router.patch(
    "/requests/:maintenance_request_public_id/sla-targets",
    authMiddleware,
    updateMaintenanceSlaTargetsValidator,
    validateRequest,
    updateMaintenanceSlaTargetsController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/escalate
 */
router.post(
    "/requests/:maintenance_request_public_id/escalate",
    authMiddleware,
    escalateMaintenanceRequestValidator,
    validateRequest,
    escalateMaintenanceRequestController
);

/*
 * GET /api/maintenance/sla/overdue
 */
router.get(
    "/sla/overdue",
    authMiddleware,
    getOverdueMaintenanceRequestsValidator,
    validateRequest,
    getOverdueMaintenanceRequestsController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/unit-status-lock
 */
router.post(
    "/requests/:maintenance_request_public_id/unit-status-lock",
    authMiddleware,
    applyMaintenanceUnitStatusLockValidator,
    validateRequest,
    applyMaintenanceUnitStatusLockController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/unit-status-lock/release
 */
router.post(
    "/requests/:maintenance_request_public_id/unit-status-lock/release",
    authMiddleware,
    releaseMaintenanceUnitStatusLockValidator,
    validateRequest,
    releaseMaintenanceUnitStatusLockController
);

module.exports = router;

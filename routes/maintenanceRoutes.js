const express = require("express");

const router = express.Router();

const {
    authMiddleware
} = require(
    "../middleware/authMiddleware"
);

const validateRequest = require(
    "../middleware/validateRequest"
);

const {
    createMaintenanceRequestValidator,
    getMaintenanceRequestsValidator,
    getSingleMaintenanceRequestValidator,
    changeMaintenanceRequestStatusValidator
} = require(
    "../validators/maintenanceValidator"
);

const {
    createMaintenanceRequestController,
    getMaintenanceRequestsController,
    getSingleMaintenanceRequestController,
    changeMaintenanceRequestStatusController
} = require(
    "../controllers/maintenanceController"
);

const requestFoundationRoutes = require(
    "./maintenance/requestFoundationRoutes"
);

const assignmentVisitRoutes = require(
    "./maintenance/assignmentVisitRoutes"
);

const costResponsibilityRoutes = require(
    "./maintenance/costResponsibilityRoutes"
);

const communicationResolutionRoutes = require(
    "./maintenance/communicationResolutionRoutes"
);

const preventiveMaintenanceRoutes = require(
    "./maintenance/preventiveMaintenanceRoutes"
);

/*
 * GET /api/maintenance/requests
 */
router.get(
    "/requests",
    authMiddleware,
    getMaintenanceRequestsValidator,
    validateRequest,
    getMaintenanceRequestsController
);

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id
 */
router.get(
    "/requests/:maintenance_request_public_id",
    authMiddleware,
    getSingleMaintenanceRequestValidator,
    validateRequest,
    getSingleMaintenanceRequestController
);

/*
 * PATCH
 * /api/maintenance/requests/:maintenance_request_public_id/status
 */
router.patch(
    "/requests/:maintenance_request_public_id/status",
    authMiddleware,
    changeMaintenanceRequestStatusValidator,
    validateRequest,
    changeMaintenanceRequestStatusController
);

/*
 * POST /api/maintenance/requests
 */
router.post(
    "/requests",
    authMiddleware,
    createMaintenanceRequestValidator,
    validateRequest,
    createMaintenanceRequestController
);

/*
 * Batch A modular request-foundation routes.
 * Existing maintenance request routes above remain unchanged.
 */
router.use(
    "/",
    requestFoundationRoutes
);

/*
 * Batch B modular assignment and visit routes.
 * Batch A and the four original request APIs remain unchanged.
 */
router.use(
    "/",
    assignmentVisitRoutes
);

/*
 * Batch C modular cost and responsibility routes.
 * Batches A-B and the four original request APIs remain unchanged.
 */
router.use(
    "/",
    costResponsibilityRoutes
);

/*
 * Batch D modular communication and resolution routes.
 * Batches A-C and the four original request APIs remain unchanged.
 */
router.use(
    "/",
    communicationResolutionRoutes
);

/*
 * Batch E modular preventive-maintenance routes.
 * Batches A-D and the four original request APIs remain unchanged.
 */
router.use(
    "/",
    preventiveMaintenanceRoutes
);

module.exports = router;

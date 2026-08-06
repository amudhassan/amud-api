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
    createMaintenanceCostValidator,
    getMaintenanceCostsValidator,
    getSingleMaintenanceCostValidator,
    updateMaintenanceCostValidator,
    submitMaintenanceCostValidator,
    approveMaintenanceCostValidator,
    rejectMaintenanceCostValidator,
    cancelMaintenanceCostValidator,
    incurMaintenanceCostValidator,
    getMaintenanceCostApprovalHistoryValidator,
    determineMaintenanceResponsibilityValidator,
    createMaintenanceResponsibilityAllocationValidator,
    getMaintenanceResponsibilityAllocationsValidator,
    revokeMaintenanceResponsibilityAllocationValidator
} = require(
    "../../validators/maintenance/costResponsibilityValidator"
);

const {
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
} = require(
    "../../controllers/maintenance/costResponsibilityController"
);

/*
 * =========================================================
 * MAINTENANCE COSTS
 * =========================================================
 */

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/costs
 */
router.post(
    "/requests/:maintenance_request_public_id/costs",
    authMiddleware,
    createMaintenanceCostValidator,
    validateRequest,
    createMaintenanceCostController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/costs
 */
router.get(
    "/requests/:maintenance_request_public_id/costs",
    authMiddleware,
    getMaintenanceCostsValidator,
    validateRequest,
    getMaintenanceCostsController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id
 */
router.get(
    "/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id",
    authMiddleware,
    getSingleMaintenanceCostValidator,
    validateRequest,
    getSingleMaintenanceCostController
);

/*
 * PATCH
 * /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id
 */
router.patch(
    "/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id",
    authMiddleware,
    updateMaintenanceCostValidator,
    validateRequest,
    updateMaintenanceCostController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/submit
 */
router.post(
    "/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/submit",
    authMiddleware,
    submitMaintenanceCostValidator,
    validateRequest,
    submitMaintenanceCostController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/approve
 */
router.post(
    "/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/approve",
    authMiddleware,
    approveMaintenanceCostValidator,
    validateRequest,
    approveMaintenanceCostController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/reject
 */
router.post(
    "/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/reject",
    authMiddleware,
    rejectMaintenanceCostValidator,
    validateRequest,
    rejectMaintenanceCostController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/cancel
 */
router.post(
    "/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/cancel",
    authMiddleware,
    cancelMaintenanceCostValidator,
    validateRequest,
    cancelMaintenanceCostController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/incur
 */
router.post(
    "/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/incur",
    authMiddleware,
    incurMaintenanceCostValidator,
    validateRequest,
    incurMaintenanceCostController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/approval-history
 */
router.get(
    "/requests/:maintenance_request_public_id/costs/:maintenance_cost_public_id/approval-history",
    authMiddleware,
    getMaintenanceCostApprovalHistoryValidator,
    validateRequest,
    getMaintenanceCostApprovalHistoryController
);

/*
 * =========================================================
 * MAINTENANCE RESPONSIBILITY
 * =========================================================
 */

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/responsibility/determine
 */
router.post(
    "/requests/:maintenance_request_public_id/responsibility/determine",
    authMiddleware,
    determineMaintenanceResponsibilityValidator,
    validateRequest,
    determineMaintenanceResponsibilityController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/responsibility/allocations
 */
router.post(
    "/requests/:maintenance_request_public_id/responsibility/allocations",
    authMiddleware,
    createMaintenanceResponsibilityAllocationValidator,
    validateRequest,
    createMaintenanceResponsibilityAllocationController
);

/*
 * GET
 * /api/maintenance/requests/:maintenance_request_public_id/responsibility/allocations
 */
router.get(
    "/requests/:maintenance_request_public_id/responsibility/allocations",
    authMiddleware,
    getMaintenanceResponsibilityAllocationsValidator,
    validateRequest,
    getMaintenanceResponsibilityAllocationsController
);

/*
 * POST
 * /api/maintenance/requests/:maintenance_request_public_id/responsibility/allocations/:maintenance_responsibility_allocation_public_id/revoke
 */
router.post(
    "/requests/:maintenance_request_public_id/responsibility/allocations/:maintenance_responsibility_allocation_public_id/revoke",
    authMiddleware,
    revokeMaintenanceResponsibilityAllocationValidator,
    validateRequest,
    revokeMaintenanceResponsibilityAllocationController
);

module.exports = router;

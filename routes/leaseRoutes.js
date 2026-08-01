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
    createDraftLeaseController,
    getLeasesController,
    getSingleLeaseController,
    updateDraftLeaseController,
    scheduleLeaseController,
    activateLeaseController,
    cancelLeaseController,
    terminateLeaseController,
    expireLeaseController,
    renewLeaseController
} = require(
    "../controllers/leaseController"
);

const {
    createDraftLeaseValidator,
    getLeasesValidator,
    getSingleLeaseValidator,
    updateDraftLeaseValidator,
    scheduleLeaseValidator,
    activateLeaseValidator,
    cancelLeaseValidator,
    terminateLeaseValidator,
    expireLeaseValidator,
    renewLeaseValidator
} = require(
    "../validators/leaseValidator"
);

/*
 * GET /api/leases
 *
 * Retrieve authorized leases.
 */
router.get(
    "/",
    authMiddleware,
    getLeasesValidator,
    validateRequest,
    getLeasesController
);

/*
 * GET /api/leases/:lease_public_id
 *
 * Retrieve one authorized lease.
 */
router.get(
    "/:lease_public_id",
    authMiddleware,
    getSingleLeaseValidator,
    validateRequest,
    getSingleLeaseController
);
/*
 * PATCH /api/leases/:lease_public_id/schedule
 *
 * Schedule an existing draft lease.
 *
 * Must remain before the general PATCH route.
 */
router.patch(
    "/:lease_public_id/schedule",
    authMiddleware,
    scheduleLeaseValidator,
    validateRequest,
    scheduleLeaseController
);
/*
 * PATCH /api/leases/:lease_public_id/activate
 *
 * Activate an existing scheduled lease.
 *
 * Must remain before the general PATCH route.
 */
router.patch(
    "/:lease_public_id/activate",
    authMiddleware,
    activateLeaseValidator,
    validateRequest,
    activateLeaseController
);
/*
 * PATCH /api/leases/:lease_public_id/cancel
 *
 * Cancel a draft or scheduled lease.
 */
router.patch(
    "/:lease_public_id/cancel",
    authMiddleware,
    cancelLeaseValidator,
    validateRequest,
    cancelLeaseController
);
/*
 * PATCH /api/leases/:lease_public_id/terminate
 *
 * Terminate an active lease.
 */
router.patch(
    "/:lease_public_id/terminate",
    authMiddleware,
    terminateLeaseValidator,
    validateRequest,
    terminateLeaseController
);
/*
 * PATCH /api/leases/:lease_public_id/expire
 *
 * Expire an active lease after its end date.
 */
router.patch(
    "/:lease_public_id/expire",
    authMiddleware,
    expireLeaseValidator,
    validateRequest,
    expireLeaseController
);
/*
 * POST /api/leases/:lease_public_id/renew
 */
router.post(
    "/:lease_public_id/renew",
    authMiddleware,
    renewLeaseValidator,
    validateRequest,
    renewLeaseController
);
/*
 * PATCH /api/leases/:lease_public_id
 *
 * Update an existing draft lease.
 */
router.patch(
    "/:lease_public_id",
    authMiddleware,
    updateDraftLeaseValidator,
    validateRequest,
    updateDraftLeaseController
);

/*
 * POST /api/leases
 *
 * Create a new draft lease.
 */
router.post(
    "/",
    authMiddleware,
    createDraftLeaseValidator,
    validateRequest,
    createDraftLeaseController
);

module.exports = router;
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
    createDraftLeaseController
} = require(
    "../controllers/leaseController"
);

const {
    createDraftLeaseValidator
} = require(
    "../validators/leaseValidator"
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
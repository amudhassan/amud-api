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
    getTenantsController,
    createTenantController
} = require(
    "../controllers/tenantController"
);

const {
    getTenantsValidator,
    createTenantValidator
} = require(
    "../validators/tenantValidator"
);

/*
 * GET /api/tenants
 *
 * Returns current tenants connected to
 * the selected owner.
 */
router.get(
    "/",
    authMiddleware,
    getTenantsValidator,
    validateRequest,
    getTenantsController
);

/*
 * POST /api/tenants
 *
 * Creates:
 * 1. Tenant legal/business profile.
 * 2. First active primary owner relationship.
 */
router.post(
    "/",
    authMiddleware,
    createTenantValidator,
    validateRequest,
    createTenantController
);

module.exports = router;
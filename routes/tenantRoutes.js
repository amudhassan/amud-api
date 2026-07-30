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
    getSingleTenantController,
    updateTenantController,
    createTenantController
} = require(
    "../controllers/tenantController"
);

const {
    getTenantsValidator,
    getSingleTenantValidator,
    updateTenantValidator,
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
 * GET /api/tenants/:tenant_public_id
 *
 * Returns one current tenant within
 * the selected owner context.
 */
router.get(
    "/:tenant_public_id",
    authMiddleware,
    getSingleTenantValidator,
    validateRequest,
    getSingleTenantController
);

/*
 * PATCH /api/tenants/:tenant_public_id
 *
 * Updates the tenant legal/business profile.
 * Owner context is supplied through query parameters.
 */
router.patch(
    "/:tenant_public_id",
    authMiddleware,
    updateTenantValidator,
    validateRequest,
    updateTenantController
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
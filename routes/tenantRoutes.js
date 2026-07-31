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
    softDeleteTenantController,
    restoreTenantController,
    createTenantController
} = require(
    "../controllers/tenantController"
);

const {
    addTenantUserController
} = require(
    "../controllers/tenantUserController"
);

const {
    getTenantsValidator,
    getSingleTenantValidator,
    updateTenantValidator,
    softDeleteTenantValidator,
    restoreTenantValidator,
    createTenantValidator
} = require(
    "../validators/tenantValidator"
);

const {
    addTenantUserValidator
} = require(
    "../validators/tenantUserValidator"
);

/*
 * GET /api/tenants
 */
router.get(
    "/",
    authMiddleware,
    getTenantsValidator,
    validateRequest,
    getTenantsController
);

/*
 * POST /api/tenants/:tenant_public_id/users
 */
router.post(
    "/:tenant_public_id/users",
    authMiddleware,
    addTenantUserValidator,
    validateRequest,
    addTenantUserController
);

/*
 * GET /api/tenants/:tenant_public_id
 */
router.get(
    "/:tenant_public_id",
    authMiddleware,
    getSingleTenantValidator,
    validateRequest,
    getSingleTenantController
);

/*
 * PATCH /api/tenants/:tenant_public_id/restore
 *
 * Must remain before the general PATCH route.
 */
router.patch(
    "/:tenant_public_id/restore",
    authMiddleware,
    restoreTenantValidator,
    validateRequest,
    restoreTenantController
);

/*
 * PATCH /api/tenants/:tenant_public_id
 */
router.patch(
    "/:tenant_public_id",
    authMiddleware,
    updateTenantValidator,
    validateRequest,
    updateTenantController
);

/*
 * DELETE /api/tenants/:tenant_public_id
 */
router.delete(
    "/:tenant_public_id",
    authMiddleware,
    softDeleteTenantValidator,
    validateRequest,
    softDeleteTenantController
);

/*
 * POST /api/tenants
 */
router.post(
    "/",
    authMiddleware,
    createTenantValidator,
    validateRequest,
    createTenantController
);

module.exports = router;
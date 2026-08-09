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
    getDeletedTenantsController,
    getSingleTenantController,
    updateTenantController,
    activateTenantController,
    blockTenantController,
    unblockTenantController,
    softDeleteTenantController,
    restoreTenantController,
    createTenantController,
    blockOwnerTenantRelationshipController,
    endOwnerTenantRelationshipController
} = require(
    "../controllers/tenantController"
);

const {
    addTenantUserController,
    getTenantUsersController,
    updateTenantUserController,
    revokeTenantUserController
} = require(
    "../controllers/tenantUserController"
);

const {
    getTenantsValidator,
    getDeletedTenantsValidator,
    getSingleTenantValidator,
    updateTenantValidator,
    activateTenantValidator,
    blockTenantValidator,
    unblockTenantValidator,
    softDeleteTenantValidator,
    restoreTenantValidator,
    createTenantValidator,
    blockOwnerTenantRelationshipValidator,
    endOwnerTenantRelationshipValidator
} = require(
    "../validators/tenantValidator"
);

const {
    addTenantUserValidator,
    getTenantUsersValidator,
    updateTenantUserValidator,
    revokeTenantUserValidator
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
 * GET /api/tenants/deleted
 *
 * Must remain before GET /:tenant_public_id.
 */
router.get(
    "/deleted",
    authMiddleware,
    getDeletedTenantsValidator,
    validateRequest,
    getDeletedTenantsController
);
/*
 * GET /api/tenants/:tenant_public_id/users
 */
router.get(
    "/:tenant_public_id/users",
    authMiddleware,
    getTenantUsersValidator,
    validateRequest,
    getTenantUsersController
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
 * PATCH /api/tenants/:tenant_public_id/users/:link_public_id
 */
router.patch(
    "/:tenant_public_id/users/:link_public_id",
    authMiddleware,
    updateTenantUserValidator,
    validateRequest,
    updateTenantUserController
);
/*
 * DELETE /api/tenants/:tenant_public_id/users/:link_public_id
 */
router.delete(
    "/:tenant_public_id/users/:link_public_id",
    authMiddleware,
    revokeTenantUserValidator,
    validateRequest,
    revokeTenantUserController
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
 * PATCH /api/tenants/:tenant_public_id/relationship/block
 */
router.patch(
    "/:tenant_public_id/relationship/block",
    authMiddleware,
    blockOwnerTenantRelationshipValidator,
    validateRequest,
    blockOwnerTenantRelationshipController
);

/*
 * PATCH /api/tenants/:tenant_public_id/relationship/end
 */
router.patch(
    "/:tenant_public_id/relationship/end",
    authMiddleware,
    endOwnerTenantRelationshipValidator,
    validateRequest,
    endOwnerTenantRelationshipController
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
 * PATCH /api/tenants/:tenant_public_id/activate
 *
 * Must remain before the general PATCH route.
 */
router.patch(
    "/:tenant_public_id/activate",
    authMiddleware,
    activateTenantValidator,
    validateRequest,
    activateTenantController
);


/*
 * PATCH /api/tenants/:tenant_public_id/block
 *
 * Must remain before the general PATCH route.
 */
router.patch(
    "/:tenant_public_id/block",
    authMiddleware,
    blockTenantValidator,
    validateRequest,
    blockTenantController
);


/*
 * PATCH /api/tenants/:tenant_public_id/unblock
 *
 * Must remain before the general PATCH route.
 */
router.patch(
    "/:tenant_public_id/unblock",
    authMiddleware,
    unblockTenantValidator,
    validateRequest,
    unblockTenantController
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
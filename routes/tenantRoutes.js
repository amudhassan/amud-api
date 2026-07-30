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
    createTenantController
} = require(
    "../controllers/tenantController"
);

const {
    createTenantValidator
} = require(
    "../validators/tenantValidator"
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
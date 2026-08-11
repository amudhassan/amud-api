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
    getLeaseClauseTemplatesValidator,
    createLeaseClauseTemplateValidator,
    getSingleLeaseClauseTemplateValidator,
    updateLeaseClauseTemplateValidator,
    deleteLeaseClauseTemplateValidator,
    createLeaseClauseTemplateItemValidator,
    updateLeaseClauseTemplateItemValidator,
    deleteLeaseClauseTemplateItemValidator
} = require(
    "../validators/leaseClauseTemplateValidator"
);

const {
    getLeaseClauseTemplatesController,
    createLeaseClauseTemplateController,
    getSingleLeaseClauseTemplateController,
    updateLeaseClauseTemplateController,
    deleteLeaseClauseTemplateController,
    createLeaseClauseTemplateItemController,
    updateLeaseClauseTemplateItemController,
    deleteLeaseClauseTemplateItemController
} = require(
    "../controllers/leaseClauseTemplateController"
);

/*
 * GET /api/lease-clause-templates
 */
router.get(
    "/",
    authMiddleware,
    getLeaseClauseTemplatesValidator,
    validateRequest,
    getLeaseClauseTemplatesController
);

/*
 * POST /api/lease-clause-templates
 */
router.post(
    "/",
    authMiddleware,
    createLeaseClauseTemplateValidator,
    validateRequest,
    createLeaseClauseTemplateController
);

/*
 * POST
 * /api/lease-clause-templates/:template_public_id/items
 */
router.post(
    "/:template_public_id/items",
    authMiddleware,
    createLeaseClauseTemplateItemValidator,
    validateRequest,
    createLeaseClauseTemplateItemController
);

/*
 * PATCH
 * /api/lease-clause-templates/:template_public_id/items/:item_public_id
 */
router.patch(
    "/:template_public_id/items/:item_public_id",
    authMiddleware,
    updateLeaseClauseTemplateItemValidator,
    validateRequest,
    updateLeaseClauseTemplateItemController
);

/*
 * DELETE
 * /api/lease-clause-templates/:template_public_id/items/:item_public_id
 */
router.delete(
    "/:template_public_id/items/:item_public_id",
    authMiddleware,
    deleteLeaseClauseTemplateItemValidator,
    validateRequest,
    deleteLeaseClauseTemplateItemController
);

/*
 * GET /api/lease-clause-templates/:template_public_id
 */
router.get(
    "/:template_public_id",
    authMiddleware,
    getSingleLeaseClauseTemplateValidator,
    validateRequest,
    getSingleLeaseClauseTemplateController
);

/*
 * PATCH /api/lease-clause-templates/:template_public_id
 */
router.patch(
    "/:template_public_id",
    authMiddleware,
    updateLeaseClauseTemplateValidator,
    validateRequest,
    updateLeaseClauseTemplateController
);

/*
 * DELETE /api/lease-clause-templates/:template_public_id
 */
router.delete(
    "/:template_public_id",
    authMiddleware,
    deleteLeaseClauseTemplateValidator,
    validateRequest,
    deleteLeaseClauseTemplateController
);

module.exports = router;

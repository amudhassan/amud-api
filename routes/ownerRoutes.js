const express = require("express");

const router = express.Router();

const {
    createOwnerController,
    getOwnersController,
    getSingleOwnerController,
    updateOwnerController,
    softDeleteOwnerController,
    restoreOwnerController
} = require("../controllers/ownerController");

const {
    createOwnerValidator,
    getOwnersValidator,
    getSingleOwnerValidator,
    updateOwnerValidator
} = require("../validators/ownerValidator");

const {
    authMiddleware
} = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");

const {
    getOwnerUsersController,
    addOwnerUserController,
    updateOwnerUserController,
    revokeOwnerUserController
} = require("../controllers/ownerUserController");

const {
    getOwnerUsersValidator,
    addOwnerUserValidator,
    updateOwnerUserValidator,
    revokeOwnerUserValidator
} = require("../validators/ownerUserValidator");

router.post(
    "/",
    authMiddleware,
    createOwnerValidator,
    validateRequest,
    createOwnerController
);
router.get(
    "/",
    authMiddleware,
    getOwnersValidator,
    validateRequest,
    getOwnersController
);
router.get(
    "/:owner_public_id/users",
    authMiddleware,
    getOwnerUsersValidator,
    validateRequest,
    getOwnerUsersController
);
router.post(
    "/:owner_public_id/users",
    authMiddleware,
    addOwnerUserValidator,
    validateRequest,
    addOwnerUserController
);
router.patch(
    "/:owner_public_id/users/:link_public_id",
    authMiddleware,
    updateOwnerUserValidator,
    validateRequest,
    updateOwnerUserController
);
router.delete(
    "/:owner_public_id/users/:link_public_id",
    authMiddleware,
    revokeOwnerUserValidator,
    validateRequest,
    revokeOwnerUserController
);
router.patch(
    "/:public_id/restore",
    authMiddleware,
    getSingleOwnerValidator,
    validateRequest,
    restoreOwnerController
);
router.get(
    "/:public_id",
    authMiddleware,
    getSingleOwnerValidator,
    validateRequest,
    getSingleOwnerController
);
router.patch(
    "/:public_id",
    authMiddleware,
    updateOwnerValidator,
    validateRequest,
    updateOwnerController
);
router.delete(
    "/:public_id",
    authMiddleware,
    getSingleOwnerValidator,
    validateRequest,
    softDeleteOwnerController
);

module.exports = router;
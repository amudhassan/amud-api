const express = require("express");

const router = express.Router();

const {
    createOwnerController,
    getOwnersController,
    getSingleOwnerController
} = require("../controllers/ownerController");

const {
    createOwnerValidator,
    getOwnersValidator,
    getSingleOwnerValidator
} = require("../validators/ownerValidator");

const {
    authMiddleware
} = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");

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
    "/:public_id",
    authMiddleware,
    getSingleOwnerValidator,
    validateRequest,
    getSingleOwnerController
);

module.exports = router;
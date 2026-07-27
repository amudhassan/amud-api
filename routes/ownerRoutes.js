const express = require("express");

const router = express.Router();

const {
    createOwnerController,
    getOwnersController
} = require("../controllers/ownerController");

const {
    createOwnerValidator,
    getOwnersValidator
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

module.exports = router;
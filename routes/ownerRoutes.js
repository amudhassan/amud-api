const express = require("express");

const router = express.Router();

const {
    createOwnerController
} = require("../controllers/ownerController");

const {
    createOwnerValidator
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

module.exports = router;
const express = require("express");

const router = express.Router();

/*
 * Tumia import ya authMiddleware inayolingana
 * kabisa na ile iliyopo kwenye ownerRoutes.js.
 */
const { authMiddleware }
  = require("../middleware/authMiddleware");

const validateRequest 
 = require("../middleware/validateRequest");

const {
    getPropertiesController,
    createPropertyController
} = require("../controllers/propertyController");

const {
    getPropertiesValidator,
    createPropertyValidator
} = require("../validators/propertyValidator");


router.get(
    "/",
    authMiddleware,
    getPropertiesValidator,
    validateRequest,
    getPropertiesController
);
router.post(
    "/",
    authMiddleware,
    createPropertyValidator,
    validateRequest,
    createPropertyController
);

module.exports = router;
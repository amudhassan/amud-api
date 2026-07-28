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
    createPropertyController,
    getSinglePropertyController
} = require("../controllers/propertyController");

const {
    getPropertiesValidator,
    createPropertyValidator,
    getSinglePropertyValidator
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
router.get(
    "/:property_public_id",
    authMiddleware,
    getSinglePropertyValidator,
    validateRequest,
    getSinglePropertyController
);
module.exports = router;
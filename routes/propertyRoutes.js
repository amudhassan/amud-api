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
    getSinglePropertyController,
    updatePropertyController,
    softDeletePropertyController,
    restorePropertyController
} = require("../controllers/propertyController");

const {
    getPropertiesValidator,
    createPropertyValidator,
    getSinglePropertyValidator,
    updatePropertyValidator,
    softDeletePropertyValidator,
    restorePropertyValidator
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
router.patch(
    "/:property_public_id/restore",
    authMiddleware,
    restorePropertyValidator,
    validateRequest,
    restorePropertyController
);
router.get(
    "/:property_public_id",
    authMiddleware,
    getSinglePropertyValidator,
    validateRequest,
    getSinglePropertyController
);
router.patch(
    "/:property_public_id",
    authMiddleware,
    updatePropertyValidator,
    validateRequest,
    updatePropertyController
);
router.delete(
    "/:property_public_id",
    authMiddleware,
    softDeletePropertyValidator,
    validateRequest,
    softDeletePropertyController
);
module.exports = router;
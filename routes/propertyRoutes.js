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
    restorePropertyController,
    getPropertyOwnersController,
    replacePropertyOwnershipController,
    activatePropertyController
} = require("../controllers/propertyController");

const {
    getPropertiesValidator,
    createPropertyValidator,
    getSinglePropertyValidator,
    updatePropertyValidator,
    softDeletePropertyValidator,
    restorePropertyValidator,
    getPropertyOwnersValidator,
    replacePropertyOwnershipValidator,
    activatePropertyValidator
} = require("../validators/propertyValidator");

const {
    getPropertyUnitsController,
    createUnitController
} = require(
    "../controllers/unitController"
);

const {
    getPropertyUnitsValidator,
    createUnitValidator
} = require(
    "../validators/unitValidator"
);

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
router.patch(
    "/:property_public_id/activate",
    authMiddleware,
    activatePropertyValidator,
    validateRequest,
    activatePropertyController
);
router.get(
    "/:property_public_id/units",
    authMiddleware,
    getPropertyUnitsValidator,
    validateRequest,
    getPropertyUnitsController
);
router.post(
    "/:property_public_id/units",
    authMiddleware,
    createUnitValidator,
    validateRequest,
    createUnitController
);
router.get(
    "/:property_public_id/owners",
    authMiddleware,
    getPropertyOwnersValidator,
    validateRequest,
    getPropertyOwnersController
);
router.put(
    "/:property_public_id/owners",
    authMiddleware,
    replacePropertyOwnershipValidator,
    validateRequest,
    replacePropertyOwnershipController
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
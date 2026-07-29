const express = require("express");

const router = express.Router();

/*
 * Tumia exact import style ya authMiddleware
 * inayofanya kazi kwenye propertyRoutes.js.
 */
const { authMiddleware
 } = require(
    "../middleware/authMiddleware"
);

const validateRequest = require(
    "../middleware/validateRequest"
);

const {
    getSingleUnitController,
    updateUnitController
} = require(
    "../controllers/unitController"
);

const {
    getSingleUnitValidator,
    updateUnitValidator
} = require(
    "../validators/unitValidator"
);

router.get(
    "/:unit_public_id",
    authMiddleware,
    getSingleUnitValidator,
    validateRequest,
    getSingleUnitController
);
router.patch(
    "/:unit_public_id",
    authMiddleware,
    updateUnitValidator,
    validateRequest,
    updateUnitController
);
module.exports = router;
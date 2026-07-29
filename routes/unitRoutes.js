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
    getSingleUnitController
} = require(
    "../controllers/unitController"
);

const {
    getSingleUnitValidator
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

module.exports = router;
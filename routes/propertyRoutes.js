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
    getPropertiesController
} = require("../controllers/propertyController");

const {
    getPropertiesValidator
} = require("../validators/propertyValidator");


router.get(
    "/",
    authMiddleware,
    getPropertiesValidator,
    validateRequest,
    getPropertiesController
);

module.exports = router;
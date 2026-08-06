const express = require("express");

const router = express.Router();

const {
    authMiddleware
} = require(
    "../../middleware/authMiddleware"
);

const validateRequest = require(
    "../../middleware/validateRequest"
);

const {
    getNotificationPreferencesValidator,
    updateNotificationPreferencesValidator,
    resetNotificationPreferencesValidator
} = require(
    "../../validators/notifications/preferencesValidator"
);

const {
    getNotificationPreferencesController,
    updateNotificationPreferencesController,
    resetNotificationPreferencesController
} = require(
    "../../controllers/notifications/preferencesController"
);

/*
 * GET /api/notifications/preferences
 */
router.get(
    "/preferences",
    authMiddleware,
    getNotificationPreferencesValidator,
    validateRequest,
    getNotificationPreferencesController
);

/*
 * PATCH /api/notifications/preferences
 */
router.patch(
    "/preferences",
    authMiddleware,
    updateNotificationPreferencesValidator,
    validateRequest,
    updateNotificationPreferencesController
);

/*
 * PATCH /api/notifications/preferences/reset
 */
router.patch(
    "/preferences/reset",
    authMiddleware,
    resetNotificationPreferencesValidator,
    validateRequest,
    resetNotificationPreferencesController
);

module.exports = router;

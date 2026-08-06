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
    getNotificationsValidator,
    getUnreadNotificationCountValidator,
    getSingleNotificationValidator,
    markNotificationAsReadValidator,
    markAllNotificationsAsReadValidator
} = require(
    "../../validators/notifications/inboxValidator"
);

const {
    getNotificationsController,
    getUnreadNotificationCountController,
    getSingleNotificationController,
    markNotificationAsReadController,
    markAllNotificationsAsReadController
} = require(
    "../../controllers/notifications/inboxController"
);

/*
 * GET /api/notifications
 */
router.get(
    "/",
    authMiddleware,
    getNotificationsValidator,
    validateRequest,
    getNotificationsController
);

/*
 * GET /api/notifications/unread-count
 */
router.get(
    "/unread-count",
    authMiddleware,
    getUnreadNotificationCountValidator,
    validateRequest,
    getUnreadNotificationCountController
);

/*
 * GET /api/notifications/:notification_public_id
 */
router.get(
    "/:notification_public_id",
    authMiddleware,
    getSingleNotificationValidator,
    validateRequest,
    getSingleNotificationController
);

/*
 * PATCH /api/notifications/read-all
 */
router.patch(
    "/read-all",
    authMiddleware,
    markAllNotificationsAsReadValidator,
    validateRequest,
    markAllNotificationsAsReadController
);

/*
 * PATCH /api/notifications/:notification_public_id/read
 */
router.patch(
    "/:notification_public_id/read",
    authMiddleware,
    markNotificationAsReadValidator,
    validateRequest,
    markNotificationAsReadController
);

module.exports = router;

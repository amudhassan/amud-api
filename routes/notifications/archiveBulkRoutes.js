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
    archiveSingleNotificationValidator,
    archiveAllNotificationsValidator,
    restoreSingleNotificationValidator,
    bulkReadNotificationsValidator,
    bulkArchiveNotificationsValidator
} = require(
    "../../validators/notifications/archiveBulkValidator"
);

const {
    archiveSingleNotificationController,
    archiveAllNotificationsController,
    restoreSingleNotificationController,
    bulkReadNotificationsController,
    bulkArchiveNotificationsController
} = require(
    "../../controllers/notifications/archiveBulkController"
);

/*
 * PATCH /api/notifications/archive-all
 */
router.patch(
    "/archive-all",
    authMiddleware,
    archiveAllNotificationsValidator,
    validateRequest,
    archiveAllNotificationsController
);

/*
 * PATCH /api/notifications/bulk-read
 */
router.patch(
    "/bulk-read",
    authMiddleware,
    bulkReadNotificationsValidator,
    validateRequest,
    bulkReadNotificationsController
);

/*
 * PATCH /api/notifications/bulk-archive
 */
router.patch(
    "/bulk-archive",
    authMiddleware,
    bulkArchiveNotificationsValidator,
    validateRequest,
    bulkArchiveNotificationsController
);

/*
 * PATCH /api/notifications/:notification_public_id/archive
 */
router.patch(
    "/:notification_public_id/archive",
    authMiddleware,
    archiveSingleNotificationValidator,
    validateRequest,
    archiveSingleNotificationController
);

/*
 * PATCH /api/notifications/:notification_public_id/restore
 */
router.patch(
    "/:notification_public_id/restore",
    authMiddleware,
    restoreSingleNotificationValidator,
    validateRequest,
    restoreSingleNotificationController
);

module.exports = router;

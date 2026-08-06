const express = require("express");

const router = express.Router();

const preferencesRoutes = require(
    "./notifications/preferencesRoutes"
);

const archiveBulkRoutes = require(
    "./notifications/archiveBulkRoutes"
);

const inboxRoutes = require(
    "./notifications/inboxRoutes"
);

/*
 * Static preference and bulk routes must be registered before
 * inbox public-ID routes such as /:notification_public_id.
 */
router.use("/", preferencesRoutes);
router.use("/", archiveBulkRoutes);
router.use("/", inboxRoutes);

module.exports = router;

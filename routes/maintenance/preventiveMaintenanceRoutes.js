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
    createPreventiveMaintenancePlanValidator,
    getPreventiveMaintenancePlansValidator,
    getDuePreventiveMaintenancePlansValidator,
    getSinglePreventiveMaintenancePlanValidator,
    updatePreventiveMaintenancePlanValidator,
    pausePreventiveMaintenancePlanValidator,
    resumePreventiveMaintenancePlanValidator,
    completePreventiveMaintenancePlanValidator,
    cancelPreventiveMaintenancePlanValidator,
    createPreventiveMaintenanceOccurrenceValidator,
    getPreventiveMaintenanceOccurrencesValidator,
    getSinglePreventiveMaintenanceOccurrenceValidator,
    generatePreventiveMaintenanceOccurrenceValidator,
    skipPreventiveMaintenanceOccurrenceValidator,
    failPreventiveMaintenanceOccurrenceValidator,
    cancelPreventiveMaintenanceOccurrenceValidator,
    processDuePreventiveMaintenancePlansValidator
} = require(
    "../../validators/maintenance/preventiveMaintenanceValidator"
);

const {
    createPreventiveMaintenancePlanController,
    getPreventiveMaintenancePlansController,
    getDuePreventiveMaintenancePlansController,
    getSinglePreventiveMaintenancePlanController,
    updatePreventiveMaintenancePlanController,
    pausePreventiveMaintenancePlanController,
    resumePreventiveMaintenancePlanController,
    completePreventiveMaintenancePlanController,
    cancelPreventiveMaintenancePlanController,
    createPreventiveMaintenanceOccurrenceController,
    getPreventiveMaintenanceOccurrencesController,
    getSinglePreventiveMaintenanceOccurrenceController,
    generatePreventiveMaintenanceOccurrenceController,
    skipPreventiveMaintenanceOccurrenceController,
    failPreventiveMaintenanceOccurrenceController,
    cancelPreventiveMaintenanceOccurrenceController,
    processDuePreventiveMaintenancePlansController
} = require(
    "../../controllers/maintenance/preventiveMaintenanceController"
);

/*
 * =========================================================
 * PREVENTIVE MAINTENANCE PLAN COLLECTION AND SCHEDULER
 * =========================================================
 *
 * Static collection paths must remain before the dynamic
 * :preventive_plan_public_id routes.
 */

/*
 * GET /api/maintenance/preventive-plans/due
 */
router.get(
    "/preventive-plans/due",
    authMiddleware,
    getDuePreventiveMaintenancePlansValidator,
    validateRequest,
    getDuePreventiveMaintenancePlansController
);

/*
 * POST /api/maintenance/preventive-plans/process-due
 */
router.post(
    "/preventive-plans/process-due",
    authMiddleware,
    processDuePreventiveMaintenancePlansValidator,
    validateRequest,
    processDuePreventiveMaintenancePlansController
);

/*
 * GET /api/maintenance/preventive-plans
 */
router.get(
    "/preventive-plans",
    authMiddleware,
    getPreventiveMaintenancePlansValidator,
    validateRequest,
    getPreventiveMaintenancePlansController
);

/*
 * POST /api/maintenance/preventive-plans
 */
router.post(
    "/preventive-plans",
    authMiddleware,
    createPreventiveMaintenancePlanValidator,
    validateRequest,
    createPreventiveMaintenancePlanController
);

/*
 * =========================================================
 * PREVENTIVE MAINTENANCE OCCURRENCES
 * =========================================================
 */

/*
 * GET
 * /api/maintenance/preventive-plans/:preventive_plan_public_id/occurrences
 */
router.get(
    "/preventive-plans/:preventive_plan_public_id/occurrences",
    authMiddleware,
    getPreventiveMaintenanceOccurrencesValidator,
    validateRequest,
    getPreventiveMaintenanceOccurrencesController
);

/*
 * POST
 * /api/maintenance/preventive-plans/:preventive_plan_public_id/occurrences
 */
router.post(
    "/preventive-plans/:preventive_plan_public_id/occurrences",
    authMiddleware,
    createPreventiveMaintenanceOccurrenceValidator,
    validateRequest,
    createPreventiveMaintenanceOccurrenceController
);

/*
 * GET
 * /api/maintenance/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id
 */
router.get(
    "/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id",
    authMiddleware,
    getSinglePreventiveMaintenanceOccurrenceValidator,
    validateRequest,
    getSinglePreventiveMaintenanceOccurrenceController
);

/*
 * POST
 * /api/maintenance/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id/generate
 */
router.post(
    "/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id/generate",
    authMiddleware,
    generatePreventiveMaintenanceOccurrenceValidator,
    validateRequest,
    generatePreventiveMaintenanceOccurrenceController
);

/*
 * POST
 * /api/maintenance/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id/skip
 */
router.post(
    "/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id/skip",
    authMiddleware,
    skipPreventiveMaintenanceOccurrenceValidator,
    validateRequest,
    skipPreventiveMaintenanceOccurrenceController
);

/*
 * POST
 * /api/maintenance/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id/fail
 */
router.post(
    "/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id/fail",
    authMiddleware,
    failPreventiveMaintenanceOccurrenceValidator,
    validateRequest,
    failPreventiveMaintenanceOccurrenceController
);

/*
 * POST
 * /api/maintenance/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id/cancel
 */
router.post(
    "/preventive-plans/:preventive_plan_public_id/occurrences/:preventive_occurrence_public_id/cancel",
    authMiddleware,
    cancelPreventiveMaintenanceOccurrenceValidator,
    validateRequest,
    cancelPreventiveMaintenanceOccurrenceController
);

/*
 * =========================================================
 * SINGLE PREVENTIVE MAINTENANCE PLAN AND LIFECYCLE
 * =========================================================
 */

/*
 * GET
 * /api/maintenance/preventive-plans/:preventive_plan_public_id
 */
router.get(
    "/preventive-plans/:preventive_plan_public_id",
    authMiddleware,
    getSinglePreventiveMaintenancePlanValidator,
    validateRequest,
    getSinglePreventiveMaintenancePlanController
);

/*
 * PATCH
 * /api/maintenance/preventive-plans/:preventive_plan_public_id
 */
router.patch(
    "/preventive-plans/:preventive_plan_public_id",
    authMiddleware,
    updatePreventiveMaintenancePlanValidator,
    validateRequest,
    updatePreventiveMaintenancePlanController
);

/*
 * POST
 * /api/maintenance/preventive-plans/:preventive_plan_public_id/pause
 */
router.post(
    "/preventive-plans/:preventive_plan_public_id/pause",
    authMiddleware,
    pausePreventiveMaintenancePlanValidator,
    validateRequest,
    pausePreventiveMaintenancePlanController
);

/*
 * POST
 * /api/maintenance/preventive-plans/:preventive_plan_public_id/resume
 */
router.post(
    "/preventive-plans/:preventive_plan_public_id/resume",
    authMiddleware,
    resumePreventiveMaintenancePlanValidator,
    validateRequest,
    resumePreventiveMaintenancePlanController
);

/*
 * POST
 * /api/maintenance/preventive-plans/:preventive_plan_public_id/complete
 */
router.post(
    "/preventive-plans/:preventive_plan_public_id/complete",
    authMiddleware,
    completePreventiveMaintenancePlanValidator,
    validateRequest,
    completePreventiveMaintenancePlanController
);

/*
 * POST
 * /api/maintenance/preventive-plans/:preventive_plan_public_id/cancel
 */
router.post(
    "/preventive-plans/:preventive_plan_public_id/cancel",
    authMiddleware,
    cancelPreventiveMaintenancePlanValidator,
    validateRequest,
    cancelPreventiveMaintenancePlanController
);

module.exports = router;

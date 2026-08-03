const express = require("express");

const router = express.Router();

const {
    authMiddleware
} = require(
    "../middleware/authMiddleware"
);

const validateRequest = require(
    "../middleware/validateRequest"
);

const {
    getReceiptValidator,
    verifyReceiptPdfValidator,
    verifyReceiptLifecyclePdfValidator
} = require(
    "../validators/receiptValidator"
);

const {
    getReceiptController,
    getReceiptPdfController,
    getVerifiedReceiptPdfController,
    getVerifiedReceiptLifecyclePdfController
} = require(
    "../controllers/receiptController"
);

/*
 * Public lifecycle-aware signed QR verification route.
 * This specific route must remain before the legacy and
 * authenticated receipt routes.
 *
 * The HMAC token is the authorization mechanism, so
 * authMiddleware must not be added here. The lifecycle
 * version changes the public PDF URL whenever the receipt
 * state changes, including payment reversal.
 *
 * GET /api/receipts/:receipt_number/verify/:verification_token/state/:lifecycle_version
 */
router.get(
    "/:receipt_number/verify/:verification_token/state/:lifecycle_version",
    verifyReceiptLifecyclePdfValidator,
    validateRequest,
    getVerifiedReceiptLifecyclePdfController
);

/*
 * Public legacy signed QR verification route.
 * Retained for QR codes generated before lifecycle-aware
 * verification URLs were introduced.
 *
 * The HMAC token is the authorization mechanism, so
 * authMiddleware must not be added here.
 *
 * GET /api/receipts/:receipt_number/verify/:verification_token
 */
router.get(
    "/:receipt_number/verify/:verification_token",
    verifyReceiptPdfValidator,
    validateRequest,
    getVerifiedReceiptPdfController
);

/*
 * GET /api/receipts/:receipt_number/pdf
 */
router.get(
    "/:receipt_number/pdf",
    authMiddleware,
    getReceiptValidator,
    validateRequest,
    getReceiptPdfController
);

/*
 * GET /api/receipts/:receipt_number
 */
router.get(
    "/:receipt_number",
    authMiddleware,
    getReceiptValidator,
    validateRequest,
    getReceiptController
);

module.exports = router;

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
    verifyReceiptPdfValidator
} = require(
    "../validators/receiptValidator"
);

const {
    getReceiptController,
    getReceiptPdfController,
    getVerifiedReceiptPdfController
} = require(
    "../controllers/receiptController"
);

/*
 * Public signed QR verification route.
 * This must remain before authenticated receipt routes.
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

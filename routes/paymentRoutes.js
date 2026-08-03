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
    getPaymentsValidator,
    getSinglePaymentValidator,
    reverseRentPaymentValidator
} = require(
    "../validators/paymentValidator"
);

const {
    getPaymentsController,
    getSinglePaymentController,
    reverseRentPaymentController
} = require(
    "../controllers/paymentController"
);

/*
 * GET /api/payments
 */
router.get(
    "/",
    authMiddleware,
    getPaymentsValidator,
    validateRequest,
    getPaymentsController
);

/*
 * GET /api/payments/:payment_public_id
 */
router.get(
    "/:payment_public_id",
    authMiddleware,
    getSinglePaymentValidator,
    validateRequest,
    getSinglePaymentController
);

/*
 * PATCH /api/payments/:payment_public_id/reverse
 */
router.patch(
    "/:payment_public_id/reverse",
    authMiddleware,
    reverseRentPaymentValidator,
    validateRequest,
    reverseRentPaymentController
);

module.exports = router;

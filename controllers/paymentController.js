const asyncHandler = require(
    "../utils/asyncHandler"
);

const AppError = require(
    "../utils/AppError"
);

const {
    getPayments,
    getSinglePayment,
    reverseRentPayment,
    recordRentPayment
} = require(
    "../services/paymentService"
);

/*
 * GET /api/payments
 */
const getPaymentsController =
    asyncHandler(
        async (req, res, next) => {
            const result = await getPayments({
                queryData: req.query,
                authenticatedUser: req.user
            });

            if (result.forbidden) {
                return next(
                    new AppError(
                        "You are not authorized to view rent payments.",
                        403
                    )
                );
            }

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Rent payments retrieved successfully.",
                    data: {
                        payments:
                            result.payments,
                        pagination:
                            result.pagination
                    }
                });
        }
    );

/*
 * GET /api/payments/:payment_public_id
 */
const getSinglePaymentController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getSinglePayment({
                    paymentPublicId:
                        req.params
                            .payment_public_id,

                    authenticatedUser:
                        req.user
                });

            if (result.paymentNotFound) {
                return next(
                    new AppError(
                        "Payment not found.",
                        404
                    )
                );
            }

            if (result.forbidden) {
                return next(
                    new AppError(
                        "You are not authorized to view this rent payment.",
                        403
                    )
                );
            }

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Rent payment retrieved successfully.",
                    data: {
                        payment:
                            result.payment
                    }
                });
        }
    );

/*
 * PATCH /api/payments/:payment_public_id/reverse
 */
const reverseRentPaymentController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await reverseRentPayment({
                        paymentPublicId:
                            req.params
                                .payment_public_id,

                        reversalData:
                            req.body,

                        authenticatedUser:
                            req.user
                    });

                if (result.paymentNotFound) {
                    return next(
                        new AppError(
                            "Payment not found.",
                            404
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to reverse this rent payment.",
                            403
                        )
                    );
                }

                if (
                    result.paymentAlreadyReversed
                ) {
                    return next(
                        new AppError(
                            "The selected payment has already been reversed.",
                            409
                        )
                    );
                }

                if (
                    result.paymentNotReversible
                ) {
                    return next(
                        new AppError(
                            "The selected payment is not eligible for reversal.",
                            409
                        )
                    );
                }

                if (
                    result.invalidReversalReason
                ) {
                    return next(
                        new AppError(
                            "A valid reversal reason of at most 1000 characters is required.",
                            422
                        )
                    );
                }

                if (
                    result.relationshipConflict
                ) {
                    return next(
                        new AppError(
                            "The payment does not have valid invoice allocations for reversal.",
                            409
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Rent payment reversed successfully.",
                        data: {
                            payment:
                                result.payment,
                            owner:
                                result.owner,
                            tenant:
                                result.tenant
                        }
                    });
            } catch (error) {
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The payment reversal violates a business rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The payment reversal references a related record that is no longer available.",
                            409
                        )
                    );
                }

                if (error.code === "P0001") {
                    return next(
                        new AppError(
                            error.message ||
                                "The payment reversal violates a business integrity rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );

/*
 * POST /api/invoices/:invoice_public_id/payments
 */
const recordRentPaymentController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await recordRentPayment({
                        invoicePublicId:
                            req.params
                                .invoice_public_id,

                        paymentData:
                            req.body,

                        authenticatedUser:
                            req.user
                    });

                if (result.invoiceNotFound) {
                    return next(
                        new AppError(
                            "Invoice not found.",
                            404
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to record payments for this invoice.",
                            403
                        )
                    );
                }

                if (result.invoiceNotEligible) {
                    return next(
                        new AppError(
                            "The selected invoice is not eligible to receive a payment.",
                            409
                        )
                    );
                }

                if (result.invalidAmount) {
                    return next(
                        new AppError(
                            "A valid positive payment amount is required.",
                            422
                        )
                    );
                }

                if (result.overpayment) {
                    return next(
                        new AppError(
                            "Payment amount cannot exceed the invoice balance.",
                            409
                        )
                    );
                }

                if (
                    result.invalidPaymentMethod
                ) {
                    return next(
                        new AppError(
                            "A valid payment method is required.",
                            422
                        )
                    );
                }

                if (
                    result
                        .invalidTransactionReference
                ) {
                    return next(
                        new AppError(
                            "A valid transaction reference is required for the selected payment method.",
                            422
                        )
                    );
                }

                if (result.invalidPaidAt) {
                    return next(
                        new AppError(
                            "Payment date and time must be valid, cannot be before invoice issuance and cannot be in the future.",
                            422
                        )
                    );
                }

                if (result.invalidNotes) {
                    return next(
                        new AppError(
                            "Payment notes cannot exceed 1000 characters.",
                            422
                        )
                    );
                }

                if (
                    result.relationshipConflict
                ) {
                    return next(
                        new AppError(
                            "The invoice relationships are not valid for payment recording.",
                            409
                        )
                    );
                }

                return res
                    .status(201)
                    .json({
                        success: true,
                        message:
                            "Rent payment recorded successfully.",
                        data: {
                            payment:
                                result.payment,
                            invoice:
                                result.invoice,
                            owner:
                                result.owner,
                            tenant:
                                result.tenant
                        }
                    });
            } catch (error) {
                /*
                 * Duplicate external transaction
                 * reference.
                 */
                if (
                    error.code === "23505" &&
                    error.constraint ===
                        "uq_rent_payments_method_reference_ci"
                ) {
                    return next(
                        new AppError(
                            "The supplied transaction reference has already been recorded for this payment method.",
                            409
                        )
                    );
                }

                /*
                 * Generated payment, receipt or
                 * allocation identifier conflict.
                 */
                if (error.code === "23505") {
                    return next(
                        new AppError(
                            "The generated payment or receipt identifier conflicts with an existing record. Please try again.",
                            409
                        )
                    );
                }

                /*
                 * Database CHECK constraint
                 * violation.
                 */
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The supplied payment violates a business rule.",
                            422
                        )
                    );
                }

                /*
                 * Foreign-key integrity conflict.
                 */
                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The payment references a related record that is no longer available.",
                            409
                        )
                    );
                }

                /*
                 * Controlled database-integrity
                 * trigger exception.
                 */
                if (error.code === "P0001") {
                    return next(
                        new AppError(
                            error.message ||
                                "The payment violates a business integrity rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );

module.exports = {
    getPaymentsController,
    getSinglePaymentController,
    reverseRentPaymentController,
    recordRentPaymentController
};

const asyncHandler = require(
    "../utils/asyncHandler"
);

const AppError = require(
    "../utils/AppError"
);

const {
    getReceipt,
    getVerifiedReceipt
} = require(
    "../services/receiptService"
);

const {
    generateReceiptPdf
} = require(
    "../services/receiptPdfService"
);

/*
 * GET /api/receipts/:receipt_number
 */
const getReceiptController =
    asyncHandler(
        async (req, res, next) => {
            const result = await getReceipt({
                receiptNumber:
                    req.params.receipt_number,
                authenticatedUser:
                    req.user
            });

            if (result.receiptNotFound) {
                return next(
                    new AppError(
                        "Receipt not found.",
                        404
                    )
                );
            }

            if (result.forbidden) {
                return next(
                    new AppError(
                        "You are not authorized to view this rent receipt.",
                        403
                    )
                );
            }

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Rent receipt retrieved successfully.",
                    data: {
                        receipt:
                            result.receipt
                    }
                });
        }
    );

/*
 * GET /api/receipts/:receipt_number/pdf
 */
const getReceiptPdfController =
    asyncHandler(
        async (req, res, next) => {
            const result = await getReceipt({
                receiptNumber:
                    req.params.receipt_number,
                authenticatedUser:
                    req.user
            });

            if (result.receiptNotFound) {
                return next(
                    new AppError(
                        "Receipt not found.",
                        404
                    )
                );
            }

            if (result.forbidden) {
                return next(
                    new AppError(
                        "You are not authorized to download this rent receipt.",
                        403
                    )
                );
            }

            const pdfBuffer =
                await generateReceiptPdf(
                    result.receipt
                );

            const fileName =
                `${result.receipt.receipt_number}.pdf`;

            return res
                .status(200)
                .set({
                    "Content-Type":
                        "application/pdf",
                    "Content-Disposition":
                        `attachment; filename="${fileName}"`,
                    "Content-Length":
                        pdfBuffer.length,
                    "Cache-Control":
                        "private, no-store"
                })
                .send(pdfBuffer);
        }
    );

/*
 * GET /api/receipts/:receipt_number/verify/:verification_token
 *
 * Public legacy endpoint used by previously generated QR
 * URLs. The same generic response is used for an invalid
 * token and a missing receipt to avoid exposing existence.
 */
const getVerifiedReceiptPdfController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getVerifiedReceipt({
                    receiptNumber:
                        req.params
                            .receipt_number,
                    verificationToken:
                        req.params
                            .verification_token
                });

            if (
                result
                    .invalidVerificationToken ||
                result.receiptNotFound
            ) {
                return next(
                    new AppError(
                        "Receipt verification link is invalid.",
                        404
                    )
                );
            }

            const pdfBuffer =
                await generateReceiptPdf(
                    result.receipt
                );

            const fileName =
                `${result.receipt.receipt_number}.pdf`;

            return res
                .status(200)
                .set({
                    "Content-Type":
                        "application/pdf",
                    "Content-Disposition":
                        `inline; filename="${fileName}"`,
                    "Content-Length":
                        pdfBuffer.length,
                    "Cache-Control":
                        "no-store"
                })
                .send(pdfBuffer);
        }
    );

/*
 * GET /api/receipts/:receipt_number/verify/:verification_token/state/:lifecycle_version
 *
 * Public lifecycle-aware QR endpoint. The lifecycle state
 * segment changes the URL after a payment reversal, while
 * the signed token remains the authorization mechanism.
 * The PDF is always regenerated from the current database
 * receipt state.
 */
const getVerifiedReceiptLifecyclePdfController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getVerifiedReceipt({
                    receiptNumber:
                        req.params
                            .receipt_number,
                    verificationToken:
                        req.params
                            .verification_token
                });

            if (
                result
                    .invalidVerificationToken ||
                result.receiptNotFound
            ) {
                return next(
                    new AppError(
                        "Receipt verification link is invalid.",
                        404
                    )
                );
            }

            const pdfBuffer =
                await generateReceiptPdf(
                    result.receipt
                );

            const fileName =
                `${result.receipt.receipt_number}.pdf`;

            return res
                .status(200)
                .set({
                    "Content-Type":
                        "application/pdf",
                    "Content-Disposition":
                        `inline; filename="${fileName}"`,
                    "Content-Length":
                        pdfBuffer.length,
                    "Cache-Control":
                        "no-store"
                })
                .send(pdfBuffer);
        }
    );

module.exports = {
    getReceiptController,
    getReceiptPdfController,
    getVerifiedReceiptPdfController,
    getVerifiedReceiptLifecyclePdfController
};

const {
    body,
    query,
    param
} = require("express-validator");

/*
 * GET /api/receipts/:receipt_number
 */
const getReceiptValidator = [

    /*
     * Query parameters are not accepted.
     */
    query()
        .custom(value => {
            const suppliedFields =
                Object.keys(value || {});

            if (suppliedFields.length > 0) {
                throw new Error(
                    `Unsupported query parameters: ${suppliedFields.join(", ")}.`
                );
            }

            return true;
        }),

    /*
     * Permanent receipt identifier generated when
     * the payment was recorded.
     */
    param("receipt_number")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Receipt number is required."
        )

        .isString()
        .withMessage(
            "Receipt number must be a string."
        )

        .trim()

        .notEmpty()
        .withMessage(
            "Receipt number cannot be empty."
        )

        .isLength({
            max: 50
        })
        .withMessage(
            "Receipt number cannot exceed 50 characters."
        )

        .matches(
            /^[A-Za-z0-9_-]+$/
        )
        .withMessage(
            "Invalid receipt number format."
        ),

    /*
     * GET operation does not accept request-body
     * fields.
     */
    body()
        .custom(value => {
            if (
                value === undefined ||
                value === null
            ) {
                return true;
            }

            if (
                typeof value !== "object" ||
                Array.isArray(value) ||
                Object.keys(value).length > 0
            ) {
                throw new Error(
                    "Request body is not allowed for this operation."
                );
            }

            return true;
        })
];

/*
 * GET /api/receipts/:receipt_number/verify/:verification_token
 *
 * The receipt-number, query and body rules remain
 * identical to the authenticated receipt endpoints.
 * The signed verification token permits public access
 * only to the exact receipt encoded in the QR URL.
 */
const verifyReceiptPdfValidator = [
    ...getReceiptValidator,

    param("verification_token")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Receipt verification token is required."
        )

        .isString()
        .withMessage(
            "Receipt verification token must be a string."
        )

        .trim()

        .matches(/^[a-fA-F0-9]{64}$/)
        .withMessage(
            "Invalid receipt verification token format."
        )
];

module.exports = {
    getReceiptValidator,
    verifyReceiptPdfValidator
};

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
 * Legacy permanent verification route retained for
 * QR codes generated before lifecycle-aware URLs.
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

/*
 * GET /api/receipts/:receipt_number/verify/:verification_token/state/:lifecycle_version
 *
 * Lifecycle-aware QR route. The signed verification
 * token remains the authorization mechanism. The state
 * segment changes whenever the receipt lifecycle changes,
 * preventing a valid PDF URL from being reused after a
 * payment reversal.
 */
const verifyReceiptLifecyclePdfValidator = [
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
        ),

    param("lifecycle_version")
        .exists({
            checkFalsy: true
        })
        .withMessage(
            "Receipt lifecycle version is required."
        )

        .isString()
        .withMessage(
            "Receipt lifecycle version must be a string."
        )

        .trim()

        .matches(
            /^state-[a-z0-9_-]{1,30}-[a-fA-F0-9]{16}$/
        )
        .withMessage(
            "Invalid receipt lifecycle version format."
        )
];

module.exports = {
    getReceiptValidator,
    verifyReceiptPdfValidator,
    verifyReceiptLifecyclePdfValidator
};

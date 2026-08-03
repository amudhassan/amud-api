const crypto = require("crypto");

const normalizeReceiptNumber = receiptNumber =>
    String(receiptNumber).trim().toLowerCase();

const getVerificationSecret = () => {
    const secret =
        process.env.RECEIPT_QR_SECRET;

    if (
        typeof secret !== "string" ||
        secret.trim().length < 32
    ) {
        const error = new Error(
            "Receipt QR verification secret is not configured securely."
        );

        error.code =
            "RECEIPT_QR_CONFIGURATION_ERROR";

        throw error;
    }

    return secret.trim();
};

const getApplicationBaseUrl = () => {
    const baseUrl =
        typeof process.env.APP_BASE_URL ===
            "string"
            ? process.env.APP_BASE_URL
                .trim()
                .replace(/\/+$/, "")
            : "";

    if (!/^https?:\/\/[^\s]+$/i.test(baseUrl)) {
        const error = new Error(
            "Application base URL is not configured correctly."
        );

        error.code =
            "RECEIPT_QR_CONFIGURATION_ERROR";

        throw error;
    }

    return baseUrl;
};

/**
 * Create a permanent HMAC verification token for
 * a receipt number. The receipt number itself is
 * not secret, but the signature cannot be forged.
 */
const createReceiptVerificationToken =
    receiptNumber =>
        crypto
            .createHmac(
                "sha256",
                getVerificationSecret()
            )
            .update(
                `rent-receipt:v1:${normalizeReceiptNumber(
                    receiptNumber
                )}`
            )
            .digest("hex");

const verifyReceiptVerificationToken = ({
    receiptNumber,
    verificationToken
}) => {
    if (
        typeof verificationToken !== "string" ||
        !/^[a-f0-9]{64}$/i.test(
            verificationToken
        )
    ) {
        return false;
    }

    const expectedToken =
        createReceiptVerificationToken(
            receiptNumber
        );

    const suppliedBuffer = Buffer.from(
        verificationToken.toLowerCase(),
        "hex"
    );

    const expectedBuffer = Buffer.from(
        expectedToken,
        "hex"
    );

    return (
        suppliedBuffer.length ===
            expectedBuffer.length &&
        crypto.timingSafeEqual(
            suppliedBuffer,
            expectedBuffer
        )
    );
};

const buildReceiptVerificationUrl =
    receiptNumber => {
        const token =
            createReceiptVerificationToken(
                receiptNumber
            );

        return `${getApplicationBaseUrl()}/api/receipts/${encodeURIComponent(
            receiptNumber
        )}/verify/${token}`;
    };

module.exports = {
    buildReceiptVerificationUrl,
    verifyReceiptVerificationToken
};

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

/*
 * Produce a deterministic, non-secret cache version
 * from the current receipt lifecycle state.
 *
 * The HMAC token remains the authorization mechanism.
 * This version only ensures that a reversed receipt uses
 * a different public PDF URL from its previous valid state.
 */
const createReceiptLifecycleVersion = ({
    receiptStatus,
    updatedAt
}) => {
    const normalizedStatus =
        String(receiptStatus || "current")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "-")
            .slice(0, 30) || "current";

    const normalizedUpdatedAt =
        updatedAt instanceof Date
            ? updatedAt.toISOString()
            : String(updatedAt || "unknown")
                .trim();

    const stateDigest = crypto
        .createHash("sha256")
        .update(
            `${normalizedStatus}:${normalizedUpdatedAt}`
        )
        .digest("hex")
        .slice(0, 16);

    return `state-${normalizedStatus}-${stateDigest}`;
};

const buildReceiptVerificationUrl =
    (
        receiptNumber,
        lifecycleState = null
    ) => {
        const token =
            createReceiptVerificationToken(
                receiptNumber
            );

        const legacyVerificationUrl =
            `${getApplicationBaseUrl()}/api/receipts/${encodeURIComponent(
            receiptNumber
        )}/verify/${token}`;

        if (
            lifecycleState === null ||
            typeof lifecycleState !== "object" ||
            Array.isArray(lifecycleState)
        ) {
            return legacyVerificationUrl;
        }

        const lifecycleVersion =
            createReceiptLifecycleVersion(
                lifecycleState
            );

        return `${legacyVerificationUrl}/state/${lifecycleVersion}`;
    };

module.exports = {
    buildReceiptVerificationUrl,
    verifyReceiptVerificationToken
};

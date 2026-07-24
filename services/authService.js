const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const {
     generateResetToken,
    generateRefreshToken
 } = require("../utils/token");

const createPasswordResetToken = async (email) => {

    const result = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const user = result.rows[0];

    const { resetToken, hashedToken } = generateResetToken();

    const expiresAt = new Date(
        Date.now() +
        Number(process.env.RESET_TOKEN_EXPIRES_MINUTES) * 60 * 1000
    );

    await pool.query(
        `UPDATE users
         SET reset_token = $1,
             reset_token_expires = $2
         WHERE public_id = $3`,
        [
            hashedToken,
            expiresAt,
            user.public_id
        ]
    );

    return {
        resetToken,
        expiresAt,
        user
    };
};

const bcrypt = require("bcrypt");
const crypto = require("crypto");

const resetUserPassword = async (resetToken, newPassword) => {

    const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    const result = await pool.query(
        `SELECT *
         FROM users
         WHERE reset_token = $1
         AND reset_token_expires > NOW()`,
        [hashedToken]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const user = result.rows[0];

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
        `UPDATE users
         SET password = $1,
             reset_token = NULL,
             reset_token_expires = NULL
         WHERE public_id = $2`,
        [
            hashedPassword,
            user.public_id
        ]
    );

    return user;
};

const saveRefreshToken = async (public_id, refreshToken) => {

    const hashedRefreshToken = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

    const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_SECRET
    );

    const expiresAt = new Date(decoded.exp * 1000);

    await pool.query(
        `INSERT INTO refresh_tokens
        (
            user_public_id,
            token_hash,
            expires_at
        )
        VALUES ($1,$2,$3)`,
        [
            public_id,
            hashedRefreshToken,
            expiresAt
        ]
    );

};

const verifyRefreshToken = async (refreshToken) => {

    try {

        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_SECRET
        );

        const hashedRefreshToken = crypto
            .createHash("sha256")
            .update(refreshToken)
            .digest("hex");

        const result = await pool.query(
    `SELECT u.*
     FROM refresh_tokens rt
     JOIN users u
       ON rt.user_public_id = u.public_id
     WHERE rt.user_public_id = $1
       AND rt.token_hash = $2
       AND rt.revoked_at IS NULL
       AND rt.expires_at > NOW()`,
    [
        decoded.public_id,
        hashedRefreshToken
    ]
);

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];

    } catch (error) {

        return null;

    }

};

const rotateRefreshToken = async (oldRefreshToken) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const decoded = jwt.verify(
            oldRefreshToken,
            process.env.JWT_SECRET
        );

        const oldTokenHash = crypto
            .createHash("sha256")
            .update(oldRefreshToken)
            .digest("hex");

        const userResult = await client.query(
            `SELECT u.*
             FROM refresh_tokens rt
             JOIN users u
               ON rt.user_public_id = u.public_id
             WHERE rt.user_public_id = $1
               AND rt.token_hash = $2
               AND rt.revoked_at IS NULL
               AND rt.expires_at > NOW()
             FOR UPDATE`,
            [
                decoded.public_id,
                oldTokenHash
            ]
        );

        if (userResult.rows.length === 0) {
            throw new Error("Invalid refresh token");
        }

        const user = userResult.rows[0];

        await client.query(
            `UPDATE refresh_tokens
             SET revoked_at = NOW()
             WHERE token_hash = $1`,
            [oldTokenHash]
        );

        const newRefreshToken = generateRefreshToken(user);

        const newTokenHash = crypto
            .createHash("sha256")
            .update(newRefreshToken)
            .digest("hex");

        const decodedNew = jwt.verify(
            newRefreshToken,
            process.env.JWT_SECRET
        );

        await client.query(
            `INSERT INTO refresh_tokens
            (
                user_public_id,
                token_hash,
                expires_at
            )
            VALUES ($1,$2,$3)`,
            [
                user.public_id,
                newTokenHash,
                new Date(decodedNew.exp * 1000)
            ]
        );

        await client.query("COMMIT");

        return {
            user,
            newRefreshToken
        };

    } catch (error) {

        await client.query("ROLLBACK");
        throw error;

    } finally {

        client.release();

    }

};

const logoutUser = async (public_id, refreshToken) => {

    const hashedRefreshToken = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

    const result = await pool.query(
        `UPDATE refresh_tokens
         SET revoked_at = NOW()
         WHERE user_public_id = $1
           AND token_hash = $2
           AND revoked_at IS NULL
         RETURNING id`,
        [
            public_id,
            hashedRefreshToken
        ]
    );

    return result.rows.length > 0;

};


const createEmailVerificationToken = async (email) => {

    const result = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const user = result.rows[0];

    if (user.is_verified) {
        return {
            alreadyVerified: true,
            user
        };
    }

   const verificationToken = crypto
    .randomBytes(32)
    .toString("hex");

const hashedVerificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

    const expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
    );

    await pool.query(
        `UPDATE users
         SET email_verification_token = $1,
             email_verification_expires = $2
         WHERE public_id = $3`,
        [
            hashedVerificationToken,
            expiresAt,
            user.public_id
        ]
    );

    return {
        verificationToken,
        expiresAt,
        user
    };

};

module.exports = {
    createPasswordResetToken,
    resetUserPassword,
    saveRefreshToken,
    verifyRefreshToken,
    rotateRefreshToken,
    logoutUser,
    createEmailVerificationToken
};
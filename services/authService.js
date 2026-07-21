const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const { generateResetToken } = require("../utils/token");

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

    await pool.query(
        `UPDATE users
         SET refresh_token = $1
         WHERE public_id = $2`,
        [
            refreshToken,
            public_id
        ]
    );

};

const verifyRefreshToken = async (refreshToken) => {

    try {

        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_SECRET
        );

        const result = await pool.query(
            `SELECT *
             FROM users
             WHERE public_id = $1
             AND refresh_token = $2`,
            [
                decoded.public_id,
                refreshToken
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

const logoutUser = async (public_id) => {

    await pool.query(
        `UPDATE users
         SET refresh_token = NULL
         WHERE public_id = $1`,
        [public_id]
    );

};

module.exports = {
    createPasswordResetToken,
    resetUserPassword,
    saveRefreshToken,
    verifyRefreshToken,
    logoutUser
};
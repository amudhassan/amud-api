const pool = require("../config/db");
const bcrypt = require("bcrypt");
const { nanoid } = require("nanoid");
const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const {generateAccessToken, generateRefreshToken, generateResetToken} = require("../utils/token");
const {createPasswordResetToken, resetUserPassword, saveRefreshToken, verifyRefreshToken, logoutUser} = require("../services/authService");
const crypto = require("crypto");

const registerUser = asyncHandler(async (req, res, next) => {

    const { full_name, email, password, role } = req.body;

    const existingUser = await pool.query(
        "SELECT email FROM users WHERE email = $1",
        [email]
    );

    if (existingUser.rows.length > 0) {
        return next(
            new AppError("Email already exists", 400)
        );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const public_id = nanoid(30);

    const result = await pool.query(
        `INSERT INTO users
        (public_id, full_name, email, password, role)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING
            public_id,
            full_name,
            email,
            role`,
        [
            public_id,
            full_name,
            email,
            hashedPassword,
            role
        ]
    );

    return res.status(201).json({
        success: true,
        message: "User registered successfully",
        user: result.rows[0]
    });

});

const loginUser = asyncHandler(async (req, res, next) => {

    const { email, password } = req.body;

    const result = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
    );

    if (result.rows.length === 0) {
        return next(
            new AppError("Invalid email or password", 401)
        );
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(
        password,
        user.password
    );

    if (!isMatch) {
        return next(
            new AppError("Invalid email or password", 401)
        );
    }

    const accessToken = generateAccessToken(user);

    const refreshToken = generateRefreshToken(user);

    await saveRefreshToken(
        user.public_id,
        refreshToken
    );

    return res.status(200).json({
        success: true,
        message: "Login successful",
        accessToken,
        refreshToken,
        user: {
            public_id: user.public_id,
            full_name: user.full_name,
            email: user.email,
            role: user.role
        }
    });

});

const getProfile = async (req, res) => {

    return res.status(200).json({
        success: true,
        message: "Profile loaded successfully",
        user: req.user
    });

};
const changePassword = asyncHandler(async (req, res, next) => {

    const { currentPassword, newPassword } = req.body;

    const result = await pool.query(
        "SELECT * FROM users WHERE public_id = $1",
        [req.user.public_id]
    );

    if (result.rows.length === 0) {
        return next(
            new AppError("User not found", 404)
        );
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(
        currentPassword,
        user.password
    );

    if (!isMatch) {
        return next(
            new AppError("Current password is incorrect", 400)
        );
    }

    const hashedPassword = await bcrypt.hash(
        newPassword,
        10
    );

    await pool.query(
        "UPDATE users SET password = $1 WHERE public_id = $2",
        [
            hashedPassword,
            req.user.public_id
        ]
    );

    return res.status(200).json({
        success: true,
        message: "Password changed successfully"
    });

});

const forgotPassword = asyncHandler(async (req, res, next) => {

    const { email } = req.body;

    if (!email) {
        return next(
            new AppError("Email is required", 400)
        );
    }

    const result = await createPasswordResetToken(email);

    if (!result) {
        return next(
            new AppError("User not found", 404)
        );
    }

    return res.status(200).json({
        success: true,
        message: "Password reset token generated successfully",
        resetToken: result.resetToken,
        expiresAt: result.expiresAt
    });

});

const resetPassword = asyncHandler(async (req, res, next) => {

    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
        return next(
            new AppError(
                "Reset token and new password are required",
                400
            )
        );
    }

    const user = await resetUserPassword(
        resetToken,
        newPassword
    );

    if (!user) {
        return next(
            new AppError(
                "Invalid or expired reset token",
                400
            )
        );
    }

    return res.status(200).json({
        success: true,
        message: "Password reset successfully"
    });

});

const refreshToken = asyncHandler(async (req, res, next) => {

    const { refreshToken } = req.body;

    if (!refreshToken) {
        return next(
            new AppError("Refresh token is required", 400)
        );
    }

    const user = await verifyRefreshToken(refreshToken);

    if (!user) {
        return next(
            new AppError("Invalid or expired refresh token", 401)
        );
    }

    const accessToken = generateAccessToken(user);

    return res.status(200).json({
        success: true,
        message: "Access token refreshed successfully",
        accessToken
    });

});

const logout = asyncHandler(async (req, res) => {

    await logoutUser(req.user.public_id);

    return res.status(200).json({
        success: true,
        message: "Logout successful"
    });

});

module.exports = { 
    registerUser,
    loginUser,
    getProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    refreshToken,
    logout
 };
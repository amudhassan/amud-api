const pool = require("../config/db");
const bcrypt = require("bcrypt");
const { nanoid } = require("nanoid");
const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const {generateAccessToken, 
    generateRefreshToken, 
    generateResetToken
} = require("../utils/token");
const {createPasswordResetToken,
     resetUserPassword, 
     saveRefreshToken, 
     verifyRefreshToken,
      logoutUser,
      createEmailVerificationToken,
      rotateRefreshToken
    } = require("../services/authService");

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

    const emailVerificationToken = crypto
        .randomBytes(32)
        .toString("hex");

        const hashedEmailVerificationToken = crypto
    .createHash("sha256")
    .update(emailVerificationToken)
    .digest("hex");

    const emailVerificationExpires =
        new Date(Date.now() + 24 * 60 * 60 * 1000);

        

    const result = await pool.query(
        `INSERT INTO users
        (
            public_id,
            full_name,
            email,
            password,
            role,
            email_verification_token,
            email_verification_expires
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING
            public_id,
            full_name,
            email,
            role,
            is_verified`,
        [
            public_id,
            full_name,
            email,
            hashedPassword,
            role,
            hashedEmailVerificationToken,
            emailVerificationExpires
        ]
    );

await sendVerificationEmail(
    email,
    emailVerificationToken,
    "register"
);

    return res.status(201).json({
        success: true,
        message: "User registered successfully. Please verify your email.",
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

    if (!user.is_verified) {
    return next(
        new AppError(
            "Please verify your email before logging in.",
            403
        )
    );
}

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

    const genericResponse = {
    success: true,
    message:
        "If an account with that email exists, a password reset link has been sent."
};

if (!result) {
    return res.status(200).json(genericResponse);
}
   await sendPasswordResetEmail(
    result.user.email,
    result.resetToken
   );

   return res.status(200).json(genericResponse);

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

    try {

        const {
            user,
            newRefreshToken
        } = await rotateRefreshToken(refreshToken);

        const accessToken = generateAccessToken(user);

        return res.status(200).json({
            success: true,
            message: "Access token refreshed successfully",
            accessToken,
            refreshToken: newRefreshToken
        });

    } catch (error) {

        return next(
            new AppError(
                "Invalid or expired refresh token",
                401
            )
        );

    }

});

const logout = asyncHandler(async (req, res, next) => {

    const { refreshToken } = req.body;

    if (!refreshToken) {
        return next(
            new AppError(
                "Refresh token is required",
                400
            )
        );
    }

    const revoked = await logoutUser(
        req.user.public_id,
        refreshToken
    );

    if (!revoked) {
        return next(
            new AppError(
                "Invalid or already revoked refresh token",
                401
            )
        );
    }

    return res.status(200).json({
        success: true,
        message: "Logout successful"
    });

});

const verifyEmail = asyncHandler(async (req, res, next) => {

    const { token } = req.query;
    const hashedVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

    if (!token) {
        return next(
            new AppError("Verification token is required", 400)
        );
    }

    const result = await pool.query(
        `
        SELECT *
        FROM users
        WHERE email_verification_token = $1
        AND email_verification_expires > NOW()
        `,
        [hashedVerificationToken]
    );

    if (result.rows.length === 0) {
        return next(
            new AppError("Invalid or expired verification link", 400)
        );
    }

    await pool.query(
        `
        UPDATE users
        SET
            is_verified = TRUE,
            email_verification_token = NULL,
            email_verification_expires = NULL
        WHERE email_verification_token = $1
        `,
        [hashedVerificationToken]
    );

    return res.status(200).json({
        success: true,
        message: "Email verified successfully."
    });

});

const { sendEmail,
    sendVerificationEmail,
    sendPasswordResetEmail
 } = require("../services/emailService");

const testEmail = async (req, res) => {
    try {

        

        await sendEmail({
            to: req.body.email,
            subject: "Amud API Test Email",
            html: `
                <h2>🎉 Congratulations!</h2>
                <p>Your email service is working successfully.</p>
                <p>This email was sent from your Node.js Backend.</p>
            `
        });

        

        return res.status(200).json({
            success: true,
            message: "Email sent successfully"
        });

    } catch (error) {

       

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

const resendVerificationEmail = asyncHandler(async (req, res, next) => {

    const { email } = req.body;

    if (!email) {
        return next(
            new AppError("Email is required", 400)
        );
    }

    const result = await createEmailVerificationToken(email);

    const genericResponse = {
        success: true,
        message:
            "If the account exists and is not verified, a verification email has been sent."
    };

    if (!result || result.alreadyVerified) {
        return res.status(200).json(genericResponse);
    }

    

 await sendVerificationEmail(
    result.user.email,
    result.verificationToken,
    "resend"
);

    return res.status(200).json(genericResponse);

});

module.exports = { 
    registerUser,
    loginUser,
    getProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    refreshToken,
    logout,
    testEmail,
    verifyEmail,
    resendVerificationEmail
 };
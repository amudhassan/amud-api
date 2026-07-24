const axios = require("axios");

const sendEmail = async ({ to, subject, html }) => {

    const payload = {
        sender: {
            name: "Amud API",
            email: process.env.SENDER_EMAIL
        },
        to: [
            {
                email: to
            }
        ],
        subject,
        htmlContent: html
    };

    try {

        const response = await axios.post(
            "https://api.brevo.com/v3/smtp/email",
            payload,
            {
                headers: {
                    "accept": "application/json",
                    "content-type": "application/json",
                    "api-key": process.env.BREVO_API_KEY
                }
            }
        );

        console.log("BREVO RESPONSE:", response.data);

        return response.data;

    } catch (error) {

        console.error("BREVO ERROR:");

        if (error.response) {
            console.error(error.response.data);
        } else {
            console.error(error.message);
        }

        throw error;

    }

};

const sendVerificationEmail = async (
    email,
    verificationToken,
    messageType = "register"
) => {

    const verificationUrl =
        `${process.env.API_URL}/api/auth/verify-email?token=${verificationToken}`;

    const introMessage =
        messageType === "resend"
            ? "You requested a new email verification link."
            : "Thank you for registering.";

    await sendEmail({
        to: email,
        subject: "Verify Your Email Address",
        html: `
            <h2>Verify Your Email</h2>

            <p>${introMessage}</p>

            <p>Please verify your email by clicking the button below:</p>

            <p>
                <a href="${verificationUrl}"
                   style="
                        background:#2563eb;
                        color:#fff;
                        padding:12px 20px;
                        text-decoration:none;
                        border-radius:6px;
                        display:inline-block;
                   ">
                    Verify Email
                </a>
            </p>

            <p>This link will expire after 24 hours.</p>

            <p>If you did not request this email, you can safely ignore it.</p>
        `
    });

};

const sendPasswordResetEmail = async (
    email,
    resetToken
) => {

    const resetUrl =
    `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await sendEmail({
        to: email,
        subject: "Reset Your Password",
        html: `
            <h2>Password Reset Request</h2>

            <p>We received a request to reset your password.</p>

            <p>
                Click the button below to reset your password:
            </p>

            <p>
                <a href="${resetUrl}">
                    Reset Password
                </a>
            </p>

            <p>
                This link expires in
                ${process.env.RESET_TOKEN_EXPIRES_MINUTES} minutes.
            </p>

            <p>
                If you didn't request this, you can ignore this email.
            </p>
        `
});
};

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendPasswordResetEmail
};
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const generateResetToken = () => {

    // Original token ambayo itatumwa kwa user kupitia email
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Hash itakayohifadhiwa kwenye database
    const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    return {
        resetToken,
        hashedToken
    };
};


const generateAccessToken = (user) => {

    return jwt.sign(
        {
            public_id: user.public_id,
            email: user.email,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRES
        }
    );

};

const generateRefreshToken = (user) => {

    return jwt.sign(
        {
            public_id: user.public_id
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRES
        }
    );

};

module.exports = {
    generateResetToken,
    generateAccessToken,
    generateRefreshToken
};
require("dotenv").config();
const jwt = require("jsonwebtoken");
const {
    generateAccessToken,
    generateRefreshToken,
    generateResetToken
} = require("../utils/token");
const crypto = require("crypto");

describe("Token Utility", () => {

    test("Should generate a valid access token", () => {

        const user = {
            public_id: "FQgdyx3KrpqsVFx_tiBtqSn42UpiL4",
            email: "amud@test.com",
            role: "admin"
        };

        const token = generateAccessToken(user);

        expect(token).toBeDefined();

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        expect(decoded.public_id).toBe(user.public_id);
        expect(decoded.email).toBe(user.email);
        expect(decoded.role).toBe(user.role);

    });

    test("Should generate a valid refresh token", () => {

    const user = {
        public_id: "123456"
    };

    const token = generateRefreshToken(user);

    expect(token).toBeDefined();

    const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
    );

    expect(decoded.public_id).toBe(user.public_id);

});

test("Should generate reset token and hashed token", () => {

    const {
        resetToken,
        hashedToken
    } = generateResetToken();

    expect(resetToken).toBeDefined();
    expect(hashedToken).toBeDefined();

    expect(resetToken).not.toBe(hashedToken);

    const expectedHash = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    expect(hashedToken).toBe(expectedHash);

});

});
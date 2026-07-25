const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const AppError = require("../utils/AppError");

const authMiddleware = async (req, res, next) => {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next(
            new AppError(
                "Access denied. No token provided.",
                401
            )
        );
    }

    const token = authHeader.split(" ")[1];

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const result = await pool.query(
            `
            SELECT
                public_id,
                full_name,
                email,
                role,
                is_verified,
                deleted_at,
                profile_image_url
            FROM users
            WHERE public_id = $1
            `,
            [decoded.public_id]
        );

        if (result.rows.length === 0) {
            return next(
                new AppError(
                    "User not found",
                    404
                )
            );
        }

        const user = result.rows[0];

        if (user.deleted_at) {
            return next(
                new AppError(
                    "This account has been deleted. Access denied.",
                    403
                )
            );
        }

        req.user = user;

        next();

    } catch (error) {

        return next(
            new AppError(
                "Invalid or expired token.",
                403
            )
        );

    }

};

const authorizeRoles = (...roles) => {

    return (req, res, next) => {

        if (!roles.includes(req.user.role)) {

            return next(
                new AppError(
                    "Access denied.",
                    403
                )
            );

        }

        next();

    };

};

module.exports = {
    authMiddleware,
    authorizeRoles
};
const pool = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

const getAllUsers = asyncHandler(async (req, res) => {

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const search = req.query.search || "";
    const role = req.query.role || "";

    const offset = (page - 1) * limit;

    const totalResult = await pool.query(
        `
        SELECT COUNT(*)
        FROM users
        WHERE
            (full_name ILIKE $1 OR email ILIKE $1)
            AND ($2 = '' OR role = $2)
        `,
        [
            `%${search}%`,
            role
        ]
    );

    const totalUsers = parseInt(totalResult.rows[0].count);

    const result = await pool.query(
        `
        SELECT
            public_id,
            full_name,
            email,
            role,
            created_at
        FROM users
        WHERE
            (full_name ILIKE $1 OR email ILIKE $1)
            AND ($2 = '' OR role = $2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        `,
        [
            `%${search}%`,
            role,
            limit,
            offset
        ]
    );

    return res.status(200).json({
        success: true,
        page,
        limit,
        search,
        role,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
        count: result.rows.length,
        users: result.rows
    });

});
const getUserById = asyncHandler(async (req, res, next) => {

    const { public_id } = req.params;

    const result = await pool.query(
        `SELECT
            public_id,
            full_name,
            email,
            role,
            created_at
         FROM users
         WHERE public_id = $1`,
        [public_id]
    );

    if (result.rows.length === 0) {
        return next(
            new AppError("User not found", 404)
        );
    }

    return res.status(200).json({
        success: true,
        user: result.rows[0]
    });

});
const updateUser = asyncHandler(async (req, res, next) => {

    const { public_id } = req.params;

    const {
        full_name,
        email
    } = req.body;

    const result = await pool.query(
        `UPDATE users
         SET
            full_name = $1,
            email = $2,
            updated_at = NOW()
         WHERE public_id = $3
         RETURNING
            public_id,
            full_name,
            email,
            updated_at`,
        [
            full_name,
            email,
            public_id
        ]
    );

    if (result.rows.length === 0) {

        return next(
            new AppError("User not found", 404)
        );

    }

    return res.status(200).json({
        success: true,
        message: "User updated successfully",
        user: result.rows[0]
    });

});

const deleteUser = asyncHandler(async (req, res, next) => {

    const { public_id } = req.params;

    const result = await pool.query(
        `DELETE FROM users
         WHERE public_id = $1
         RETURNING
            public_id,
            full_name,
            email,
            role`,
        [public_id]
    );

    if (result.rows.length === 0) {

        return next(
            new AppError("User not found", 404)
        );

    }

    return res.status(200).json({
        success: true,
        message: "User deleted successfully",
        user: result.rows[0]
    });

});

const uploadProfileImage = asyncHandler(async (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "Please upload an image"
        });
    }

    const imagePath = `/uploads/${req.file.filename}`;

    await pool.query(
        `UPDATE users
         SET profile_image = $1,
             updated_at = NOW()
         WHERE public_id = $2`,
        [
            imagePath,
            req.user.public_id
        ]
    );

    return res.status(200).json({
        success: true,
        message: "Profile image uploaded successfully",
        profile_image: imagePath
    });

});

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    uploadProfileImage
};
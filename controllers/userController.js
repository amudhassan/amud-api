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
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Find and lock the target user.
    const targetUserResult = await client.query(
      `
      SELECT
        id,
        public_id,
        role
      FROM users
      WHERE public_id = $1
        AND deleted_at IS NULL
      FOR UPDATE
      `,
      [req.params.public_id]
    );

    if (targetUserResult.rows.length === 0) {
      throw new AppError("User not found", 404);
    }

    const targetUser = targetUserResult.rows[0];

    // 2. Prevent an administrator from deleting their own account.
    if (targetUser.public_id === req.user.public_id) {
      throw new AppError(
        "You cannot delete your own account.",
        409
      );
    }

    // 3. Prevent deletion of the last active administrator.
    if (targetUser.role === "admin") {
      const activeAdministratorsResult = await client.query(
        `
        SELECT id
        FROM users
        WHERE role = 'admin'
          AND deleted_at IS NULL
        FOR UPDATE
        `
      );

      if (activeAdministratorsResult.rows.length <= 1) {
        throw new AppError(
          "The last active administrator cannot be deleted.",
          409
        );
      }
    }

    // 4. Check active owner-user relationships.
    const activeOwnerRelationshipResult = await client.query(
      `
      SELECT id
      FROM owner_users
      WHERE user_id = $1
        AND revoked_at IS NULL
      LIMIT 1
      `,
      [targetUser.id]
    );

    if (activeOwnerRelationshipResult.rows.length > 0) {
      throw new AppError(
        "User cannot be deleted while active owner relationships exist.",
        409
      );
    }

    // 5. Check active tenant-user relationships.
    const activeTenantRelationshipResult = await client.query(
      `
      SELECT id
      FROM tenant_users
      WHERE user_id = $1
        AND revoked_at IS NULL
      LIMIT 1
      `,
      [targetUser.id]
    );

    if (activeTenantRelationshipResult.rows.length > 0) {
      throw new AppError(
        "User cannot be deleted while active tenant relationships exist.",
        409
      );
    }

    // 6. Revoke all active user sessions.
    await client.query(
      `
      UPDATE user_sessions
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
        AND revoked_at IS NULL
      `,
      [targetUser.id]
    );

    // 7. Revoke all active refresh tokens.
    await client.query(
      `
      UPDATE refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_public_id = $1
        AND revoked_at IS NULL
      `,
      [targetUser.public_id]
    );

    // 8. Soft-delete the user.
    const deletedUserResult = await client.query(
      `
      UPDATE users
      SET
        deleted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING
        public_id,
        full_name,
        email,
        role,
        deleted_at,
        updated_at
      `,
      [targetUser.id]
    );

    if (deletedUserResult.rows.length === 0) {
      throw new AppError("User not found", 404);
    }

    // 9. Execute all deferred database integrity checks now.
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");

    await client.query("COMMIT");

    return res.status(200).json({
      status: "success",
      message: "User deleted successfully.",
      data: {
        user: deletedUserResult.rows[0]
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
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
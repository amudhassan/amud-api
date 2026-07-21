const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    uploadProfileImage
} = require("../controllers/userController");

const {
    authMiddleware,
    authorizeRoles
} = require("../middleware/authMiddleware");

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */

router.get(
    "/",
    authMiddleware,
    authorizeRoles("admin"),
    getAllUsers
);

/**
 * @swagger
 * /api/users/{public_id}:
 *   get:
 *     summary: Get user by Public ID
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: public_id
 *         required: true
 *         schema:
 *           type: string
 *         description: User Public ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: User not found
 */

router.get(
    "/:public_id",
    authMiddleware,
    authorizeRoles("admin"),
    getUserById
);

/**
 * @swagger
 * /api/users/{public_id}:
 *   put:
 *     summary: Update user by Public ID
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: public_id
 *         required: true
 *         schema:
 *           type: string
 *         description: User Public ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *                 example: Amud Hassan
 *               email:
 *                 type: string
 *                 example: amud@test.com
 *               role:
 *                 type: string
 *                 example: admin
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: User not found
 */

router.put(
    "/:public_id",
    authMiddleware,
    authorizeRoles("admin"),
    updateUser
);

/**
 * @swagger
 * /api/users/{public_id}:
 *   delete:
 *     summary: Delete user by Public ID
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: public_id
 *         required: true
 *         schema:
 *           type: string
 *         description: User Public ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: User not found
 */

router.delete(
    "/:public_id",
    authMiddleware,
    authorizeRoles("admin"),
    deleteUser
);

router.post(
    "/upload-profile",
    authMiddleware,
    upload.single("profile_image"),
    uploadProfileImage
);

module.exports = router;
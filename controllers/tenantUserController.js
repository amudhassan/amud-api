const asyncHandler = require(
    "../utils/asyncHandler"
);

const AppError = require(
    "../utils/AppError"
);

const {
    addTenantUser,
    getTenantUsers,
    updateTenantUser,
    revokeTenantUser
} = require(
    "../services/tenantUserService"
);

/*
 * POST /api/tenants/:tenant_public_id/users
 */
const addTenantUserController = asyncHandler(
    async (req, res, next) => {
        try {
            const result = await addTenantUser({
                tenantPublicId:
                    req.params.tenant_public_id,

                userData: req.body,

                authenticatedUser: req.user
            });

            /*
             * Active tenant was not found.
             */
            if (!result) {
                return next(
                    new AppError(
                        "Tenant not found",
                        404
                    )
                );
            }

            /*
             * Authenticated regular user does not
             * have sufficient tenant permission.
             */
            if (result.forbidden) {
                return next(
                    new AppError(
                        result.reason ||
                            "You do not have permission to manage users for this tenant.",
                        403
                    )
                );
            }

            /*
             * Target user does not exist or
             * has already been soft-deleted.
             */
            if (result.userNotFound) {
                return next(
                    new AppError(
                        "User not found",
                        404
                    )
                );
            }

            /*
             * Target account exists but has not
             * completed account verification.
             */
            if (result.userUnverified) {
                return next(
                    new AppError(
                        "User account must be verified before it can be linked to a tenant.",
                        409
                    )
                );
            }

            /*
             * Defensive service-level role validation.
             */
            if (result.invalidRole) {
                return next(
                    new AppError(
                        "Invalid tenant-user relationship role.",
                        400
                    )
                );
            }

            /*
             * primary_contact must always be primary.
             */
            if (
                result.primaryRoleMustBePrimary
            ) {
                return next(
                    new AppError(
                        "Primary contact role must be marked as primary.",
                        422
                    )
                );
            }

            /*
             * No other relationship role may be
             * marked as the tenant primary user.
             */
            if (
                result.primaryRequiresPrimaryRole
            ) {
                return next(
                    new AppError(
                        "Only a primary contact can be marked as primary.",
                        422
                    )
                );
            }

            /*
             * Database requires every primary contact
             * to manage tenant users.
             */
            if (
                result
                    .primaryRequiresManagementPermission
            ) {
                return next(
                    new AppError(
                        "The primary contact must have permission to manage tenant users.",
                        422
                    )
                );
            }

            /*
             * Payment permission requires visibility
             * of tenant financial information.
             */
            if (
                result.invalidPaymentPermission
            ) {
                return next(
                    new AppError(
                        "Payment permission requires financial-viewing permission.",
                        422
                    )
                );
            }

            /*
             * Same user cannot have two active
             * relationships with the same tenant.
             */
            if (
                result.duplicateRelationship
            ) {
                return next(
                    new AppError(
                        "User already has an active relationship with this tenant.",
                        409
                    )
                );
            }

            /*
             * Only one current primary contact
             * is permitted for each tenant.
             */
            if (result.primaryConflict) {
                return next(
                    new AppError(
                        "Tenant already has an active primary contact.",
                        409
                    )
                );
            }

            return res.status(201).json({
                success: true,
                message:
                    "Tenant user added successfully.",
                data: result
            });
        } catch (error) {
            /*
             * Race-condition protection kutoka
             * partial unique indexes:
             *
             * - current tenant-user relationship
             * - active tenant primary contact
             */
            if (error.code === "23505") {
                return next(
                    new AppError(
                        "The tenant-user relationship conflicts with an existing active relationship.",
                        409
                    )
                );
            }

            /*
             * Database CHECK constraints and
             * deferred tenant-user integrity triggers.
             */
            if (error.code === "23514") {
                return next(
                    new AppError(
                        "The supplied tenant-user relationship violates a business rule.",
                        422
                    )
                );
            }

            return next(error);
        }
    }
);
/*
 * GET /api/tenants/:tenant_public_id/users
 */
const getTenantUsersController = asyncHandler(
    async (req, res, next) => {
        const result = await getTenantUsers({
            tenantPublicId:
                req.params.tenant_public_id,

            filters: req.query,

            authenticatedUser: req.user
        });

        /*
         * Active tenant does not exist.
         */
        if (!result) {
            return next(
                new AppError(
                    "Tenant not found",
                    404
                )
            );
        }

        /*
         * Regular requester does not have
         * tenant-user management permission.
         */
        if (result.forbidden) {
            return next(
                new AppError(
                    "You do not have permission to view users for this tenant.",
                    403
                )
            );
        }

        return res.status(200).json({
            success: true,
            message:
                "Tenant users retrieved successfully.",
            count: result.users.length,
            data: {
                tenant: result.tenant,
                users: result.users,
                pagination:
                    result.pagination
            }
        });
    }
);
/*
 * PATCH /api/tenants/:tenant_public_id/users/:link_public_id
 */
const updateTenantUserController = asyncHandler(
    async (req, res, next) => {
        try {
            const result = await updateTenantUser({
                tenantPublicId:
                    req.params.tenant_public_id,

                linkPublicId:
                    req.params.link_public_id,

                linkData: req.body,

                authenticatedUser: req.user
            });

            /*
             * Active tenant not found.
             */
            if (!result) {
                return next(
                    new AppError(
                        "Tenant not found",
                        404
                    )
                );
            }

            /*
             * Link is missing, revoked or belongs
             * to another tenant.
             */
            if (result.linkNotFound) {
                return next(
                    new AppError(
                        "Active tenant-user relationship not found.",
                        404
                    )
                );
            }

            /*
             * Requester is not permitted to
             * perform this update.
             */
            if (result.forbidden) {
                return next(
                    new AppError(
                        result.reason ||
                            "You do not have permission to update users for this tenant.",
                        403
                    )
                );
            }

            /*
             * Current primary cannot be removed
             * or assigned another role directly.
             */
            if (
                result.primaryRemovalBlocked
            ) {
                return next(
                    new AppError(
                        "The current primary contact cannot be removed directly. Promote another active tenant user to primary instead.",
                        409
                    )
                );
            }

            if (
                result.primaryRoleMustBePrimary
            ) {
                return next(
                    new AppError(
                        "Primary contact role must be marked as primary.",
                        422
                    )
                );
            }

            if (
                result.primaryRequiresPrimaryRole
            ) {
                return next(
                    new AppError(
                        "Only a primary contact can be marked as primary.",
                        422
                    )
                );
            }

            if (
                result
                    .primaryRequiresManagementPermission
            ) {
                return next(
                    new AppError(
                        "The primary contact must have permission to manage tenant users.",
                        422
                    )
                );
            }

            if (
                result.invalidPaymentPermission
            ) {
                return next(
                    new AppError(
                        "Payment permission requires financial-viewing permission.",
                        422
                    )
                );
            }

            if (result.noChanges) {
                return next(
                    new AppError(
                        "No tenant-user changes were detected.",
                        400
                    )
                );
            }

            return res.status(200).json({
                success: true,
                message:
                    "Tenant user updated successfully.",
                data: result
            });
        } catch (error) {
            /*
             * Partial unique-index conflict,
             * especially concurrent primary transfer.
             */
            if (error.code === "23505") {
                return next(
                    new AppError(
                        "The updated tenant-user relationship conflicts with an existing active relationship.",
                        409
                    )
                );
            }

            /*
             * CHECK constraints and deferred
             * tenant-user integrity triggers.
             */
            if (error.code === "23514") {
                return next(
                    new AppError(
                        "The updated tenant-user relationship violates a business rule.",
                        422
                    )
                );
            }

            return next(error);
        }
    }
);
/*
 * DELETE /api/tenants/:tenant_public_id/users/:link_public_id
 */
const revokeTenantUserController = asyncHandler(
    async (req, res, next) => {
        try {
            const result = await revokeTenantUser({
                tenantPublicId:
                    req.params.tenant_public_id,

                linkPublicId:
                    req.params.link_public_id,

                authenticatedUser: req.user
            });

            /*
             * Active tenant not found.
             */
            if (!result) {
                return next(
                    new AppError(
                        "Tenant not found",
                        404
                    )
                );
            }

            /*
             * Link is missing, already revoked
             * or belongs to another tenant.
             */
            if (result.linkNotFound) {
                return next(
                    new AppError(
                        "Active tenant-user relationship not found.",
                        404
                    )
                );
            }

            /*
             * Requester is not authorized to
             * revoke this relationship.
             */
            if (result.forbidden) {
                return next(
                    new AppError(
                        result.reason ||
                            "You do not have permission to revoke users for this tenant.",
                        403
                    )
                );
            }

            /*
             * Current primary must first transfer
             * primary status to another active user.
             */
            if (
                result.primaryRevocationBlocked
            ) {
                return next(
                    new AppError(
                        "The current primary contact cannot be revoked directly. Promote another active tenant user to primary first.",
                        409
                    )
                );
            }

            return res.status(200).json({
                success: true,
                message:
                    "Tenant user revoked successfully.",
                data: result
            });
        } catch (error) {
            /*
             * CHECK constraints and deferred
             * tenant-user integrity triggers.
             */
            if (error.code === "23514") {
                return next(
                    new AppError(
                        "The tenant-user relationship could not be revoked because it violates a business rule.",
                        422
                    )
                );
            }

            return next(error);
        }
    }
);
module.exports = {
    addTenantUserController,
    getTenantUsersController,
    updateTenantUserController,
    revokeTenantUserController
};
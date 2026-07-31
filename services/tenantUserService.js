const { nanoid } = require("nanoid");
const pool = require("../config/db");

/**
 * Add an active login user to an active tenant.
 *
 * Administrator:
 * - Can add users to any active tenant.
 * - Can grant any valid tenant permission.
 *
 * Regular user:
 * - Must have an active tenant_users relationship.
 * - Must have can_manage_tenant_users = TRUE.
 * - Cannot assign access to themselves.
 * - Cannot grant a permission they do not have.
 */
const addTenantUser = async ({
    tenantPublicId,
    userData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Find and lock the active tenant.
         *
         * Locking the tenant serializes concurrent inserts
         * involving the same tenant, including primary-contact
         * and duplicate-link checks.
         */
        const tenantResult = await client.query(
            `
            SELECT
                id,
                public_id
            FROM tenants
            WHERE public_id = $1
              AND deleted_at IS NULL
            LIMIT 1
            FOR UPDATE
            `,
            [tenantPublicId]
        );

        if (tenantResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return null;
        }

        const tenant = tenantResult.rows[0];

        /*
         * 2. Find and lock the target login user.
         *
         * Deleted users are treated as not found.
         */
        const targetUserResult = await client.query(
            `
            SELECT
                id,
                public_id,
                full_name,
                email,
                role,
                is_verified,
                profile_image_url
            FROM users
            WHERE public_id = $1
              AND deleted_at IS NULL
            LIMIT 1
            FOR UPDATE
            `,
            [userData.user_public_id]
        );

        if (targetUserResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                userNotFound: true
            };
        }

        const targetUser = targetUserResult.rows[0];

        /*
         * User lazima awe verified kabla ya kupewa
         * tenant portal relationship.
         */
        if (targetUser.is_verified !== true) {
            await client.query("ROLLBACK");

            return {
                userUnverified: true
            };
        }

        /*
         * 3. Prepare role and role-based defaults.
         */
        const relationshipRole =
            userData.relationship_role || "viewer";

        const roleDefaults = {
            primary_contact: {
                can_view_leases: true,
                can_view_finances: true,
                can_make_payments: true,
                can_submit_maintenance: true,
                can_manage_tenant_users: true
            },

            authorized_representative: {
                can_view_leases: true,
                can_view_finances: false,
                can_make_payments: false,
                can_submit_maintenance: true,
                can_manage_tenant_users: false
            },

            accountant: {
                can_view_leases: true,
                can_view_finances: true,
                can_make_payments: true,
                can_submit_maintenance: false,
                can_manage_tenant_users: false
            },

            occupant: {
                can_view_leases: true,
                can_view_finances: false,
                can_make_payments: false,
                can_submit_maintenance: true,
                can_manage_tenant_users: false
            },

            viewer: {
                can_view_leases: true,
                can_view_finances: false,
                can_make_payments: false,
                can_submit_maintenance: false,
                can_manage_tenant_users: false
            }
        };

        const selectedDefaults =
            roleDefaults[relationshipRole];

        /*
         * Validator tayari inazuia invalid role.
         * Hii ni service-level defensive protection.
         */
        if (!selectedDefaults) {
            await client.query("ROLLBACK");

            return {
                invalidRole: true
            };
        }

        const isPrimary =
            userData.is_primary === true;

        const canViewLeases =
            typeof userData.can_view_leases ===
            "boolean"
                ? userData.can_view_leases
                : selectedDefaults.can_view_leases;

        const canViewFinances =
            typeof userData.can_view_finances ===
            "boolean"
                ? userData.can_view_finances
                : selectedDefaults.can_view_finances;

        const canMakePayments =
            typeof userData.can_make_payments ===
            "boolean"
                ? userData.can_make_payments
                : selectedDefaults.can_make_payments;

        const canSubmitMaintenance =
            typeof userData
                .can_submit_maintenance ===
            "boolean"
                ? userData.can_submit_maintenance
                : selectedDefaults
                    .can_submit_maintenance;

        const canManageTenantUsers =
            typeof userData
                .can_manage_tenant_users ===
            "boolean"
                ? userData.can_manage_tenant_users
                : selectedDefaults
                    .can_manage_tenant_users;

        /*
         * 4. Primary-contact consistency.
         *
         * primary_contact lazima awe primary.
         * Primary lazima awe primary_contact.
         */
        if (
            relationshipRole ===
                "primary_contact" &&
            isPrimary !== true
        ) {
            await client.query("ROLLBACK");

            return {
                primaryRoleMustBePrimary: true
            };
        }

        if (
            isPrimary === true &&
            relationshipRole !==
                "primary_contact"
        ) {
            await client.query("ROLLBACK");

            return {
                primaryRequiresPrimaryRole: true
            };
        }

        /*
         * Database constraint pia inalinda rule hii.
         */
        if (
            isPrimary === true &&
            canManageTenantUsers !== true
        ) {
            await client.query("ROLLBACK");

            return {
                primaryRequiresManagementPermission:
                    true
            };
        }

        /*
         * User hawezi kufanya payments bila kuona
         * financial information.
         */
        if (
            canMakePayments === true &&
            canViewFinances !== true
        ) {
            await client.query("ROLLBACK");

            return {
                invalidPaymentPermission: true
            };
        }

        /*
         * 5. Authorization ya regular user.
         */
        let requesterPermissions = null;

        if (authenticatedUser.role !== "admin") {
            /*
             * Regular user haruhusiwi kujiongeza mwenyewe.
             */
            if (
                targetUser.id ===
                authenticatedUser.id
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        "You cannot assign tenant access to yourself."
                };
            }

            const requesterResult =
                await client.query(
                    `
                    SELECT
                        id,
                        can_view_leases,
                        can_view_finances,
                        can_make_payments,
                        can_submit_maintenance,
                        can_manage_tenant_users
                    FROM tenant_users
                    WHERE tenant_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        tenant.id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0 ||
                requesterResult.rows[0]
                    .can_manage_tenant_users !== true
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        "You do not have permission to manage users for this tenant."
                };
            }

            requesterPermissions =
                requesterResult.rows[0];

            /*
             * Regular user hawezi kutoa permission
             * ambayo yeye mwenyewe hana.
             */
            const delegatedPermissions = [
                {
                    requested: canViewLeases,
                    owned:
                        requesterPermissions
                            .can_view_leases,
                    reason:
                        "You cannot grant lease-viewing permission that you do not have."
                },
                {
                    requested: canViewFinances,
                    owned:
                        requesterPermissions
                            .can_view_finances,
                    reason:
                        "You cannot grant financial-viewing permission that you do not have."
                },
                {
                    requested: canMakePayments,
                    owned:
                        requesterPermissions
                            .can_make_payments,
                    reason:
                        "You cannot grant payment permission that you do not have."
                },
                {
                    requested:
                        canSubmitMaintenance,
                    owned:
                        requesterPermissions
                            .can_submit_maintenance,
                    reason:
                        "You cannot grant maintenance permission that you do not have."
                },
                {
                    requested:
                        canManageTenantUsers,
                    owned:
                        requesterPermissions
                            .can_manage_tenant_users,
                    reason:
                        "You cannot grant tenant-user management permission that you do not have."
                }
            ];

            const unauthorizedPermission =
                delegatedPermissions.find(
                    permission =>
                        permission.requested === true &&
                        permission.owned !== true
                );

            if (unauthorizedPermission) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        unauthorizedPermission.reason
                };
            }
        }

        /*
         * 6. Prevent duplicate active relationship.
         */
        const duplicateResult = await client.query(
            `
            SELECT public_id
            FROM tenant_users
            WHERE tenant_id = $1
              AND user_id = $2
              AND revoked_at IS NULL
            LIMIT 1
            `,
            [
                tenant.id,
                targetUser.id
            ]
        );

        if (duplicateResult.rows.length > 0) {
            await client.query("ROLLBACK");

            return {
                duplicateRelationship: true
            };
        }

        /*
         * 7. Only one active primary contact
         * is permitted for each tenant.
         */
        if (isPrimary === true) {
            const primaryResult =
                await client.query(
                    `
                    SELECT public_id
                    FROM tenant_users
                    WHERE tenant_id = $1
                      AND is_primary = TRUE
                      AND revoked_at IS NULL
                    LIMIT 1
                    `,
                    [tenant.id]
                );

            if (primaryResult.rows.length > 0) {
                await client.query("ROLLBACK");

                return {
                    primaryConflict: true
                };
            }
        }

        /*
         * 8. Create a new audit relationship.
         *
         * Revoked historical relationships are never
         * edited or reactivated.
         */
        const linkPublicId =
            `tenant_user_${nanoid(24)}`;

        const linkResult = await client.query(
            `
            INSERT INTO tenant_users (
                public_id,
                tenant_id,
                user_id,
                relationship_role,
                is_primary,
                can_view_leases,
                can_view_finances,
                can_make_payments,
                can_submit_maintenance,
                can_manage_tenant_users,
                created_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11
            )
            RETURNING
                public_id AS link_public_id,
                relationship_role,
                is_primary,
                can_view_leases,
                can_view_finances,
                can_make_payments,
                can_submit_maintenance,
                can_manage_tenant_users,
                created_at,
                updated_at
            `,
            [
                linkPublicId,
                tenant.id,
                targetUser.id,
                relationshipRole,
                isPrimary,
                canViewLeases,
                canViewFinances,
                canMakePayments,
                canSubmitMaintenance,
                canManageTenantUsers,
                authenticatedUser.id
            ]
        );

        /*
         * Execute deferred tenant-user integrity
         * triggers before committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        delete tenant.id;
        delete targetUser.id;

        return {
            forbidden: false,
            tenant,
            user: targetUser,
            link: linkResult.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    addTenantUser
};
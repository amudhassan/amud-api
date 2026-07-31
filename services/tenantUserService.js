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
/**
 * Retrieve active users linked to an active tenant.
 *
 * Administrator:
 * - Can retrieve users of any active tenant.
 *
 * Regular user:
 * - Must have an active tenant-user relationship.
 * - Must have can_manage_tenant_users = TRUE.
 */
const getTenantUsers = async ({
    tenantPublicId,
    filters,
    authenticatedUser
}) => {
    /*
     * 1. Confirm that the active tenant exists.
     */
    const tenantResult = await pool.query(
        `
        SELECT
            id,
            public_id
        FROM tenants
        WHERE public_id = $1
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [tenantPublicId]
    );

    if (tenantResult.rows.length === 0) {
        return null;
    }

    const tenant = tenantResult.rows[0];

    /*
     * 2. Regular users must have active permission
     * to manage users for this tenant.
     */
    if (authenticatedUser.role !== "admin") {
        const requesterResult = await pool.query(
            `
            SELECT id
            FROM tenant_users
            WHERE tenant_id = $1
              AND user_id = $2
              AND revoked_at IS NULL
              AND can_manage_tenant_users = TRUE
            LIMIT 1
            `,
            [
                tenant.id,
                authenticatedUser.id
            ]
        );

        if (requesterResult.rows.length === 0) {
            return {
                forbidden: true
            };
        }
    }

    /*
     * 3. Prepare pagination.
     */
    const page =
        Number.isInteger(filters.page)
            ? filters.page
            : 1;

    const limit =
        Number.isInteger(filters.limit)
            ? filters.limit
            : 20;

    const offset =
        (page - 1) * limit;

    /*
     * 4. Build parameterized search and filters.
     */
    const queryValues = [
        tenant.id
    ];

    const conditions = [
        "tu.tenant_id = $1",
        "tu.revoked_at IS NULL",
        "u.deleted_at IS NULL"
    ];

    const addQueryValue = value => {
        queryValues.push(value);

        return `$${queryValues.length}`;
    };

    if (filters.search !== undefined) {
        const placeholder = addQueryValue(
            `%${filters.search}%`
        );

        conditions.push(
            `(
                u.full_name ILIKE ${placeholder}
                OR u.email ILIKE ${placeholder}
            )`
        );
    }

    if (
        filters.relationship_role !==
        undefined
    ) {
        const placeholder = addQueryValue(
            filters.relationship_role
        );

        conditions.push(
            `tu.relationship_role = ${placeholder}`
        );
    }

    const booleanFilters = [
        "is_primary",
        "can_view_leases",
        "can_view_finances",
        "can_make_payments",
        "can_submit_maintenance",
        "can_manage_tenant_users"
    ];

    for (const field of booleanFilters) {
        if (typeof filters[field] === "boolean") {
            const placeholder = addQueryValue(
                filters[field]
            );

            conditions.push(
                `tu.${field} = ${placeholder}`
            );
        }
    }

    const whereClause =
        conditions.join("\nAND ");

    /*
     * 5. Count matching active relationships.
     */
    const countResult = await pool.query(
        `
        SELECT
            COUNT(*)::INTEGER AS total
        FROM tenant_users AS tu

        INNER JOIN users AS u
            ON u.id = tu.user_id

        WHERE ${whereClause}
        `,
        queryValues
    );

    const total =
        countResult.rows[0].total;

    const totalPages =
        total === 0
            ? 0
            : Math.ceil(total / limit);

    /*
     * 6. Retrieve the requested page.
     *
     * Add limit and offset only after the filter
     * parameters have been prepared.
     */
    const dataValues = [
        ...queryValues,
        limit,
        offset
    ];

    const limitPlaceholder =
        `$${queryValues.length + 1}`;

    const offsetPlaceholder =
        `$${queryValues.length + 2}`;

    const usersResult = await pool.query(
        `
        SELECT
            tu.public_id AS link_public_id,

            u.public_id AS user_public_id,
            u.full_name,
            u.email,
            u.role AS user_role,
            u.is_verified,
            u.profile_image_url,

            tu.relationship_role,
            tu.is_primary,
            tu.can_view_leases,
            tu.can_view_finances,
            tu.can_make_payments,
            tu.can_submit_maintenance,
            tu.can_manage_tenant_users,

            tu.created_at,
            tu.updated_at

        FROM tenant_users AS tu

        INNER JOIN users AS u
            ON u.id = tu.user_id

        WHERE ${whereClause}

        ORDER BY
            tu.is_primary DESC,
            tu.relationship_role ASC,
            tu.created_at ASC,
            tu.id ASC

        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
        `,
        dataValues
    );

    /*
     * Do not expose the internal tenant database ID.
     */
    delete tenant.id;

    return {
        forbidden: false,
        tenant,
        users: usersResult.rows,
        pagination: {
            total,
            page,
            limit,
            total_pages: totalPages,
            has_next_page:
                page < totalPages,
            has_previous_page:
                page > 1
        }
    };
};
const updateTenantUser = async ({
    tenantPublicId,
    linkPublicId,
    linkData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Find and lock the active tenant.
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
         * 2. Find and lock the active tenant-user link.
         */
        const targetResult = await client.query(
            `
            SELECT
                tu.id,
                tu.public_id,
                tu.user_id,
                tu.relationship_role,
                tu.is_primary,
                tu.can_view_leases,
                tu.can_view_finances,
                tu.can_make_payments,
                tu.can_submit_maintenance,
                tu.can_manage_tenant_users,
                tu.created_at,
                tu.updated_at,

                u.public_id AS user_public_id,
                u.full_name,
                u.email,
                u.role AS user_role,
                u.is_verified,
                u.profile_image_url

            FROM tenant_users AS tu

            INNER JOIN users AS u
                ON u.id = tu.user_id

            WHERE tu.tenant_id = $1
              AND tu.public_id = $2
              AND tu.revoked_at IS NULL
              AND u.deleted_at IS NULL

            LIMIT 1
            FOR UPDATE OF tu, u
            `,
            [
                tenant.id,
                linkPublicId
            ]
        );

        if (targetResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                linkNotFound: true
            };
        }

        const currentLink =
            targetResult.rows[0];

        /*
         * 3. Authorize the requester.
         */
        let requesterLink = null;

        if (authenticatedUser.role !== "admin") {
            /*
             * Regular user cannot update their own
             * tenant relationship.
             */
            if (
                currentLink.user_id ===
                authenticatedUser.id
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        "You cannot update your own tenant relationship."
                };
            }

            const requesterResult =
                await client.query(
                    `
                    SELECT
                        id,
                        relationship_role,
                        is_primary,
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
                        "You do not have permission to update users for this tenant."
                };
            }

            requesterLink =
                requesterResult.rows[0];
        }

        /*
         * 4. Merge supplied fields with current values.
         */
        const finalRelationshipRole =
            linkData.relationship_role !==
            undefined
                ? linkData.relationship_role
                : currentLink.relationship_role;

        const finalIsPrimary =
            typeof linkData.is_primary ===
            "boolean"
                ? linkData.is_primary
                : currentLink.is_primary;

        const finalCanViewLeases =
            typeof linkData.can_view_leases ===
            "boolean"
                ? linkData.can_view_leases
                : currentLink.can_view_leases;

        const finalCanViewFinances =
            typeof linkData.can_view_finances ===
            "boolean"
                ? linkData.can_view_finances
                : currentLink.can_view_finances;

        const finalCanMakePayments =
            typeof linkData.can_make_payments ===
            "boolean"
                ? linkData.can_make_payments
                : currentLink.can_make_payments;

        const finalCanSubmitMaintenance =
            typeof linkData
                .can_submit_maintenance ===
            "boolean"
                ? linkData
                    .can_submit_maintenance
                : currentLink
                    .can_submit_maintenance;

        const finalCanManageTenantUsers =
            typeof linkData
                .can_manage_tenant_users ===
            "boolean"
                ? linkData
                    .can_manage_tenant_users
                : currentLink
                    .can_manage_tenant_users;

        /*
         * 5. Current primary cannot be removed
         * directly.
         */
        if (
            currentLink.is_primary === true &&
            (
                finalIsPrimary !== true ||
                finalRelationshipRole !==
                    "primary_contact"
            )
        ) {
            await client.query("ROLLBACK");

            return {
                primaryRemovalBlocked: true
            };
        }

        /*
         * 6. Validate final primary-contact state.
         */
        if (
            finalRelationshipRole ===
                "primary_contact" &&
            finalIsPrimary !== true
        ) {
            await client.query("ROLLBACK");

            return {
                primaryRoleMustBePrimary: true
            };
        }

        if (
            finalIsPrimary === true &&
            finalRelationshipRole !==
                "primary_contact"
        ) {
            await client.query("ROLLBACK");

            return {
                primaryRequiresPrimaryRole: true
            };
        }

        if (
            finalIsPrimary === true &&
            finalCanManageTenantUsers !== true
        ) {
            await client.query("ROLLBACK");

            return {
                primaryRequiresManagementPermission:
                    true
            };
        }

        /*
         * 7. Payment permission requires
         * financial-viewing permission.
         */
        if (
            finalCanMakePayments === true &&
            finalCanViewFinances !== true
        ) {
            await client.query("ROLLBACK");

            return {
                invalidPaymentPermission: true
            };
        }

        const primaryTransferRequested =
            currentLink.is_primary !== true &&
            finalIsPrimary === true;

        /*
         * 8. Only admin or current primary contact
         * can transfer primary status.
         */
        if (
            primaryTransferRequested &&
            authenticatedUser.role !== "admin"
        ) {
            const requesterIsCurrentPrimary =
                requesterLink &&
                requesterLink.is_primary === true &&
                requesterLink
                    .relationship_role ===
                    "primary_contact";

            if (!requesterIsCurrentPrimary) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        "Only an administrator or the current primary contact can transfer primary-contact status."
                };
            }
        }

        /*
         * 9. Prevent regular-user permission
         * escalation.
         */
        if (authenticatedUser.role !== "admin") {
            const permissionTransitions = [
                {
                    current:
                        currentLink.can_view_leases,
                    final:
                        finalCanViewLeases,
                    requester:
                        requesterLink.can_view_leases,
                    reason:
                        "You cannot grant lease-viewing permission that you do not have."
                },
                {
                    current:
                        currentLink.can_view_finances,
                    final:
                        finalCanViewFinances,
                    requester:
                        requesterLink.can_view_finances,
                    reason:
                        "You cannot grant financial-viewing permission that you do not have."
                },
                {
                    current:
                        currentLink.can_make_payments,
                    final:
                        finalCanMakePayments,
                    requester:
                        requesterLink.can_make_payments,
                    reason:
                        "You cannot grant payment permission that you do not have."
                },
                {
                    current:
                        currentLink
                            .can_submit_maintenance,
                    final:
                        finalCanSubmitMaintenance,
                    requester:
                        requesterLink
                            .can_submit_maintenance,
                    reason:
                        "You cannot grant maintenance permission that you do not have."
                },
                {
                    current:
                        currentLink
                            .can_manage_tenant_users,
                    final:
                        finalCanManageTenantUsers,
                    requester:
                        requesterLink
                            .can_manage_tenant_users,
                    reason:
                        "You cannot grant tenant-user management permission that you do not have."
                }
            ];

            const unauthorizedGrant =
                permissionTransitions.find(
                    permission =>
                        permission.current !== true &&
                        permission.final === true &&
                        permission.requester !== true
                );

            if (unauthorizedGrant) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        unauthorizedGrant.reason
                };
            }
        }

        /*
         * 10. Detect a no-change request.
         */
        const hasChanges =
            finalRelationshipRole !==
                currentLink.relationship_role ||
            finalIsPrimary !==
                currentLink.is_primary ||
            finalCanViewLeases !==
                currentLink.can_view_leases ||
            finalCanViewFinances !==
                currentLink.can_view_finances ||
            finalCanMakePayments !==
                currentLink.can_make_payments ||
            finalCanSubmitMaintenance !==
                currentLink
                    .can_submit_maintenance ||
            finalCanManageTenantUsers !==
                currentLink
                    .can_manage_tenant_users;

        if (!hasChanges) {
            await client.query("ROLLBACK");

            return {
                noChanges: true
            };
        }

        /*
         * 11. If another user is being promoted,
         * demote the existing primary first.
         */
        let previousPrimary = null;

        if (primaryTransferRequested) {
            const primaryResult =
                await client.query(
                    `
                    SELECT
                        id,
                        public_id,
                        user_id,
                        relationship_role,
                        is_primary
                    FROM tenant_users
                    WHERE tenant_id = $1
                      AND is_primary = TRUE
                      AND revoked_at IS NULL
                      AND id <> $2
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        tenant.id,
                        currentLink.id
                    ]
                );

            if (primaryResult.rows.length > 0) {
                previousPrimary =
                    primaryResult.rows[0];

                await client.query(
                    `
                    UPDATE tenant_users
                    SET
                        relationship_role =
                            'authorized_representative',
                        is_primary = FALSE,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $1
                      AND revoked_at IS NULL
                    `,
                    [previousPrimary.id]
                );
            }
        }

        /*
         * 12. Update the target link.
         */
        const updatedResult =
            await client.query(
                `
                UPDATE tenant_users
                SET
                    relationship_role = $1,
                    is_primary = $2,
                    can_view_leases = $3,
                    can_view_finances = $4,
                    can_make_payments = $5,
                    can_submit_maintenance = $6,
                    can_manage_tenant_users = $7,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $8
                  AND revoked_at IS NULL
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
                    finalRelationshipRole,
                    finalIsPrimary,
                    finalCanViewLeases,
                    finalCanViewFinances,
                    finalCanMakePayments,
                    finalCanSubmitMaintenance,
                    finalCanManageTenantUsers,
                    currentLink.id
                ]
            );

        if (updatedResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                linkNotFound: true
            };
        }

        /*
         * 13. Execute deferred integrity checks.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        delete tenant.id;

        const user = {
            public_id:
                currentLink.user_public_id,
            full_name:
                currentLink.full_name,
            email:
                currentLink.email,
            user_role:
                currentLink.user_role,
            is_verified:
                currentLink.is_verified,
            profile_image_url:
                currentLink.profile_image_url
        };

        return {
            forbidden: false,
            tenant,
            user,
            link: updatedResult.rows[0],

            primary_transfer:
                previousPrimary
                    ? {
                        previous_primary_link_public_id:
                            previousPrimary.public_id
                    }
                    : null
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
/**
 * Revoke an active tenant-user relationship.
 *
 * This is a soft revocation. The audit record
 * remains permanently inside tenant_users.
 */
const revokeTenantUser = async ({
    tenantPublicId,
    linkPublicId,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Find and lock the active tenant.
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
         * 2. Find and lock the active target link
         * and its linked active user.
         */
        const targetResult = await client.query(
            `
            SELECT
                tu.id,
                tu.public_id,
                tu.user_id,
                tu.relationship_role,
                tu.is_primary,
                tu.can_view_leases,
                tu.can_view_finances,
                tu.can_make_payments,
                tu.can_submit_maintenance,
                tu.can_manage_tenant_users,
                tu.created_at,
                tu.updated_at,

                u.public_id AS user_public_id,
                u.full_name,
                u.email,
                u.role AS user_role,
                u.is_verified,
                u.profile_image_url

            FROM tenant_users AS tu

            INNER JOIN users AS u
                ON u.id = tu.user_id

            WHERE tu.tenant_id = $1
              AND tu.public_id = $2
              AND tu.revoked_at IS NULL
              AND u.deleted_at IS NULL

            LIMIT 1
            FOR UPDATE OF tu, u
            `,
            [
                tenant.id,
                linkPublicId
            ]
        );

        if (targetResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                linkNotFound: true
            };
        }

        const targetLink =
            targetResult.rows[0];

        /*
         * 3. Authorize regular tenant users.
         */
        let requesterLink = null;

        if (authenticatedUser.role !== "admin") {
            /*
             * Regular tenant user cannot revoke
             * their own relationship.
             */
            if (
                targetLink.user_id ===
                authenticatedUser.id
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        "You cannot revoke your own tenant relationship."
                };
            }

            const requesterResult =
                await client.query(
                    `
                    SELECT
                        id,
                        relationship_role,
                        is_primary,
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
                        "You do not have permission to revoke users for this tenant."
                };
            }

            requesterLink =
                requesterResult.rows[0];
        }

        /*
         * 4. Current primary contact cannot be
         * revoked directly.
         */
        if (targetLink.is_primary === true) {
            await client.query("ROLLBACK");

            return {
                primaryRevocationBlocked: true
            };
        }

        /*
         * 5. A regular limited manager cannot revoke
         * another tenant manager.
         *
         * Only administrator or current primary
         * contact may revoke a manager relationship.
         */
        if (
            authenticatedUser.role !== "admin" &&
            targetLink
                .can_manage_tenant_users === true
        ) {
            const requesterIsCurrentPrimary =
                requesterLink &&
                requesterLink.is_primary === true &&
                requesterLink
                    .relationship_role ===
                    "primary_contact";

            if (!requesterIsCurrentPrimary) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        "Only an administrator or the current primary contact can revoke a tenant manager."
                };
            }
        }

        /*
         * 6. Revoke the link while preserving
         * relationship identity and audit history.
         */
        const revokedResult =
            await client.query(
                `
                UPDATE tenant_users
                SET
                    is_primary = FALSE,
                    revoked_at =
                        CURRENT_TIMESTAMP,
                    revoked_by = $1,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $2
                  AND revoked_at IS NULL
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
                    updated_at,
                    revoked_at
                `,
                [
                    authenticatedUser.id,
                    targetLink.id
                ]
            );

        if (revokedResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                linkNotFound: true
            };
        }

        /*
         * 7. Execute deferred database-integrity
         * checks before commit.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        delete tenant.id;

        const user = {
            public_id:
                targetLink.user_public_id,
            full_name:
                targetLink.full_name,
            email:
                targetLink.email,
            user_role:
                targetLink.user_role,
            is_verified:
                targetLink.is_verified,
            profile_image_url:
                targetLink.profile_image_url
        };

        const link = {
            ...revokedResult.rows[0],

            revoked_by:
                authenticatedUser.public_id
        };

        return {
            forbidden: false,
            tenant,
            user,
            link
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
module.exports = {
    addTenantUser,
    getTenantUsers,
    updateTenantUser,
    revokeTenantUser
};
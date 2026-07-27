const { nanoid } = require("nanoid");
const pool = require("../config/db");

/**
 * Retrieve active users linked to an owner.
 *
 * Admin:
 * - Can retrieve users of any active owner.
 *
 * Regular user:
 * - Must have an active relationship with the owner.
 */
const getOwnerUsers = async ({
    ownerPublicId,
    authenticatedUser
}) => {
    const accessValues = [ownerPublicId];

    let accessJoin = "";

    /*
     * Regular users must have an active owner_users link.
     * Admin does not require an owner relationship.
     */
    if (authenticatedUser.role !== "admin") {
        accessValues.push(authenticatedUser.id);

        accessJoin = `
            INNER JOIN owner_users AS requester_link
                ON requester_link.owner_id = o.id
               AND requester_link.user_id = $2
               AND requester_link.revoked_at IS NULL
        `;
    }

    const ownerResult = await pool.query(
        `
        SELECT
            o.id,
            o.public_id,
            o.owner_type,
            o.display_name,
            o.status
        FROM owners AS o

        ${accessJoin}

        WHERE o.public_id = $1
          AND o.deleted_at IS NULL

        LIMIT 1
        `,
        accessValues
    );

    /*
     * Returning null hides whether an inaccessible owner exists.
     */
    if (ownerResult.rows.length === 0) {
        return null;
    }

    const owner = ownerResult.rows[0];

    const usersResult = await pool.query(
        `
        SELECT
            ou.public_id AS link_public_id,

            u.public_id AS user_public_id,
            u.full_name,
            u.email,
            u.role AS user_role,
            u.is_verified,
            u.profile_image_url,

            ou.relationship_role,
            ou.is_primary,
            ou.can_manage_properties,
            ou.can_manage_finances,

            ou.created_at,
            ou.updated_at

        FROM owner_users AS ou

        INNER JOIN users AS u
            ON u.id = ou.user_id

        WHERE ou.owner_id = $1
          AND ou.revoked_at IS NULL
          AND u.deleted_at IS NULL

        ORDER BY
            ou.is_primary DESC,
            ou.created_at ASC
        `,
        [owner.id]
    );

    delete owner.id;

    return {
        owner,
        users: usersResult.rows
    };
};

const addOwnerUser = async ({
    ownerPublicId,
    userData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const accessValues = [ownerPublicId];

        let accessJoin = "";

        let requesterPermissionFields = `
            TRUE AS requester_can_manage_properties,
            TRUE AS requester_can_manage_finances
        `;

        /*
         * Regular user lazima awe active primary representative.
         * Admin hahitaji owner_users relationship.
         */
        if (authenticatedUser.role !== "admin") {
            accessValues.push(authenticatedUser.id);

            accessJoin = `
                INNER JOIN owner_users AS requester_link
                    ON requester_link.owner_id = o.id
                   AND requester_link.user_id = $2
                   AND requester_link.revoked_at IS NULL
                   AND requester_link.is_primary = TRUE
                   AND requester_link.relationship_role IN (
                       'owner',
                       'representative',
                       'manager'
                   )
            `;

            requesterPermissionFields = `
                requester_link.can_manage_properties
                    AS requester_can_manage_properties,

                requester_link.can_manage_finances
                    AS requester_can_manage_finances
            `;
        }

        const ownerResult = await client.query(
            `
            SELECT
                o.id,
                o.public_id,
                o.owner_type,
                o.display_name,
                o.status,

                ${requesterPermissionFields}

            FROM owners AS o

            ${accessJoin}

            WHERE o.public_id = $1
              AND o.deleted_at IS NULL

            LIMIT 1
            FOR UPDATE OF o
            `,
            accessValues
        );

        /*
         * Kwa regular user, null pia inaweza kumaanisha
         * hana authorization. Tunatumia 404 kwa security.
         */
        if (ownerResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return null;
        }

        const owner = ownerResult.rows[0];

        const relationshipRole =
            userData.relationship_role || "viewer";

        const isPrimary =
            userData.is_primary === true;

        const canManageProperties =
            userData.can_manage_properties === true;

        const canManageFinances =
            userData.can_manage_finances === true;

        /*
         * Zuia privilege escalation kwa regular users.
         */
        if (authenticatedUser.role !== "admin") {
            if (
                relationshipRole === "owner" ||
                isPrimary === true
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        "Only administrators can assign the owner role or primary representative status."
                };
            }

            if (
                canManageProperties &&
                !owner.requester_can_manage_properties
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        "You cannot grant property-management permission that you do not have."
                };
            }

            if (
                canManageFinances &&
                !owner.requester_can_manage_finances
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        "You cannot grant financial permission that you do not have."
                };
            }
        }

        /*
         * User anayoongezwa lazima awe verified na active.
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
              AND is_verified = TRUE
            LIMIT 1
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
         * Zuia active relationship inayojirudia.
         */
        const duplicateResult = await client.query(
            `
            SELECT public_id
            FROM owner_users
            WHERE owner_id = $1
              AND user_id = $2
              AND revoked_at IS NULL
            LIMIT 1
            `,
            [
                owner.id,
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
         * Owner ana primary representative mmoja tu.
         */
        if (isPrimary) {
            const primaryResult = await client.query(
                `
                SELECT public_id
                FROM owner_users
                WHERE owner_id = $1
                  AND is_primary = TRUE
                  AND revoked_at IS NULL
                LIMIT 1
                `,
                [owner.id]
            );

            if (primaryResult.rows.length > 0) {
                await client.query("ROLLBACK");

                return {
                    primaryConflict: true
                };
            }
        }

        const linkPublicId =
            `owner_user_${nanoid(24)}`;

        const linkResult = await client.query(
            `
            INSERT INTO owner_users (
                public_id,
                owner_id,
                user_id,
                relationship_role,
                is_primary,
                can_manage_properties,
                can_manage_finances
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7
            )
            RETURNING
                public_id AS link_public_id,
                relationship_role,
                is_primary,
                can_manage_properties,
                can_manage_finances,
                created_at,
                updated_at
            `,
            [
                linkPublicId,
                owner.id,
                targetUser.id,
                relationshipRole,
                isPrimary,
                canManageProperties,
                canManageFinances
            ]
        );

        await client.query("COMMIT");

        delete owner.id;
        delete owner.requester_can_manage_properties;
        delete owner.requester_can_manage_finances;

        delete targetUser.id;

        return {
            forbidden: false,
            owner,
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
const updateOwnerUser = async ({
    ownerPublicId,
    linkPublicId,
    linkData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const accessValues = [ownerPublicId];

        let accessJoin = "";

        let requesterPermissionFields = `
            TRUE AS requester_can_manage_properties,
            TRUE AS requester_can_manage_finances
        `;

        /*
         * Regular user lazima awe active primary representative.
         */
        if (authenticatedUser.role !== "admin") {
            accessValues.push(authenticatedUser.id);

            accessJoin = `
                INNER JOIN owner_users AS requester_link
                    ON requester_link.owner_id = o.id
                   AND requester_link.user_id = $2
                   AND requester_link.revoked_at IS NULL
                   AND requester_link.is_primary = TRUE
                   AND requester_link.relationship_role IN (
                       'owner',
                       'representative',
                       'manager'
                   )
            `;

            requesterPermissionFields = `
                requester_link.can_manage_properties
                    AS requester_can_manage_properties,

                requester_link.can_manage_finances
                    AS requester_can_manage_finances
            `;
        }

        const ownerResult = await client.query(
            `
            SELECT
                o.id,
                o.public_id,
                o.owner_type,
                o.display_name,
                o.status,

                ${requesterPermissionFields}

            FROM owners AS o

            ${accessJoin}

            WHERE o.public_id = $1
              AND o.deleted_at IS NULL

            LIMIT 1
            FOR UPDATE OF o
            `,
            accessValues
        );

        if (ownerResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return null;
        }

        const owner = ownerResult.rows[0];

        const linkResult = await client.query(
            `
            SELECT
                ou.id,
                ou.public_id,
                ou.user_id,
                ou.relationship_role,
                ou.is_primary,
                ou.can_manage_properties,
                ou.can_manage_finances,
                ou.created_at,
                ou.updated_at,

                u.public_id AS user_public_id,
                u.full_name,
                u.email,
                u.role AS user_role,
                u.is_verified,
                u.profile_image_url

            FROM owner_users AS ou

            INNER JOIN users AS u
                ON u.id = ou.user_id

            WHERE ou.owner_id = $1
              AND ou.public_id = $2
              AND ou.revoked_at IS NULL
              AND u.deleted_at IS NULL

            LIMIT 1
            FOR UPDATE OF ou
            `,
            [
                owner.id,
                linkPublicId
            ]
        );

        if (linkResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                linkNotFound: true
            };
        }

        const currentLink = linkResult.rows[0];

        /*
         * Regular users hawawezi kubadilisha primary status
         * wala kutoa role ya owner.
         */
        if (authenticatedUser.role !== "admin") {
            if (
                Object.prototype.hasOwnProperty.call(
                    linkData,
                    "is_primary"
                )
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        "Only administrators can change primary representative status."
                };
            }

            if (linkData.relationship_role === "owner") {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        "Only administrators can assign the owner relationship role."
                };
            }

            if (
                linkData.can_manage_properties === true &&
                !owner.requester_can_manage_properties
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        "You cannot grant property-management permission that you do not have."
                };
            }

            if (
                linkData.can_manage_finances === true &&
                !owner.requester_can_manage_finances
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true,
                    reason:
                        "You cannot grant financial permission that you do not have."
                };
            }
        }

        const finalRelationshipRole =
            Object.prototype.hasOwnProperty.call(
                linkData,
                "relationship_role"
            )
                ? linkData.relationship_role
                : currentLink.relationship_role;

        const finalIsPrimary =
            Object.prototype.hasOwnProperty.call(
                linkData,
                "is_primary"
            )
                ? linkData.is_primary
                : currentLink.is_primary;

        /*
         * Primary representative lazima awe owner,
         * representative au manager.
         */
        if (
            finalIsPrimary === true &&
            ![
                "owner",
                "representative",
                "manager"
            ].includes(finalRelationshipRole)
        ) {
            await client.query("ROLLBACK");

            return {
                invalidPrimaryRole: true
            };
        }

        /*
         * Primary aliyepo hawezi kushushwa moja kwa moja.
         * Transfer inafanywa kwa kuweka link nyingine primary.
         */
        if (
            authenticatedUser.role === "admin" &&
            currentLink.is_primary === true &&
            Object.prototype.hasOwnProperty.call(
                linkData,
                "is_primary"
            ) &&
            linkData.is_primary === false
        ) {
            await client.query("ROLLBACK");

            return {
                primaryRemovalBlocked: true
            };
        }

        let previousPrimaryDemoted = 0;

        /*
         * Admin aki-promote target link, primary wa zamani
         * anashushwa atomically ndani ya transaction.
         */
        if (
            authenticatedUser.role === "admin" &&
            finalIsPrimary === true &&
            currentLink.is_primary === false
        ) {
            const demotedResult = await client.query(
                `
                UPDATE owner_users
                SET
                    is_primary = FALSE,
                    updated_at = NOW()
                WHERE owner_id = $1
                  AND public_id <> $2
                  AND is_primary = TRUE
                  AND revoked_at IS NULL
                RETURNING public_id
                `,
                [
                    owner.id,
                    currentLink.public_id
                ]
            );

            previousPrimaryDemoted =
                demotedResult.rowCount;
        }

        const allowedFields = [
            "relationship_role",
            "is_primary",
            "can_manage_properties",
            "can_manage_finances"
        ];

        const updateFields = [];
        const updateValues = [];

        for (const field of allowedFields) {
            if (
                !Object.prototype.hasOwnProperty.call(
                    linkData,
                    field
                )
            ) {
                continue;
            }

            updateValues.push(linkData[field]);

            updateFields.push(
                `${field} = $${updateValues.length}`
            );
        }

        if (updateFields.length === 0) {
            await client.query("ROLLBACK");

            return {
                noChanges: true
            };
        }

        updateValues.push(currentLink.id);

        const linkIdParameter =
            `$${updateValues.length}`;

        const updatedLinkResult = await client.query(
            `
            UPDATE owner_users
            SET
                ${updateFields.join(", ")},
                updated_at = NOW()
            WHERE id = ${linkIdParameter}
              AND revoked_at IS NULL
            RETURNING
                public_id AS link_public_id,
                relationship_role,
                is_primary,
                can_manage_properties,
                can_manage_finances,
                created_at,
                updated_at
            `,
            updateValues
        );

        await client.query("COMMIT");

        delete owner.id;
        delete owner.requester_can_manage_properties;
        delete owner.requester_can_manage_finances;

        return {
            forbidden: false,
            owner,
            user: {
                public_id: currentLink.user_public_id,
                full_name: currentLink.full_name,
                email: currentLink.email,
                role: currentLink.user_role,
                is_verified: currentLink.is_verified,
                profile_image_url:
                    currentLink.profile_image_url
            },
            link: updatedLinkResult.rows[0],
            previous_primary_demoted:
                previousPrimaryDemoted
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
const revokeOwnerUser = async ({
    ownerPublicId,
    linkPublicId,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const accessValues = [ownerPublicId];

        let accessJoin = "";

        /*
         * Regular user lazima awe active primary representative
         * mwenye role ya owner, representative au manager.
         */
        if (authenticatedUser.role !== "admin") {
            accessValues.push(authenticatedUser.id);

            accessJoin = `
                INNER JOIN owner_users AS requester_link
                    ON requester_link.owner_id = o.id
                   AND requester_link.user_id = $2
                   AND requester_link.revoked_at IS NULL
                   AND requester_link.is_primary = TRUE
                   AND requester_link.relationship_role IN (
                       'owner',
                       'representative',
                       'manager'
                   )
            `;
        }

        const ownerResult = await client.query(
            `
            SELECT
                o.id,
                o.public_id,
                o.owner_type,
                o.display_name,
                o.status
            FROM owners AS o

            ${accessJoin}

            WHERE o.public_id = $1
              AND o.deleted_at IS NULL

            LIMIT 1
            FOR UPDATE OF o
            `,
            accessValues
        );

        /*
         * Kwa regular user, null pia inaweza kumaanisha
         * hana authorization. Tunatumia 404 kwa security.
         */
        if (ownerResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return null;
        }

        const owner = ownerResult.rows[0];

        /*
         * LEFT JOIN inaruhusu admin kurevoke link hata kama
         * user account yenyewe ilishafutwa.
         */
        const linkResult = await client.query(
            `
            SELECT
                ou.id,
                ou.public_id,
                ou.relationship_role,
                ou.is_primary,
                ou.can_manage_properties,
                ou.can_manage_finances,
                ou.created_at,
                ou.updated_at,

                u.public_id AS user_public_id,
                u.full_name,
                u.email,
                u.role AS user_role,
                u.is_verified,
                u.profile_image_url,
                u.deleted_at AS user_deleted_at

            FROM owner_users AS ou

            LEFT JOIN users AS u
                ON u.id = ou.user_id

            WHERE ou.owner_id = $1
              AND ou.public_id = $2
              AND ou.revoked_at IS NULL

            LIMIT 1
            FOR UPDATE OF ou
            `,
            [
                owner.id,
                linkPublicId
            ]
        );

        if (linkResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                linkNotFound: true
            };
        }

        const currentLink = linkResult.rows[0];

        /*
         * Primary representative haondolewi moja kwa moja.
         * Admin apromote mwingine kwanza; update endpoint
         * itamshusha primary wa zamani atomically.
         */
        if (currentLink.is_primary === true) {
            await client.query("ROLLBACK");

            return {
                primaryRevocationBlocked: true
            };
        }

        /*
         * Regular user haruhusiwi kuondoa relationship
         * yenye role ya owner.
         */
        if (
            authenticatedUser.role !== "admin" &&
            currentLink.relationship_role === "owner"
        ) {
            await client.query("ROLLBACK");

            return {
                forbidden: true,
                reason:
                    "Only administrators can revoke an owner relationship."
            };
        }

        const revokedLinkResult = await client.query(
            `
            UPDATE owner_users
            SET
            revoked_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
              AND revoked_at IS NULL
            RETURNING
                public_id AS link_public_id,
                relationship_role,
                is_primary,
                can_manage_properties,
                can_manage_finances,
                created_at,
                updated_at,
                revoked_at
            `,
            [currentLink.id]
        );

        await client.query("COMMIT");

        delete owner.id;

        return {
            forbidden: false,

            owner,

            user: {
                public_id: currentLink.user_public_id,
                full_name: currentLink.full_name,
                email: currentLink.email,
                role: currentLink.user_role,
                is_verified: currentLink.is_verified,
                profile_image_url:
                    currentLink.profile_image_url,
                deleted_at: currentLink.user_deleted_at
            },

            link: revokedLinkResult.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    getOwnerUsers,
    addOwnerUser,
    updateOwnerUser,
    revokeOwnerUser
};
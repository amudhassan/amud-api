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

module.exports = {
    getOwnerUsers,
    addOwnerUser
};
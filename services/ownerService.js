const { nanoid } = require("nanoid");

// Tumia pool import ile ile inayotumiwa ndani ya authService.js
const pool = require("../config/db");

const createOwner = async ({
    ownerData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const ownerPublicId = `owner_${nanoid(24)}`;

        const ownerResult = await client.query(
            `
            INSERT INTO owners (
                public_id,
                owner_type,
                display_name,
                registration_number,
                tax_identification_number,
                email,
                phone_number,
                alternative_phone,
                address,
                city,
                region,
                country,
                created_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13
            )
            RETURNING
                id,
                public_id,
                owner_type,
                display_name,
                registration_number,
                tax_identification_number,
                email,
                phone_number,
                alternative_phone,
                address,
                city,
                region,
                country,
                status,
                created_at,
                updated_at
            `,
            [
                ownerPublicId,
                ownerData.owner_type,
                ownerData.display_name.trim(),
                ownerData.registration_number?.trim() || null,
                ownerData.tax_identification_number?.trim() || null,
                ownerData.email?.trim().toLowerCase() || null,
                ownerData.phone_number?.trim() || null,
                ownerData.alternative_phone?.trim() || null,
                ownerData.address?.trim() || null,
                ownerData.city?.trim() || null,
                ownerData.region?.trim() || null,
                ownerData.country.trim(),
                authenticatedUser.id
            ]
        );

        const owner = ownerResult.rows[0];

        let ownerUserLink = null;

        /*
         * Regular user anayesajili owner ataunganishwa naye moja kwa moja.
         * Admin anaweza kusajili owner kwa niaba ya mtu mwingine bila
         * kujifanya representative wa owner huyo.
         */
        if (authenticatedUser.role !== "admin") {
            const ownerUserPublicId = `owner_user_${nanoid(24)}`;

            const ownerUserResult = await client.query(
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
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING
                    public_id,
                    relationship_role,
                    is_primary,
                    can_manage_properties,
                    can_manage_finances,
                    created_at
                `,
                [
                    ownerUserPublicId,
                    owner.id,
                    authenticatedUser.id,
                    "owner",
                    true,
                    true,
                    true
                ]
            );

            ownerUserLink = ownerUserResult.rows[0];
        }

        await client.query("COMMIT");

        delete owner.id;

        return {
            owner,
            owner_user_link: ownerUserLink
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const getOwners = async ({
    authenticatedUser,
    filters
}) => {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const values = [];
    const conditions = [
        "o.deleted_at IS NULL"
    ];

    let accessJoin = "";

    let relationshipFields = `
        NULL::VARCHAR AS relationship_role,
        NULL::BOOLEAN AS is_primary,
        NULL::BOOLEAN AS can_manage_properties,
        NULL::BOOLEAN AS can_manage_finances
    `;

    /*
     * Admin anaona owners wote.
     * Regular user anaona owners aliounganishwa nao pekee.
     */
    if (authenticatedUser.role !== "admin") {
        values.push(authenticatedUser.id);

        const userIdParameter = `$${values.length}`;

        accessJoin = `
            INNER JOIN owner_users AS ou_access
                ON ou_access.owner_id = o.id
               AND ou_access.user_id = ${userIdParameter}
               AND ou_access.revoked_at IS NULL
        `;

        relationshipFields = `
            ou_access.relationship_role,
            ou_access.is_primary,
            ou_access.can_manage_properties,
            ou_access.can_manage_finances
        `;
    }

    if (filters.search) {
        values.push(`%${filters.search.trim()}%`);

        const searchParameter = `$${values.length}`;

        conditions.push(`
            (
                o.display_name ILIKE ${searchParameter}
                OR COALESCE(o.email, '') ILIKE ${searchParameter}
                OR COALESCE(o.phone_number, '') ILIKE ${searchParameter}
                OR COALESCE(
                    o.registration_number,
                    ''
                ) ILIKE ${searchParameter}
                OR COALESCE(
                    o.tax_identification_number,
                    ''
                ) ILIKE ${searchParameter}
            )
        `);
    }

    if (filters.owner_type) {
        values.push(filters.owner_type);

        conditions.push(
            `o.owner_type = $${values.length}`
        );
    }

    if (filters.status) {
        values.push(filters.status);

        conditions.push(
            `o.status = $${values.length}`
        );
    }

    if (filters.country) {
        values.push(filters.country.trim());

        conditions.push(
            `LOWER(o.country) = LOWER($${values.length})`
        );
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await pool.query(
        `
        SELECT COUNT(*) AS total_records
        FROM owners AS o
        ${accessJoin}
        WHERE ${whereClause}
        `,
        values
    );

    const totalRecords = Number(
        countResult.rows[0].total_records
    );

    const dataValues = [...values];

    dataValues.push(limit);
    const limitParameter = `$${dataValues.length}`;

    dataValues.push(offset);
    const offsetParameter = `$${dataValues.length}`;

    const ownersResult = await pool.query(
        `
        SELECT
            o.public_id,
            o.owner_type,
            o.display_name,
            o.registration_number,
            o.tax_identification_number,
            o.email,
            o.phone_number,
            o.alternative_phone,
            o.address,
            o.city,
            o.region,
            o.country,
            o.status,
            o.created_at,
            o.updated_at,
            ${relationshipFields}
        FROM owners AS o
        ${accessJoin}
        WHERE ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT ${limitParameter}
        OFFSET ${offsetParameter}
        `,
        dataValues
    );

    return {
        owners: ownersResult.rows,
        pagination: {
            page,
            limit,
            total_records: totalRecords,
            total_pages: Math.ceil(
                totalRecords / limit
            )
        }
    };
};
const getOwnerByPublicId = async ({
    ownerPublicId,
    authenticatedUser
}) => {
    const values = [ownerPublicId];

    let accessJoin = "";

    let relationshipFields = `
        NULL::VARCHAR(30) AS relationship_role,
        NULL::BOOLEAN AS is_primary,
        NULL::BOOLEAN AS can_manage_properties,
        NULL::BOOLEAN AS can_manage_finances
    `;

    /*
     * Admin anaweza kuona owner yeyote.
     * Regular user lazima awe na active link kwenye owner_users.
     */
    if (authenticatedUser.role !== "admin") {
        values.push(authenticatedUser.id);

        const userIdParameter = `$${values.length}`;

        accessJoin = `
            INNER JOIN owner_users AS ou_access
                ON ou_access.owner_id = o.id
               AND ou_access.user_id = ${userIdParameter}
               AND ou_access.revoked_at IS NULL
        `;

        relationshipFields = `
            ou_access.relationship_role,
            ou_access.is_primary,
            ou_access.can_manage_properties,
            ou_access.can_manage_finances
        `;
    }

    const result = await pool.query(
        `
        SELECT
            o.public_id,
            o.owner_type,
            o.display_name,
            o.registration_number,
            o.tax_identification_number,
            o.email,
            o.phone_number,
            o.alternative_phone,
            o.address,
            o.city,
            o.region,
            o.country,
            o.status,
            o.created_at,
            o.updated_at,

            ${relationshipFields},

            (
                SELECT COUNT(*)::INTEGER
                FROM owner_users AS ou
                WHERE ou.owner_id = o.id
                  AND ou.revoked_at IS NULL
            ) AS active_user_count,

            (
                SELECT COUNT(*)::INTEGER
                FROM property_owners AS po
                WHERE po.owner_id = o.id
                  AND po.effective_to IS NULL
            ) AS active_property_count,

            (
                SELECT COUNT(*)::INTEGER
                FROM owner_shareholders AS os
                WHERE os.company_owner_id = o.id
                  AND os.is_active = TRUE
                  AND os.effective_to IS NULL
            ) AS active_shareholder_count

        FROM owners AS o

        ${accessJoin}

        WHERE o.public_id = $1
          AND o.deleted_at IS NULL

        LIMIT 1
        `,
        values
    );

    return result.rows[0] || null;
};

module.exports = {
    createOwner,
    getOwners,
    getOwnerByPublicId
};
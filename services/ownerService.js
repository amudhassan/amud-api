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

const updateOwner = async ({
    ownerPublicId,
    ownerData,
    authenticatedUser
}) => {
    const accessValues = [ownerPublicId];

    let accessJoin = "";

    /*
     * Regular user lazima awe active primary representative.
     * Admin hahitaji owner_users relationship.
     */
    if (authenticatedUser.role !== "admin") {
        accessValues.push(authenticatedUser.id);

        accessJoin = `
            INNER JOIN owner_users AS ou_access
                ON ou_access.owner_id = o.id
               AND ou_access.user_id = $2
               AND ou_access.revoked_at IS NULL
               AND ou_access.is_primary = TRUE
               AND ou_access.relationship_role IN (
                    'owner',
                    'representative',
                    'manager'
               )
        `;
    }

    const ownerAccessResult = await pool.query(
        `
        SELECT o.id
        FROM owners AS o
        ${accessJoin}
        WHERE o.public_id = $1
          AND o.deleted_at IS NULL
        LIMIT 1
        `,
        accessValues
    );

    if (ownerAccessResult.rows.length === 0) {
        return null;
    }

    const ownerId = ownerAccessResult.rows[0].id;

    const regularUserFields = [
        "display_name",
        "registration_number",
        "tax_identification_number",
        "email",
        "phone_number",
        "alternative_phone",
        "address",
        "city",
        "region",
        "country"
    ];

    const adminOnlyFields = [
        "owner_type",
        "status"
    ];

    const allowedFields =
        authenticatedUser.role === "admin"
            ? [...regularUserFields, ...adminOnlyFields]
            : regularUserFields;

    const nullableFields = new Set([
        "registration_number",
        "tax_identification_number",
        "email",
        "phone_number",
        "alternative_phone",
        "address",
        "city",
        "region"
    ]);

    const updateFields = [];
    const updateValues = [];

    for (const field of allowedFields) {
        if (
            !Object.prototype.hasOwnProperty.call(
                ownerData,
                field
            )
        ) {
            continue;
        }

        let value = ownerData[field];

        if (typeof value === "string") {
            value = value.trim();
        }

        if (field === "email" && value) {
            value = value.toLowerCase();
        }

        if (
            nullableFields.has(field) &&
            (value === "" || value === null)
        ) {
            value = null;
        }

        updateValues.push(value);

        updateFields.push(
            `${field} = $${updateValues.length}`
        );
    }

    /*
     * Validator inazuia empty body, lakini hii inalinda
     * service ikiwa itaitwa kutoka sehemu nyingine.
     */
    if (updateFields.length === 0) {
        return {
            noChanges: true
        };
    }

    updateValues.push(ownerId);
    const ownerIdParameter = `$${updateValues.length}`;

    const updateResult = await pool.query(
        `
        UPDATE owners
        SET
            ${updateFields.join(", ")},
            updated_at = NOW()
        WHERE id = ${ownerIdParameter}
          AND deleted_at IS NULL
        RETURNING
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
        updateValues
    );

    return {
        noChanges: false,
        owner: updateResult.rows[0]
    };
};

const softDeleteOwner = async ({
    ownerPublicId,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const accessValues = [ownerPublicId];
        let accessJoin = "";

        /*
         * Regular user lazima awe active primary representative.
         * Admin hahitaji owner_users relationship.
         */
        if (authenticatedUser.role !== "admin") {
            accessValues.push(authenticatedUser.id);

            accessJoin = `
                INNER JOIN owner_users AS ou_access
                    ON ou_access.owner_id = o.id
                   AND ou_access.user_id = $2
                   AND ou_access.revoked_at IS NULL
                   AND ou_access.is_primary = TRUE
                   AND ou_access.relationship_role IN (
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

        if (ownerResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return null;
        }

        const owner = ownerResult.rows[0];

        /*
         * Tunazuia deletion ikiwa owner bado anahusika
         * kwenye active ownership au shareholding.
         */
        const dependencyResult = await client.query(
            `
            SELECT
                EXISTS (
                    SELECT 1
                    FROM property_owners
                    WHERE owner_id = $1
                      AND effective_to IS NULL
                ) AS has_active_property_ownership,

                EXISTS (
                    SELECT 1
                    FROM owner_shareholders
                    WHERE company_owner_id = $1
                      AND is_active = TRUE
                      AND effective_to IS NULL
                ) AS has_active_company_shareholders,

                EXISTS (
                    SELECT 1
                    FROM owner_shareholders
                    WHERE shareholder_owner_id = $1
                      AND is_active = TRUE
                      AND effective_to IS NULL
                ) AS has_active_shareholding
            `,
            [owner.id]
        );

        const dependencies = dependencyResult.rows[0];

        const deletionBlocked =
            dependencies.has_active_property_ownership ||
            dependencies.has_active_company_shareholders ||
            dependencies.has_active_shareholding;

        if (deletionBlocked) {
            await client.query("ROLLBACK");

            return {
                blocked: true,
                dependencies
            };
        }

        const revokedLinksResult = await client.query(
            `
            UPDATE owner_users
            SET
                revoked_at = NOW(),
                updated_at = NOW()
            WHERE owner_id = $1
              AND revoked_at IS NULL
            RETURNING id
            `,
            [owner.id]
        );

        const deletedOwnerResult = await client.query(
            `
            UPDATE owners
            SET
                status = 'inactive',
                deleted_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
              AND deleted_at IS NULL
            RETURNING
                public_id,
                owner_type,
                display_name,
                status,
                deleted_at,
                updated_at
            `,
            [owner.id]
        );

        await client.query("COMMIT");

        return {
            blocked: false,
            owner: deletedOwnerResult.rows[0],
            revoked_user_links: revokedLinksResult.rowCount
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    createOwner,
    getOwners,
    getOwnerByPublicId,
    updateOwner,
    softDeleteOwner
};
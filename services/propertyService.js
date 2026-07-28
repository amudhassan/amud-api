const { nanoid } = require("nanoid");
const pool = require("../config/db");

/**
 * Retrieve properties according to the authenticated user's access.
 *
 * Admin:
 * - Can view all non-deleted properties.
 *
 * Regular user:
 * - Can only view properties connected to owners for which the user
 *   has an active owner_users relationship.
 */
const getProperties = async ({
    filters,
    authenticatedUser
}) => {
    const {
        search,
        property_type,
        usage_category,
        operational_status,
        is_multi_unit,
        city,
        region,
        country,
        owner_public_id,
        page = 1,
        limit = 20
    } = filters;

    const values = [];
    const conditions = [
        "p.deleted_at IS NULL"
    ];

    /*
     * Regular users only see properties belonging to owners
     * with whom they have an active owner_users relationship.
     */
    if (authenticatedUser.role !== "admin") {
        values.push(authenticatedUser.id);

        conditions.push(`
            EXISTS (
                SELECT 1

                FROM property_owners AS po_access

                INNER JOIN owners AS owner_access
                    ON owner_access.id = po_access.owner_id
                   AND owner_access.deleted_at IS NULL

                INNER JOIN owner_users AS user_access
                    ON user_access.owner_id = owner_access.id
                   AND user_access.user_id = $${values.length}
                   AND user_access.revoked_at IS NULL

                WHERE po_access.property_id = p.id
                  AND po_access.effective_to IS NULL
            )
        `);
    }

    if (search) {
        values.push(`%${search}%`);

        conditions.push(`
            (
                p.property_name ILIKE $${values.length}
                OR p.property_code ILIKE $${values.length}
                OR COALESCE(p.description, '') ILIKE $${values.length}
                OR COALESCE(p.address, '') ILIKE $${values.length}
                OR COALESCE(p.city, '') ILIKE $${values.length}
                OR COALESCE(p.region, '') ILIKE $${values.length}
                OR COALESCE(p.country, '') ILIKE $${values.length}
            )
        `);
    }

    if (property_type) {
        values.push(property_type);

        conditions.push(
            `p.property_type = $${values.length}`
        );
    }

    if (usage_category) {
        values.push(usage_category);

        conditions.push(
            `p.usage_category = $${values.length}`
        );
    }

    if (operational_status) {
        values.push(operational_status);

        conditions.push(
            `p.operational_status = $${values.length}`
        );
    }

    if (
        typeof is_multi_unit === "boolean"
    ) {
        values.push(is_multi_unit);

        conditions.push(
            `p.is_multi_unit = $${values.length}`
        );
    }

    if (city) {
        values.push(city);

        conditions.push(
            `LOWER(p.city) = LOWER($${values.length})`
        );
    }

    if (region) {
        values.push(region);

        conditions.push(
            `LOWER(p.region) = LOWER($${values.length})`
        );
    }

    if (country) {
        values.push(country);

        conditions.push(
            `LOWER(p.country) = LOWER($${values.length})`
        );
    }

    /*
     * Filter properties by one specific active owner.
     */
    if (owner_public_id) {
        values.push(owner_public_id);

        conditions.push(`
            EXISTS (
                SELECT 1

                FROM property_owners AS po_filter

                INNER JOIN owners AS owner_filter
                    ON owner_filter.id = po_filter.owner_id
                   AND owner_filter.deleted_at IS NULL

                WHERE po_filter.property_id = p.id
                  AND po_filter.effective_to IS NULL
                  AND owner_filter.public_id =
                      $${values.length}
            )
        `);
    }

    const whereClause =
        conditions.length > 0
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

    /*
     * Total count uses the same authorization and filters,
     * but without pagination.
     */
    const countResult = await pool.query(
        `
        SELECT
            COUNT(*)::INTEGER AS total_items

        FROM properties AS p

        ${whereClause}
        `,
        values
    );

    const totalItems =
        countResult.rows[0].total_items;

    const offset =
        (page - 1) * limit;

    const dataValues = [
        ...values,
        limit,
        offset
    ];

    const limitParameter =
        `$${dataValues.length - 1}`;

    const offsetParameter =
        `$${dataValues.length}`;

    const propertiesResult = await pool.query(
        `
        SELECT
            p.public_id,
            p.property_code,
            p.property_name,
            p.property_type,
            p.usage_category,
            p.description,
            p.address,
            p.city,
            p.region,
            p.country,
            p.latitude,
            p.longitude,
            p.year_built,
            p.is_multi_unit,
            p.operational_status,
            p.created_at,
            p.updated_at,

            ownership_summary.active_owner_count,

            ownership_summary
                .total_active_ownership,

            (
                ownership_summary
                    .total_active_ownership = 100
            ) AS ownership_complete,

            primary_owner.public_id
                AS primary_owner_public_id,

            primary_owner.display_name
                AS primary_owner_name,

            primary_owner.owner_type
                AS primary_owner_type

        FROM properties AS p

        LEFT JOIN LATERAL (
            SELECT
                COUNT(DISTINCT po.owner_id)::INTEGER
                    AS active_owner_count,

                COALESCE(
                    SUM(po.ownership_percentage),
                    0
                )::NUMERIC(12,4)
                    AS total_active_ownership

            FROM property_owners AS po

            INNER JOIN owners AS owner_record
                ON owner_record.id = po.owner_id
               AND owner_record.deleted_at IS NULL

            WHERE po.property_id = p.id
              AND po.effective_to IS NULL
        ) AS ownership_summary
            ON TRUE

        LEFT JOIN LATERAL (
            SELECT
                owner_record.public_id,
                owner_record.display_name,
                owner_record.owner_type

            FROM property_owners AS po

            INNER JOIN owners AS owner_record
                ON owner_record.id = po.owner_id
               AND owner_record.deleted_at IS NULL

            WHERE po.property_id = p.id
              AND po.effective_to IS NULL

            ORDER BY
                po.is_primary_contact DESC,
                po.ownership_percentage DESC,
                po.created_at ASC

            LIMIT 1
        ) AS primary_owner
            ON TRUE

        ${whereClause}

        ORDER BY
            p.created_at DESC,
            p.id DESC

        LIMIT ${limitParameter}
        OFFSET ${offsetParameter}
        `,
        dataValues
    );

    const properties =
        propertiesResult.rows.map(property => ({
            public_id:
                property.public_id,

            property_code:
                property.property_code,

            property_name:
                property.property_name,

            property_type:
                property.property_type,

            usage_category:
                property.usage_category,

            description:
                property.description,

            location: {
                address:
                    property.address,

                city:
                    property.city,

                region:
                    property.region,

                country:
                    property.country,

                latitude:
                    property.latitude === null
                        ? null
                        : Number(property.latitude),

                longitude:
                    property.longitude === null
                        ? null
                        : Number(property.longitude)
            },

            year_built:
                property.year_built,

            is_multi_unit:
                property.is_multi_unit,

            operational_status:
                property.operational_status,

            primary_owner:
                property.primary_owner_public_id
                    ? {
                        public_id:
                            property
                                .primary_owner_public_id,

                        display_name:
                            property
                                .primary_owner_name,

                        owner_type:
                            property
                                .primary_owner_type
                    }
                    : null,

            ownership_summary: {
                active_owner_count:
                    property.active_owner_count,

                total_active_ownership:
                    Number(
                        property
                            .total_active_ownership
                    ),

                remaining_ownership:
                    Number(
                        (
                            100 -
                            Number(
                                property
                                    .total_active_ownership
                            )
                        ).toFixed(4)
                    ),

                ownership_complete:
                    property.ownership_complete
            },

            created_at:
                property.created_at,

            updated_at:
                property.updated_at
        }));

    const totalPages =
        totalItems === 0
            ? 0
            : Math.ceil(totalItems / limit);

    return {
        properties,

        pagination: {
            page,
            limit,
            total_items: totalItems,
            total_pages: totalPages,
            has_previous_page:
                page > 1,

            has_next_page:
                page < totalPages
        }
    };
};
const createProperty = async ({
    propertyData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const ownerships = propertyData.ownerships;

        const ownerPublicIds = ownerships.map(
            ownership => ownership.owner_public_id
        );

        const totalOwnership = Number(
            ownerships
                .reduce(
                    (total, ownership) =>
                        total +
                        Number(
                            ownership.ownership_percentage
                        ),
                    0
                )
                .toFixed(4)
        );

        if (totalOwnership > 100) {
            await client.query("ROLLBACK");

            return {
                ownershipLimitExceeded: true,
                total_ownership: totalOwnership
            };
        }

        const primaryContactCount =
            ownerships.filter(
                ownership =>
                    ownership.is_primary_contact === true
            ).length;

        if (primaryContactCount > 1) {
            await client.query("ROLLBACK");

            return {
                multiplePrimaryContacts: true
            };
        }

        /*
         * Owner mmoja akiwekwa peke yake, anakuwa primary
         * automatically kama request haijaweka primary.
         */
        const normalizedOwnerships =
            ownerships.map(ownership => ({
                ...ownership,

                ownership_type:
                    ownership.ownership_type ||
                    "legal",

                is_primary_contact:
                    ownerships.length === 1
                        ? true
                        : Boolean(
                            ownership.is_primary_contact
                        )
            }));

        const ownerValues = [ownerPublicIds];

        let accessJoin = "";

        if (authenticatedUser.role !== "admin") {
            ownerValues.push(authenticatedUser.id);

            accessJoin = `
                INNER JOIN owner_users AS requester_link
                    ON requester_link.owner_id = o.id
                   AND requester_link.user_id = $2
                   AND requester_link.revoked_at IS NULL
                   AND requester_link.can_manage_properties = TRUE
                   AND requester_link.relationship_role IN (
                       'owner',
                       'representative',
                       'manager'
                   )
            `;
        }

        /*
         * Lock all owners participating in this property.
         */
        const ownersResult = await client.query(
            `
            SELECT
                o.id,
                o.public_id,
                o.owner_type,
                o.display_name,
                o.status
            FROM owners AS o

            ${accessJoin}

            WHERE o.public_id = ANY($1::TEXT[])
              AND o.deleted_at IS NULL
              AND o.status = 'active'

            ORDER BY o.id

            FOR UPDATE OF o
            `,
            ownerValues
        );

        /*
         * Kwa regular user, hii inaweza kumaanisha owner
         * hayupo au user hana property-management access.
         */
        if (
            ownersResult.rows.length !==
            ownerPublicIds.length
        ) {
            await client.query("ROLLBACK");

            return {
                ownersUnavailable: true
            };
        }

        const ownerMap = new Map(
            ownersResult.rows.map(owner => [
                owner.public_id,
                owner
            ])
        );

        const propertyPublicId =
            `property_${nanoid(24)}`;

        const propertyCode =
            `PRP-${nanoid(10).toUpperCase()}`;

        const propertyResult = await client.query(
            `
            INSERT INTO properties (
                public_id,
                property_code,
                property_name,
                property_type,
                usage_category,
                description,
                address,
                city,
                region,
                country,
                latitude,
                longitude,
                year_built,
                is_multi_unit,
                operational_status,
                created_by
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13,
                $14,
                'inactive',
                $15
            )
            RETURNING
                id,
                public_id,
                property_code,
                property_name,
                property_type,
                usage_category,
                description,
                address,
                city,
                region,
                country,
                latitude,
                longitude,
                year_built,
                is_multi_unit,
                operational_status,
                created_at,
                updated_at
            `,
            [
                propertyPublicId,
                propertyCode,
                propertyData.property_name,
                propertyData.property_type,
                propertyData.usage_category,
                propertyData.description || null,
                propertyData.address || null,
                propertyData.city || null,
                propertyData.region || null,
                propertyData.country,
                propertyData.latitude ?? null,
                propertyData.longitude ?? null,
                propertyData.year_built ?? null,
                propertyData.is_multi_unit,
                authenticatedUser.id
            ]
        );

        const property = propertyResult.rows[0];

        const createdOwnerships = [];

        for (
            const ownership
            of normalizedOwnerships
        ) {
            const owner = ownerMap.get(
                ownership.owner_public_id
            );

            const ownershipPublicId =
                `property_owner_${nanoid(24)}`;

            const ownershipResult =
                await client.query(
                    `
                    INSERT INTO property_owners (
                        public_id,
                        property_id,
                        owner_id,
                        ownership_percentage,
                        ownership_type,
                        is_primary_contact,
                        effective_from
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        COALESCE(
                            $7::DATE,
                            CURRENT_DATE
                        )
                    )
                    RETURNING
                        public_id
                            AS ownership_public_id,

                        ownership_percentage,
                        ownership_type,
                        is_primary_contact,
                        effective_from,
                        effective_to,
                        created_at,
                        updated_at
                    `,
                    [
                        ownershipPublicId,
                        property.id,
                        owner.id,
                        ownership
                            .ownership_percentage,
                        ownership.ownership_type,
                        ownership
                            .is_primary_contact,
                        ownership.effective_from ||
                            null
                    ]
                );

            const createdOwnership =
                ownershipResult.rows[0];

            createdOwnership
                .ownership_percentage =
                Number(
                    createdOwnership
                        .ownership_percentage
                );

            createdOwnerships.push({
                owner: {
                    public_id:
                        owner.public_id,

                    owner_type:
                        owner.owner_type,

                    display_name:
                        owner.display_name,

                    status:
                        owner.status
                },

                ownership:
                    createdOwnership
            });
        }

        await client.query("COMMIT");

        delete property.id;

        return {
            property: {
                ...property,

                latitude:
                    property.latitude === null
                        ? null
                        : Number(property.latitude),

                longitude:
                    property.longitude === null
                        ? null
                        : Number(property.longitude)
            },

            ownership_summary: {
                active_owner_count:
                    createdOwnerships.length,

                total_active_ownership:
                    totalOwnership,

                remaining_ownership:
                    Number(
                        (
                            100 -
                            totalOwnership
                        ).toFixed(4)
                    ),

                ownership_complete:
                    totalOwnership === 100
            },

            ownerships:
                createdOwnerships
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
const getSingleProperty = async ({
    propertyPublicId,
    authenticatedUser
}) => {
    const values = [propertyPublicId];

    const conditions = [
        "p.public_id = $1",
        "p.deleted_at IS NULL"
    ];

    /*
     * Regular user ataona property tu kama ameunganishwa
     * na angalau owner mmoja wa property hiyo.
     */
    if (authenticatedUser.role !== "admin") {
        values.push(authenticatedUser.id);

        conditions.push(`
            EXISTS (
                SELECT 1

                FROM property_owners AS po_access

                INNER JOIN owners AS owner_access
                    ON owner_access.id =
                        po_access.owner_id
                   AND owner_access.deleted_at IS NULL

                INNER JOIN owner_users AS user_access
                    ON user_access.owner_id =
                        owner_access.id
                   AND user_access.user_id =
                        $${values.length}
                   AND user_access.revoked_at IS NULL

                WHERE po_access.property_id = p.id
                  AND po_access.effective_to IS NULL
            )
        `);
    }

    const propertyResult = await pool.query(
        `
        SELECT
            p.id,
            p.public_id,
            p.property_code,
            p.property_name,
            p.property_type,
            p.usage_category,
            p.description,
            p.address,
            p.city,
            p.region,
            p.country,
            p.latitude,
            p.longitude,
            p.year_built,
            p.is_multi_unit,
            p.operational_status,
            p.created_at,
            p.updated_at

        FROM properties AS p

        WHERE ${conditions.join(" AND ")}

        LIMIT 1
        `,
        values
    );

    if (propertyResult.rows.length === 0) {
        return null;
    }

    const property = propertyResult.rows[0];

    const ownershipResult = await pool.query(
        `
        SELECT
            po.public_id
                AS ownership_public_id,

            po.ownership_percentage,
            po.ownership_type,
            po.is_primary_contact,
            po.effective_from,
            po.effective_to,
            po.created_at,
            po.updated_at,

            owner_record.public_id
                AS owner_public_id,

            owner_record.owner_type,
            owner_record.display_name,
            owner_record.registration_number,
            owner_record.tax_identification_number,
            owner_record.email,
            owner_record.phone_number,
            owner_record.city,
            owner_record.region,
            owner_record.country,
            owner_record.status

        FROM property_owners AS po

        INNER JOIN owners AS owner_record
            ON owner_record.id = po.owner_id
           AND owner_record.deleted_at IS NULL

        WHERE po.property_id = $1
          AND po.effective_to IS NULL

        ORDER BY
            po.is_primary_contact DESC,
            po.ownership_percentage DESC,
            po.created_at ASC
        `,
        [property.id]
    );

    const ownerships =
        ownershipResult.rows.map(row => ({
            ownership_public_id:
                row.ownership_public_id,

            ownership_percentage:
                Number(
                    row.ownership_percentage
                ),

            ownership_type:
                row.ownership_type,

            is_primary_contact:
                row.is_primary_contact,

            effective_from:
                row.effective_from,

            effective_to:
                row.effective_to,

            owner: {
                public_id:
                    row.owner_public_id,

                owner_type:
                    row.owner_type,

                display_name:
                    row.display_name,

                registration_number:
                    row.registration_number,

                tax_identification_number:
                    row.tax_identification_number,

                email:
                    row.email,

                phone_number:
                    row.phone_number,

                city:
                    row.city,

                region:
                    row.region,

                country:
                    row.country,

                status:
                    row.status
            },

            created_at:
                row.created_at,

            updated_at:
                row.updated_at
        }));

    const totalActiveOwnership = Number(
        ownerships
            .reduce(
                (total, item) =>
                    total +
                    item.ownership_percentage,
                0
            )
            .toFixed(4)
    );

    const primaryOwnership =
        ownerships.find(
            item =>
                item.is_primary_contact === true
        ) || null;

    delete property.id;

    return {
        property: {
            ...property,

            latitude:
                property.latitude === null
                    ? null
                    : Number(property.latitude),

            longitude:
                property.longitude === null
                    ? null
                    : Number(property.longitude)
        },

        ownership_summary: {
            active_owner_count:
                ownerships.length,

            total_active_ownership:
                totalActiveOwnership,

            remaining_ownership:
                Number(
                    (
                        100 -
                        totalActiveOwnership
                    ).toFixed(4)
                ),

            ownership_complete:
                totalActiveOwnership === 100,

            primary_owner:
                primaryOwnership
                    ? {
                        public_id:
                            primaryOwnership
                                .owner.public_id,

                        display_name:
                            primaryOwnership
                                .owner.display_name,

                        owner_type:
                            primaryOwnership
                                .owner.owner_type
                    }
                    : null
        },

        ownerships
    };
};
const updateProperty = async ({
    propertyPublicId,
    propertyData,
    authenticatedUser
}) => {
    const allowedFields = [
        "property_name",
        "property_type",
        "usage_category",
        "description",
        "address",
        "city",
        "region",
        "country",
        "latitude",
        "longitude",
        "year_built",
        "is_multi_unit"
    ];

    const updateFields = [];
    const values = [];

    for (const field of allowedFields) {
        if (
            !Object.prototype.hasOwnProperty.call(
                propertyData,
                field
            )
        ) {
            continue;
        }

        values.push(propertyData[field]);

        updateFields.push(
            `${field} = $${values.length}`
        );
    }

    if (updateFields.length === 0) {
        return {
            noChanges: true
        };
    }

    values.push(propertyPublicId);

    const propertyIdParameter =
        `$${values.length}`;

    let accessCondition = "";

    /*
     * Regular user lazima awe na active relationship
     * na owner wa property pamoja na management permission.
     */
    if (authenticatedUser.role !== "admin") {
        values.push(authenticatedUser.id);

        const userIdParameter =
            `$${values.length}`;

        accessCondition = `
            AND EXISTS (
                SELECT 1

                FROM property_owners AS po_access

                INNER JOIN owners AS owner_access
                    ON owner_access.id =
                        po_access.owner_id
                   AND owner_access.deleted_at IS NULL

                INNER JOIN owner_users AS user_access
                    ON user_access.owner_id =
                        owner_access.id
                   AND user_access.user_id =
                        ${userIdParameter}
                   AND user_access.revoked_at IS NULL
                   AND user_access
                        .can_manage_properties = TRUE
                   AND user_access.relationship_role IN (
                        'owner',
                        'representative',
                        'manager'
                   )

                WHERE po_access.property_id = p.id
                  AND po_access.effective_to IS NULL
            )
        `;
    }

    const result = await pool.query(
        `
        UPDATE properties AS p

        SET
            ${updateFields.join(", ")},
            updated_at = NOW()

        WHERE p.public_id =
            ${propertyIdParameter}

          AND p.deleted_at IS NULL

          ${accessCondition}

        RETURNING
            p.public_id,
            p.property_code,
            p.property_name,
            p.property_type,
            p.usage_category,
            p.description,
            p.address,
            p.city,
            p.region,
            p.country,
            p.latitude,
            p.longitude,
            p.year_built,
            p.is_multi_unit,
            p.operational_status,
            p.created_at,
            p.updated_at
        `,
        values
    );

    /*
     * Kwa regular user, 0 rows inaweza kumaanisha:
     * - property haipo
     * - property imefutwa
     * - user hana authorization
     */
    if (result.rows.length === 0) {
        return null;
    }

    const property = result.rows[0];

    return {
        property: {
            ...property,

            latitude:
                property.latitude === null
                    ? null
                    : Number(property.latitude),

            longitude:
                property.longitude === null
                    ? null
                    : Number(property.longitude)
        }
    };
};
module.exports = {
    getProperties,
    createProperty,
    getSingleProperty,
    updateProperty
};
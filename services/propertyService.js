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

module.exports = {
    getProperties
};
const { nanoid } = require("nanoid");
const pool = require("../config/db");

const getPropertyUnits = async ({
    propertyPublicId,
    filters,
    authenticatedUser
}) => {
    const propertyValues = [
        propertyPublicId
    ];

    let accessCondition = "";

    /*
     * Admin anaona property yoyote.
     * Regular user lazima awe linked na angalau
     * owner mmoja wa property kupitia owner_users.
     */
    if (authenticatedUser.role !== "admin") {
        propertyValues.push(
            authenticatedUser.id
        );

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
                   AND user_access.user_id = $2
                   AND user_access.revoked_at IS NULL

                WHERE po_access.property_id = p.id
                  AND po_access.effective_to IS NULL
            )
        `;
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
            p.operational_status,
            p.is_multi_unit,
            p.created_at,
            p.updated_at

        FROM properties AS p

        WHERE p.public_id = $1
          AND p.deleted_at IS NULL

          ${accessCondition}

        LIMIT 1
        `,
        propertyValues
    );

    /*
     * Kwa regular user, null inaweza kumaanisha
     * property haipo au hana ruhusa ya kuiona.
     */
    if (propertyResult.rows.length === 0) {
        return null;
    }

    const property = propertyResult.rows[0];

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const whereConditions = [
        "unit_record.property_id = $1",
        "unit_record.deleted_at IS NULL"
    ];

    const queryValues = [
        property.id
    ];

    const addQueryValue = value => {
        queryValues.push(value);
        return `$${queryValues.length}`;
    };

    if (filters.search) {
        const placeholder = addQueryValue(
            `%${filters.search}%`
        );

        whereConditions.push(`
            (
                unit_record.unit_code ILIKE ${placeholder}
                OR unit_record.unit_name ILIKE ${placeholder}
                OR unit_record.description ILIKE ${placeholder}
            )
        `);
    }

    if (filters.unit_type) {
        const placeholder = addQueryValue(
            filters.unit_type
        );

        whereConditions.push(
            `unit_record.unit_type = ${placeholder}`
        );
    }

    if (filters.operational_status) {
        const placeholder = addQueryValue(
            filters.operational_status
        );

        whereConditions.push(
            `unit_record.operational_status = ${placeholder}`
        );
    }

    if (
        filters.floor_number !== undefined
    ) {
        const placeholder = addQueryValue(
            filters.floor_number
        );

        whereConditions.push(
            `unit_record.floor_number = ${placeholder}`
        );
    }

    if (filters.bedrooms !== undefined) {
        const placeholder = addQueryValue(
            filters.bedrooms
        );

        whereConditions.push(
            `unit_record.bedrooms = ${placeholder}`
        );
    }

    if (filters.bathrooms !== undefined) {
        const placeholder = addQueryValue(
            filters.bathrooms
        );

        whereConditions.push(
            `unit_record.bathrooms = ${placeholder}`
        );
    }

    const whereClause =
        whereConditions.join(" AND ");

    const countResult = await pool.query(
        `
        SELECT
            COUNT(*)::INTEGER AS total_items

        FROM units AS unit_record

        WHERE ${whereClause}
        `,
        queryValues
    );

    const totalItems =
        countResult.rows[0].total_items;

    const limitPlaceholder =
        addQueryValue(limit);

    const offsetPlaceholder =
        addQueryValue(offset);

    const unitsResult = await pool.query(
        `
        SELECT
            unit_record.public_id,
            unit_record.unit_code,
            unit_record.unit_name,
            unit_record.unit_type,
            unit_record.floor_number,
            unit_record.bedrooms,
            unit_record.bathrooms,
            unit_record.area_size,
            unit_record.area_unit,
            unit_record.description,
            unit_record.operational_status,
            unit_record.created_at,
            unit_record.updated_at,

            creator.public_id
                AS created_by_public_id,

            creator.full_name
                AS created_by_name

        FROM units AS unit_record

        LEFT JOIN users AS creator
            ON creator.id =
                unit_record.created_by

        WHERE ${whereClause}

        ORDER BY
            unit_record.created_at DESC,
            unit_record.id DESC

        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
        `,
        queryValues
    );

    const units = unitsResult.rows.map(
        unit => ({
            public_id:
                unit.public_id,

            unit_code:
                unit.unit_code,

            unit_name:
                unit.unit_name,

            unit_type:
                unit.unit_type,

            floor_number:
                unit.floor_number,

            bedrooms:
                unit.bedrooms,

            bathrooms:
                Number(unit.bathrooms),

            area_size:
                unit.area_size === null
                    ? null
                    : Number(unit.area_size),

            area_unit:
                unit.area_unit,

            description:
                unit.description,

            operational_status:
                unit.operational_status,

            created_by: {
                public_id:
                    unit.created_by_public_id,

                full_name:
                    unit.created_by_name
            },

            created_at:
                unit.created_at,

            updated_at:
                unit.updated_at
        })
    );

    const statusSummaryResult =
        await pool.query(
            `
            SELECT
                COUNT(*)::INTEGER
                    AS total_units,

                COUNT(*) FILTER (
                    WHERE operational_status =
                        'inactive'
                )::INTEGER
                    AS inactive_units,

                COUNT(*) FILTER (
                    WHERE operational_status =
                        'available'
                )::INTEGER
                    AS available_units,

                COUNT(*) FILTER (
                    WHERE operational_status =
                        'reserved'
                )::INTEGER
                    AS reserved_units,

                COUNT(*) FILTER (
                    WHERE operational_status =
                        'occupied'
                )::INTEGER
                    AS occupied_units,

                COUNT(*) FILTER (
                    WHERE operational_status =
                        'maintenance'
                )::INTEGER
                    AS maintenance_units

            FROM units

            WHERE property_id = $1
              AND deleted_at IS NULL
            `,
            [property.id]
        );

    const totalPages =
        totalItems === 0
            ? 0
            : Math.ceil(totalItems / limit);

    delete property.id;

    return {
        property,

        summary:
            statusSummaryResult.rows[0],

        units,

        pagination: {
            current_page: page,
            per_page: limit,
            total_items: totalItems,
            total_pages: totalPages,
            has_previous_page:
                page > 1,
            has_next_page:
                page < totalPages
        },

        filters: {
            search:
                filters.search || null,

            unit_type:
                filters.unit_type || null,

            operational_status:
                filters.operational_status ||
                null,

            floor_number:
                filters.floor_number ??
                null,

            bedrooms:
                filters.bedrooms ??
                null,

            bathrooms:
                filters.bathrooms ??
                null
        }
    };
};
const createUnit = async ({
    propertyPublicId,
    unitData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const propertyValues = [
            propertyPublicId
        ];

        let accessCondition = "";

        /*
         * Regular user lazima awe na active management
         * permission kupitia angalau owner mmoja wa property.
         */
        if (authenticatedUser.role !== "admin") {
            propertyValues.push(
                authenticatedUser.id
            );

            accessCondition = `
                AND EXISTS (
                    SELECT 1

                    FROM property_owners AS po_access

                    INNER JOIN owners AS owner_access
                        ON owner_access.id =
                            po_access.owner_id
                       AND owner_access.deleted_at IS NULL
                       AND owner_access.status = 'active'

                    INNER JOIN owner_users AS user_access
                        ON user_access.owner_id =
                            owner_access.id
                       AND user_access.user_id = $2
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

        /*
         * Property lock inazuia concurrent creation
         * kuvunja single-unit property rule.
         */
        const propertyResult = await client.query(
            `
            SELECT
                p.id,
                p.public_id,
                p.property_code,
                p.property_name,
                p.property_type,
                p.usage_category,
                p.operational_status,
                p.is_multi_unit,
                p.created_at,
                p.updated_at

            FROM properties AS p

            WHERE p.public_id = $1
              AND p.deleted_at IS NULL

              ${accessCondition}

            LIMIT 1

            FOR UPDATE OF p
            `,
            propertyValues
        );

        if (propertyResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return null;
        }

        const property =
            propertyResult.rows[0];

        if (
            property.operational_status === "sold"
        ) {
            await client.query("ROLLBACK");

            return {
                soldProperty: true
            };
        }

        /*
         * Helpful pre-check.
         * Database trigger bado ndiyo final protection.
         */
        if (property.is_multi_unit === false) {
            const existingUnitResult =
                await client.query(
                    `
                    SELECT
                        public_id,
                        unit_code,
                        unit_name,
                        operational_status

                    FROM units

                    WHERE property_id = $1
                      AND deleted_at IS NULL

                    LIMIT 1
                    `,
                    [property.id]
                );

            if (
                existingUnitResult.rows.length > 0
            ) {
                await client.query("ROLLBACK");

                return {
                    singleUnitLimitReached: true,
                    existing_unit:
                        existingUnitResult.rows[0]
                };
            }
        }

        const unitPublicId =
            `unit_${nanoid(24)}`;

        const createdUnitResult =
            await client.query(
                `
                INSERT INTO units (
                    public_id,
                    property_id,
                    unit_code,
                    unit_name,
                    unit_type,
                    floor_number,
                    bedrooms,
                    bathrooms,
                    area_size,
                    area_unit,
                    description,
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
                    'inactive',
                    $12
                )
                RETURNING
                    public_id,
                    unit_code,
                    unit_name,
                    unit_type,
                    floor_number,
                    bedrooms,
                    bathrooms,
                    area_size,
                    area_unit,
                    description,
                    operational_status,
                    created_at,
                    updated_at,
                    deleted_at
                `,
                [
                    unitPublicId,
                    property.id,
                    unitData.unit_code,
                    unitData.unit_name ?? null,
                    unitData.unit_type,
                    unitData.floor_number ?? null,
                    unitData.bedrooms ?? 0,
                    unitData.bathrooms ?? 0,
                    unitData.area_size ?? null,
                    unitData.area_unit ?? null,
                    unitData.description ?? null,
                    authenticatedUser.id
                ]
            );

        /*
         * Lazimisha deferred integrity triggers
         * kabla ya transaction ku-commit.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        const unit =
            createdUnitResult.rows[0];

        unit.bathrooms =
            Number(unit.bathrooms);

        unit.area_size =
            unit.area_size === null
                ? null
                : Number(unit.area_size);

        delete property.id;

        return {
            property,

            unit,

            creation_summary: {
                property_is_multi_unit:
                    property.is_multi_unit,

                initial_operational_status:
                    unit.operational_status,

                rentable_immediately: false
            }
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    getPropertyUnits,
    createUnit
};
const { nanoid } = require("nanoid");
const pool = require("../config/db");

/*
 * GET /api/tenants
 */
const getTenants = async ({
    ownerPublicId,
    filters,
    authenticatedUser
}) => {
    const ownerValues = [
        ownerPublicId
    ];

    let accessCondition = "";

    /*
     * Regular user lazima awe na current
     * owner_users relationship.
     *
     * Read operation hairuhitaji
     * can_manage_properties.
     */
    if (authenticatedUser.role !== "admin") {
        ownerValues.push(
            authenticatedUser.id
        );

        accessCondition = `
            AND EXISTS (
                SELECT 1

                FROM owner_users AS user_access

                WHERE user_access.owner_id = o.id
                  AND user_access.user_id = $2
                  AND user_access.revoked_at IS NULL
                  AND user_access.relationship_role IN (
                      'owner',
                      'representative',
                      'manager',
                      'accountant',
                      'viewer'
                  )
            )
        `;
    }

    const ownerResult = await pool.query(
        `
        SELECT
            o.id,
            o.public_id,
            o.owner_type,
            o.display_name,
            o.status,
            o.created_at,
            o.updated_at

        FROM owners AS o

        WHERE o.public_id = $1
          AND o.deleted_at IS NULL

          ${accessCondition}

        LIMIT 1
        `,
        ownerValues
    );

    if (ownerResult.rows.length === 0) {
        return null;
    }

    const owner = ownerResult.rows[0];

    const page =
        filters.page || 1;

    const limit =
        filters.limit || 20;

    const offset =
        (page - 1) * limit;

    const whereConditions = [
        "ot.owner_id = $1",
        "t.deleted_at IS NULL",
        "ot.ended_at IS NULL",
        `ot.relationship_status IN (
            'active',
            'blocked'
        )`
    ];

    const queryValues = [
        owner.id
    ];

    const addQueryValue = value => {
        queryValues.push(value);

        return `$${queryValues.length}`;
    };

    /*
     * Search across tenant identity
     * and contact fields.
     */
    if (filters.search) {
        const placeholder =
            addQueryValue(
                `%${filters.search}%`
            );

        whereConditions.push(`
            (
                t.display_name
                    ILIKE ${placeholder}

                OR t.national_id
                    ILIKE ${placeholder}

                OR t.passport_number
                    ILIKE ${placeholder}

                OR t.registration_number
                    ILIKE ${placeholder}

                OR t.tax_identification_number
                    ILIKE ${placeholder}

                OR t.email
                    ILIKE ${placeholder}

                OR t.phone_number
                    ILIKE ${placeholder}
            )
        `);
    }

    if (filters.tenant_type) {
        const placeholder =
            addQueryValue(
                filters.tenant_type
            );

        whereConditions.push(
            `t.tenant_type = ${placeholder}`
        );
    }

    if (filters.status) {
        const placeholder =
            addQueryValue(
                filters.status
            );

        whereConditions.push(
            `t.status = ${placeholder}`
        );
    }

    if (filters.relationship_status) {
        const placeholder =
            addQueryValue(
                filters.relationship_status
            );

        whereConditions.push(
            `ot.relationship_status = ${placeholder}`
        );
    }

    const whereClause =
        whereConditions.join(" AND ");

    /*
     * Total records after applying filters.
     */
    const countResult = await pool.query(
        `
        SELECT
            COUNT(*)::INTEGER AS total_items

        FROM owner_tenants AS ot

        INNER JOIN tenants AS t
            ON t.id = ot.tenant_id

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

    /*
     * Paginated tenant records.
     */
    const tenantsResult = await pool.query(
        `
        SELECT
            t.public_id,
            t.tenant_type,
            t.display_name,
            t.national_id,
            t.passport_number,
            t.registration_number,
            t.tax_identification_number,
            t.email,
            t.phone_number,
            t.alternative_phone,
            t.address,
            t.city,
            t.region,
            t.country,
            t.status,
            t.created_at,
            t.updated_at,

            ot.public_id
                AS relationship_public_id,

            ot.relationship_status,
            ot.is_primary_owner_relationship,
            ot.notes AS relationship_notes,
            ot.created_at
                AS relationship_created_at,

            ot.updated_at
                AS relationship_updated_at,

            ot.ended_at,

            creator.public_id
                AS created_by_public_id,

            creator.full_name
                AS created_by_name,

            creator.email
                AS created_by_email

        FROM owner_tenants AS ot

        INNER JOIN tenants AS t
            ON t.id = ot.tenant_id

        LEFT JOIN users AS creator
            ON creator.id = t.created_by

        WHERE ${whereClause}

        ORDER BY
            t.created_at DESC,
            t.id DESC

        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
        `,
        queryValues
    );

    const tenants =
        tenantsResult.rows.map(
            row => ({
                public_id:
                    row.public_id,

                tenant_type:
                    row.tenant_type,

                display_name:
                    row.display_name,

                national_id:
                    row.national_id,

                passport_number:
                    row.passport_number,

                registration_number:
                    row.registration_number,

                tax_identification_number:
                    row.tax_identification_number,

                email:
                    row.email,

                phone_number:
                    row.phone_number,

                alternative_phone:
                    row.alternative_phone,

                address:
                    row.address,

                city:
                    row.city,

                region:
                    row.region,

                country:
                    row.country,

                status:
                    row.status,

                owner_relationship: {
                    public_id:
                        row.relationship_public_id,

                    relationship_status:
                        row.relationship_status,

                    is_primary_owner_relationship:
                        row
                            .is_primary_owner_relationship,

                    notes:
                        row.relationship_notes,

                    created_at:
                        row
                            .relationship_created_at,

                    updated_at:
                        row
                            .relationship_updated_at,

                    ended_at:
                        row.ended_at
                },

                created_by: {
                    public_id:
                        row.created_by_public_id,

                    full_name:
                        row.created_by_name,

                    email:
                        row.created_by_email
                },

                created_at:
                    row.created_at,

                updated_at:
                    row.updated_at
            })
        );

    /*
     * Summary inahesabu tenants wote wa owner
     * wenye current relationship, bila kuathiriwa
     * na search au pagination filters.
     */
    const summaryResult = await pool.query(
        `
        SELECT
            COUNT(*)::INTEGER
                AS total_tenants,

            COUNT(*) FILTER (
                WHERE t.status = 'prospective'
            )::INTEGER
                AS prospective_tenants,

            COUNT(*) FILTER (
                WHERE t.status = 'active'
            )::INTEGER
                AS active_tenants,

            COUNT(*) FILTER (
                WHERE t.status = 'inactive'
            )::INTEGER
                AS inactive_tenants,

            COUNT(*) FILTER (
                WHERE t.status = 'blocked'
            )::INTEGER
                AS blocked_tenants,

            COUNT(*) FILTER (
                WHERE ot.relationship_status =
                    'active'
            )::INTEGER
                AS active_relationships,

            COUNT(*) FILTER (
                WHERE ot.relationship_status =
                    'blocked'
            )::INTEGER
                AS blocked_relationships

        FROM owner_tenants AS ot

        INNER JOIN tenants AS t
            ON t.id = ot.tenant_id

        WHERE ot.owner_id = $1
          AND t.deleted_at IS NULL
          AND ot.ended_at IS NULL
          AND ot.relationship_status IN (
              'active',
              'blocked'
          )
        `,
        [owner.id]
    );

    const totalPages =
        totalItems === 0
            ? 0
            : Math.ceil(
                totalItems / limit
            );

    delete owner.id;

    return {
        owner,

        summary:
            summaryResult.rows[0],

        tenants,

        pagination: {
            current_page:
                page,

            per_page:
                limit,

            total_items:
                totalItems,

            total_pages:
                totalPages,

            has_previous_page:
                page > 1,

            has_next_page:
                page < totalPages
        },

        filters: {
            search:
                filters.search || null,

            tenant_type:
                filters.tenant_type ||
                null,

            status:
                filters.status || null,

            relationship_status:
                filters
                    .relationship_status ||
                null
        }
    };
};
/*
 * GET /api/tenants/:tenant_public_id
 */
const getSingleTenant = async ({
    ownerPublicId,
    tenantPublicId,
    authenticatedUser
}) => {
    const ownerValues = [
        ownerPublicId
    ];

    let accessCondition = "";

    /*
     * Regular user lazima awe na current
     * owner_users relationship na selected owner.
     *
     * Read operation hairuhitaji
     * can_manage_properties.
     */
    if (authenticatedUser.role !== "admin") {
        ownerValues.push(
            authenticatedUser.id
        );

        accessCondition = `
            AND EXISTS (
                SELECT 1

                FROM owner_users AS user_access

                WHERE user_access.owner_id = o.id
                  AND user_access.user_id = $2
                  AND user_access.revoked_at IS NULL
                  AND user_access.relationship_role IN (
                      'owner',
                      'representative',
                      'manager',
                      'accountant',
                      'viewer'
                  )
            )
        `;
    }

    /*
     * Owner validation inafanyika kwanza ili
     * kutofautisha inaccessible owner na
     * tenant ambaye hayupo kwa owner huyo.
     */
    const ownerResult = await pool.query(
        `
        SELECT
            o.id,
            o.public_id,
            o.owner_type,
            o.display_name,
            o.status,
            o.created_at,
            o.updated_at

        FROM owners AS o

        WHERE o.public_id = $1
          AND o.deleted_at IS NULL

          ${accessCondition}

        LIMIT 1
        `,
        ownerValues
    );

    if (ownerResult.rows.length === 0) {
        return null;
    }

    const owner = ownerResult.rows[0];

    /*
     * Tenant lazima awe:
     * - current,
     * - hajafutwa,
     * - ameunganishwa na selected owner,
     * - relationship yake haijaisha.
     */
    const tenantResult = await pool.query(
        `
        SELECT
            t.public_id,
            t.tenant_type,
            t.display_name,
            t.national_id,
            t.passport_number,
            t.registration_number,
            t.tax_identification_number,
            t.email,
            t.phone_number,
            t.alternative_phone,
            t.address,
            t.city,
            t.region,
            t.country,
            t.status,
            t.created_at,
            t.updated_at,

            ot.public_id
                AS relationship_public_id,

            ot.relationship_status,
            ot.is_primary_owner_relationship,
            ot.notes
                AS relationship_notes,

            ot.created_at
                AS relationship_created_at,

            ot.updated_at
                AS relationship_updated_at,

            ot.ended_at,

            creator.public_id
                AS created_by_public_id,

            creator.full_name
                AS created_by_name,

            creator.email
                AS created_by_email

        FROM tenants AS t

        INNER JOIN owner_tenants AS ot
            ON ot.tenant_id = t.id

        LEFT JOIN users AS creator
            ON creator.id = t.created_by

        WHERE t.public_id = $1
          AND t.deleted_at IS NULL
          AND ot.owner_id = $2
          AND ot.ended_at IS NULL
          AND ot.relationship_status IN (
              'active',
              'blocked'
          )

        LIMIT 1
        `,
        [
            tenantPublicId,
            owner.id
        ]
    );

    if (tenantResult.rows.length === 0) {
        return {
            tenantNotFound: true
        };
    }

    const row = tenantResult.rows[0];

    delete owner.id;

    return {
        owner,

        tenant: {
            public_id:
                row.public_id,

            tenant_type:
                row.tenant_type,

            display_name:
                row.display_name,

            national_id:
                row.national_id,

            passport_number:
                row.passport_number,

            registration_number:
                row.registration_number,

            tax_identification_number:
                row.tax_identification_number,

            email:
                row.email,

            phone_number:
                row.phone_number,

            alternative_phone:
                row.alternative_phone,

            address:
                row.address,

            city:
                row.city,

            region:
                row.region,

            country:
                row.country,

            status:
                row.status,

            owner_relationship: {
                public_id:
                    row.relationship_public_id,

                relationship_status:
                    row.relationship_status,

                is_primary_owner_relationship:
                    row
                        .is_primary_owner_relationship,

                notes:
                    row.relationship_notes,

                created_at:
                    row
                        .relationship_created_at,

                updated_at:
                    row
                        .relationship_updated_at,

                ended_at:
                    row.ended_at
            },

            created_by: {
                public_id:
                    row.created_by_public_id,

                full_name:
                    row.created_by_name,

                email:
                    row.created_by_email
            },

            created_at:
                row.created_at,

            updated_at:
                row.updated_at
        }
    };
};
/*
 * PATCH /api/tenants/:tenant_public_id
 */
const updateTenant = async ({
    ownerPublicId,
    tenantPublicId,
    tenantData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const ownerValues = [
            ownerPublicId
        ];

        let ownerAccessCondition = "";

        /*
         * Regular user lazima awe na management
         * permission kupitia selected owner.
         */
        if (authenticatedUser.role !== "admin") {
            ownerValues.push(
                authenticatedUser.id
            );

            ownerAccessCondition = `
                AND EXISTS (
                    SELECT 1

                    FROM owner_users AS user_access

                    WHERE user_access.owner_id = o.id
                      AND user_access.user_id = $2
                      AND user_access.revoked_at IS NULL
                      AND user_access.can_manage_properties = TRUE
                      AND user_access.relationship_role IN (
                          'owner',
                          'representative',
                          'manager'
                      )
                )
            `;
        }

        /*
         * Validate na lock active owner.
         */
        const ownerResult = await client.query(
            `
            SELECT
                o.id,
                o.public_id,
                o.owner_type,
                o.display_name,
                o.status,
                o.created_at,
                o.updated_at

            FROM owners AS o

            WHERE o.public_id = $1
              AND o.status = 'active'
              AND o.deleted_at IS NULL

              ${ownerAccessCondition}

            LIMIT 1

            FOR UPDATE OF o
            `,
            ownerValues
        );

        if (ownerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return null;
        }

        const owner = ownerResult.rows[0];

        /*
         * Admin anaweza kutumia active relationship
         * yoyote.
         *
         * Regular user lazima selected owner awe
         * primary owner relationship ya tenant.
         */
        let primaryRelationshipCondition = "";

        if (authenticatedUser.role !== "admin") {
            primaryRelationshipCondition = `
                AND ot.is_primary_owner_relationship =
                    TRUE
            `;
        }

        /*
         * Validate na lock tenant pamoja na
         * owner_tenants relationship.
         */
        const tenantAccessResult =
            await client.query(
                `
                SELECT
                    t.id AS tenant_id,

                    ot.public_id
                        AS relationship_public_id,

                    ot.relationship_status,
                    ot.is_primary_owner_relationship,
                    ot.notes
                        AS relationship_notes,

                    ot.created_at
                        AS relationship_created_at,

                    ot.updated_at
                        AS relationship_updated_at,

                    ot.ended_at

                FROM tenants AS t

                INNER JOIN owner_tenants AS ot
                    ON ot.tenant_id = t.id

                WHERE t.public_id = $1
                  AND t.deleted_at IS NULL
                  AND ot.owner_id = $2
                  AND ot.relationship_status =
                      'active'
                  AND ot.ended_at IS NULL

                  ${primaryRelationshipCondition}

                LIMIT 1

                FOR UPDATE OF t, ot
                `,
                [
                    tenantPublicId,
                    owner.id
                ]
            );

        if (
            tenantAccessResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                tenantNotFound: true
            };
        }

        const tenantAccess =
            tenantAccessResult.rows[0];

        /*
         * Defense-in-depth:
         * Service layer pia inatumia whitelist
         * hata baada ya request validation.
         */
        const allowedFields = [
            "tenant_type",
            "display_name",
            "national_id",
            "passport_number",
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

        const updatedFields =
            Object.keys(tenantData)
                .filter(
                    field =>
                        allowedFields.includes(field)
                );

        if (updatedFields.length === 0) {
            await client.query("ROLLBACK");

            return {
                noFieldsSupplied: true
            };
        }

        const updateValues = [];

        const setClauses =
            updatedFields.map(field => {
                updateValues.push(
                    tenantData[field]
                );

                return `
                    ${field} =
                    $${updateValues.length}
                `;
            });

        updateValues.push(
            tenantAccess.tenant_id
        );

        const tenantIdPlaceholder =
            `$${updateValues.length}`;

        /*
         * Only supplied fields are updated.
         * Omitted fields retain their current values.
         */
        const updatedTenantResult =
            await client.query(
                `
                UPDATE tenants

                SET
                    ${setClauses.join(", ")},
                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = ${tenantIdPlaceholder}
                  AND deleted_at IS NULL

                RETURNING
                    public_id,
                    tenant_type,
                    display_name,
                    national_id,
                    passport_number,
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
                    updated_at,
                    deleted_at
                `,
                updateValues
            );

        /*
         * Lazimisha deferred integrity checks
         * kabla transaction haija-commit.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        delete owner.id;

        return {
            owner,

            tenant:
                updatedTenantResult.rows[0],

            owner_relationship: {
                public_id:
                    tenantAccess
                        .relationship_public_id,

                relationship_status:
                    tenantAccess
                        .relationship_status,

                is_primary_owner_relationship:
                    tenantAccess
                        .is_primary_owner_relationship,

                notes:
                    tenantAccess
                        .relationship_notes,

                created_at:
                    tenantAccess
                        .relationship_created_at,

                updated_at:
                    tenantAccess
                        .relationship_updated_at,

                ended_at:
                    tenantAccess.ended_at
            },

            updated_fields:
                updatedFields
        };
    } catch (error) {
        await client.query("ROLLBACK");

        /*
         * Map current tenant identifier
         * uniqueness violations.
         */
        if (error.code === "23505") {
            const duplicateFields = {
                uq_tenants_current_national_id:
                    "national_id",

                uq_tenants_current_passport_number:
                    "passport_number",

                uq_tenants_current_registration_number:
                    "registration_number",

                uq_tenants_current_tax_identification_number:
                    "tax_identification_number"
            };

            const duplicateField =
                duplicateFields[
                    error.constraint
                ];

            if (duplicateField) {
                return {
                    duplicateIdentifier: true,
                    duplicateField
                };
            }
        }

        throw error;
    } finally {
        client.release();
    }
};
/*
 * DELETE /api/tenants/:tenant_public_id
 */
const softDeleteTenant = async ({
    ownerPublicId,
    tenantPublicId,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const ownerValues = [
            ownerPublicId
        ];

        let ownerAccessCondition = "";

        /*
         * Regular user lazima awe na management
         * permission kupitia selected owner.
         */
        if (authenticatedUser.role !== "admin") {
            ownerValues.push(
                authenticatedUser.id
            );

            ownerAccessCondition = `
                AND EXISTS (
                    SELECT 1

                    FROM owner_users AS user_access

                    WHERE user_access.owner_id = o.id
                      AND user_access.user_id = $2
                      AND user_access.revoked_at IS NULL
                      AND user_access.can_manage_properties = TRUE
                      AND user_access.relationship_role IN (
                          'owner',
                          'representative',
                          'manager'
                      )
                )
            `;
        }

        /*
         * Validate na lock active owner.
         */
        const ownerResult = await client.query(
            `
            SELECT
                o.id,
                o.public_id,
                o.owner_type,
                o.display_name,
                o.status,
                o.created_at,
                o.updated_at

            FROM owners AS o

            WHERE o.public_id = $1
              AND o.status = 'active'
              AND o.deleted_at IS NULL

              ${ownerAccessCondition}

            LIMIT 1

            FOR UPDATE OF o
            `,
            ownerValues
        );

        if (ownerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return null;
        }

        const owner = ownerResult.rows[0];

        /*
         * Tenant lazima:
         * - awe current,
         * - hajafutwa,
         * - selected owner awe amewahi kuwa
         *   na relationship naye.
         *
         * Relationship inaweza kuwa historical
         * kwa sababu current relationships
         * zinazuia deletion.
         */
        const tenantResult = await client.query(
            `
            SELECT
                t.id,
                t.public_id,
                t.tenant_type,
                t.display_name,
                t.national_id,
                t.passport_number,
                t.registration_number,
                t.tax_identification_number,
                t.email,
                t.phone_number,
                t.alternative_phone,
                t.address,
                t.city,
                t.region,
                t.country,
                t.status,
                t.created_at,
                t.updated_at,
                t.deleted_at,

                ot.id AS relationship_id,
                ot.public_id
                    AS relationship_public_id,

                ot.relationship_status,
                ot.is_primary_owner_relationship,
                ot.ended_at

            FROM tenants AS t

            INNER JOIN owner_tenants AS ot
                ON ot.tenant_id = t.id

            WHERE t.public_id = $1
              AND t.deleted_at IS NULL
              AND ot.owner_id = $2

            ORDER BY
                ot.created_at DESC,
                ot.id DESC

            LIMIT 1

            FOR UPDATE OF t, ot
            `,
            [
                tenantPublicId,
                owner.id
            ]
        );

        if (tenantResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                tenantNotFound: true
            };
        }

        const tenantRecord =
            tenantResult.rows[0];

        /*
         * Lock na kagua current relationships
         * zote za tenant kwa owners wote.
         */
        const currentRelationshipsResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    owner_id,
                    relationship_status,
                    is_primary_owner_relationship,
                    ended_at

                FROM owner_tenants

                WHERE tenant_id = $1
                  AND ended_at IS NULL
                  AND relationship_status IN (
                      'active',
                      'blocked'
                  )

                FOR UPDATE
                `,
                [tenantRecord.id]
            );

        /*
         * Tenant hawezi kufutwa mpaka current
         * relationships zote ziwe ended.
         */
        if (
            currentRelationshipsResult
                .rows.length > 0
        ) {
            await client.query("ROLLBACK");

            return {
                currentRelationshipExists:
                    true,

                currentRelationshipCount:
                    currentRelationshipsResult
                        .rows.length
            };
        }
        /*
 * Tenant mwenye active tenant-user links
 * hawezi kufutwa mpaka links zote
 * zirevokewe.
 *
 * Tenant row tayari imefungwa, hivyo
 * concurrent tenant-user insertion
 * haiwezi kupita kabla ya transaction.
 */
const activeTenantUsersResult =
    await client.query(
        `
        SELECT
            id,
            public_id,
            user_id,
            relationship_role,
            is_primary,
            revoked_at

        FROM tenant_users

        WHERE tenant_id = $1
          AND revoked_at IS NULL

        FOR UPDATE
        `,
        [tenantRecord.id]
    );

if (
    activeTenantUsersResult.rows.length > 0
) {
    await client.query("ROLLBACK");

    return {
        activeTenantUsersExist: true,

        activeTenantUserCount:
            activeTenantUsersResult
                .rows.length
    };
}
        const previousStatus =
            tenantRecord.status;

        const deletedTenantResult =
            await client.query(
                `
                UPDATE tenants

                SET
                    status = 'inactive',
                    deleted_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = $1
                  AND deleted_at IS NULL

                RETURNING
                    public_id,
                    tenant_type,
                    display_name,
                    national_id,
                    passport_number,
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
                    updated_at,
                    deleted_at
                `,
                [tenantRecord.id]
            );

        /*
         * Force deferred integrity checks
         * before commit.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        delete owner.id;

        const deletedTenant =
            deletedTenantResult.rows[0];

        return {
            owner,

            tenant:
                deletedTenant,

            deletion_summary: {
                soft_deleted:
                    true,

                previous_status:
                    previousStatus,

                current_status:
                    deletedTenant.status,

                deleted_at:
                    deletedTenant.deleted_at
            }
        };
    } catch (error) {
        await client.query("ROLLBACK");

        throw error;
    } finally {
        client.release();
    }
};
/*
 * PATCH /api/tenants/:tenant_public_id/restore
 */
const restoreTenant = async ({
    ownerPublicId,
    tenantPublicId,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const ownerValues = [
            ownerPublicId
        ];

        let ownerAccessCondition = "";

        /*
         * Regular user lazima awe na management
         * permission kupitia selected owner.
         */
        if (authenticatedUser.role !== "admin") {
            ownerValues.push(
                authenticatedUser.id
            );

            ownerAccessCondition = `
                AND EXISTS (
                    SELECT 1

                    FROM owner_users AS user_access

                    WHERE user_access.owner_id = o.id
                      AND user_access.user_id = $2
                      AND user_access.revoked_at IS NULL
                      AND user_access.can_manage_properties = TRUE
                      AND user_access.relationship_role IN (
                          'owner',
                          'representative',
                          'manager'
                      )
                )
            `;
        }

        /*
         * Validate na lock active owner.
         */
        const ownerResult = await client.query(
            `
            SELECT
                o.id,
                o.public_id,
                o.owner_type,
                o.display_name,
                o.status,
                o.created_at,
                o.updated_at

            FROM owners AS o

            WHERE o.public_id = $1
              AND o.status = 'active'
              AND o.deleted_at IS NULL

              ${ownerAccessCondition}

            LIMIT 1

            FOR UPDATE OF o
            `,
            ownerValues
        );

        if (ownerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return null;
        }

        const owner = ownerResult.rows[0];

        /*
         * Tenant lazima:
         * - awe soft-deleted,
         * - selected owner awe amewahi kuwa
         *   na relationship naye.
         *
         * Historical relationship haifunguliwi
         * upya wakati wa restore.
         */
        const tenantResult = await client.query(
            `
            SELECT
                t.id,
                t.public_id,
                t.tenant_type,
                t.display_name,
                t.national_id,
                t.passport_number,
                t.registration_number,
                t.tax_identification_number,
                t.email,
                t.phone_number,
                t.alternative_phone,
                t.address,
                t.city,
                t.region,
                t.country,
                t.status,
                t.created_at,
                t.updated_at,
                t.deleted_at,

                ot.id AS relationship_id,
                ot.public_id
                    AS relationship_public_id,

                ot.relationship_status,
                ot.is_primary_owner_relationship,
                ot.ended_at

            FROM tenants AS t

            INNER JOIN owner_tenants AS ot
                ON ot.tenant_id = t.id

            WHERE t.public_id = $1
              AND t.deleted_at IS NOT NULL
              AND ot.owner_id = $2

            ORDER BY
                ot.created_at DESC,
                ot.id DESC

            LIMIT 1

            FOR UPDATE OF t, ot
            `,
            [
                tenantPublicId,
                owner.id
            ]
        );

        if (tenantResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                tenantNotFound: true
            };
        }

        const tenantRecord =
            tenantResult.rows[0];

        const previousStatus =
            tenantRecord.status;

        const previousDeletedAt =
            tenantRecord.deleted_at;

        /*
         * Restored tenant anabaki inactive.
         * Relationship mpya haitengenezwi hapa.
         */
        const restoredTenantResult =
            await client.query(
                `
                UPDATE tenants

                SET
                    status = 'inactive',
                    deleted_at = NULL,
                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = $1
                  AND deleted_at IS NOT NULL

                RETURNING
                    public_id,
                    tenant_type,
                    display_name,
                    national_id,
                    passport_number,
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
                    updated_at,
                    deleted_at
                `,
                [tenantRecord.id]
            );

        /*
         * Lazimisha partial unique indexes
         * na deferred integrity checks
         * kabla ya commit.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        delete owner.id;

        const restoredTenant =
            restoredTenantResult.rows[0];

        return {
            owner,

            tenant:
                restoredTenant,

            restore_summary: {
                restored:
                    true,

                previous_status:
                    previousStatus,

                current_status:
                    restoredTenant.status,

                previous_deleted_at:
                    previousDeletedAt,

                current_deleted_at:
                    restoredTenant.deleted_at,

                relationship_recreated:
                    false
            }
        };
    } catch (error) {
        await client.query("ROLLBACK");

        /*
         * Soft-deleted identifiers zinaweza kuwa
         * zimetumiwa na current tenant mwingine.
         * Restore ikigongana nazo irudishe 409.
         */
        if (error.code === "23505") {
            const duplicateFields = {
                uq_tenants_current_national_id:
                    "national_id",

                uq_tenants_current_passport_number:
                    "passport_number",

                uq_tenants_current_registration_number:
                    "registration_number",

                uq_tenants_current_tax_identification_number:
                    "tax_identification_number"
            };

            const duplicateField =
                duplicateFields[
                    error.constraint
                ];

            if (duplicateField) {
                return {
                    duplicateIdentifier: true,
                    duplicateField
                };
            }
        }

        throw error;
    } finally {
        client.release();
    }
};
/*
 * POST /api/tenants
 */
const createTenant = async ({
    ownerPublicId,
    tenantData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const ownerValues = [
            ownerPublicId
        ];

        let accessCondition = "";

        if (authenticatedUser.role !== "admin") {
            ownerValues.push(
                authenticatedUser.id
            );

            accessCondition = `
                AND EXISTS (
                    SELECT 1

                    FROM owner_users AS user_access

                    WHERE user_access.owner_id = o.id
                      AND user_access.user_id = $2
                      AND user_access.revoked_at IS NULL
                      AND user_access.can_manage_properties = TRUE
                      AND user_access.relationship_role IN (
                          'owner',
                          'representative',
                          'manager'
                      )
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
                o.status,
                o.created_at,
                o.updated_at

            FROM owners AS o

            WHERE o.public_id = $1
              AND o.status = 'active'
              AND o.deleted_at IS NULL

              ${accessCondition}

            LIMIT 1

            FOR UPDATE OF o
            `,
            ownerValues
        );

        if (ownerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return null;
        }

        const owner = ownerResult.rows[0];

        const tenantPublicId =
            `tenant_${nanoid(24)}`;

        const createdTenantResult =
            await client.query(
                `
                INSERT INTO tenants (
                    public_id,
                    tenant_type,
                    display_name,
                    national_id,
                    passport_number,
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
                    'prospective',
                    $15
                )
                RETURNING
                    id,
                    public_id,
                    tenant_type,
                    display_name,
                    national_id,
                    passport_number,
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
                    updated_at,
                    deleted_at
                `,
                [
                    tenantPublicId,
                    tenantData.tenant_type,
                    tenantData.display_name,
                    tenantData.national_id ?? null,
                    tenantData.passport_number ?? null,
                    tenantData.registration_number ?? null,
                    tenantData
                        .tax_identification_number ??
                        null,
                    tenantData.email ?? null,
                    tenantData.phone_number ?? null,
                    tenantData.alternative_phone ?? null,
                    tenantData.address ?? null,
                    tenantData.city ?? null,
                    tenantData.region ?? null,
                    tenantData.country ?? "Tanzania",
                    authenticatedUser.id
                ]
            );

        const tenant =
            createdTenantResult.rows[0];

        const relationshipPublicId =
            `owner_tenant_${nanoid(24)}`;

        const relationshipResult =
            await client.query(
                `
                INSERT INTO owner_tenants (
                    public_id,
                    owner_id,
                    tenant_id,
                    relationship_status,
                    is_primary_owner_relationship,
                    notes,
                    created_by,
                    ended_at
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    'active',
                    TRUE,
                    $4,
                    $5,
                    NULL
                )
                RETURNING
                    public_id,
                    relationship_status,
                    is_primary_owner_relationship,
                    notes,
                    created_at,
                    updated_at,
                    ended_at
                `,
                [
                    relationshipPublicId,
                    owner.id,
                    tenant.id,
                    tenantData.notes ?? null,
                    authenticatedUser.id
                ]
            );

        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        delete tenant.id;
        delete owner.id;

        return {
            owner,

            tenant,

            owner_relationship:
                relationshipResult.rows[0],

            creation_summary: {
                initial_tenant_status:
                    tenant.status,

                relationship_status:
                    relationshipResult
                        .rows[0]
                        .relationship_status,

                is_primary_owner_relationship:
                    relationshipResult
                        .rows[0]
                        .is_primary_owner_relationship
            }
        };
    } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23505") {
            const duplicateFields = {
                uq_tenants_current_national_id:
                    "national_id",

                uq_tenants_current_passport_number:
                    "passport_number",

                uq_tenants_current_registration_number:
                    "registration_number",

                uq_tenants_current_tax_identification_number:
                    "tax_identification_number"
            };

            const duplicateField =
                duplicateFields[
                    error.constraint
                ];

            if (duplicateField) {
                return {
                    duplicateIdentifier: true,
                    duplicateField
                };
            }
        }

        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    getTenants,
    getSingleTenant,
    updateTenant,
    softDeleteTenant,
    restoreTenant,
    createTenant
};
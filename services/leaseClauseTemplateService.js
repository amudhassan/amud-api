const {
    nanoid
} = require("nanoid");

const pool = require("../config/db");

const hasOwn = (
    object,
    field
) =>
    Object.prototype.hasOwnProperty.call(
        object,
        field
    );

const rollbackAndReturn = async (
    client,
    result
) => {
    await client.query("ROLLBACK");
    return result;
};

/**
 * Resolve an active owner that the requester is allowed
 * to manage for lease-contract purposes.
 *
 * Regular owner-side users require BOTH:
 * - can_manage_properties = TRUE
 * - can_manage_finances = TRUE
 *
 * This mirrors the write authority already used by the
 * Lease Management module.
 */
const getAuthorizedOwner = async ({
    db,
    ownerPublicId,
    authenticatedUser,
    lock = false
}) => {
    const values = [
        ownerPublicId
    ];

    let accessCondition = "";

    if (
        authenticatedUser.role !==
            "admin"
    ) {
        values.push(
            authenticatedUser.id
        );

        const userPosition =
            values.length;

        accessCondition = `
            AND EXISTS (
                SELECT 1
                FROM owner_users AS ou
                WHERE ou.owner_id = o.id
                  AND ou.user_id =
                        $${userPosition}
                  AND ou.revoked_at IS NULL
                  AND ou.can_manage_properties =
                        TRUE
                  AND ou.can_manage_finances =
                        TRUE
            )
        `;
    }

    const result =
        await db.query(
            `
            SELECT
                o.id,
                o.public_id,
                o.owner_type,
                o.display_name,
                o.status
            FROM owners AS o
            WHERE o.public_id = $1
              AND o.status = 'active'
              AND o.deleted_at IS NULL
              ${accessCondition}
            LIMIT 1
            ${lock ? "FOR UPDATE OF o" : ""}
            `,
            values
        );

    return (
        result.rows[0] ||
        null
    );
};

/**
 * Resolve one non-deleted template inside the requester's
 * owner-management scope.
 *
 * Inaccessible templates intentionally resolve the same
 * way as missing templates.
 */
const getAuthorizedTemplate = async ({
    db,
    templatePublicId,
    authenticatedUser,
    lock = false
}) => {
    const values = [
        templatePublicId
    ];

    let accessCondition = "";

    if (
        authenticatedUser.role !==
            "admin"
    ) {
        values.push(
            authenticatedUser.id
        );

        const userPosition =
            values.length;

        accessCondition = `
            AND EXISTS (
                SELECT 1
                FROM owner_users AS ou
                WHERE ou.owner_id =
                        t.owner_id
                  AND ou.user_id =
                        $${userPosition}
                  AND ou.revoked_at IS NULL
                  AND ou.can_manage_properties =
                        TRUE
                  AND ou.can_manage_finances =
                        TRUE
            )
        `;
    }

    const result =
        await db.query(
            `
            SELECT
                t.id,
                t.public_id,
                t.owner_id,
                t.name,
                t.description,
                t.status,
                t.created_at,
                t.updated_at,
                o.public_id AS owner_public_id,
                o.display_name AS owner_display_name
            FROM lease_clause_templates AS t
            INNER JOIN owners AS o
                ON o.id = t.owner_id
            WHERE t.public_id = $1
              AND t.deleted_at IS NULL
              ${accessCondition}
            LIMIT 1
            ${lock ? "FOR UPDATE OF t" : ""}
            `,
            values
        );

    return (
        result.rows[0] ||
        null
    );
};

/**
 * GET /api/lease-clause-templates
 */
const getLeaseClauseTemplates = async ({
    filters,
    authenticatedUser
}) => {
    const owner =
        await getAuthorizedOwner({
            db: pool,
            ownerPublicId:
                filters.owner_public_id,
            authenticatedUser
        });

    if (!owner) {
        return {
            ownerNotFound: true
        };
    }

    const values = [
        owner.id
    ];

    let statusCondition = "";

    if (filters.status) {
        values.push(
            filters.status
        );

        statusCondition = `
            AND t.status = $2
        `;
    }

    const result =
        await pool.query(
            `
            SELECT
                t.public_id,
                t.name,
                t.description,
                t.status,
                t.created_at,
                t.updated_at,
                COUNT(i.id)
                    FILTER (
                        WHERE
                            i.deleted_at IS NULL
                    )::INTEGER
                    AS item_count
            FROM lease_clause_templates
                AS t
            LEFT JOIN
                lease_clause_template_items
                AS i
                ON i.template_id = t.id
            WHERE t.owner_id = $1
              AND t.deleted_at IS NULL
              ${statusCondition}
            GROUP BY
                t.id
            ORDER BY
                lower(t.name) ASC,
                t.id ASC
            `,
            values
        );

    return {
        owner: {
            public_id:
                owner.public_id,
            display_name:
                owner.display_name
        },
        templates:
            result.rows
    };
};

/**
 * POST /api/lease-clause-templates
 */
const createLeaseClauseTemplate = async ({
    templateData,
    authenticatedUser
}) => {
    const client =
        await pool.connect();

    try {
        await client.query("BEGIN");

        const owner =
            await getAuthorizedOwner({
                db: client,
                ownerPublicId:
                    templateData
                        .owner_public_id,
                authenticatedUser,
                lock: true
            });

        if (!owner) {
            return await rollbackAndReturn(
                client,
                {
                    ownerNotFound: true
                }
            );
        }

        const publicId =
            `lease_clause_template_${nanoid(24)}`;

        const result =
            await client.query(
                `
                INSERT INTO
                    lease_clause_templates (
                        public_id,
                        owner_id,
                        name,
                        description,
                        status,
                        created_by
                    )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6
                )
                RETURNING
                    public_id,
                    name,
                    description,
                    status,
                    created_at,
                    updated_at
                `,
                [
                    publicId,
                    owner.id,
                    templateData.name,
                    hasOwn(
                        templateData,
                        "description"
                    )
                        ? templateData
                            .description
                        : null,
                    hasOwn(
                        templateData,
                        "status"
                    )
                        ? templateData.status
                        : "active",
                    authenticatedUser.id
                ]
            );

        await client.query("COMMIT");

        return {
            owner: {
                public_id:
                    owner.public_id,
                display_name:
                    owner.display_name
            },
            template:
                result.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/**
 * GET /api/lease-clause-templates/:template_public_id
 */
const getSingleLeaseClauseTemplate = async ({
    templatePublicId,
    authenticatedUser
}) => {
    const template =
        await getAuthorizedTemplate({
            db: pool,
            templatePublicId,
            authenticatedUser
        });

    if (!template) {
        return {
            templateNotFound: true
        };
    }

    const itemsResult =
        await pool.query(
            `
            SELECT
                public_id,
                clause_category,
                title,
                clause_text,
                is_mandatory,
                display_order,
                created_at,
                updated_at
            FROM
                lease_clause_template_items
            WHERE template_id = $1
              AND deleted_at IS NULL
            ORDER BY
                display_order ASC,
                id ASC
            `,
            [
                template.id
            ]
        );

    return {
        template: {
            public_id:
                template.public_id,
            name:
                template.name,
            description:
                template.description,
            status:
                template.status,
            created_at:
                template.created_at,
            updated_at:
                template.updated_at,
            owner: {
                public_id:
                    template
                        .owner_public_id,
                display_name:
                    template
                        .owner_display_name
            },
            items:
                itemsResult.rows
        }
    };
};

/**
 * PATCH /api/lease-clause-templates/:template_public_id
 */
const updateLeaseClauseTemplate = async ({
    templatePublicId,
    templateData,
    authenticatedUser
}) => {
    const client =
        await pool.connect();

    try {
        await client.query("BEGIN");

        const template =
            await getAuthorizedTemplate({
                db: client,
                templatePublicId,
                authenticatedUser,
                lock: true
            });

        if (!template) {
            return await rollbackAndReturn(
                client,
                {
                    templateNotFound: true
                }
            );
        }

        const finalName =
            hasOwn(
                templateData,
                "name"
            )
                ? templateData.name
                : template.name;

        const finalDescription =
            hasOwn(
                templateData,
                "description"
            )
                ? templateData.description
                : template.description;

        const finalStatus =
            hasOwn(
                templateData,
                "status"
            )
                ? templateData.status
                : template.status;

        const result =
            await client.query(
                `
                UPDATE
                    lease_clause_templates
                SET
                    name = $1,
                    description = $2,
                    status = $3,
                    updated_by = $4,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $5
                RETURNING
                    public_id,
                    name,
                    description,
                    status,
                    created_at,
                    updated_at
                `,
                [
                    finalName,
                    finalDescription,
                    finalStatus,
                    authenticatedUser.id,
                    template.id
                ]
            );

        await client.query("COMMIT");

        return {
            template:
                result.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/**
 * DELETE /api/lease-clause-templates/:template_public_id
 *
 * Soft deletes active items first, then the parent template.
 * This ordering is intentional because the database prevents
 * item mutation after the parent template becomes deleted.
 */
const deleteLeaseClauseTemplate = async ({
    templatePublicId,
    authenticatedUser
}) => {
    const client =
        await pool.connect();

    try {
        await client.query("BEGIN");

        const template =
            await getAuthorizedTemplate({
                db: client,
                templatePublicId,
                authenticatedUser,
                lock: true
            });

        if (!template) {
            return await rollbackAndReturn(
                client,
                {
                    templateNotFound: true
                }
            );
        }

        await client.query(
            `
            UPDATE
                lease_clause_template_items
            SET
                deleted_at =
                    CURRENT_TIMESTAMP,
                deleted_by = $1,
                updated_by = $1,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE template_id = $2
              AND deleted_at IS NULL
            `,
            [
                authenticatedUser.id,
                template.id
            ]
        );

        const result =
            await client.query(
                `
                UPDATE
                    lease_clause_templates
                SET
                    deleted_at =
                        CURRENT_TIMESTAMP,
                    deleted_by = $1,
                    updated_by = $1,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING
                    public_id,
                    name,
                    status,
                    deleted_at
                `,
                [
                    authenticatedUser.id,
                    template.id
                ]
            );

        await client.query("COMMIT");

        return {
            template:
                result.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/**
 * POST
 * /api/lease-clause-templates/:template_public_id/items
 */
const createLeaseClauseTemplateItem = async ({
    templatePublicId,
    itemData,
    authenticatedUser
}) => {
    const client =
        await pool.connect();

    try {
        await client.query("BEGIN");

        const template =
            await getAuthorizedTemplate({
                db: client,
                templatePublicId,
                authenticatedUser,
                lock: true
            });

        if (!template) {
            return await rollbackAndReturn(
                client,
                {
                    templateNotFound: true
                }
            );
        }

        const publicId =
            `lease_clause_template_item_${nanoid(24)}`;

        const result =
            await client.query(
                `
                INSERT INTO
                    lease_clause_template_items (
                        public_id,
                        template_id,
                        clause_category,
                        title,
                        clause_text,
                        is_mandatory,
                        display_order,
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
                    $8
                )
                RETURNING
                    public_id,
                    clause_category,
                    title,
                    clause_text,
                    is_mandatory,
                    display_order,
                    created_at,
                    updated_at
                `,
                [
                    publicId,
                    template.id,
                    itemData
                        .clause_category,
                    itemData.title,
                    itemData.clause_text,
                    hasOwn(
                        itemData,
                        "is_mandatory"
                    )
                        ? itemData
                            .is_mandatory
                        : true,
                    hasOwn(
                        itemData,
                        "display_order"
                    )
                        ? itemData
                            .display_order
                        : 1,
                    authenticatedUser.id
                ]
            );

        await client.query("COMMIT");

        return {
            template: {
                public_id:
                    template.public_id,
                name:
                    template.name,
                status:
                    template.status
            },
            item:
                result.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/**
 * PATCH
 * /api/lease-clause-templates/:template_public_id/items/:item_public_id
 */
const updateLeaseClauseTemplateItem = async ({
    templatePublicId,
    itemPublicId,
    itemData,
    authenticatedUser
}) => {
    const client =
        await pool.connect();

    try {
        await client.query("BEGIN");

        const template =
            await getAuthorizedTemplate({
                db: client,
                templatePublicId,
                authenticatedUser,
                lock: true
            });

        if (!template) {
            return await rollbackAndReturn(
                client,
                {
                    templateNotFound: true
                }
            );
        }

        const itemResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    clause_category,
                    title,
                    clause_text,
                    is_mandatory,
                    display_order
                FROM
                    lease_clause_template_items
                WHERE public_id = $1
                  AND template_id = $2
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    itemPublicId,
                    template.id
                ]
            );

        if (
            itemResult.rows.length === 0
        ) {
            return await rollbackAndReturn(
                client,
                {
                    itemNotFound: true
                }
            );
        }

        const current =
            itemResult.rows[0];

        const result =
            await client.query(
                `
                UPDATE
                    lease_clause_template_items
                SET
                    clause_category = $1,
                    title = $2,
                    clause_text = $3,
                    is_mandatory = $4,
                    display_order = $5,
                    updated_by = $6,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $7
                RETURNING
                    public_id,
                    clause_category,
                    title,
                    clause_text,
                    is_mandatory,
                    display_order,
                    created_at,
                    updated_at
                `,
                [
                    hasOwn(
                        itemData,
                        "clause_category"
                    )
                        ? itemData
                            .clause_category
                        : current
                            .clause_category,
                    hasOwn(
                        itemData,
                        "title"
                    )
                        ? itemData.title
                        : current.title,
                    hasOwn(
                        itemData,
                        "clause_text"
                    )
                        ? itemData
                            .clause_text
                        : current
                            .clause_text,
                    hasOwn(
                        itemData,
                        "is_mandatory"
                    )
                        ? itemData
                            .is_mandatory
                        : current
                            .is_mandatory,
                    hasOwn(
                        itemData,
                        "display_order"
                    )
                        ? itemData
                            .display_order
                        : current
                            .display_order,
                    authenticatedUser.id,
                    current.id
                ]
            );

        await client.query("COMMIT");

        return {
            template: {
                public_id:
                    template.public_id,
                name:
                    template.name
            },
            item:
                result.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/**
 * DELETE
 * /api/lease-clause-templates/:template_public_id/items/:item_public_id
 */
const deleteLeaseClauseTemplateItem = async ({
    templatePublicId,
    itemPublicId,
    authenticatedUser
}) => {
    const client =
        await pool.connect();

    try {
        await client.query("BEGIN");

        const template =
            await getAuthorizedTemplate({
                db: client,
                templatePublicId,
                authenticatedUser,
                lock: true
            });

        if (!template) {
            return await rollbackAndReturn(
                client,
                {
                    templateNotFound: true
                }
            );
        }

        const itemResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id
                FROM
                    lease_clause_template_items
                WHERE public_id = $1
                  AND template_id = $2
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    itemPublicId,
                    template.id
                ]
            );

        if (
            itemResult.rows.length === 0
        ) {
            return await rollbackAndReturn(
                client,
                {
                    itemNotFound: true
                }
            );
        }

        const result =
            await client.query(
                `
                UPDATE
                    lease_clause_template_items
                SET
                    deleted_at =
                        CURRENT_TIMESTAMP,
                    deleted_by = $1,
                    updated_by = $1,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING
                    public_id,
                    clause_category,
                    title,
                    display_order,
                    deleted_at
                `,
                [
                    authenticatedUser.id,
                    itemResult.rows[0].id
                ]
            );

        await client.query("COMMIT");

        return {
            template: {
                public_id:
                    template.public_id,
                name:
                    template.name
            },
            item:
                result.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/**
 * POST /api/leases/:lease_public_id/apply-clause-template
 *
 * Safety rules:
 * - Requester must have lease-management authority.
 * - Lease must be Draft.
 * - Template must belong to the same owner.
 * - Template must be active and contain active items.
 * - Draft must not already contain active clauses.
 * - Template items are copied into lease_clauses with new
 *   public IDs; no live template link is retained.
 */
const applyLeaseClauseTemplate = async ({
    leasePublicId,
    templatePublicId,
    authenticatedUser
}) => {
    const client =
        await pool.connect();

    try {
        await client.query("BEGIN");

        const values = [
            leasePublicId
        ];

        let accessCondition = "";

        if (
            authenticatedUser.role !==
                "admin"
        ) {
            values.push(
                authenticatedUser.id
            );

            const userPosition =
                values.length;

            accessCondition = `
                AND EXISTS (
                    SELECT 1
                    FROM owner_users AS ou
                    WHERE ou.owner_id =
                            l.owner_id
                      AND ou.user_id =
                            $${userPosition}
                      AND ou.revoked_at IS NULL
                      AND ou.can_manage_properties =
                            TRUE
                      AND ou.can_manage_finances =
                            TRUE
                )
            `;
        }

        const leaseResult =
            await client.query(
                `
                SELECT
                    l.id,
                    l.public_id,
                    l.lease_number,
                    l.owner_id,
                    l.status,
                    o.public_id
                        AS owner_public_id
                FROM leases AS l
                INNER JOIN owners AS o
                    ON o.id = l.owner_id
                WHERE l.public_id = $1
                  ${accessCondition}
                LIMIT 1
                FOR UPDATE OF l
                `,
                values
            );

        if (
            leaseResult.rows.length === 0
        ) {
            return await rollbackAndReturn(
                client,
                {
                    leaseNotFound: true
                }
            );
        }

        const lease =
            leaseResult.rows[0];

        if (
            lease.status !== "draft"
        ) {
            return await rollbackAndReturn(
                client,
                {
                    notDraft: true
                }
            );
        }

        const templateResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    name,
                    description,
                    status
                FROM
                    lease_clause_templates
                WHERE public_id = $1
                  AND owner_id = $2
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    templatePublicId,
                    lease.owner_id
                ]
            );

        if (
            templateResult.rows.length ===
                0
        ) {
            return await rollbackAndReturn(
                client,
                {
                    templateNotFound: true
                }
            );
        }

        const template =
            templateResult.rows[0];

        if (
            template.status !== "active"
        ) {
            return await rollbackAndReturn(
                client,
                {
                    templateInactive: true
                }
            );
        }

        const existingClauseResult =
            await client.query(
                `
                SELECT id
                FROM lease_clauses
                WHERE lease_id = $1
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    lease.id
                ]
            );

        if (
            existingClauseResult
                .rows.length > 0
        ) {
            return await rollbackAndReturn(
                client,
                {
                    leaseHasClauses: true
                }
            );
        }

        /*
         * Parent template is already locked FOR UPDATE.
         * The template-item integrity trigger also locks
         * the parent before item mutation, so concurrent
         * item changes cannot race with this snapshot.
         */
        const itemsResult =
            await client.query(
                `
                SELECT
                    id,
                    clause_category,
                    title,
                    clause_text,
                    is_mandatory,
                    display_order
                FROM
                    lease_clause_template_items
                WHERE template_id = $1
                  AND deleted_at IS NULL
                ORDER BY
                    display_order ASC,
                    id ASC
                FOR SHARE
                `,
                [
                    template.id
                ]
            );

        if (
            itemsResult.rows.length === 0
        ) {
            return await rollbackAndReturn(
                client,
                {
                    templateEmpty: true
                }
            );
        }

        const copiedClauses = [];

        for (
            const item of
            itemsResult.rows
        ) {
            const clausePublicId =
                `lease_clause_${nanoid(24)}`;

            const copiedResult =
                await client.query(
                    `
                    INSERT INTO
                        lease_clauses (
                            public_id,
                            lease_id,
                            clause_category,
                            title,
                            clause_text,
                            is_mandatory,
                            display_order,
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
                        $8
                    )
                    RETURNING
                        public_id,
                        clause_category,
                        title,
                        clause_text,
                        is_mandatory,
                        display_order,
                        created_at,
                        updated_at
                    `,
                    [
                        clausePublicId,
                        lease.id,
                        item.clause_category,
                        item.title,
                        item.clause_text,
                        item.is_mandatory,
                        item.display_order,
                        authenticatedUser.id
                    ]
                );

            copiedClauses.push(
                copiedResult.rows[0]
            );
        }

        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        return {
            lease: {
                public_id:
                    lease.public_id,
                lease_number:
                    lease.lease_number,
                status:
                    lease.status,
                owner_public_id:
                    lease.owner_public_id
            },
            template: {
                public_id:
                    template.public_id,
                name:
                    template.name
            },
            copied_count:
                copiedClauses.length,
            clauses:
                copiedClauses
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    getLeaseClauseTemplates,
    createLeaseClauseTemplate,
    getSingleLeaseClauseTemplate,
    updateLeaseClauseTemplate,
    deleteLeaseClauseTemplate,
    createLeaseClauseTemplateItem,
    updateLeaseClauseTemplateItem,
    deleteLeaseClauseTemplateItem,
    applyLeaseClauseTemplate
};

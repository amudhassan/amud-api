const {
    nanoid
} = require("nanoid");

const pool = require("../config/db");

/**
 * Create a new draft rent invoice.
 *
 * Administrator:
 * - Can create an invoice for any eligible lease.
 *
 * Regular owner user:
 * - Must have an active owner_users relationship.
 * - Must have can_manage_finances = TRUE.
 *
 * Tenant users:
 * - Cannot create invoices.
 */
const createDraftRentInvoice = async ({
    invoiceData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Find and lock the source lease.
         */
        const leaseResult =
    await client.query(
        `
        SELECT
            id,
            public_id,
            lease_number,
            owner_id,
            property_id,
            unit_id,
            tenant_id,
            status,
            start_date::text
                AS start_date,
            end_date::text
                AS end_date,
            currency_code
        FROM leases
        WHERE public_id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [
            invoiceData
                .lease_public_id
        ]
    );
        if (leaseResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                leaseNotFound: true
            };
        }

        const lease = leaseResult.rows[0];

        /*
         * 2. Confirm that the lease lifecycle
         * permits invoice creation.
         */
        const eligibleLeaseStatuses = [
            "scheduled",
            "active",
            "expired",
            "terminated"
        ];

        if (
            !eligibleLeaseStatuses.includes(
                lease.status
            )
        ) {
            await client.query("ROLLBACK");

            return {
                leaseNotEligible: true
            };
        }

        /*
         * 3. Find and lock the related owner.
         */
        const ownerResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    owner_type,
                    display_name,
                    status
                FROM owners
                WHERE id = $1
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    lease.owner_id
                ]
            );

        if (ownerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                relationshipConflict: true
            };
        }

        const owner = ownerResult.rows[0];

        /*
         * 4. Check invoice-creation permission.
         */
        if (
            authenticatedUser.role !== "admin"
        ) {
            const requesterResult =
                await client.query(
                    `
                    SELECT
                        id,
                        relationship_role,
                        can_manage_finances
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        owner.id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length ===
                    0 ||
                requesterResult.rows[0]
                    .can_manage_finances !== true
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        /*
         * 5. Find and lock the related property.
         */
        const propertyResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    property_name,
                    property_code,
                    operational_status
                FROM properties
                WHERE id = $1
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    lease.property_id
                ]
            );

        if (
            propertyResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                relationshipConflict: true
            };
        }

        const property =
            propertyResult.rows[0];

        /*
         * 6. Find and lock the related unit.
         */
        const unitResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    property_id,
                    unit_code,
                    unit_name,
                    operational_status
                FROM units
                WHERE id = $1
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    lease.unit_id
                ]
            );

        if (unitResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                relationshipConflict: true
            };
        }

        const unit = unitResult.rows[0];

        if (
            unit.property_id !==
            property.id
        ) {
            await client.query("ROLLBACK");

            return {
                relationshipConflict: true
            };
        }

        /*
         * 7. Find and lock the related tenant.
         */
        const tenantResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    tenant_type,
                    display_name,
                    status
                FROM tenants
                WHERE id = $1
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    lease.tenant_id
                ]
            );

        if (
            tenantResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                relationshipConflict: true
            };
        }

        const tenant =
            tenantResult.rows[0];

        /*
         * 8. Defensive date validation.
         *
         * The validator handles request format.
         * These checks protect service calls made
         * from another internal code path.
         */
        const billingPeriodStart =
            invoiceData.billing_period_start;

        const billingPeriodEnd =
            invoiceData.billing_period_end;

        const dueDate =
            invoiceData.due_date;

           
        if (
            billingPeriodEnd <
            billingPeriodStart
        ) {
            await client.query("ROLLBACK");

            return {
                invalidBillingPeriod: true
            };
        }

        if (
            billingPeriodStart <
                lease.start_date ||
            billingPeriodEnd >
                lease.end_date
        ) {
            await client.query("ROLLBACK");

            return {
                billingPeriodOutsideLease:
                    true
            };
        }

        if (
            dueDate <
            billingPeriodStart
        ) {
            await client.query("ROLLBACK");

            return {
                invalidDueDate: true
            };
        }

        /*
         * 9. Detect an existing overlapping
         * non-void invoice.
         *
         * The deferred exclusion constraint
         * remains the final concurrency guard.
         */
        const periodConflictResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    invoice_number,
                    status
                FROM rent_invoices
                WHERE lease_id = $1
                  AND status <> 'void'
                  AND daterange(
                        billing_period_start,
                        billing_period_end,
                        '[]'
                      )
                      &&
                      daterange(
                        $2::date,
                        $3::date,
                        '[]'
                      )
                LIMIT 1
                FOR UPDATE
                `,
                [
                    lease.id,
                    billingPeriodStart,
                    billingPeriodEnd
                ]
            );

        if (
            periodConflictResult.rows.length >
            0
        ) {
            await client.query("ROLLBACK");

            return {
                billingPeriodConflict: true
            };
        }

        /*
         * 10. Prepare optional values.
         */
        const currencyCode =
            invoiceData.currency_code ||
            lease.currency_code ||
            "TZS";

        const notes =
            typeof invoiceData.notes ===
                "string" &&
            invoiceData.notes.trim().length > 0
                ? invoiceData.notes.trim()
                : null;

        /*
         * 11. Generate collision-resistant public
         * identifiers.
         *
         * Random invoice numbers avoid a
         * concurrent MAX()+1 numbering race.
         */
        const invoicePublicId =
            `invoice_${nanoid(24)}`;

        const invoiceNumber =
            `INV-${new Date()
                .getUTCFullYear()}-${nanoid(10)
                .toUpperCase()}`;

        /*
         * 12. Insert a zero-value draft invoice.
         *
         * Financial component columns use their
         * database defaults. Invoice-item triggers
         * will synchronize them later.
         */
        const invoiceResult =
            await client.query(
                `
                INSERT INTO rent_invoices (
                    public_id,
                    invoice_number,
                    lease_id,
                    owner_id,
                    property_id,
                    unit_id,
                    tenant_id,
                    billing_period_start,
                    billing_period_end,
                    due_date,
                    currency_code,
                    status,
                    notes,
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
                    'draft',
                    $12,
                    $13
                )
                RETURNING
                    public_id,
                    invoice_number,
                    status,
                    billing_period_start,
                    billing_period_end,
                    issue_date,
                    due_date,
                    currency_code,
                    subtotal_amount,
                    discount_amount,
                    tax_amount,
                    late_fee_amount,
                    total_amount,
                    paid_amount,
                    balance_amount,
                    notes,
                    issued_at,
                    voided_at,
                    created_at,
                    updated_at
                `,
                [
                    invoicePublicId,
                    invoiceNumber,
                    lease.id,
                    owner.id,
                    property.id,
                    unit.id,
                    tenant.id,
                    billingPeriodStart,
                    billingPeriodEnd,
                    dueDate,
                    currencyCode,
                    notes,
                    authenticatedUser.id
                ]
            );

        /*
         * 13. Execute deferred database integrity
         * checks before committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        /*
         * Do not expose internal database IDs.
         */
        delete lease.id;
        delete lease.owner_id;
        delete lease.property_id;
        delete lease.unit_id;
        delete lease.tenant_id;

        delete owner.id;
        delete property.id;

        delete unit.id;
        delete unit.property_id;

        delete tenant.id;

        return {
            forbidden: false,
            invoice:
                invoiceResult.rows[0],
            lease,
            owner,
            property,
            unit,
            tenant
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
/**
 * Retrieve invoices visible to the authenticated
 * user.
 *
 * Administrator:
 * - Can view every invoice.
 *
 * Owner user:
 * - Requires active owner_users relationship.
 * - Requires can_manage_finances = TRUE.
 *
 * Tenant user:
 * - Requires active tenant_users relationship.
 * - Requires can_view_finances = TRUE.
 */
const getInvoices = async ({
    filters,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        /*
         * 1. Confirm that a regular user has at
         * least one valid financial relationship.
         */
        if (
            authenticatedUser.role !== "admin"
        ) {
            const permissionResult =
                await client.query(
                    `
                    SELECT
                        (
                            EXISTS (
                                SELECT 1
                                FROM owner_users
                                WHERE user_id = $1
                                  AND revoked_at
                                      IS NULL
                                  AND can_manage_finances
                                      = TRUE
                            )
                            OR
                            EXISTS (
                                SELECT 1
                                FROM tenant_users
                                WHERE user_id = $1
                                  AND revoked_at
                                      IS NULL
                                  AND can_view_finances
                                      = TRUE
                            )
                        ) AS has_permission
                    `,
                    [
                        authenticatedUser.id
                    ]
                );

            if (
                permissionResult.rows[0]
                    .has_permission !== true
            ) {
                return {
                    forbidden: true
                };
            }
        }

        /*
         * 2. Pagination defaults.
         */
        const page =
            filters.page || 1;

        const limit =
            filters.limit || 20;

        const offset =
            (page - 1) * limit;

        /*
         * 3. Build parameterized authorization
         * and filter conditions.
         */
        const values = [
            authenticatedUser.role === "admin",
            authenticatedUser.id
        ];

        const conditions = [
            `
            (
                $1::boolean = TRUE

                OR EXISTS (
                    SELECT 1
                    FROM owner_users AS authorized_ou
                    WHERE authorized_ou.owner_id =
                            ri.owner_id
                      AND authorized_ou.user_id =
                            $2
                      AND authorized_ou.revoked_at
                            IS NULL
                      AND authorized_ou
                            .can_manage_finances =
                            TRUE
                )

                OR EXISTS (
                    SELECT 1
                    FROM tenant_users AS authorized_tu
                    WHERE authorized_tu.tenant_id =
                            ri.tenant_id
                      AND authorized_tu.user_id =
                            $2
                      AND authorized_tu.revoked_at
                            IS NULL
                      AND authorized_tu
                            .can_view_finances =
                            TRUE
                )
            )
            `
        ];

        const addCondition = (
            sqlBuilder,
            value
        ) => {
            values.push(value);

            conditions.push(
                sqlBuilder(values.length)
            );
        };

        if (filters.search) {
            addCondition(
                parameterNumber => `
                (
                    ri.invoice_number
                        ILIKE $${parameterNumber}
                    OR l.lease_number
                        ILIKE $${parameterNumber}
                    OR o.display_name
                        ILIKE $${parameterNumber}
                    OR p.property_name
                        ILIKE $${parameterNumber}
                    OR p.property_code
                        ILIKE $${parameterNumber}
                    OR u.unit_name
                        ILIKE $${parameterNumber}
                    OR u.unit_code
                        ILIKE $${parameterNumber}
                    OR t.display_name
                        ILIKE $${parameterNumber}
                )
                `,
                `%${filters.search}%`
            );
        }

        if (filters.status) {
            addCondition(
                parameterNumber =>
                    `ri.status = $${parameterNumber}`,
                filters.status
            );
        }

        if (filters.lease_public_id) {
            addCondition(
                parameterNumber =>
                    `l.public_id = $${parameterNumber}`,
                filters.lease_public_id
            );
        }

        if (filters.owner_public_id) {
            addCondition(
                parameterNumber =>
                    `o.public_id = $${parameterNumber}`,
                filters.owner_public_id
            );
        }

        if (
            filters.property_public_id
        ) {
            addCondition(
                parameterNumber =>
                    `p.public_id = $${parameterNumber}`,
                filters.property_public_id
            );
        }

        if (filters.unit_public_id) {
            addCondition(
                parameterNumber =>
                    `u.public_id = $${parameterNumber}`,
                filters.unit_public_id
            );
        }

        if (filters.tenant_public_id) {
            addCondition(
                parameterNumber =>
                    `t.public_id = $${parameterNumber}`,
                filters.tenant_public_id
            );
        }

        if (
            filters
                .billing_period_start_from
        ) {
            addCondition(
                parameterNumber => `
                    ri.billing_period_start >=
                        $${parameterNumber}::date
                `,
                filters
                    .billing_period_start_from
            );
        }

        if (
            filters.billing_period_end_to
        ) {
            addCondition(
                parameterNumber => `
                    ri.billing_period_end <=
                        $${parameterNumber}::date
                `,
                filters.billing_period_end_to
            );
        }

        if (filters.due_date_from) {
            addCondition(
                parameterNumber => `
                    ri.due_date >=
                        $${parameterNumber}::date
                `,
                filters.due_date_from
            );
        }

        if (filters.due_date_to) {
            addCondition(
                parameterNumber => `
                    ri.due_date <=
                        $${parameterNumber}::date
                `,
                filters.due_date_to
            );
        }

        const whereClause =
            conditions.join("\n AND ");

        const baseJoins = `
            INNER JOIN leases AS l
                ON l.id = ri.lease_id

            INNER JOIN owners AS o
                ON o.id = ri.owner_id

            INNER JOIN properties AS p
                ON p.id = ri.property_id

            INNER JOIN units AS u
                ON u.id = ri.unit_id

            INNER JOIN tenants AS t
                ON t.id = ri.tenant_id
        `;

        /*
         * 4. Count filtered authorized invoices.
         */
        const countResult =
            await client.query(
                `
                SELECT
                    COUNT(*)::integer
                        AS total
                FROM rent_invoices AS ri

                ${baseJoins}

                WHERE ${whereClause}
                `,
                values
            );

        const total =
            countResult.rows[0].total;

        /*
         * 5. Add pagination parameters after the
         * count query.
         */
        const dataValues = [
            ...values,
            limit,
            offset
        ];

        const limitParameter =
            dataValues.length - 1;

        const offsetParameter =
            dataValues.length;

        /*
         * 6. Retrieve the paginated invoice list.
         */
        const dataResult =
            await client.query(
                `
                SELECT
                    ri.public_id,
                    ri.invoice_number,
                    ri.status,
                    ri.billing_period_start,
                    ri.billing_period_end,
                    ri.issue_date,
                    ri.due_date,
                    ri.currency_code,
                    ri.subtotal_amount,
                    ri.discount_amount,
                    ri.tax_amount,
                    ri.late_fee_amount,
                    ri.total_amount,
                    ri.paid_amount,
                    ri.balance_amount,
                    ri.notes,
                    ri.issued_at,
                    ri.voided_at,
                    ri.void_reason,
                    ri.created_at,
                    ri.updated_at,

                    (
                        SELECT COUNT(*)::integer
                        FROM rent_invoice_items
                            AS rii
                        WHERE rii.invoice_id =
                            ri.id
                    ) AS item_count,

                    l.public_id
                        AS lease_public_id,
                    l.lease_number,
                    l.status
                        AS lease_status,
                    l.start_date
                        AS lease_start_date,
                    l.end_date
                        AS lease_end_date,

                    o.public_id
                        AS owner_public_id,
                    o.owner_type,
                    o.display_name
                        AS owner_display_name,
                    o.status
                        AS owner_status,

                    p.public_id
                        AS property_public_id,
                    p.property_name,
                    p.property_code,
                    p.operational_status
                        AS property_status,

                    u.public_id
                        AS unit_public_id,
                    u.unit_code,
                    u.unit_name,
                    u.operational_status
                        AS unit_status,

                    t.public_id
                        AS tenant_public_id,
                    t.tenant_type,
                    t.display_name
                        AS tenant_display_name,
                    t.status
                        AS tenant_status

                FROM rent_invoices AS ri

                ${baseJoins}

                WHERE ${whereClause}

                ORDER BY
                    ri.created_at DESC,
                    ri.id DESC

                LIMIT $${limitParameter}
                OFFSET $${offsetParameter}
                `,
                dataValues
            );

        /*
         * 7. Convert flat SQL rows into the public
         * nested API response.
         */
        const invoices =
            dataResult.rows.map(row => ({
                public_id:
                    row.public_id,

                invoice_number:
                    row.invoice_number,

                status:
                    row.status,

                billing_period_start:
                    row.billing_period_start,

                billing_period_end:
                    row.billing_period_end,

                issue_date:
                    row.issue_date,

                due_date:
                    row.due_date,

                currency_code:
                    row.currency_code,

                financial_summary: {
                    subtotal_amount:
                        row.subtotal_amount,

                    discount_amount:
                        row.discount_amount,

                    tax_amount:
                        row.tax_amount,

                    late_fee_amount:
                        row.late_fee_amount,

                    total_amount:
                        row.total_amount,

                    paid_amount:
                        row.paid_amount,

                    balance_amount:
                        row.balance_amount
                },

                item_count:
                    row.item_count,

                notes:
                    row.notes,

                issued_at:
                    row.issued_at,

                voided_at:
                    row.voided_at,

                void_reason:
                    row.void_reason,

                lease: {
                    public_id:
                        row.lease_public_id,

                    lease_number:
                        row.lease_number,

                    status:
                        row.lease_status,

                    start_date:
                        row.lease_start_date,

                    end_date:
                        row.lease_end_date
                },

                owner: {
                    public_id:
                        row.owner_public_id,

                    owner_type:
                        row.owner_type,

                    display_name:
                        row.owner_display_name,

                    status:
                        row.owner_status
                },

                property: {
                    public_id:
                        row.property_public_id,

                    property_name:
                        row.property_name,

                    property_code:
                        row.property_code,

                    operational_status:
                        row.property_status
                },

                unit: {
                    public_id:
                        row.unit_public_id,

                    unit_code:
                        row.unit_code,

                    unit_name:
                        row.unit_name,

                    operational_status:
                        row.unit_status
                },

                tenant: {
                    public_id:
                        row.tenant_public_id,

                    tenant_type:
                        row.tenant_type,

                    display_name:
                        row.tenant_display_name,

                    status:
                        row.tenant_status
                },

                created_at:
                    row.created_at,

                updated_at:
                    row.updated_at
            }));

        const totalPages =
            total === 0
                ? 0
                : Math.ceil(total / limit);

        return {
            forbidden: false,
            invoices,
            pagination: {
                page,
                limit,
                total,
                total_pages:
                    totalPages,
                has_next_page:
                    page < totalPages,
                has_previous_page:
                    page > 1
            }
        };
    } finally {
        client.release();
    }
};
/**
 * Retrieve one invoice when the authenticated
 * user has financial visibility.
 *
 * Missing and inaccessible invoices deliberately
 * produce the same null result.
 */
const getSingleInvoice = async ({
    invoicePublicId,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        /*
         * 1. Retrieve the invoice and apply
         * authorization inside the SQL query.
         */
        const invoiceResult =
            await client.query(
                `
                SELECT
                    ri.id,
                    ri.public_id,
                    ri.invoice_number,
                    ri.status,
                    ri.billing_period_start,
                    ri.billing_period_end,
                    ri.issue_date,
                    ri.due_date,
                    ri.currency_code,
                    ri.subtotal_amount,
                    ri.discount_amount,
                    ri.tax_amount,
                    ri.late_fee_amount,
                    ri.total_amount,
                    ri.paid_amount,
                    ri.balance_amount,
                    ri.notes,
                    ri.issued_at,
                    ri.voided_at,
                    ri.void_reason,
                    ri.created_at,
                    ri.updated_at,

                    l.public_id
                        AS lease_public_id,
                    l.lease_number,
                    l.status
                        AS lease_status,
                    l.start_date
                        AS lease_start_date,
                    l.end_date
                        AS lease_end_date,

                    o.public_id
                        AS owner_public_id,
                    o.owner_type,
                    o.display_name
                        AS owner_display_name,
                    o.status
                        AS owner_status,

                    p.public_id
                        AS property_public_id,
                    p.property_name,
                    p.property_code,
                    p.operational_status
                        AS property_status,

                    u.public_id
                        AS unit_public_id,
                    u.unit_code,
                    u.unit_name,
                    u.operational_status
                        AS unit_status,

                    t.public_id
                        AS tenant_public_id,
                    t.tenant_type,
                    t.display_name
                        AS tenant_display_name,
                    t.status
                        AS tenant_status,

                    creator.public_id
                        AS creator_public_id,
                    creator.full_name
                        AS creator_full_name,
                    creator.email
                        AS creator_email,

                    issuer.public_id
                        AS issuer_public_id,
                    issuer.full_name
                        AS issuer_full_name,
                    issuer.email
                        AS issuer_email,

                    voider.public_id
                        AS voider_public_id,
                    voider.full_name
                        AS voider_full_name,
                    voider.email
                        AS voider_email

                FROM rent_invoices AS ri

                INNER JOIN leases AS l
                    ON l.id = ri.lease_id

                INNER JOIN owners AS o
                    ON o.id = ri.owner_id

                INNER JOIN properties AS p
                    ON p.id = ri.property_id

                INNER JOIN units AS u
                    ON u.id = ri.unit_id

                INNER JOIN tenants AS t
                    ON t.id = ri.tenant_id

                INNER JOIN users AS creator
                    ON creator.id = ri.created_by

                LEFT JOIN users AS issuer
                    ON issuer.id = ri.issued_by

                LEFT JOIN users AS voider
                    ON voider.id = ri.voided_by

                WHERE ri.public_id = $1

                  AND (
                      $2::boolean = TRUE

                      OR EXISTS (
                          SELECT 1
                          FROM owner_users
                              AS authorized_ou
                          WHERE
                              authorized_ou.owner_id =
                                  ri.owner_id
                            AND authorized_ou.user_id =
                                  $3
                            AND authorized_ou.revoked_at
                                  IS NULL
                            AND authorized_ou
                                  .can_manage_finances =
                                  TRUE
                      )

                      OR EXISTS (
                          SELECT 1
                          FROM tenant_users
                              AS authorized_tu
                          WHERE
                              authorized_tu.tenant_id =
                                  ri.tenant_id
                            AND authorized_tu.user_id =
                                  $3
                            AND authorized_tu.revoked_at
                                  IS NULL
                            AND authorized_tu
                                  .can_view_finances =
                                  TRUE
                      )
                  )

                LIMIT 1
                `,
                [
                    invoicePublicId,
                    authenticatedUser.role ===
                        "admin",
                    authenticatedUser.id
                ]
            );

        if (
            invoiceResult.rows.length === 0
        ) {
            return null;
        }

        const row =
            invoiceResult.rows[0];

        /*
         * 2. Retrieve items only after invoice
         * authorization has succeeded.
         */
        const itemsResult =
            await client.query(
                `
                SELECT
                    rii.public_id,
                    rii.item_type,
                    rii.description,
                    rii.quantity,
                    rii.unit_amount,
                    rii.line_amount,
                    rii.created_at,
                    rii.updated_at,

                    creator.public_id
                        AS creator_public_id,
                    creator.full_name
                        AS creator_full_name,
                    creator.email
                        AS creator_email

                FROM rent_invoice_items AS rii

                INNER JOIN users AS creator
                    ON creator.id =
                        rii.created_by

                WHERE rii.invoice_id = $1

                ORDER BY
                    rii.created_at ASC,
                    rii.id ASC
                `,
                [
                    row.id
                ]
            );

        /*
         * 3. Map items without internal IDs.
         */
        const items =
            itemsResult.rows.map(item => ({
                public_id:
                    item.public_id,

                item_type:
                    item.item_type,

                description:
                    item.description,

                quantity:
                    item.quantity,

                unit_amount:
                    item.unit_amount,

                line_amount:
                    item.line_amount,

                created_by: {
                    public_id:
                        item.creator_public_id,

                    full_name:
                        item.creator_full_name,

                    email:
                        item.creator_email
                },

                created_at:
                    item.created_at,

                updated_at:
                    item.updated_at
            }));

        /*
         * 4. Return the nested public response.
         */
        return {
            public_id:
                row.public_id,

            invoice_number:
                row.invoice_number,

            status:
                row.status,

            billing_period_start:
                row.billing_period_start,

            billing_period_end:
                row.billing_period_end,

            issue_date:
                row.issue_date,

            due_date:
                row.due_date,

            currency_code:
                row.currency_code,

            financial_summary: {
                subtotal_amount:
                    row.subtotal_amount,

                discount_amount:
                    row.discount_amount,

                tax_amount:
                    row.tax_amount,

                late_fee_amount:
                    row.late_fee_amount,

                total_amount:
                    row.total_amount,

                paid_amount:
                    row.paid_amount,

                balance_amount:
                    row.balance_amount
            },

            notes:
                row.notes,

            items,

            lease: {
                public_id:
                    row.lease_public_id,

                lease_number:
                    row.lease_number,

                status:
                    row.lease_status,

                start_date:
                    row.lease_start_date,

                end_date:
                    row.lease_end_date
            },

            owner: {
                public_id:
                    row.owner_public_id,

                owner_type:
                    row.owner_type,

                display_name:
                    row.owner_display_name,

                status:
                    row.owner_status
            },

            property: {
                public_id:
                    row.property_public_id,

                property_name:
                    row.property_name,

                property_code:
                    row.property_code,

                operational_status:
                    row.property_status
            },

            unit: {
                public_id:
                    row.unit_public_id,

                unit_code:
                    row.unit_code,

                unit_name:
                    row.unit_name,

                operational_status:
                    row.unit_status
            },

            tenant: {
                public_id:
                    row.tenant_public_id,

                tenant_type:
                    row.tenant_type,

                display_name:
                    row.tenant_display_name,

                status:
                    row.tenant_status
            },

            audit: {
                created_by: {
                    public_id:
                        row.creator_public_id,

                    full_name:
                        row.creator_full_name,

                    email:
                        row.creator_email
                },

                issued: {
                    issued_at:
                        row.issued_at,

                    issued_by:
                        row.issuer_public_id
                            ? {
                                public_id:
                                    row.issuer_public_id,

                                full_name:
                                    row.issuer_full_name,

                                email:
                                    row.issuer_email
                            }
                            : null
                },

                voided: {
                    voided_at:
                        row.voided_at,

                    voided_by:
                        row.voider_public_id
                            ? {
                                public_id:
                                    row.voider_public_id,

                                full_name:
                                    row.voider_full_name,

                                email:
                                    row.voider_email
                            }
                            : null,

                    void_reason:
                        row.void_reason
                }
            },

            created_at:
                row.created_at,

            updated_at:
                row.updated_at
        };
    } finally {
        client.release();
    }
};

/**
 * Update the editable header fields of a draft
 * rent invoice.
 *
 * Administrator:
 * - Can update any draft invoice.
 *
 * Regular owner user:
 * - Must have an active owner_users relationship.
 * - Must have can_manage_finances = TRUE.
 *
 * Tenant users:
 * - Cannot update invoices.
 */
const updateDraftRentInvoice = async ({
    invoicePublicId,
    invoiceData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Find and lock the target invoice.
         */
        const invoiceResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    invoice_number,
                    owner_id,
                    status,
                    billing_period_start::text
    AS billing_period_start,
billing_period_end::text
    AS billing_period_end,
issue_date::text
    AS issue_date,
due_date::text
    AS due_date,
                    currency_code,
                    subtotal_amount,
                    discount_amount,
                    tax_amount,
                    late_fee_amount,
                    total_amount,
                    paid_amount,
                    balance_amount,
                    notes,
                    issued_at,
                    voided_at,
                    void_reason,
                    created_at,
                    updated_at
                FROM rent_invoices
                WHERE public_id = $1
                LIMIT 1
                FOR UPDATE
                `,
                [
                    invoicePublicId
                ]
            );

        if (invoiceResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                invoiceNotFound: true
            };
        }

        const currentInvoice =
            invoiceResult.rows[0];

        /*
         * 2. Confirm update authorization before
         * exposing the invoice's current status.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT
                        id,
                        relationship_role,
                        can_manage_finances
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        currentInvoice.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0 ||
                requesterResult.rows[0]
                    .can_manage_finances !== true
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        /*
         * 3. Only draft invoices are editable.
         *
         * This check runs after authorization so
         * unauthorized users cannot discover the
         * invoice's current status.
         */
        if (currentInvoice.status !== "draft") {
            await client.query("ROLLBACK");

            return {
                notDraft: true
            };
        }

        /*
         * 4. Build final values for this partial
         * update.
         */
        const hasOwn = field =>
            Object.prototype.hasOwnProperty.call(
                invoiceData,
                field
            );

        const finalDueDate =
            hasOwn("due_date")
                ? invoiceData.due_date
                : currentInvoice.due_date;

        const finalCurrencyCode =
            hasOwn("currency_code")
                ? invoiceData.currency_code
                : currentInvoice.currency_code;

        const finalNotes =
            hasOwn("notes")
                ? (
                    typeof invoiceData.notes ===
                        "string"
                        ? (
                            invoiceData.notes.trim()
                                .length > 0
                                ? invoiceData.notes
                                    .trim()
                                : null
                        )
                        : null
                )
                : currentInvoice.notes;

        /*
         * 5. Defensive final-value validation.
         *
         * The validator protects HTTP requests;
         * these checks also protect internal calls.
         */
        if (
            typeof finalDueDate !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(
                finalDueDate
            ) ||
            finalDueDate <
                currentInvoice
                    .billing_period_start
        ) {
            await client.query("ROLLBACK");

            return {
                invalidDueDate: true
            };
        }

        if (
            typeof finalCurrencyCode !==
                "string" ||
            !/^[A-Z]{3}$/.test(
                finalCurrencyCode
            )
        ) {
            await client.query("ROLLBACK");

            return {
                invalidCurrencyCode: true
            };
        }

        /*
         * 6. Reject requests that do not produce
         * an actual persisted change.
         */
        const noChanges =
            finalDueDate ===
                currentInvoice.due_date &&
            finalCurrencyCode ===
                currentInvoice.currency_code &&
            finalNotes ===
                currentInvoice.notes;

        if (noChanges) {
            await client.query("ROLLBACK");

            return {
                noChanges: true
            };
        }

        /*
         * 7. Update only editable draft invoice
         * header fields.
         */
        const updatedInvoiceResult =
            await client.query(
                `
                UPDATE rent_invoices
                SET
                    due_date = $1,
                    currency_code = $2,
                    notes = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4
                  AND status = 'draft'
                RETURNING
                    public_id,
                    invoice_number,
                    status,
                    billing_period_start,
                    billing_period_end,
                    issue_date,
                    due_date,
                    currency_code,
                    subtotal_amount,
                    discount_amount,
                    tax_amount,
                    late_fee_amount,
                    total_amount,
                    paid_amount,
                    balance_amount,
                    notes,
                    issued_at,
                    voided_at,
                    void_reason,
                    created_at,
                    updated_at
                `,
                [
                    finalDueDate,
                    finalCurrencyCode,
                    finalNotes,
                    currentInvoice.id
                ]
            );

        /*
         * 8. Execute deferred integrity checks
         * before committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        return {
            invoice:
                updatedInvoiceResult.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Add a billing line to a draft rent invoice.
 *
 * Administrator:
 * - Can add items to any draft invoice.
 *
 * Regular owner user:
 * - Must have an active owner_users relationship.
 * - Must have can_manage_finances = TRUE.
 *
 * Tenant users:
 * - Cannot add invoice items.
 */
const addDraftRentInvoiceItem = async ({
    invoicePublicId,
    itemData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Find and lock the target invoice.
         */
        const invoiceResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    invoice_number,
                    owner_id,
                    status
                FROM rent_invoices
                WHERE public_id = $1
                LIMIT 1
                FOR UPDATE
                `,
                [
                    invoicePublicId
                ]
            );

        if (invoiceResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                invoiceNotFound: true
            };
        }

        const currentInvoice =
            invoiceResult.rows[0];

        /*
         * 2. Confirm authorization before
         * exposing the invoice's current status.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT
                        id,
                        relationship_role,
                        can_manage_finances
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        currentInvoice.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0 ||
                requesterResult.rows[0]
                    .can_manage_finances !== true
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        /*
         * 3. Invoice items can only be changed
         * while the invoice is draft.
         */
        if (currentInvoice.status !== "draft") {
            await client.query("ROLLBACK");

            return {
                notDraft: true
            };
        }

        /*
         * 4. Defensive item-value validation.
         *
         * The HTTP validator is the first guard;
         * these checks also protect internal calls.
         */
        const allowedItemTypes = [
            "rent",
            "late_fee",
            "utility",
            "service_charge",
            "adjustment",
            "discount",
            "tax",
            "other"
        ];

        const itemType =
            typeof itemData.item_type === "string"
                ? itemData.item_type.trim()
                : "";

        if (!allowedItemTypes.includes(itemType)) {
            await client.query("ROLLBACK");

            return {
                invalidItemType: true
            };
        }

        const description =
            typeof itemData.description === "string"
                ? itemData.description.trim()
                : "";

        if (
            description.length === 0 ||
            description.length > 500
        ) {
            await client.query("ROLLBACK");

            return {
                invalidDescription: true
            };
        }

        const quantity =
            String(itemData.quantity).trim();

        if (
            !/^\d{1,8}(\.\d{1,4})?$/.test(
                quantity
            ) ||
            Number(quantity) <= 0
        ) {
            await client.query("ROLLBACK");

            return {
                invalidQuantity: true
            };
        }

        const unitAmount =
            String(itemData.unit_amount).trim();

        if (
            !/^\d{1,12}(\.\d{1,2})?$/.test(
                unitAmount
            ) ||
            Number(unitAmount) < 0
        ) {
            await client.query("ROLLBACK");

            return {
                invalidUnitAmount: true
            };
        }

        /*
         * 5. Generate the immutable public ID.
         */
        const itemPublicId =
            `invoice_item_${nanoid(24)}`;

        /*
         * 6. Insert the item.
         *
         * line_amount is generated by PostgreSQL.
         * Database triggers synchronize all invoice
         * financial totals after this insert.
         */
        const itemResult =
            await client.query(
                `
                INSERT INTO rent_invoice_items (
                    public_id,
                    invoice_id,
                    item_type,
                    description,
                    quantity,
                    unit_amount,
                    created_by
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7
                )
                RETURNING
                    public_id,
                    item_type,
                    description,
                    quantity,
                    unit_amount,
                    line_amount,
                    created_at,
                    updated_at
                `,
                [
                    itemPublicId,
                    currentInvoice.id,
                    itemType,
                    description,
                    quantity,
                    unitAmount,
                    authenticatedUser.id
                ]
            );

        /*
         * 7. Execute deferred integrity checks
         * before reading the final totals or
         * committing the transaction.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        /*
         * 8. Reload the invoice after automatic
         * total synchronization.
         */
        const updatedInvoiceResult =
            await client.query(
                `
                SELECT
                    public_id,
                    invoice_number,
                    status,
                    billing_period_start,
                    billing_period_end,
                    issue_date,
                    due_date,
                    currency_code,
                    subtotal_amount,
                    discount_amount,
                    tax_amount,
                    late_fee_amount,
                    total_amount,
                    paid_amount,
                    balance_amount,
                    notes,
                    issued_at,
                    voided_at,
                    void_reason,
                    created_at,
                    updated_at
                FROM rent_invoices
                WHERE id = $1
                LIMIT 1
                `,
                [
                    currentInvoice.id
                ]
            );

        await client.query("COMMIT");

        return {
            item:
                itemResult.rows[0],

            invoice:
                updatedInvoiceResult.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
/**
 * Update an existing billing line belonging to a
 * draft rent invoice.
 *
 * Administrator:
 * - Can update items on any draft invoice.
 *
 * Regular owner user:
 * - Must have an active owner_users relationship.
 * - Must have can_manage_finances = TRUE.
 *
 * Tenant users:
 * - Cannot update invoice items.
 */
const updateDraftRentInvoiceItem = async ({
    invoicePublicId,
    itemPublicId,
    itemData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Find and lock the target invoice.
         */
        const invoiceResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    invoice_number,
                    owner_id,
                    status
                FROM rent_invoices
                WHERE public_id = $1
                LIMIT 1
                FOR UPDATE
                `,
                [
                    invoicePublicId
                ]
            );

        if (invoiceResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                invoiceNotFound: true
            };
        }

        const currentInvoice =
            invoiceResult.rows[0];

        /*
         * 2. Confirm authorization before
         * exposing invoice status or item details.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT
                        id,
                        relationship_role,
                        can_manage_finances
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        currentInvoice.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0 ||
                requesterResult.rows[0]
                    .can_manage_finances !== true
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        /*
         * 3. Invoice items can only be updated
         * while the invoice is draft.
         */
        if (currentInvoice.status !== "draft") {
            await client.query("ROLLBACK");

            return {
                notDraft: true
            };
        }

        /*
         * 4. Find and lock the item only when it
         * belongs to the selected invoice.
         */
        const itemResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    invoice_id,
                    item_type,
                    description,
                    quantity::text
                        AS quantity,
                    unit_amount::text
                        AS unit_amount,
                    line_amount,
                    created_by,
                    created_at,
                    updated_at
                FROM rent_invoice_items
                WHERE public_id = $1
                  AND invoice_id = $2
                LIMIT 1
                FOR UPDATE
                `,
                [
                    itemPublicId,
                    currentInvoice.id
                ]
            );

        if (itemResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                itemNotFound: true
            };
        }

        const currentItem =
            itemResult.rows[0];

        /*
         * 5. Build final values for this partial
         * item update.
         */
        const hasOwn = field =>
            Object.prototype.hasOwnProperty.call(
                itemData,
                field
            );

        const finalItemType =
            hasOwn("item_type") &&
            typeof itemData.item_type === "string"
                ? itemData.item_type.trim()
                : currentItem.item_type;

        const finalDescription =
            hasOwn("description") &&
            typeof itemData.description === "string"
                ? itemData.description.trim()
                : currentItem.description;

        const finalQuantity =
            hasOwn("quantity")
                ? String(
                    itemData.quantity
                ).trim()
                : currentItem.quantity;

        const finalUnitAmount =
            hasOwn("unit_amount")
                ? String(
                    itemData.unit_amount
                ).trim()
                : currentItem.unit_amount;

        /*
         * 6. Defensive final-value validation.
         */
        const allowedItemTypes = [
            "rent",
            "late_fee",
            "utility",
            "service_charge",
            "adjustment",
            "discount",
            "tax",
            "other"
        ];

        if (
            !allowedItemTypes.includes(
                finalItemType
            )
        ) {
            await client.query("ROLLBACK");

            return {
                invalidItemType: true
            };
        }

        if (
            typeof finalDescription !== "string" ||
            finalDescription.length === 0 ||
            finalDescription.length > 500
        ) {
            await client.query("ROLLBACK");

            return {
                invalidDescription: true
            };
        }

        if (
            !/^\d{1,8}(\.\d{1,4})?$/.test(
                finalQuantity
            ) ||
            Number(finalQuantity) <= 0
        ) {
            await client.query("ROLLBACK");

            return {
                invalidQuantity: true
            };
        }

        if (
            !/^\d{1,12}(\.\d{1,2})?$/.test(
                finalUnitAmount
            ) ||
            Number(finalUnitAmount) < 0
        ) {
            await client.query("ROLLBACK");

            return {
                invalidUnitAmount: true
            };
        }

        /*
         * Normalize decimal strings so values such
         * as 2 and 2.0000 compare as equal.
         */
        const normalizeDecimal = value => {
            const stringValue =
                String(value).trim();

            const [
                wholePart,
                fractionPart = ""
            ] = stringValue.split(".");

            const normalizedWhole =
                wholePart.replace(
                    /^0+(?=\d)/,
                    ""
                );

            const normalizedFraction =
                fractionPart.replace(
                    /0+$/,
                    ""
                );

            return normalizedFraction
                ? `${normalizedWhole}.${normalizedFraction}`
                : normalizedWhole;
        };

        /*
         * 7. Reject requests that do not produce
         * an actual persisted change.
         */
        const noChanges =
            finalItemType ===
                currentItem.item_type &&
            finalDescription ===
                currentItem.description &&
            normalizeDecimal(
                finalQuantity
            ) ===
                normalizeDecimal(
                    currentItem.quantity
                ) &&
            normalizeDecimal(
                finalUnitAmount
            ) ===
                normalizeDecimal(
                    currentItem.unit_amount
                );

        if (noChanges) {
            await client.query("ROLLBACK");

            return {
                noChanges: true
            };
        }

        /*
         * 8. Update only editable item fields.
         *
         * line_amount is recalculated by PostgreSQL.
         * Invoice totals are synchronized by the
         * database item trigger.
         */
        const updatedItemResult =
            await client.query(
                `
                UPDATE rent_invoice_items
                SET
                    item_type = $1,
                    description = $2,
                    quantity = $3,
                    unit_amount = $4,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $5
                  AND invoice_id = $6
                RETURNING
                    public_id,
                    item_type,
                    description,
                    quantity,
                    unit_amount,
                    line_amount,
                    created_at,
                    updated_at
                `,
                [
                    finalItemType,
                    finalDescription,
                    finalQuantity,
                    finalUnitAmount,
                    currentItem.id,
                    currentInvoice.id
                ]
            );

        /*
         * 9. Execute deferred integrity checks
         * before reading totals or committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        /*
         * 10. Reload synchronized invoice totals.
         */
        const updatedInvoiceResult =
            await client.query(
                `
                SELECT
                    public_id,
                    invoice_number,
                    status,
                    billing_period_start,
                    billing_period_end,
                    issue_date,
                    due_date,
                    currency_code,
                    subtotal_amount,
                    discount_amount,
                    tax_amount,
                    late_fee_amount,
                    total_amount,
                    paid_amount,
                    balance_amount,
                    notes,
                    issued_at,
                    voided_at,
                    void_reason,
                    created_at,
                    updated_at
                FROM rent_invoices
                WHERE id = $1
                LIMIT 1
                `,
                [
                    currentInvoice.id
                ]
            );

        await client.query("COMMIT");

        return {
            item:
                updatedItemResult.rows[0],

            invoice:
                updatedInvoiceResult.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
/**
 * Delete an existing billing line belonging to a
 * draft rent invoice.
 *
 * Administrator:
 * - Can delete items from any draft invoice.
 *
 * Regular owner user:
 * - Must have an active owner_users relationship.
 * - Must have can_manage_finances = TRUE.
 *
 * Tenant users:
 * - Cannot delete invoice items.
 */
const deleteDraftRentInvoiceItem = async ({
    invoicePublicId,
    itemPublicId,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Find and lock the target invoice.
         */
        const invoiceResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    invoice_number,
                    owner_id,
                    status
                FROM rent_invoices
                WHERE public_id = $1
                LIMIT 1
                FOR UPDATE
                `,
                [
                    invoicePublicId
                ]
            );

        if (invoiceResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                invoiceNotFound: true
            };
        }

        const currentInvoice =
            invoiceResult.rows[0];

        /*
         * 2. Confirm authorization before
         * exposing invoice status or item details.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT
                        id,
                        relationship_role,
                        can_manage_finances
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        currentInvoice.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0 ||
                requesterResult.rows[0]
                    .can_manage_finances !== true
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        /*
         * 3. Invoice items can only be deleted
         * while the invoice is draft.
         */
        if (currentInvoice.status !== "draft") {
            await client.query("ROLLBACK");

            return {
                notDraft: true
            };
        }

        /*
         * 4. Find and lock the item only when it
         * belongs to the selected invoice.
         */
        const itemResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    invoice_id,
                    item_type,
                    description,
                    quantity,
                    unit_amount,
                    line_amount,
                    created_at,
                    updated_at
                FROM rent_invoice_items
                WHERE public_id = $1
                  AND invoice_id = $2
                LIMIT 1
                FOR UPDATE
                `,
                [
                    itemPublicId,
                    currentInvoice.id
                ]
            );

        if (itemResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                itemNotFound: true
            };
        }

        const currentItem =
            itemResult.rows[0];

        /*
         * 5. Delete the item.
         *
         * The database trigger recalculates all
         * invoice financial totals afterward.
         */
        const deletedItemResult =
            await client.query(
                `
                DELETE FROM rent_invoice_items
                WHERE id = $1
                  AND invoice_id = $2
                RETURNING
                    public_id,
                    item_type,
                    description,
                    quantity,
                    unit_amount,
                    line_amount,
                    created_at,
                    updated_at
                `,
                [
                    currentItem.id,
                    currentInvoice.id
                ]
            );

        /*
         * 6. Execute deferred integrity checks
         * before reading totals or committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        /*
         * 7. Reload synchronized invoice totals.
         */
        const updatedInvoiceResult =
            await client.query(
                `
                SELECT
                    public_id,
                    invoice_number,
                    status,
                    billing_period_start,
                    billing_period_end,
                    issue_date,
                    due_date,
                    currency_code,
                    subtotal_amount,
                    discount_amount,
                    tax_amount,
                    late_fee_amount,
                    total_amount,
                    paid_amount,
                    balance_amount,
                    notes,
                    issued_at,
                    voided_at,
                    void_reason,
                    created_at,
                    updated_at
                FROM rent_invoices
                WHERE id = $1
                LIMIT 1
                `,
                [
                    currentInvoice.id
                ]
            );

        await client.query("COMMIT");

        return {
            deletedItem:
                deletedItemResult.rows[0],

            invoice:
                updatedInvoiceResult.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
/**
 * Issue an eligible draft rent invoice.
 *
 * Administrator:
 * - Can issue any eligible draft invoice.
 *
 * Regular owner user:
 * - Must have an active owner_users relationship.
 * - Must have can_manage_finances = TRUE.
 *
 * Tenant users:
 * - Cannot issue invoices.
 */
const issueRentInvoice = async ({
    invoicePublicId,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Find and lock the target invoice.
         *
         * Eligibility booleans are calculated by
         * PostgreSQL to avoid JavaScript decimal
         * and date-conversion inconsistencies.
         */
        const invoiceResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    invoice_number,
                    owner_id,
                    status,
                    billing_period_start::text
                        AS billing_period_start,
                    billing_period_end::text
                        AS billing_period_end,
                    issue_date::text
                        AS issue_date,
                    due_date::text
                        AS due_date,
                    currency_code,
                    subtotal_amount,
                    discount_amount,
                    tax_amount,
                    late_fee_amount,
                    total_amount,
                    paid_amount,
                    balance_amount,
                    notes,
                    issued_at,
                    voided_at,
                    void_reason,
                    created_at,
                    updated_at,
                    (total_amount > 0)
                        AS has_positive_total,
                    (paid_amount = 0)
                        AS has_no_payments,
                    (balance_amount = total_amount)
                        AS balance_matches_total,
                    (due_date >= CURRENT_DATE)
                        AS due_date_allows_issue
                FROM rent_invoices
                WHERE public_id = $1
                LIMIT 1
                FOR UPDATE
                `,
                [
                    invoicePublicId
                ]
            );

        if (invoiceResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                invoiceNotFound: true
            };
        }

        const currentInvoice =
            invoiceResult.rows[0];

        /*
         * 2. Confirm authorization before
         * exposing invoice status or eligibility.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT
                        id,
                        relationship_role,
                        can_manage_finances
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        currentInvoice.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0 ||
                requesterResult.rows[0]
                    .can_manage_finances !== true
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        /*
         * 3. Only a draft invoice can be issued.
         */
        if (currentInvoice.status !== "draft") {
            await client.query("ROLLBACK");

            return {
                notDraft: true
            };
        }

        /*
         * 4. Find and lock all invoice items.
         */
        const itemsResult =
            await client.query(
                `
                SELECT
                    public_id,
                    item_type,
                    description,
                    quantity,
                    unit_amount,
                    line_amount,
                    created_at,
                    updated_at
                FROM rent_invoice_items
                WHERE invoice_id = $1
                ORDER BY created_at, id
                FOR UPDATE
                `,
                [
                    currentInvoice.id
                ]
            );

        if (itemsResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                noItems: true
            };
        }

        /*
         * 5. Confirm financial eligibility.
         */
        if (
            currentInvoice
                .has_positive_total !== true
        ) {
            await client.query("ROLLBACK");

            return {
                invalidTotal: true
            };
        }

        if (
            currentInvoice
                .has_no_payments !== true ||
            currentInvoice
                .balance_matches_total !== true
        ) {
            await client.query("ROLLBACK");

            return {
                financialConflict: true
            };
        }

        /*
         * issue_date will be CURRENT_DATE.
         * The due date cannot precede it.
         */
        if (
            currentInvoice
                .due_date_allows_issue !== true
        ) {
            await client.query("ROLLBACK");

            return {
                invalidDueDate: true
            };
        }

        /*
         * 6. Change lifecycle status and record
         * immutable issue audit information.
         */
        const issuedInvoiceResult =
            await client.query(
                `
                UPDATE rent_invoices
                SET
                    status = 'issued',
                    issue_date = CURRENT_DATE,
                    issued_at = CURRENT_TIMESTAMP,
                    issued_by = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                  AND status = 'draft'
                RETURNING
                    public_id,
                    invoice_number,
                    status,
                    billing_period_start,
                    billing_period_end,
                    issue_date,
                    due_date,
                    currency_code,
                    subtotal_amount,
                    discount_amount,
                    tax_amount,
                    late_fee_amount,
                    total_amount,
                    paid_amount,
                    balance_amount,
                    notes,
                    issued_at,
                    voided_at,
                    void_reason,
                    created_at,
                    updated_at
                `,
                [
                    authenticatedUser.id,
                    currentInvoice.id
                ]
            );

        /*
         * 7. Execute every deferred database
         * integrity check before committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        return {
            invoice: {
                ...issuedInvoiceResult.rows[0],

                items:
                    itemsResult.rows
            }
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
/**
 * Void an eligible rent invoice while preserving
 * its complete financial and lifecycle history.
 *
 * Administrator:
 * - Can void any eligible invoice.
 *
 * Regular owner user:
 * - Must have an active owner_users relationship.
 * - Must have can_manage_finances = TRUE.
 *
 * Tenant users:
 * - Cannot void invoices.
 */
const voidRentInvoice = async ({
    invoicePublicId,
    voidReason,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Find and lock the target invoice.
         */
        const invoiceResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    invoice_number,
                    owner_id,
                    status,
                    paid_amount,
                    (paid_amount = 0)
                        AS has_no_payments
                FROM rent_invoices
                WHERE public_id = $1
                LIMIT 1
                FOR UPDATE
                `,
                [
                    invoicePublicId
                ]
            );

        if (invoiceResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                invoiceNotFound: true
            };
        }

        const currentInvoice =
            invoiceResult.rows[0];

        /*
         * 2. Confirm authorization before
         * exposing lifecycle or payment state.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT
                        id,
                        relationship_role,
                        can_manage_finances
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        currentInvoice.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0 ||
                requesterResult.rows[0]
                    .can_manage_finances !== true
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        /*
         * 3. Only draft and issued invoices may
         * transition to void.
         */
        if (
            ![
                "draft",
                "issued"
            ].includes(currentInvoice.status)
        ) {
            await client.query("ROLLBACK");

            return {
                invalidStatus: true
            };
        }

        /*
         * 4. An invoice with a recorded payment
         * cannot be voided.
         */
        if (
            currentInvoice
                .has_no_payments !== true
        ) {
            await client.query("ROLLBACK");

            return {
                paymentConflict: true
            };
        }

        /*
         * 5. Defensively validate and normalize
         * the required void reason.
         */
        const normalizedVoidReason =
            typeof voidReason === "string"
                ? voidReason.trim()
                : "";

        if (
            normalizedVoidReason.length === 0 ||
            normalizedVoidReason.length > 1000
        ) {
            await client.query("ROLLBACK");

            return {
                invalidVoidReason: true
            };
        }

        /*
         * 6. Lock all invoice items to keep the
         * returned snapshot transactionally stable.
         */
        const itemsResult =
            await client.query(
                `
                SELECT
                    public_id,
                    item_type,
                    description,
                    quantity,
                    unit_amount,
                    line_amount,
                    created_at,
                    updated_at
                FROM rent_invoice_items
                WHERE invoice_id = $1
                ORDER BY created_at, id
                FOR UPDATE
                `,
                [
                    currentInvoice.id
                ]
            );

        /*
         * 7. Record the irreversible void
         * transition and immutable audit data.
         */
        const voidedInvoiceResult =
            await client.query(
                `
                UPDATE rent_invoices
                SET
                    status = 'void',
                    voided_at = CURRENT_TIMESTAMP,
                    voided_by = $1,
                    void_reason = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
                  AND status IN (
                      'draft',
                      'issued'
                  )
                  AND paid_amount = 0
                RETURNING
                    public_id,
                    invoice_number,
                    status,
                    billing_period_start,
                    billing_period_end,
                    issue_date,
                    due_date,
                    currency_code,
                    subtotal_amount,
                    discount_amount,
                    tax_amount,
                    late_fee_amount,
                    total_amount,
                    paid_amount,
                    balance_amount,
                    notes,
                    issued_at,
                    voided_at,
                    void_reason,
                    created_at,
                    updated_at
                `,
                [
                    authenticatedUser.id,
                    normalizedVoidReason,
                    currentInvoice.id
                ]
            );

        /*
         * 8. Execute deferred integrity checks
         * before committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        return {
            invoice: {
                ...voidedInvoiceResult.rows[0],

                items:
                    itemsResult.rows
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
    createDraftRentInvoice,
    getInvoices,
    getSingleInvoice,
    updateDraftRentInvoice,
    addDraftRentInvoiceItem,
    updateDraftRentInvoiceItem,
    deleteDraftRentInvoiceItem,
    issueRentInvoice,
    voidRentInvoice
};
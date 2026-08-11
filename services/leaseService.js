const {
    nanoid
} = require("nanoid");

const pool = require("../config/db");

/**
 * Create a new draft lease.
 *
 * Administrator:
 * - Can create a lease for any valid active owner.
 *
 * Regular user:
 * - Must have an active owner_users relationship.
 * - Must have can_manage_properties = TRUE.
 * - Must have can_manage_finances = TRUE.
 */
const createDraftLease = async ({
    leaseData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Find and lock the active owner.
         */
        const ownerResult = await client.query(
            `
            SELECT
                id,
                public_id,
                owner_type,
                display_name,
                status
            FROM owners
            WHERE public_id = $1
              AND status = 'active'
              AND deleted_at IS NULL
            LIMIT 1
            FOR UPDATE
            `,
            [
                leaseData.owner_public_id
            ]
        );

        if (ownerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                ownerNotFound: true
            };
        }

        const owner = ownerResult.rows[0];

        /*
         * 2. Check regular-user authorization.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT
                        id,
                        can_manage_properties,
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
                requesterResult.rows.length === 0 ||
                requesterResult.rows[0]
                    .can_manage_properties !== true ||
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
         * 3. Find and lock the active property.
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
                WHERE public_id = $1
                  AND operational_status = 'active'
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    leaseData.property_public_id
                ]
            );

        if (propertyResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                propertyNotFound: true
            };
        }

        const property =
            propertyResult.rows[0];

        /*
         * 4. Confirm that the owner currently owns
         * the selected property.
         */
        const propertyOwnerResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    ownership_type,
                    ownership_percentage,
                    effective_from,
                    effective_to
                FROM property_owners
                WHERE property_id = $1
                  AND owner_id = $2
                  AND effective_from <= $3::date
                  AND effective_to IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    property.id,
                    owner.id,
                    leaseData.start_date
                ]
            );

        if (
            propertyOwnerResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                ownershipConflict: true
            };
        }

        /*
         * 5. Find and lock the selected unit.
         *
         * Draft creation does not require available
         * status because a draft does not bind a unit.
         */
        const unitResult = await client.query(
            `
            SELECT
                id,
                public_id,
                property_id,
                unit_code,
                unit_name,
                operational_status
            FROM units
            WHERE public_id = $1
              AND deleted_at IS NULL
            LIMIT 1
            FOR UPDATE
            `,
            [
                leaseData.unit_public_id
            ]
        );

        if (unitResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                unitNotFound: true
            };
        }

        const unit = unitResult.rows[0];

        if (unit.property_id !== property.id) {
            await client.query("ROLLBACK");

            return {
                unitPropertyConflict: true
            };
        }

        /*
         * 6. Find and lock the active tenant.
         */
        const tenantResult = await client.query(
            `
            SELECT
                id,
                public_id,
                tenant_type,
                display_name,
                status
            FROM tenants
            WHERE public_id = $1
              AND status = 'active'
              AND deleted_at IS NULL
            LIMIT 1
            FOR UPDATE
            `,
            [
                leaseData.tenant_public_id
            ]
        );

        if (tenantResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                tenantNotFound: true
            };
        }

        const tenant = tenantResult.rows[0];

        /*
         * 7. Confirm the active owner–tenant
         * business relationship.
         */
        const ownerTenantResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    relationship_status,
                    is_primary_owner_relationship
                FROM owner_tenants
                WHERE owner_id = $1
                  AND tenant_id = $2
                  AND relationship_status = 'active'
                  AND ended_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    owner.id,
                    tenant.id
                ]
            );

        if (
            ownerTenantResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                tenantRelationshipConflict: true
            };
        }

        /*
         * 8. Prepare contract defaults.
         */
        const currencyCode =
            leaseData.currency_code || "TZS";

        const billingFrequency =
            leaseData.billing_frequency ||
            "monthly";

        const paymentDueDay =
            leaseData.payment_due_day ?? 1;

        const gracePeriodDays =
            leaseData.grace_period_days ?? 0;

        const securityDepositAmount =
            leaseData.security_deposit_amount ?? 0;

        const lateFeeType =
            leaseData.late_fee_type || "none";

        const lateFeeValue =
            leaseData.late_fee_value ?? 0;

        const notes =
            typeof leaseData.notes === "string" &&
            leaseData.notes.length > 0
                ? leaseData.notes
                : null;

        /*
         * 9. Service-level defensive validation.
         */
        if (
            leaseData.end_date <=
            leaseData.start_date
        ) {
            await client.query("ROLLBACK");

            return {
                invalidDateRange: true
            };
        }

        if (
            typeof leaseData.rent_amount !==
                "number" ||
            !Number.isFinite(
                leaseData.rent_amount
            ) ||
            leaseData.rent_amount <= 0
        ) {
            await client.query("ROLLBACK");

            return {
                invalidFinancialTerms: true
            };
        }

        if (
            lateFeeType === "none" &&
            lateFeeValue !== 0
        ) {
            await client.query("ROLLBACK");

            return {
                invalidFinancialTerms: true
            };
        }

        if (
            (
                lateFeeType === "fixed" ||
                lateFeeType === "percentage"
            ) &&
            lateFeeValue <= 0
        ) {
            await client.query("ROLLBACK");

            return {
                invalidFinancialTerms: true
            };
        }

        if (
            lateFeeType === "percentage" &&
            lateFeeValue > 100
        ) {
            await client.query("ROLLBACK");

            return {
                invalidFinancialTerms: true
            };
        }

        /*
         * 10. Generate public identifiers.
         *
         * Random lease numbers avoid a concurrent
         * MAX()+1 numbering race.
         */
        const leasePublicId =
            `lease_${nanoid(24)}`;

        const leaseNumber =
            `LSE-${new Date().getUTCFullYear()}-${nanoid(10).toUpperCase()}`;

        /*
         * 11. Insert the draft lease.
         */
        const leaseResult = await client.query(
            `
            INSERT INTO leases (
                public_id,
                lease_number,
                owner_id,
                property_id,
                unit_id,
                tenant_id,
                status,
                start_date,
                end_date,
                currency_code,
                rent_amount,
                billing_frequency,
                payment_due_day,
                grace_period_days,
                security_deposit_amount,
                late_fee_type,
                late_fee_value,
                notes,
                created_by
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, 'draft', $7, $8,
                $9, $10, $11, $12,
                $13, $14, $15, $16,
                $17, $18
            )
            RETURNING
                public_id,
                lease_number,
                status,
                start_date,
                end_date,
                currency_code,
                rent_amount,
                billing_frequency,
                payment_due_day,
                grace_period_days,
                security_deposit_amount,
                late_fee_type,
                late_fee_value,
                notes,
                created_at,
                updated_at
            `,
            [
                leasePublicId,
                leaseNumber,
                owner.id,
                property.id,
                unit.id,
                tenant.id,
                leaseData.start_date,
                leaseData.end_date,
                currencyCode,
                leaseData.rent_amount,
                billingFrequency,
                paymentDueDay,
                gracePeriodDays,
                securityDepositAmount,
                lateFeeType,
                lateFeeValue,
                notes,
                authenticatedUser.id
            ]
        );

        /*
         * 12. Execute deferred integrity checks
         * before committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        /*
         * Do not expose internal database IDs.
         */
        delete owner.id;
        delete property.id;
        delete unit.id;
        delete unit.property_id;
        delete tenant.id;

        return {
            forbidden: false,
            lease: leaseResult.rows[0],
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
 * Retrieve leases visible to the authenticated user.
 *
 * Administrator:
 * - Can view every lease.
 *
 * Owner-side regular user:
 * - Must have an active owner_users relationship.
 * - Must have can_manage_properties or
 *   can_manage_finances permission.
 * - Can view every lease status, including draft.
 *
 * Tenant-side regular user:
 * - Must have an active tenant_users relationship.
 * - Must have can_view_leases = TRUE.
 * - Cannot view draft leases.
 */
const getLeases = async ({
    filters,
    authenticatedUser
}) => {
    /*
     * 1. Confirm that a regular user has at least
     * one valid lease-access relationship.
     */
    if (authenticatedUser.role !== "admin") {
        const accessResult = await pool.query(
            `
            SELECT
                (
                    EXISTS (
                        SELECT 1
                        FROM owner_users AS ou
                        WHERE ou.user_id = $1
                          AND ou.revoked_at IS NULL
                          AND (
                              ou.can_manage_properties =
                                  TRUE
                              OR
                              ou.can_manage_finances =
                                  TRUE
                          )
                    )
                    OR
                    EXISTS (
                        SELECT 1
                        FROM tenant_users AS tu
                        WHERE tu.user_id = $1
                          AND tu.revoked_at IS NULL
                          AND tu.can_view_leases =
                              TRUE
                    )
                ) AS has_lease_access
            `,
            [
                authenticatedUser.id
            ]
        );

        if (
            accessResult.rows[0]
                .has_lease_access !== true
        ) {
            return {
                forbidden: true
            };
        }
    }

    /*
     * 2. Prepare pagination.
     */
    const page =
        Number.isInteger(filters.page)
            ? filters.page
            : 1;

    const limit =
        Number.isInteger(filters.limit)
            ? filters.limit
            : 20;

    const offset =
        (page - 1) * limit;

    /*
     * 3. Build parameterized authorization
     * and filter conditions.
     */
    const values = [];
    const conditions = [];

    let financialAccessSelect = `
        TRUE AS can_view_finances
    `;

    if (authenticatedUser.role !== "admin") {
        values.push(authenticatedUser.id);

        const authenticatedUserPosition =
            values.length;

        financialAccessSelect = `
            (
                EXISTS (
                    SELECT 1
                    FROM owner_users AS
                        ou_finance
                    WHERE
                        ou_finance.owner_id =
                            l.owner_id
                        AND ou_finance.user_id =
                            $${authenticatedUserPosition}
                        AND ou_finance.revoked_at
                            IS NULL
                        AND ou_finance
                            .can_manage_finances =
                                TRUE
                )
                OR
                (
                    l.status <> 'draft'
                    AND EXISTS (
                        SELECT 1
                        FROM tenant_users AS
                            tu_finance
                        WHERE
                            tu_finance.tenant_id =
                                l.tenant_id
                            AND tu_finance.user_id =
                                $${authenticatedUserPosition}
                            AND tu_finance.revoked_at
                                IS NULL
                            AND tu_finance
                                .can_view_leases =
                                    TRUE
                            AND tu_finance
                                .can_view_finances =
                                    TRUE
                    )
                )
            ) AS can_view_finances
        `;

        conditions.push(
            `
            (
                EXISTS (
                    SELECT 1
                    FROM owner_users AS ou_access
                    WHERE
                        ou_access.owner_id =
                            l.owner_id
                        AND ou_access.user_id =
                            $${authenticatedUserPosition}
                        AND ou_access.revoked_at
                            IS NULL
                        AND (
                            ou_access
                                .can_manage_properties =
                                    TRUE
                            OR
                            ou_access
                                .can_manage_finances =
                                    TRUE
                        )
                )
                OR
                (
                    l.status <> 'draft'
                    AND EXISTS (
                        SELECT 1
                        FROM tenant_users AS
                            tu_access
                        WHERE
                            tu_access.tenant_id =
                                l.tenant_id
                            AND tu_access.user_id =
                                $${authenticatedUserPosition}
                            AND tu_access.revoked_at
                                IS NULL
                            AND tu_access
                                .can_view_leases =
                                    TRUE
                    )
                )
            )
            `
        );
    }

    /*
     * Search filter.
     */
    if (filters.search) {
        values.push(
            `%${filters.search}%`
        );

        const position = values.length;

        conditions.push(
            `
            (
                l.lease_number
                    ILIKE $${position}
                OR o.display_name
                    ILIKE $${position}
                OR p.property_name
                    ILIKE $${position}
                OR p.property_code
                    ILIKE $${position}
                OR u.unit_code
                    ILIKE $${position}
                OR COALESCE(
                    u.unit_name,
                    ''
                ) ILIKE $${position}
                OR t.display_name
                    ILIKE $${position}
            )
            `
        );
    }

    /*
     * Lifecycle-status filter.
     */
    if (filters.status) {
        values.push(filters.status);

        conditions.push(
            `l.status = $${values.length}`
        );
    }

    /*
     * Public-identifier filters.
     */
    if (filters.owner_public_id) {
        values.push(
            filters.owner_public_id
        );

        conditions.push(
            `o.public_id = $${values.length}`
        );
    }

    if (filters.property_public_id) {
        values.push(
            filters.property_public_id
        );

        conditions.push(
            `p.public_id = $${values.length}`
        );
    }

    if (filters.unit_public_id) {
        values.push(
            filters.unit_public_id
        );

        conditions.push(
            `u.public_id = $${values.length}`
        );
    }

    if (filters.tenant_public_id) {
        values.push(
            filters.tenant_public_id
        );

        conditions.push(
            `t.public_id = $${values.length}`
        );
    }

    /*
     * Date-overlap filters.
     */
    if (filters.start_date_from) {
        values.push(
            filters.start_date_from
        );

        conditions.push(
            `
            l.end_date >=
                $${values.length}::date
            `
        );
    }

    if (filters.end_date_to) {
        values.push(
            filters.end_date_to
        );

        conditions.push(
            `
            l.start_date <=
                $${values.length}::date
            `
        );
    }

    const whereClause =
        conditions.length > 0
            ? `WHERE ${conditions.join(
                "\n AND "
            )}`
            : "";

    /*
     * Shared relational joins.
     */
    const joins = `
        INNER JOIN owners AS o
            ON o.id = l.owner_id

        INNER JOIN properties AS p
            ON p.id = l.property_id

        INNER JOIN units AS u
            ON u.id = l.unit_id

        INNER JOIN tenants AS t
            ON t.id = l.tenant_id
    `;

    /*
     * 4. Count authorized and filtered records.
     */
    const countResult = await pool.query(
        `
        SELECT
            COUNT(*) AS total_records
        FROM leases AS l

        ${joins}

        ${whereClause}
        `,
        values
    );

    const totalRecords =
        Number(
            countResult.rows[0]
                .total_records
        );

    const totalPages =
        totalRecords === 0
            ? 0
            : Math.ceil(
                totalRecords / limit
            );

    /*
     * 5. Retrieve the requested page.
     */
    const dataValues = [
        ...values,
        limit,
        offset
    ];

    const limitPosition =
        values.length + 1;

    const offsetPosition =
        values.length + 2;

    const leasesResult = await pool.query(
        `
        SELECT
            l.public_id,
            l.lease_number,
            l.status,
            l.start_date,
            l.end_date,
            l.currency_code,
            l.rent_amount,
            l.billing_frequency,
            l.payment_due_day,
            l.grace_period_days,
            l.security_deposit_amount,
            l.late_fee_type,
            l.late_fee_value,
            l.created_at,
            l.updated_at,

            ${financialAccessSelect},

            o.public_id
                AS owner_public_id,
            o.display_name
                AS owner_display_name,

            p.public_id
                AS property_public_id,
            p.property_code,
            p.property_name,

            u.public_id
                AS unit_public_id,
            u.unit_code,
            u.unit_name,
            u.operational_status
                AS unit_operational_status,

            t.public_id
                AS tenant_public_id,
            t.display_name
                AS tenant_display_name

        FROM leases AS l

        ${joins}

        ${whereClause}

        ORDER BY
            l.created_at DESC,
            l.id DESC

        LIMIT $${limitPosition}
        OFFSET $${offsetPosition}
        `,
        dataValues
    );

    /*
     * 6. Shape relational rows into API objects.
     */
    const leases =
        leasesResult.rows.map(row => ({
            public_id: row.public_id,
            lease_number:
                row.lease_number,
            status: row.status,
            start_date: row.start_date,
            end_date: row.end_date,

            can_view_finances:
                row.can_view_finances,

            currency_code:
                row.can_view_finances
                    ? row.currency_code
                    : null,
            rent_amount:
                row.can_view_finances
                    ? row.rent_amount
                    : null,
            billing_frequency:
                row.can_view_finances
                    ? row.billing_frequency
                    : null,
            payment_due_day:
                row.can_view_finances
                    ? row.payment_due_day
                    : null,
            grace_period_days:
                row.can_view_finances
                    ? row.grace_period_days
                    : null,
            security_deposit_amount:
                row.can_view_finances
                    ? row.security_deposit_amount
                    : null,
            late_fee_type:
                row.can_view_finances
                    ? row.late_fee_type
                    : null,
            late_fee_value:
                row.can_view_finances
                    ? row.late_fee_value
                    : null,

            owner: {
                public_id:
                    row.owner_public_id,
                display_name:
                    row.owner_display_name
            },

            property: {
                public_id:
                    row.property_public_id,
                property_code:
                    row.property_code,
                property_name:
                    row.property_name
            },

            unit: {
                public_id:
                    row.unit_public_id,
                unit_code:
                    row.unit_code,
                unit_name:
                    row.unit_name,
                operational_status:
                    row
                        .unit_operational_status
            },

            tenant: {
                public_id:
                    row.tenant_public_id,
                display_name:
                    row.tenant_display_name
            },

            created_at:
                row.created_at,
            updated_at:
                row.updated_at
        }));

    return {
        forbidden: false,
        leases,
        pagination: {
            page,
            limit,
            total_records:
                totalRecords,
            total_pages:
                totalPages,
            has_next_page:
                page < totalPages,
            has_previous_page:
                page > 1
        }
    };
};
/**
 * Retrieve one lease visible to the
 * authenticated user.
 *
 * Missing and inaccessible leases both return
 * null so that the API does not disclose the
 * existence of protected lease records.
 */
const getSingleLease = async ({
    leasePublicId,
    authenticatedUser
}) => {
    const values = [
        leasePublicId
    ];

    let accessTypeSelect = `
        'admin'::text AS access_type
    `;

    let financialAccessSelect = `
        TRUE AS can_view_finances
    `;

    let authorizationCondition = "";

    /*
     * Regular users require an active owner-side
     * or tenant-side access relationship.
     */
    if (authenticatedUser.role !== "admin") {
        values.push(
            authenticatedUser.id
        );

        const authenticatedUserPosition =
            values.length;

        const ownerAccess = `
            EXISTS (
                SELECT 1
                FROM owner_users AS
                    ou_access
                WHERE
                    ou_access.owner_id =
                        l.owner_id
                    AND ou_access.user_id =
                        $${authenticatedUserPosition}
                    AND ou_access.revoked_at
                        IS NULL
                    AND (
                        ou_access
                            .can_manage_properties =
                                TRUE
                        OR
                        ou_access
                            .can_manage_finances =
                                TRUE
                    )
            )
        `;

        const tenantAccess = `
            EXISTS (
                SELECT 1
                FROM tenant_users AS
                    tu_access
                WHERE
                    tu_access.tenant_id =
                        l.tenant_id
                    AND tu_access.user_id =
                        $${authenticatedUserPosition}
                    AND tu_access.revoked_at
                        IS NULL
                    AND tu_access
                        .can_view_leases =
                            TRUE
            )
        `;

        const ownerFinancialAccess = `
            EXISTS (
                SELECT 1
                FROM owner_users AS
                    ou_finance
                WHERE
                    ou_finance.owner_id =
                        l.owner_id
                    AND ou_finance.user_id =
                        $${authenticatedUserPosition}
                    AND ou_finance.revoked_at
                        IS NULL
                    AND ou_finance
                        .can_manage_finances =
                            TRUE
            )
        `;

        const tenantFinancialAccess = `
            EXISTS (
                SELECT 1
                FROM tenant_users AS
                    tu_finance
                WHERE
                    tu_finance.tenant_id =
                        l.tenant_id
                    AND tu_finance.user_id =
                        $${authenticatedUserPosition}
                    AND tu_finance.revoked_at
                        IS NULL
                    AND tu_finance
                        .can_view_leases =
                            TRUE
                    AND tu_finance
                        .can_view_finances =
                            TRUE
            )
        `;

        financialAccessSelect = `
            (
                ${ownerFinancialAccess}
                OR
                (
                    l.status <> 'draft'
                    AND ${tenantFinancialAccess}
                )
            ) AS can_view_finances
        `;

        /*
         * Owner access takes precedence where a
         * user has both owner and tenant access.
         */
        accessTypeSelect = `
            CASE
                WHEN ${ownerAccess}
                    THEN 'owner'
                ELSE 'tenant'
            END AS access_type
        `;

        authorizationCondition = `
            AND (
                ${ownerAccess}
                OR
                (
                    l.status <> 'draft'
                    AND ${tenantAccess}
                )
            )
        `;
    }

    const leaseResult = await pool.query(
        `
        SELECT
            l.public_id,
            l.lease_number,
            l.status,
            l.start_date,
            l.end_date,

            previous_lease.public_id
                AS renewed_from_lease_public_id,

            l.currency_code,
            l.rent_amount,
            l.billing_frequency,
            l.payment_due_day,
            l.grace_period_days,
            l.security_deposit_amount,
            l.late_fee_type,
            l.late_fee_value,

            l.signed_at,
            l.scheduled_at,
            l.activated_at,
            l.expired_at,
            l.terminated_at,
            l.termination_reason,
            l.cancelled_at,
            l.cancellation_reason,

            l.notes,
            l.created_at,
            l.updated_at,

            o.public_id
                AS owner_public_id,
            o.owner_type,
            o.display_name
                AS owner_display_name,
            o.status
                AS owner_status,

            p.public_id
                AS property_public_id,
            p.property_code,
            p.property_name,
            p.operational_status
                AS property_operational_status,

            u.public_id
                AS unit_public_id,
            u.unit_code,
            u.unit_name,
            u.unit_type,
            u.operational_status
                AS unit_operational_status,

            t.public_id
                AS tenant_public_id,
            t.tenant_type,
            t.display_name
                AS tenant_display_name,
            t.status
                AS tenant_status,

            ${accessTypeSelect},

            ${financialAccessSelect}

        FROM leases AS l

        INNER JOIN owners AS o
            ON o.id = l.owner_id

        INNER JOIN properties AS p
            ON p.id = l.property_id

        INNER JOIN units AS u
            ON u.id = l.unit_id

        INNER JOIN tenants AS t
            ON t.id = l.tenant_id

        LEFT JOIN leases AS previous_lease
            ON previous_lease.id =
                l.renewed_from_lease_id

        WHERE l.public_id = $1

        ${authorizationCondition}

        LIMIT 1
        `,
        values
    );

    if (leaseResult.rows.length === 0) {
        return null;
    }

    const row = leaseResult.rows[0];

    const canViewInternalNotes =
        row.access_type === "admin" ||
        row.access_type === "owner";

    return {
        public_id:
            row.public_id,
        lease_number:
            row.lease_number,
        status:
            row.status,
        start_date:
            row.start_date,
        end_date:
            row.end_date,
        renewed_from_lease_public_id:
            row.renewed_from_lease_public_id,

        can_view_finances:
            row.can_view_finances,

        financial_terms:
            row.can_view_finances
                ? {
                    currency_code:
                        row.currency_code,
                    rent_amount:
                        row.rent_amount,
                    billing_frequency:
                        row.billing_frequency,
                    payment_due_day:
                        row.payment_due_day,
                    grace_period_days:
                        row.grace_period_days,
                    security_deposit_amount:
                        row.security_deposit_amount,
                    late_fee_type:
                        row.late_fee_type,
                    late_fee_value:
                        row.late_fee_value
                }
                : null,

        lifecycle: {
            signed_at:
                row.signed_at,
            scheduled_at:
                row.scheduled_at,
            activated_at:
                row.activated_at,
            expired_at:
                row.expired_at,
            terminated_at:
                row.terminated_at,
            termination_reason:
                row.termination_reason,
            cancelled_at:
                row.cancelled_at,
            cancellation_reason:
                row.cancellation_reason
        },

        notes:
            canViewInternalNotes
                ? row.notes
                : null,

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
            property_code:
                row.property_code,
            property_name:
                row.property_name,
            operational_status:
                row
                    .property_operational_status
        },

        unit: {
            public_id:
                row.unit_public_id,
            unit_code:
                row.unit_code,
            unit_name:
                row.unit_name,
            unit_type:
                row.unit_type,
            operational_status:
                row
                    .unit_operational_status
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
    };
};
/**
 * Update an existing draft lease.
 */
const updateDraftLease = async ({
    leasePublicId,
    leaseData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    const hasField = field =>
        Object.prototype.hasOwnProperty.call(
            leaseData,
            field
        );

    const normalizeTimestamp = value => {
        if (value === null) {
            return null;
        }

        return new Date(value).toISOString();
    };

    try {
        await client.query("BEGIN");

        /*
         * 1. Find and lock the target lease.
         */
        const leaseResult = await client.query(
            `
            SELECT
                l.id,
                l.public_id,
                l.lease_number,
                l.owner_id,
                l.property_id,
                l.unit_id,
                l.tenant_id,
                l.status,
                l.start_date,
                l.end_date,
                l.signed_at,
                l.currency_code,
                l.rent_amount,
                l.billing_frequency,
                l.payment_due_day,
                l.grace_period_days,
                l.security_deposit_amount,
                l.late_fee_type,
                l.late_fee_value,
                l.notes,

                p.public_id
                    AS property_public_id,

                u.public_id
                    AS unit_public_id,

                t.public_id
                    AS tenant_public_id

            FROM leases AS l

            INNER JOIN properties AS p
                ON p.id = l.property_id

            INNER JOIN units AS u
                ON u.id = l.unit_id

            INNER JOIN tenants AS t
                ON t.id = l.tenant_id

            WHERE l.public_id = $1

            LIMIT 1

            FOR UPDATE OF l
            `,
            [
                leasePublicId
            ]
        );

        if (leaseResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                leaseNotFound: true
            };
        }

        const currentLease =
            leaseResult.rows[0];

        /*
         * 2. Only draft leases can be edited.
         */
        if (currentLease.status !== "draft") {
            await client.query("ROLLBACK");

            return {
                notDraft: true
            };
        }

        /*
         * 3. Lock and confirm the current owner.
         */
        const ownerResult = await client.query(
            `
            SELECT
                id,
                public_id,
                owner_type,
                display_name,
                status
            FROM owners
            WHERE id = $1
              AND status = 'active'
              AND deleted_at IS NULL
            LIMIT 1
            FOR UPDATE
            `,
            [
                currentLease.owner_id
            ]
        );

        if (ownerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                ownerNotFound: true
            };
        }

        const owner = ownerResult.rows[0];

        /*
         * 4. Check regular-user authorization.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT id
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                      AND can_manage_properties =
                          TRUE
                      AND can_manage_finances =
                          TRUE
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        owner.id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        /*
         * 5. Calculate final partial-update values.
         */
        const finalPropertyPublicId =
            hasField("property_public_id")
                ? leaseData.property_public_id
                : currentLease
                    .property_public_id;

        const finalUnitPublicId =
            hasField("unit_public_id")
                ? leaseData.unit_public_id
                : currentLease
                    .unit_public_id;

        const finalTenantPublicId =
            hasField("tenant_public_id")
                ? leaseData.tenant_public_id
                : currentLease
                    .tenant_public_id;

        const finalStartDate =
            hasField("start_date")
                ? leaseData.start_date
                : currentLease.start_date;

        const finalEndDate =
            hasField("end_date")
                ? leaseData.end_date
                : currentLease.end_date;

        const finalSignedAt =
            hasField("signed_at")
                ? leaseData.signed_at
                : currentLease.signed_at;

        const finalCurrencyCode =
            hasField("currency_code")
                ? leaseData.currency_code
                : currentLease.currency_code;

        const finalRentAmount =
            hasField("rent_amount")
                ? leaseData.rent_amount
                : Number(
                    currentLease.rent_amount
                );

        const finalBillingFrequency =
            hasField("billing_frequency")
                ? leaseData.billing_frequency
                : currentLease
                    .billing_frequency;

        const finalPaymentDueDay =
            hasField("payment_due_day")
                ? leaseData.payment_due_day
                : currentLease
                    .payment_due_day;

        const finalGracePeriodDays =
            hasField("grace_period_days")
                ? leaseData.grace_period_days
                : currentLease
                    .grace_period_days;

        const finalSecurityDepositAmount =
            hasField(
                "security_deposit_amount"
            )
                ? leaseData
                    .security_deposit_amount
                : Number(
                    currentLease
                        .security_deposit_amount
                );

        const finalLateFeeType =
            hasField("late_fee_type")
                ? leaseData.late_fee_type
                : currentLease.late_fee_type;

        const finalLateFeeValue =
            hasField("late_fee_value")
                ? leaseData.late_fee_value
                : Number(
                    currentLease.late_fee_value
                );

        const finalNotes =
            hasField("notes")
                ? leaseData.notes
                : currentLease.notes;

        /*
         * 6. Validate the final date range.
         */
        if (
            finalEndDate <= finalStartDate
        ) {
            await client.query("ROLLBACK");

            return {
                invalidDateRange: true
            };
        }

        /*
         * 7. Defensive validation of final
         * financial terms.
         */
        const validBillingFrequencies = [
            "monthly",
            "quarterly",
            "semi_annual",
            "annual"
        ];

        const validLateFeeTypes = [
            "none",
            "fixed",
            "percentage"
        ];

        if (
            typeof finalRentAmount !==
                "number" ||
            !Number.isFinite(
                finalRentAmount
            ) ||
            finalRentAmount <= 0 ||
            finalRentAmount >
                999999999999.99 ||

            !validBillingFrequencies
                .includes(
                    finalBillingFrequency
                ) ||

            !Number.isInteger(
                finalPaymentDueDay
            ) ||
            finalPaymentDueDay < 1 ||
            finalPaymentDueDay > 28 ||

            !Number.isInteger(
                finalGracePeriodDays
            ) ||
            finalGracePeriodDays < 0 ||
            finalGracePeriodDays > 30 ||

            typeof
                finalSecurityDepositAmount !==
                "number" ||
            !Number.isFinite(
                finalSecurityDepositAmount
            ) ||
            finalSecurityDepositAmount < 0 ||
            finalSecurityDepositAmount >
                999999999999.99 ||

            !validLateFeeTypes.includes(
                finalLateFeeType
            ) ||

            typeof finalLateFeeValue !==
                "number" ||
            !Number.isFinite(
                finalLateFeeValue
            ) ||
            finalLateFeeValue < 0 ||
            finalLateFeeValue >
                999999999999.99
        ) {
            await client.query("ROLLBACK");

            return {
                invalidFinancialTerms: true
            };
        }

        if (
            finalLateFeeType === "none" &&
            finalLateFeeValue !== 0
        ) {
            await client.query("ROLLBACK");

            return {
                invalidFinancialTerms: true
            };
        }

        if (
            (
                finalLateFeeType === "fixed" ||
                finalLateFeeType ===
                    "percentage"
            ) &&
            finalLateFeeValue <= 0
        ) {
            await client.query("ROLLBACK");

            return {
                invalidFinancialTerms: true
            };
        }

        if (
            finalLateFeeType ===
                "percentage" &&
            finalLateFeeValue > 100
        ) {
            await client.query("ROLLBACK");

            return {
                invalidFinancialTerms: true
            };
        }

        /*
         * 8. Find and lock the final property.
         */
        const propertyResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    property_code,
                    property_name,
                    operational_status
                FROM properties
                WHERE public_id = $1
                  AND operational_status =
                      'active'
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    finalPropertyPublicId
                ]
            );

        if (
            propertyResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                propertyNotFound: true
            };
        }

        const property =
            propertyResult.rows[0];

        /*
         * 9. Confirm current ownership against
         * the final lease start date.
         */
        const propertyOwnerResult =
            await client.query(
                `
                SELECT id
                FROM property_owners
                WHERE property_id = $1
                  AND owner_id = $2
                  AND effective_from <= $3::date
                  AND effective_to IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    property.id,
                    owner.id,
                    finalStartDate
                ]
            );

        if (
            propertyOwnerResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                ownershipConflict: true
            };
        }

        /*
         * 10. Find and lock the final unit.
         */
        const unitResult = await client.query(
            `
            SELECT
                id,
                public_id,
                property_id,
                unit_code,
                unit_name,
                operational_status
            FROM units
            WHERE public_id = $1
              AND deleted_at IS NULL
            LIMIT 1
            FOR UPDATE
            `,
            [
                finalUnitPublicId
            ]
        );

        if (unitResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                unitNotFound: true
            };
        }

        const unit = unitResult.rows[0];

        if (unit.property_id !== property.id) {
            await client.query("ROLLBACK");

            return {
                unitPropertyConflict: true
            };
        }

        /*
         * 11. Find and lock the final tenant.
         */
        const tenantResult = await client.query(
            `
            SELECT
                id,
                public_id,
                tenant_type,
                display_name,
                status
            FROM tenants
            WHERE public_id = $1
              AND status = 'active'
              AND deleted_at IS NULL
            LIMIT 1
            FOR UPDATE
            `,
            [
                finalTenantPublicId
            ]
        );

        if (
            tenantResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                tenantNotFound: true
            };
        }

        const tenant = tenantResult.rows[0];

        /*
         * 12. Confirm the owner–tenant
         * relationship.
         */
        const ownerTenantResult =
            await client.query(
                `
                SELECT id
                FROM owner_tenants
                WHERE owner_id = $1
                  AND tenant_id = $2
                  AND relationship_status =
                      'active'
                  AND ended_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    owner.id,
                    tenant.id
                ]
            );

        if (
            ownerTenantResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                tenantRelationshipConflict: true
            };
        }

        /*
         * 13. Detect a request that produces no
         * actual database change.
         */
        const propertyChanged =
            property.id !==
            currentLease.property_id;

        const unitChanged =
            unit.id !==
            currentLease.unit_id;

        const tenantChanged =
            tenant.id !==
            currentLease.tenant_id;

        const startDateChanged =
            finalStartDate !==
            currentLease.start_date;

        const endDateChanged =
            finalEndDate !==
            currentLease.end_date;

        const signedAtChanged =
            normalizeTimestamp(
                finalSignedAt
            ) !==
            normalizeTimestamp(
                currentLease.signed_at
            );

        const currencyChanged =
            finalCurrencyCode !==
            currentLease.currency_code;

        const rentChanged =
            finalRentAmount !==
            Number(
                currentLease.rent_amount
            );

        const billingChanged =
            finalBillingFrequency !==
            currentLease
                .billing_frequency;

        const paymentDueDayChanged =
            finalPaymentDueDay !==
            currentLease.payment_due_day;

        const gracePeriodChanged =
            finalGracePeriodDays !==
            currentLease.grace_period_days;

        const depositChanged =
            finalSecurityDepositAmount !==
            Number(
                currentLease
                    .security_deposit_amount
            );

        const lateFeeTypeChanged =
            finalLateFeeType !==
            currentLease.late_fee_type;

        const lateFeeValueChanged =
            finalLateFeeValue !==
            Number(
                currentLease.late_fee_value
            );

        const notesChanged =
            finalNotes !==
            currentLease.notes;

        const hasChanges = [
            propertyChanged,
            unitChanged,
            tenantChanged,
            startDateChanged,
            endDateChanged,
            signedAtChanged,
            currencyChanged,
            rentChanged,
            billingChanged,
            paymentDueDayChanged,
            gracePeriodChanged,
            depositChanged,
            lateFeeTypeChanged,
            lateFeeValueChanged,
            notesChanged
        ].some(Boolean);

        if (!hasChanges) {
            await client.query("ROLLBACK");

            return {
                noChanges: true
            };
        }

        /*
         * 14. Apply the complete final draft state.
         */
        const updatedLeaseResult =
            await client.query(
                `
                UPDATE leases
                SET
                    property_id = $1,
                    unit_id = $2,
                    tenant_id = $3,
                    start_date = $4,
                    end_date = $5,
                    signed_at = $6,
                    currency_code = $7,
                    rent_amount = $8,
                    billing_frequency = $9,
                    payment_due_day = $10,
                    grace_period_days = $11,
                    security_deposit_amount =
                        $12,
                    late_fee_type = $13,
                    late_fee_value = $14,
                    notes = $15,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $16
                RETURNING
                    public_id,
                    lease_number,
                    status,
                    start_date,
                    end_date,
                    signed_at,
                    currency_code,
                    rent_amount,
                    billing_frequency,
                    payment_due_day,
                    grace_period_days,
                    security_deposit_amount,
                    late_fee_type,
                    late_fee_value,
                    notes,
                    created_at,
                    updated_at
                `,
                [
                    property.id,
                    unit.id,
                    tenant.id,
                    finalStartDate,
                    finalEndDate,
                    finalSignedAt,
                    finalCurrencyCode,
                    finalRentAmount,
                    finalBillingFrequency,
                    finalPaymentDueDay,
                    finalGracePeriodDays,
                    finalSecurityDepositAmount,
                    finalLateFeeType,
                    finalLateFeeValue,
                    finalNotes,
                    currentLease.id
                ]
            );

        /*
         * 15. Execute deferred integrity checks
         * before committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        delete owner.id;
        delete property.id;
        delete unit.id;
        delete unit.property_id;
        delete tenant.id;

        return {
            forbidden: false,
            lease:
                updatedLeaseResult.rows[0],
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
 * Schedule an existing draft lease.
 */
const scheduleLease = async ({
    leasePublicId,
    scheduleData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    const hasSignedAt =
        Object.prototype.hasOwnProperty.call(
            scheduleData,
            "signed_at"
        );

    try {
        await client.query("BEGIN");

        /*
         * 1. Find and lock the target lease.
         */
        const leaseResult = await client.query(
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
                start_date,
                end_date,
                signed_at
            FROM leases
            WHERE public_id = $1
            LIMIT 1
            FOR UPDATE
            `,
            [
                leasePublicId
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
         * 2. Only draft leases can be scheduled.
         */
        if (lease.status !== "draft") {
            await client.query("ROLLBACK");

            return {
                notDraft: true
            };
        }

        /*
         * 3. Lock and validate the active owner.
         */
        const ownerResult = await client.query(
            `
            SELECT
                id,
                public_id,
                display_name,
                status
            FROM owners
            WHERE id = $1
              AND status = 'active'
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
                ownerNotFound: true
            };
        }

        const owner = ownerResult.rows[0];

        /*
         * 4. Check regular-user authorization.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT id
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                      AND can_manage_properties =
                          TRUE
                      AND can_manage_finances =
                          TRUE
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        owner.id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        /*
         * 5. Lock and validate the property.
         */
        const propertyResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    property_code,
                    property_name,
                    operational_status
                FROM properties
                WHERE id = $1
                  AND operational_status =
                      'active'
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
                propertyNotFound: true
            };
        }

        const property =
            propertyResult.rows[0];

        /*
         * 6. Confirm current ownership.
         */
        const propertyOwnerResult =
            await client.query(
                `
                SELECT id
                FROM property_owners
                WHERE property_id = $1
                  AND owner_id = $2
                  AND effective_from <= $3::date
                  AND effective_to IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    property.id,
                    owner.id,
                    lease.start_date
                ]
            );

        if (
            propertyOwnerResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                ownershipConflict: true
            };
        }

        /*
         * 7. Lock and validate the unit.
         */
        const unitResult = await client.query(
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
                unitNotFound: true
            };
        }

        const unit = unitResult.rows[0];

        if (unit.property_id !== property.id) {
            await client.query("ROLLBACK");

            return {
                unitPropertyConflict: true
            };
        }

        const eligibleUnitStatuses = [
            "available",
            "reserved",
            "occupied"
        ];

        if (
            !eligibleUnitStatuses.includes(
                unit.operational_status
            )
        ) {
            await client.query("ROLLBACK");

            return {
                unitNotEligible: true
            };
        }

        /*
         * 8. Lock and validate the tenant.
         */
        const tenantResult = await client.query(
            `
            SELECT
                id,
                public_id,
                display_name,
                status
            FROM tenants
            WHERE id = $1
              AND status = 'active'
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
                tenantNotFound: true
            };
        }

        const tenant = tenantResult.rows[0];

        /*
         * 9. Confirm active owner–tenant
         * relationship.
         */
        const ownerTenantResult =
            await client.query(
                `
                SELECT id
                FROM owner_tenants
                WHERE owner_id = $1
                  AND tenant_id = $2
                  AND relationship_status =
                      'active'
                  AND ended_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    owner.id,
                    tenant.id
                ]
            );

        if (
            ownerTenantResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                tenantRelationshipConflict: true
            };
        }

        /*
         * 10. Use database time for scheduling
         * validation.
         */
        const databaseTimeResult =
            await client.query(
                `
                SELECT
                    CURRENT_TIMESTAMP
                        AS current_time,
                    CURRENT_DATE
                        AS current_date
                `
            );

        const {
            current_time: currentTime,
            current_date: currentDate
        } = databaseTimeResult.rows[0];

        const finalSignedAt =
            hasSignedAt
                ? scheduleData.signed_at
                : lease.signed_at;

        if (finalSignedAt === null) {
            await client.query("ROLLBACK");

            return {
                signatureRequired: true
            };
        }

        if (
            new Date(finalSignedAt).getTime() >
            new Date(currentTime).getTime()
        ) {
            await client.query("ROLLBACK");

            return {
                futureSignature: true
            };
        }

        if (
            lease.start_date < currentDate
        ) {
            await client.query("ROLLBACK");

            return {
                pastStartDate: true
            };
        }

        /*
         * 11. Move the lease to scheduled.
         */
        const scheduledLeaseResult =
            await client.query(
                `
                UPDATE leases
                SET
                    status = 'scheduled',
                    signed_at = $1,
                    scheduled_at =
                        CURRENT_TIMESTAMP,
                    scheduled_by = $2,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING
                    public_id,
                    lease_number,
                    status,
                    start_date,
                    end_date,
                    signed_at,
                    scheduled_at,
                    created_at,
                    updated_at
                `,
                [
                    finalSignedAt,
                    authenticatedUser.id,
                    lease.id
                ]
            );

        /*
         * 12. Reserve an available unit.
         *
         * Reserved and occupied units retain
         * their existing status.
         */
        let finalUnitStatus =
            unit.operational_status;

        if (
            unit.operational_status ===
                "available"
        ) {
            const updatedUnitResult =
                await client.query(
                    `
                    UPDATE units
                    SET
                        operational_status =
                            'reserved',
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING
                        operational_status
                    `,
                    [
                        unit.id
                    ]
                );

            finalUnitStatus =
                updatedUnitResult.rows[0]
                    .operational_status;
        }

        /*
         * 13. Execute deferred relationship,
         * lifecycle and overlap checks before
         * committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");
        return {
            lease:
                scheduledLeaseResult.rows[0],

            unit: {
                public_id:
                    unit.public_id,
                unit_code:
                    unit.unit_code,
                unit_name:
                    unit.unit_name,
                operational_status:
                    finalUnitStatus
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
 * Activate an existing scheduled lease.
 */
const activateLease = async ({
    leasePublicId,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Lock lease and related records.
         */
        const leaseResult = await client.query(
            `
            SELECT
                l.id,
                l.public_id,
                l.lease_number,
                l.status,
                l.start_date,
                l.end_date,
                l.signed_at,
                l.scheduled_at,
                l.scheduled_by,

                o.id AS owner_id,
                o.status AS owner_status,
                o.deleted_at AS owner_deleted_at,

                p.id AS property_id,
                p.operational_status
                    AS property_status,
                p.deleted_at
                    AS property_deleted_at,

                u.id AS unit_id,
                u.public_id AS unit_public_id,
                u.property_id
                    AS unit_property_id,
                u.operational_status
                    AS unit_status,
                u.deleted_at AS unit_deleted_at,

                t.id AS tenant_id,
                t.status AS tenant_status,
                t.deleted_at AS tenant_deleted_at

            FROM leases AS l

            INNER JOIN owners AS o
                ON o.id = l.owner_id

            INNER JOIN properties AS p
                ON p.id = l.property_id

            INNER JOIN units AS u
                ON u.id = l.unit_id

            INNER JOIN tenants AS t
                ON t.id = l.tenant_id

            WHERE l.public_id = $1

            LIMIT 1

            FOR UPDATE OF l, o, p, u, t
            `,
            [
                leasePublicId
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
         * 2. Only scheduled leases can activate.
         */
        if (lease.status !== "scheduled") {
            await client.query("ROLLBACK");

            return {
                notScheduled: true
            };
        }

        /*
         * 3. Validate related records.
         */
        if (
            lease.owner_status !== "active" ||
            lease.owner_deleted_at !== null
        ) {
            await client.query("ROLLBACK");

            return {
                ownerNotFound: true
            };
        }

        if (
            lease.property_status !== "active" ||
            lease.property_deleted_at !== null
        ) {
            await client.query("ROLLBACK");

            return {
                propertyNotFound: true
            };
        }

        if (lease.unit_deleted_at !== null) {
            await client.query("ROLLBACK");

            return {
                unitNotFound: true
            };
        }

        if (
            lease.unit_property_id !==
            lease.property_id
        ) {
            await client.query("ROLLBACK");

            return {
                unitPropertyConflict: true
            };
        }

        if (
            lease.tenant_status !== "active" ||
            lease.tenant_deleted_at !== null
        ) {
            await client.query("ROLLBACK");

            return {
                tenantNotFound: true
            };
        }

        /*
         * 4. Confirm regular-user authorization.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT id
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                      AND can_manage_properties =
                          TRUE
                      AND can_manage_finances =
                          TRUE
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        lease.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        /*
         * 5. Confirm current property ownership.
         */
        const ownershipResult =
            await client.query(
                `
                SELECT id
                FROM property_owners
                WHERE property_id = $1
                  AND owner_id = $2
                  AND effective_from <= $3::date
                  AND effective_to IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    lease.property_id,
                    lease.owner_id,
                    lease.start_date
                ]
            );

        if (
            ownershipResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                ownershipConflict: true
            };
        }

        /*
         * 6. Confirm active owner–tenant link.
         */
        const ownerTenantResult =
            await client.query(
                `
                SELECT id
                FROM owner_tenants
                WHERE owner_id = $1
                  AND tenant_id = $2
                  AND relationship_status =
                      'active'
                  AND ended_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    lease.owner_id,
                    lease.tenant_id
                ]
            );

        if (
            ownerTenantResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                tenantRelationshipConflict: true
            };
        }

        /*
         * 7. Validate scheduling audit.
         */
        if (
            lease.signed_at === null ||
            lease.scheduled_at === null ||
            lease.scheduled_by === null
        ) {
            await client.query("ROLLBACK");

            return {
                incompleteScheduling: true
            };
        }

        /*
         * 8. Validate unit eligibility.
         */
        const eligibleUnitStatuses = [
            "available",
            "reserved",
            "occupied"
        ];

        if (
            !eligibleUnitStatuses.includes(
                lease.unit_status
            )
        ) {
            await client.query("ROLLBACK");

            return {
                unitNotEligible: true
            };
        }

        /*
         * 9. Use database date for activation.
         */
        const timeResult = await client.query(
            `
            SELECT CURRENT_DATE AS current_date
            `
        );

        const currentDate =
            timeResult.rows[0].current_date;

        if (lease.start_date > currentDate) {
            await client.query("ROLLBACK");

            return {
                startDateNotReached: true
            };
        }

        if (lease.end_date < currentDate) {
            await client.query("ROLLBACK");

            return {
                leasePeriodEnded: true
            };
        }

        /*
         * 10. Activate the lease.
         */
        const activatedLeaseResult =
            await client.query(
                `
                UPDATE leases
                SET
                    status = 'active',
                    activated_at =
                        CURRENT_TIMESTAMP,
                    activated_by = $1,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING
                    public_id,
                    lease_number,
                    status,
                    start_date,
                    end_date,
                    signed_at,
                    scheduled_at,
                    activated_at,
                    created_at,
                    updated_at
                `,
                [
                    authenticatedUser.id,
                    lease.id
                ]
            );

        /*
         * 11. Mark unit as occupied.
         */
        const unitResult = await client.query(
            `
            UPDATE units
            SET
                operational_status =
                    'occupied',
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING
                public_id,
                operational_status
            `,
            [
                lease.unit_id
            ]
        );

        /*
         * 12. Run deferred checks now.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        return {
            lease:
                activatedLeaseResult.rows[0],
            unit:
                unitResult.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
/**
 * Cancel a draft or scheduled lease.
 */
const cancelLease = async ({
    leasePublicId,
    cancellationReason,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Lock lease and unit.
         */
        const leaseResult = await client.query(
            `
            SELECT
                l.id,
                l.public_id,
                l.lease_number,
                l.owner_id,
                l.unit_id,
                l.status,

                u.public_id
                    AS unit_public_id,
                u.operational_status
                    AS unit_status

            FROM leases AS l

            INNER JOIN units AS u
                ON u.id = l.unit_id

            WHERE l.public_id = $1

            LIMIT 1

            FOR UPDATE OF l, u
            `,
            [
                leasePublicId
            ]
        );

        if (leaseResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                leaseNotFound: true
            };
        }

        const lease = leaseResult.rows[0];

        const cancellableStatuses = [
            "draft",
            "scheduled"
        ];

        if (
            !cancellableStatuses.includes(
                lease.status
            )
        ) {
            await client.query("ROLLBACK");

            return {
                notCancellable: true
            };
        }

        /*
         * 2. Confirm regular-user authorization.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT id
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                      AND can_manage_properties =
                          TRUE
                      AND can_manage_finances =
                          TRUE
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        lease.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        const originalStatus =
            lease.status;

        /*
         * 3. Cancel the lease.
         */
        const cancelledLeaseResult =
            await client.query(
                `
                UPDATE leases
                SET
                    status = 'cancelled',
                    cancelled_at =
                        CURRENT_TIMESTAMP,
                    cancelled_by = $1,
                    cancellation_reason = $2,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING
                    public_id,
                    lease_number,
                    status,
                    cancelled_at,
                    cancellation_reason,
                    created_at,
                    updated_at
                `,
                [
                    authenticatedUser.id,
                    cancellationReason,
                    lease.id
                ]
            );

        let finalUnitStatus =
            lease.unit_status;

        /*
         * 4. Safely release a reservation created
         * by a scheduled lease.
         */
        if (
            originalStatus === "scheduled" &&
            lease.unit_status === "reserved"
        ) {
            const bindingResult =
                await client.query(
                    `
                    SELECT
                        EXISTS (
                            SELECT 1
                            FROM leases
                            WHERE unit_id = $1
                              AND id <> $2
                              AND status = 'active'
                              AND start_date <=
                                  CURRENT_DATE
                              AND end_date >=
                                  CURRENT_DATE
                        ) AS has_current_active,

                        EXISTS (
                            SELECT 1
                            FROM leases
                            WHERE unit_id = $1
                              AND id <> $2
                              AND status =
                                  'scheduled'
                        ) AS has_scheduled
                    `,
                    [
                        lease.unit_id,
                        lease.id
                    ]
                );

            const binding =
                bindingResult.rows[0];

            if (
                binding.has_current_active ===
                true
            ) {
                finalUnitStatus =
                    "occupied";
            } else if (
                binding.has_scheduled === true
            ) {
                finalUnitStatus =
                    "reserved";
            } else {
                finalUnitStatus =
                    "available";
            }

            if (
                finalUnitStatus !==
                lease.unit_status
            ) {
                await client.query(
                    `
                    UPDATE units
                    SET
                        operational_status = $1,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $2
                    `,
                    [
                        finalUnitStatus,
                        lease.unit_id
                    ]
                );
            }
        }

        /*
         * 5. Execute deferred checks before
         * committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        return {
            lease:
                cancelledLeaseResult.rows[0],

            unit: {
                public_id:
                    lease.unit_public_id,
                operational_status:
                    finalUnitStatus
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
 * Terminate an active lease.
 */
const terminateLease = async ({
    leasePublicId,
    terminationReason,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Lock lease and unit.
         */
        const leaseResult = await client.query(
            `
            SELECT
                l.id,
                l.public_id,
                l.lease_number,
                l.owner_id,
                l.unit_id,
                l.status,

                u.public_id
                    AS unit_public_id,
                u.operational_status
                    AS unit_status

            FROM leases AS l

            INNER JOIN units AS u
                ON u.id = l.unit_id

            WHERE l.public_id = $1

            LIMIT 1

            FOR UPDATE OF l, u
            `,
            [
                leasePublicId
            ]
        );

        if (leaseResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                leaseNotFound: true
            };
        }

        const lease = leaseResult.rows[0];

        if (lease.status !== "active") {
            await client.query("ROLLBACK");

            return {
                notActive: true
            };
        }

        /*
         * 2. Confirm regular-user authorization.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT id
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                      AND can_manage_properties =
                          TRUE
                      AND can_manage_finances =
                          TRUE
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        lease.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        /*
         * 3. Terminate the lease.
         */
        const terminatedLeaseResult =
            await client.query(
                `
                UPDATE leases
                SET
                    status = 'terminated',
                    terminated_at =
                        CURRENT_TIMESTAMP,
                    terminated_by = $1,
                    termination_reason = $2,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING
                    public_id,
                    lease_number,
                    status,
                    terminated_at,
                    termination_reason,
                    created_at,
                    updated_at
                `,
                [
                    authenticatedUser.id,
                    terminationReason,
                    lease.id
                ]
            );

        let finalUnitStatus =
            lease.unit_status;

        /*
         * 4. Recalculate an occupied unit after
         * releasing the active lease.
         */
        if (lease.unit_status === "occupied") {
            const bindingResult =
                await client.query(
                    `
                    SELECT
                        EXISTS (
                            SELECT 1
                            FROM leases
                            WHERE unit_id = $1
                              AND id <> $2
                              AND status = 'active'
                              AND start_date <=
                                  CURRENT_DATE
                              AND end_date >=
                                  CURRENT_DATE
                        ) AS has_current_active,

                        EXISTS (
                            SELECT 1
                            FROM leases
                            WHERE unit_id = $1
                              AND id <> $2
                              AND status =
                                  'scheduled'
                        ) AS has_scheduled
                    `,
                    [
                        lease.unit_id,
                        lease.id
                    ]
                );

            const binding =
                bindingResult.rows[0];

            if (
                binding.has_current_active ===
                true
            ) {
                finalUnitStatus =
                    "occupied";
            } else if (
                binding.has_scheduled === true
            ) {
                finalUnitStatus =
                    "reserved";
            } else {
                finalUnitStatus =
                    "available";
            }

            if (
                finalUnitStatus !==
                lease.unit_status
            ) {
                await client.query(
                    `
                    UPDATE units
                    SET
                        operational_status = $1,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $2
                    `,
                    [
                        finalUnitStatus,
                        lease.unit_id
                    ]
                );
            }
        }

        /*
         * 5. Execute deferred checks.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        return {
            lease:
                terminatedLeaseResult.rows[0],

            unit: {
                public_id:
                    lease.unit_public_id,
                operational_status:
                    finalUnitStatus
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
 * Expire an active lease whose end date
 * has already passed.
 */
const expireLease = async ({
    leasePublicId,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Lock lease and unit.
         */
        const leaseResult = await client.query(
            `
            SELECT
                l.id,
                l.public_id,
                l.lease_number,
                l.owner_id,
                l.unit_id,
                l.status,
                l.end_date,

                u.public_id
                    AS unit_public_id,
                u.operational_status
                    AS unit_status

            FROM leases AS l

            INNER JOIN units AS u
                ON u.id = l.unit_id

            WHERE l.public_id = $1

            LIMIT 1

            FOR UPDATE OF l, u
            `,
            [
                leasePublicId
            ]
        );

        if (leaseResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                leaseNotFound: true
            };
        }

        const lease = leaseResult.rows[0];

        if (lease.status !== "active") {
            await client.query("ROLLBACK");

            return {
                notActive: true
            };
        }

        /*
         * 2. Confirm regular-user authorization.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT id
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                      AND can_manage_properties =
                          TRUE
                      AND can_manage_finances =
                          TRUE
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        lease.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        /*
         * 3. Use database date for expiry.
         */
        const dateResult = await client.query(
            `
            SELECT CURRENT_DATE AS current_date
            `
        );

        const currentDate =
            dateResult.rows[0].current_date;

        if (lease.end_date >= currentDate) {
            await client.query("ROLLBACK");

            return {
                endDateNotPassed: true
            };
        }

        /*
         * 4. Expire the lease.
         */
        const expiredLeaseResult =
            await client.query(
                `
                UPDATE leases
                SET
                    status = 'expired',
                    expired_at =
                        CURRENT_TIMESTAMP,
                    expired_by = $1,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING
                    public_id,
                    lease_number,
                    status,
                    start_date,
                    end_date,
                    expired_at,
                    created_at,
                    updated_at
                `,
                [
                    authenticatedUser.id,
                    lease.id
                ]
            );

        let finalUnitStatus =
            lease.unit_status;

        /*
         * 5. Recalculate occupied unit status.
         */
        if (lease.unit_status === "occupied") {
            const bindingResult =
                await client.query(
                    `
                    SELECT
                        EXISTS (
                            SELECT 1
                            FROM leases
                            WHERE unit_id = $1
                              AND id <> $2
                              AND status = 'active'
                              AND start_date <=
                                  CURRENT_DATE
                              AND end_date >=
                                  CURRENT_DATE
                        ) AS has_current_active,

                        EXISTS (
                            SELECT 1
                            FROM leases
                            WHERE unit_id = $1
                              AND id <> $2
                              AND status =
                                  'scheduled'
                        ) AS has_scheduled
                    `,
                    [
                        lease.unit_id,
                        lease.id
                    ]
                );

            const binding =
                bindingResult.rows[0];

            if (
                binding.has_current_active ===
                true
            ) {
                finalUnitStatus =
                    "occupied";
            } else if (
                binding.has_scheduled === true
            ) {
                finalUnitStatus =
                    "reserved";
            } else {
                finalUnitStatus =
                    "available";
            }

            if (
                finalUnitStatus !==
                lease.unit_status
            ) {
                await client.query(
                    `
                    UPDATE units
                    SET
                        operational_status = $1,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $2
                    `,
                    [
                        finalUnitStatus,
                        lease.unit_id
                    ]
                );
            }
        }

        /*
         * 6. Execute deferred integrity checks.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        return {
            lease:
                expiredLeaseResult.rows[0],

            unit: {
                public_id:
                    lease.unit_public_id,
                operational_status:
                    finalUnitStatus
            }
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
const renewLease = async ({
    sourceLeasePublicId,
    renewalData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Locate and lock the source lease pamoja
         * na records zake muhimu.
         */
        const sourceLeaseResult =
            await client.query(
                `
                SELECT
                    l.id,
                    l.public_id,
                    l.lease_number,
                    l.owner_id,
                    l.property_id,
                    l.unit_id,
                    l.tenant_id,
                    l.status,
                    l.start_date,
                    l.end_date,
                    l.currency_code,
                    l.rent_amount,
                    l.billing_frequency,
                    l.payment_due_day,
                    l.grace_period_days,
                    l.security_deposit_amount,
                    l.late_fee_type,
                    l.late_fee_value,

                    o.public_id AS owner_public_id,
                    o.status AS owner_status,
                    o.deleted_at AS owner_deleted_at,

                    p.public_id AS property_public_id,
                    p.operational_status
                        AS property_status,
                    p.deleted_at AS property_deleted_at,

                    u.public_id AS unit_public_id,
                    u.property_id AS unit_property_id,
                    u.deleted_at AS unit_deleted_at,

                    t.public_id AS tenant_public_id,
                    t.status AS tenant_status,
                    t.deleted_at AS tenant_deleted_at

                FROM leases AS l

                INNER JOIN owners AS o
                    ON o.id = l.owner_id

                INNER JOIN properties AS p
                    ON p.id = l.property_id

                INNER JOIN units AS u
                    ON u.id = l.unit_id

                INNER JOIN tenants AS t
                    ON t.id = l.tenant_id

                WHERE l.public_id = $1

                LIMIT 1

                FOR UPDATE OF l, o, p, u, t
                `,
                [sourceLeasePublicId]
            );

        if (sourceLeaseResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                sourceLeaseNotFound: true
            };
        }

        const sourceLease =
            sourceLeaseResult.rows[0];

        /*
         * 2. Only active or expired leases
         * can produce renewal drafts.
         */
        if (
            ![
                "active",
                "expired"
            ].includes(sourceLease.status)
        ) {
            await client.query("ROLLBACK");

            return {
                sourceNotRenewable: true
            };
        }

        /*
         * 3. Validate current related records.
         */
        if (
            sourceLease.owner_status !== "active" ||
            sourceLease.owner_deleted_at !== null
        ) {
            await client.query("ROLLBACK");

            return {
                ownerNotFound: true
            };
        }

        if (
            sourceLease.property_status !== "active" ||
            sourceLease.property_deleted_at !== null
        ) {
            await client.query("ROLLBACK");

            return {
                propertyNotFound: true
            };
        }

        if (sourceLease.unit_deleted_at !== null) {
            await client.query("ROLLBACK");

            return {
                unitNotFound: true
            };
        }

        if (
            sourceLease.unit_property_id !==
            sourceLease.property_id
        ) {
            await client.query("ROLLBACK");

            return {
                unitPropertyConflict: true
            };
        }

        if (
            sourceLease.tenant_status !== "active" ||
            sourceLease.tenant_deleted_at !== null
        ) {
            await client.query("ROLLBACK");

            return {
                tenantNotFound: true
            };
        }

        /*
         * 4. Authorization.
         *
         * Admin is allowed directly.
         * Regular user needs an active owner-user
         * relationship with both permissions.
         */
        if (authenticatedUser.role !== "admin") {
            const authorizationResult =
                await client.query(
                    `
                    SELECT
                        id
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                      AND can_manage_properties = TRUE
                      AND can_manage_finances = TRUE
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        sourceLease.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                authorizationResult.rows.length === 0
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        /*
         * 5. A source lease can have only one
         * current non-cancelled renewal.
         */
        const existingRenewalResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    status
                FROM leases
                WHERE renewed_from_lease_id = $1
                  AND status <> 'cancelled'
                LIMIT 1
                FOR UPDATE
                `,
                [sourceLease.id]
            );

        if (
            existingRenewalResult.rows.length > 0
        ) {
            await client.query("ROLLBACK");

            return {
                currentRenewalExists: true
            };
        }

        /*
         * 6. Validate renewal dates defensively.
         */
        const renewalStartDate =
            renewalData.start_date;

        const renewalEndDate =
            renewalData.end_date;

        if (
            renewalStartDate <=
            sourceLease.end_date
        ) {
            await client.query("ROLLBACK");

            return {
                invalidRenewalStart: true
            };
        }

        if (
            renewalEndDate <=
            renewalStartDate
        ) {
            await client.query("ROLLBACK");

            return {
                invalidRenewalDates: true
            };
        }

        /*
         * 7. Owner must own the property on
         * the renewal start date.
         */
        const propertyOwnershipResult =
            await client.query(
                `
                SELECT
                    id
                FROM property_owners
                WHERE property_id = $1
                  AND owner_id = $2
                  AND effective_from <= $3::date
                  AND (
                      effective_to IS NULL
                      OR effective_to >= $3::date
                  )
                LIMIT 1
                FOR UPDATE
                `,
                [
                    sourceLease.property_id,
                    sourceLease.owner_id,
                    renewalStartDate
                ]
            );

        if (
            propertyOwnershipResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                ownershipConflict: true
            };
        }

        /*
         * 8. Owner and tenant must still have
         * an active relationship.
         */
        const ownerTenantResult =
            await client.query(
                `
                SELECT
                    id
                FROM owner_tenants
                WHERE owner_id = $1
                  AND tenant_id = $2
                  AND relationship_status = 'active'
                  AND ended_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    sourceLease.owner_id,
                    sourceLease.tenant_id
                ]
            );

        if (ownerTenantResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                tenantRelationshipConflict: true
            };
        }

        /*
         * 9. Helper for distinguishing an omitted
         * field from an explicitly supplied field.
         */
        const hasField = field =>
            Object.prototype.hasOwnProperty.call(
                renewalData,
                field
            );

        /*
         * 10. Financial fields inherit their values
         * from the source lease unless overridden.
         */
        const currencyCode =
            hasField("currency_code")
                ? renewalData.currency_code
                : sourceLease.currency_code;

        const rentAmount =
            hasField("rent_amount")
                ? renewalData.rent_amount
                : sourceLease.rent_amount;

        const billingFrequency =
            hasField("billing_frequency")
                ? renewalData.billing_frequency
                : sourceLease.billing_frequency;

        const paymentDueDay =
            hasField("payment_due_day")
                ? renewalData.payment_due_day
                : sourceLease.payment_due_day;

        const gracePeriodDays =
            hasField("grace_period_days")
                ? renewalData.grace_period_days
                : sourceLease.grace_period_days;

        const securityDepositAmount =
            hasField("security_deposit_amount")
                ? renewalData
                    .security_deposit_amount
                : sourceLease
                    .security_deposit_amount;

        const lateFeeType =
            hasField("late_fee_type")
                ? renewalData.late_fee_type
                : sourceLease.late_fee_type;

        const lateFeeValue =
            hasField("late_fee_value")
                ? renewalData.late_fee_value
                : sourceLease.late_fee_value;

        /*
         * Notes are intentionally not inherited.
         */
        const notes =
            hasField("notes")
                ? renewalData.notes
                : null;

        /*
 * 11. Defensive final financial validation.
 */
const normalizedRentAmount =
    Number(rentAmount);

const normalizedPaymentDueDay =
    Number(paymentDueDay);

const normalizedGracePeriodDays =
    Number(gracePeriodDays);

const normalizedSecurityDepositAmount =
    Number(securityDepositAmount);

const normalizedLateFeeValue =
    Number(lateFeeValue);

const validBillingFrequencies = [
    "monthly",
    "quarterly",
    "semi_annual",
    "annual"
];

const validLateFeeTypes = [
    "none",
    "fixed",
    "percentage"
];

if (
    typeof currencyCode !== "string" ||
    !/^[A-Z]{3}$/.test(currencyCode) ||

    !Number.isFinite(
        normalizedRentAmount
    ) ||
    normalizedRentAmount <= 0 ||
    normalizedRentAmount >
        999999999999.99 ||

    !validBillingFrequencies.includes(
        billingFrequency
    ) ||

    !Number.isInteger(
        normalizedPaymentDueDay
    ) ||
    normalizedPaymentDueDay < 1 ||
    normalizedPaymentDueDay > 28 ||

    !Number.isInteger(
        normalizedGracePeriodDays
    ) ||
    normalizedGracePeriodDays < 0 ||
    normalizedGracePeriodDays > 30 ||

    !Number.isFinite(
        normalizedSecurityDepositAmount
    ) ||
    normalizedSecurityDepositAmount < 0 ||
    normalizedSecurityDepositAmount >
        999999999999.99 ||

    !validLateFeeTypes.includes(
        lateFeeType
    ) ||

    !Number.isFinite(
        normalizedLateFeeValue
    ) ||
    normalizedLateFeeValue < 0 ||
    normalizedLateFeeValue >
        999999999999.99
) {
    await client.query("ROLLBACK");

    return {
        invalidFinancialTerms: true,
        reason:
            "The supplied renewal financial terms are invalid."
    };
}

if (
    lateFeeType === "none" &&
    normalizedLateFeeValue !== 0
) {
    await client.query("ROLLBACK");

    return {
        invalidFinancialTerms: true,
        reason:
            "Late fee value must be zero when late fee type is none."
    };
}

if (
    (
        lateFeeType === "fixed" ||
        lateFeeType === "percentage"
    ) &&
    normalizedLateFeeValue <= 0
) {
    await client.query("ROLLBACK");

    return {
        invalidFinancialTerms: true,
        reason:
            "Late fee value must be greater than zero when a late fee is enabled."
    };
}

if (
    lateFeeType === "percentage" &&
    normalizedLateFeeValue > 100
) {
    await client.query("ROLLBACK");

    return {
        invalidFinancialTerms: true,
        reason:
            "Percentage late fee cannot exceed 100."
    };
}

        /*
         * 12. Generate independent identifiers for
         * the new renewal draft.
         */
        const renewalPublicId =
            `lease_${nanoid(24)}`;

        const renewalStartYear =
            renewalStartDate.slice(0, 4);

        const renewalLeaseNumber =
            `LSE-${renewalStartYear}-${nanoid(10).toUpperCase()}`;

        /*
         * 13. Create a completely new draft lease.
         *
         * Parties are inherited from the source
         * lease and cannot be changed by the client.
         */
        const renewalResult =
            await client.query(
                `
                INSERT INTO leases (
                    public_id,
                    lease_number,
                    owner_id,
                    property_id,
                    unit_id,
                    tenant_id,
                    renewed_from_lease_id,
                    status,
                    start_date,
                    end_date,
                    currency_code,
                    rent_amount,
                    billing_frequency,
                    payment_due_day,
                    grace_period_days,
                    security_deposit_amount,
                    late_fee_type,
                    late_fee_value,
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
                    'draft',
                    $8,
                    $9,
                    $10,
                    $11,
                    $12,
                    $13,
                    $14,
                    $15,
                    $16,
                    $17,
                    $18,
                    $19
                )
                RETURNING
                    id,
                    public_id,
                    lease_number,
                    status,
                    start_date,
                    end_date,
                    currency_code,
                    rent_amount,
                    billing_frequency,
                    payment_due_day,
                    grace_period_days,
                    security_deposit_amount,
                    late_fee_type,
                    late_fee_value,
                    notes,
                    created_at,
                    updated_at
                `,
                [
                    renewalPublicId,
                    renewalLeaseNumber,
                    sourceLease.owner_id,
                    sourceLease.property_id,
                    sourceLease.unit_id,
                    sourceLease.tenant_id,
                    sourceLease.id,
                    renewalStartDate,
                    renewalEndDate,
                    currencyCode,
                    rentAmount,
                    billingFrequency,
                    paymentDueDay,
                    gracePeriodDays,
                    securityDepositAmount,
                    lateFeeType,
                    lateFeeValue,
                    notes,
                    authenticatedUser.id
                ]
            );

        /*
         * 14. Copy the active contractual clause snapshot.
         *
         * Soft-deleted source clauses are intentionally not
         * inherited. The new copies belong independently to
         * the renewal Draft and can be edited before scheduling.
         */
        const sourceClausesResult =
            await client.query(
                `
                SELECT
                    clause_category,
                    title,
                    clause_text,
                    is_mandatory,
                    display_order
                FROM lease_clauses
                WHERE lease_id = $1
                  AND deleted_at IS NULL
                ORDER BY
                    display_order ASC,
                    id ASC
                `,
                [
                    sourceLease.id
                ]
            );

        const renewalLeaseId =
            renewalResult.rows[0].id;

        for (
            const sourceClause
            of sourceClausesResult.rows
        ) {
            await client.query(
                `
                INSERT INTO lease_clauses (
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
                `,
                [
                    `lease_clause_${nanoid(24)}`,
                    renewalLeaseId,
                    sourceClause
                        .clause_category,
                    sourceClause.title,
                    sourceClause.clause_text,
                    sourceClause
                        .is_mandatory,
                    sourceClause
                        .display_order,
                    authenticatedUser.id
                ]
            );
        }

        /*
         * Force all deferred integrity checks
         * before committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        const renewalLeaseResponse = {
            ...renewalResult.rows[0]
        };

        delete renewalLeaseResponse.id;

        return {
            source_lease: {
                public_id:
                    sourceLease.public_id,
                lease_number:
                    sourceLease.lease_number,
                status:
                    sourceLease.status,
                end_date:
                    sourceLease.end_date
            },

            renewal_lease: {
                ...renewalLeaseResponse,

                owner_public_id:
                    sourceLease.owner_public_id,

                property_public_id:
                    sourceLease.property_public_id,

                unit_public_id:
                    sourceLease.unit_public_id,

                tenant_public_id:
                    sourceLease.tenant_public_id,

                renewed_from_lease_public_id:
                    sourceLease.public_id
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
 * Get active contractual clauses for one authorized lease.
 *
 * Admin:
 * - Can read all leases.
 *
 * Owner-side user:
 * - Requires an active owner_users relationship and either
 *   property-management or financial-management capability.
 *
 * Tenant-side user:
 * - Requires can_view_leases = TRUE.
 * - Draft leases remain hidden from tenant-side users.
 */
const getLeaseClauses = async ({
    leasePublicId,
    authenticatedUser
}) => {
    const values = [
        leasePublicId
    ];

    let authorizationCondition = "";

    if (authenticatedUser.role !== "admin") {
        values.push(
            authenticatedUser.id
        );

        const userPosition =
            values.length;

        authorizationCondition = `
            AND (
                EXISTS (
                    SELECT 1
                    FROM owner_users AS ou
                    WHERE ou.owner_id = l.owner_id
                      AND ou.user_id =
                            $${userPosition}
                      AND ou.revoked_at IS NULL
                      AND (
                            ou.can_manage_properties =
                                TRUE
                            OR
                            ou.can_manage_finances =
                                TRUE
                      )
                )
                OR
                (
                    l.status <> 'draft'
                    AND EXISTS (
                        SELECT 1
                        FROM tenant_users AS tu
                        WHERE tu.tenant_id =
                                l.tenant_id
                          AND tu.user_id =
                                $${userPosition}
                          AND tu.revoked_at IS NULL
                          AND tu.can_view_leases =
                                TRUE
                    )
                )
            )
        `;
    }

    const leaseResult =
        await pool.query(
            `
            SELECT
                l.id,
                l.public_id,
                l.lease_number,
                l.status
            FROM leases AS l
            WHERE l.public_id = $1
            ${authorizationCondition}
            LIMIT 1
            `,
            values
        );

    if (
        leaseResult.rows.length === 0
    ) {
        return {
            leaseNotFound: true
        };
    }

    const lease =
        leaseResult.rows[0];

    const clausesResult =
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
            FROM lease_clauses
            WHERE lease_id = $1
              AND deleted_at IS NULL
            ORDER BY
                display_order ASC,
                id ASC
            `,
            [
                lease.id
            ]
        );

    return {
        lease: {
            public_id:
                lease.public_id,
            lease_number:
                lease.lease_number,
            status:
                lease.status
        },
        clauses:
            clausesResult.rows
    };
};

/**
 * Create a contractual clause on a Draft lease.
 */
const createLeaseClause = async ({
    leasePublicId,
    clauseData,
    authenticatedUser
}) => {
    const client =
        await pool.connect();

    try {
        await client.query("BEGIN");

        const leaseResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    lease_number,
                    owner_id,
                    status
                FROM leases
                WHERE public_id = $1
                LIMIT 1
                FOR UPDATE
                `,
                [
                    leasePublicId
                ]
            );

        if (
            leaseResult.rows.length === 0
        ) {
            await client.query(
                "ROLLBACK"
            );

            return {
                leaseNotFound: true
            };
        }

        const lease =
            leaseResult.rows[0];

        if (lease.status !== "draft") {
            await client.query(
                "ROLLBACK"
            );

            return {
                notDraft: true
            };
        }

        if (
            authenticatedUser.role !==
                "admin"
        ) {
            const authorizationResult =
                await client.query(
                    `
                    SELECT id
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                      AND can_manage_properties =
                            TRUE
                      AND can_manage_finances =
                            TRUE
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        lease.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                authorizationResult
                    .rows.length === 0
            ) {
                await client.query(
                    "ROLLBACK"
                );

                return {
                    forbidden: true
                };
            }
        }

        const clausePublicId =
            `lease_clause_${nanoid(24)}`;

        const clauseResult =
            await client.query(
                `
                INSERT INTO lease_clauses (
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
                    clauseData
                        .clause_category,
                    clauseData.title,
                    clauseData.clause_text,
                    Object.prototype
                        .hasOwnProperty.call(
                            clauseData,
                            "is_mandatory"
                        )
                        ? clauseData
                            .is_mandatory
                        : true,
                    Object.prototype
                        .hasOwnProperty.call(
                            clauseData,
                            "display_order"
                        )
                        ? clauseData
                            .display_order
                        : 1,
                    authenticatedUser.id
                ]
            );

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
                    lease.status
            },
            clause:
                clauseResult.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Update one active clause on a Draft lease.
 */
const updateLeaseClause = async ({
    leasePublicId,
    clausePublicId,
    clauseData,
    authenticatedUser
}) => {
    const client =
        await pool.connect();

    const hasField = field =>
        Object.prototype.hasOwnProperty.call(
            clauseData,
            field
        );

    try {
        await client.query("BEGIN");

        const leaseResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    lease_number,
                    owner_id,
                    status
                FROM leases
                WHERE public_id = $1
                LIMIT 1
                FOR UPDATE
                `,
                [
                    leasePublicId
                ]
            );

        if (
            leaseResult.rows.length === 0
        ) {
            await client.query(
                "ROLLBACK"
            );

            return {
                leaseNotFound: true
            };
        }

        const lease =
            leaseResult.rows[0];

        if (lease.status !== "draft") {
            await client.query(
                "ROLLBACK"
            );

            return {
                notDraft: true
            };
        }

        if (
            authenticatedUser.role !==
                "admin"
        ) {
            const authorizationResult =
                await client.query(
                    `
                    SELECT id
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                      AND can_manage_properties =
                            TRUE
                      AND can_manage_finances =
                            TRUE
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        lease.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                authorizationResult
                    .rows.length === 0
            ) {
                await client.query(
                    "ROLLBACK"
                );

                return {
                    forbidden: true
                };
            }
        }

        const clauseResult =
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
                FROM lease_clauses
                WHERE public_id = $1
                  AND lease_id = $2
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    clausePublicId,
                    lease.id
                ]
            );

        if (
            clauseResult.rows.length === 0
        ) {
            await client.query(
                "ROLLBACK"
            );

            return {
                clauseNotFound: true
            };
        }

        const currentClause =
            clauseResult.rows[0];

        const finalCategory =
            hasField("clause_category")
                ? clauseData.clause_category
                : currentClause
                    .clause_category;

        const finalTitle =
            hasField("title")
                ? clauseData.title
                : currentClause.title;

        const finalText =
            hasField("clause_text")
                ? clauseData.clause_text
                : currentClause
                    .clause_text;

        const finalMandatory =
            hasField("is_mandatory")
                ? clauseData.is_mandatory
                : currentClause
                    .is_mandatory;

        const finalDisplayOrder =
            hasField("display_order")
                ? clauseData.display_order
                : currentClause
                    .display_order;

        const updatedClauseResult =
            await client.query(
                `
                UPDATE lease_clauses
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
                    finalCategory,
                    finalTitle,
                    finalText,
                    finalMandatory,
                    finalDisplayOrder,
                    authenticatedUser.id,
                    currentClause.id
                ]
            );

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
                    lease.status
            },
            clause:
                updatedClauseResult
                    .rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Soft delete one active clause on a Draft lease.
 */
const deleteLeaseClause = async ({
    leasePublicId,
    clausePublicId,
    authenticatedUser
}) => {
    const client =
        await pool.connect();

    try {
        await client.query("BEGIN");

        const leaseResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    lease_number,
                    owner_id,
                    status
                FROM leases
                WHERE public_id = $1
                LIMIT 1
                FOR UPDATE
                `,
                [
                    leasePublicId
                ]
            );

        if (
            leaseResult.rows.length === 0
        ) {
            await client.query(
                "ROLLBACK"
            );

            return {
                leaseNotFound: true
            };
        }

        const lease =
            leaseResult.rows[0];

        if (lease.status !== "draft") {
            await client.query(
                "ROLLBACK"
            );

            return {
                notDraft: true
            };
        }

        if (
            authenticatedUser.role !==
                "admin"
        ) {
            const authorizationResult =
                await client.query(
                    `
                    SELECT id
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                      AND can_manage_properties =
                            TRUE
                      AND can_manage_finances =
                            TRUE
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        lease.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                authorizationResult
                    .rows.length === 0
            ) {
                await client.query(
                    "ROLLBACK"
                );

                return {
                    forbidden: true
                };
            }
        }

        const clauseResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id
                FROM lease_clauses
                WHERE public_id = $1
                  AND lease_id = $2
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    clausePublicId,
                    lease.id
                ]
            );

        if (
            clauseResult.rows.length === 0
        ) {
            await client.query(
                "ROLLBACK"
            );

            return {
                clauseNotFound: true
            };
        }

        const deletedClauseResult =
            await client.query(
                `
                UPDATE lease_clauses
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
                    clause_text,
                    is_mandatory,
                    display_order,
                    deleted_at
                `,
                [
                    authenticatedUser.id,
                    clauseResult.rows[0].id
                ]
            );

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
                    lease.status
            },
            clause:
                deletedClauseResult
                    .rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    createDraftLease,
    getLeases,
    getSingleLease,
    updateDraftLease,
    scheduleLease,
    activateLease,
    cancelLease,
    terminateLease,
    expireLease,
    renewLease,
    getLeaseClauses,
    createLeaseClause,
    updateLeaseClause,
    deleteLeaseClause
};

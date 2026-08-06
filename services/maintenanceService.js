const crypto = require("crypto");
const { nanoid } = require("nanoid");
const pool = require("../config/db");

/*
 * Convert PostgreSQL numeric and BIGINT values used by
 * the maintenance response into API-friendly numbers.
 */
const toNumber = value => {
    if (value === null || value === undefined) {
        return null;
    }

    return Number(value);
};

/*
 * Generate the public identifier used by the API.
 */
const generateMaintenancePublicId = () =>
    `maintenance_${nanoid(24)}`;

/*
 * Generate the human-readable maintenance number.
 * Eight uppercase hexadecimal characters satisfy the
 * MNT-YYYY-[A-Z0-9]{8} database rule.
 */
const generateMaintenanceRequestNumber = year =>
    `MNT-${year}-${crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;

/*
 * Shape a relational database row into the public API
 * representation returned after request creation.
 */
const shapeMaintenanceRequest = ({
    row,
    submissionContext
}) => ({
    public_id: row.public_id,
    request_number: row.request_number,
    request_scope: row.request_scope,
    request_source: row.request_source,
    submission_context: submissionContext,

    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    impact_level: row.impact_level,

    location_details: row.location_details,
    problem_started_at: row.problem_started_at,
    preferred_visit_at: row.preferred_visit_at,
    access_instruction: row.access_instruction,

    owner: {
        public_id: row.owner_public_id,
        owner_type: row.owner_type,
        display_name: row.owner_display_name,
        status: row.owner_status
    },

    property: {
        public_id: row.property_public_id,
        property_code: row.property_code,
        property_name: row.property_name,
        property_type: row.property_type,
        operational_status:
            row.property_operational_status
    },

    unit: row.unit_public_id
        ? {
            public_id: row.unit_public_id,
            unit_code: row.unit_code,
            unit_name: row.unit_name,
            unit_type: row.unit_type,
            operational_status:
                row.unit_operational_status
        }
        : null,

    tenant: row.tenant_public_id
        ? {
            public_id: row.tenant_public_id,
            tenant_type: row.tenant_type,
            display_name: row.tenant_display_name,
            status: row.tenant_status
        }
        : null,

    lease: row.lease_public_id
        ? {
            public_id: row.lease_public_id,
            lease_number: row.lease_number,
            status: row.lease_status,
            start_date: row.lease_start_date,
            end_date: row.lease_end_date,
            currency_code: row.lease_currency_code
        }
        : null,

    reporter: {
        public_id: row.reporter_public_id,
        full_name: row.reporter_full_name,
        email: row.reporter_email,
        role: row.reporter_role,
        reporter_type: row.reporter_type
    },

    sla: {
        target_review_at: row.target_review_at,
        target_work_start_at:
            row.target_work_start_at,
        target_resolution_at:
            row.target_resolution_at,
        review_overdue: row.review_overdue,
        work_start_overdue:
            row.work_start_overdue,
        resolution_overdue:
            row.resolution_overdue
    },

    resolution_confirmation: {
        status:
            row.resolution_confirmation_status,
        deadline_at:
            row.resolution_confirmation_deadline_at
    },

    cost_summary: {
        estimated:
            toNumber(row.total_estimated_cost),
        approved:
            toNumber(row.total_approved_cost),
        actual:
            toNumber(row.total_actual_cost),
        currency_code: row.currency_code
    },

    responsibility: {
        coverage_type: row.coverage_type,
        status: row.responsibility_status
    },

    lifecycle_audit: {
        status_changed_at:
            row.status_changed_at,
        status_change_reason:
            row.status_change_reason,
        total_resolution_hold_seconds:
            toNumber(
                row.total_resolution_hold_seconds
            )
    },

    reported_at: row.reported_at,
    created_at: row.created_at,
    updated_at: row.updated_at
});

/*
 * Resolve and lock an owner-side request context.
 */
const resolveOwnerSubmission = async ({
    client,
    requestData,
    authenticatedUser
}) => {
    const ownerValues = [
        requestData.owner_public_id
    ];

    let accessJoin = "";
    let lockTargets = "o";

    if (authenticatedUser.role !== "admin") {
        ownerValues.push(
            authenticatedUser.id
        );

        accessJoin = `
            INNER JOIN owner_users AS ou
                ON ou.owner_id = o.id
               AND ou.user_id = $2
               AND ou.revoked_at IS NULL
               AND (
                    ou.relationship_role = 'owner'
                    OR ou.is_primary = TRUE
                    OR ou.can_create_maintenance_requests = TRUE
               )
        `;

        lockTargets = "o, ou";
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
          AND o.status = 'active'
          AND o.deleted_at IS NULL
        LIMIT 1
        FOR UPDATE OF ${lockTargets}
        `,
        ownerValues
    );

    if (ownerResult.rows.length === 0) {
        return {
            ownerNotFound: true
        };
    }

    const owner = ownerResult.rows[0];

    const propertyResult = await client.query(
        `
        SELECT
            p.id,
            p.public_id,
            p.property_code,
            p.property_name,
            p.property_type,
            p.operational_status
        FROM properties AS p
        INNER JOIN property_owners AS po
            ON po.property_id = p.id
           AND po.owner_id = $2
           AND po.effective_to IS NULL
        WHERE p.public_id = $1
          AND p.deleted_at IS NULL
        LIMIT 1
        FOR UPDATE OF p, po
        `,
        [
            requestData.property_public_id,
            owner.id
        ]
    );

    if (propertyResult.rows.length === 0) {
        return {
            propertyNotFound: true
        };
    }

    const property = propertyResult.rows[0];

    let unit = null;
    let tenant = null;
    let lease = null;

    if (requestData.request_scope === "unit") {
        const unitResult = await client.query(
            `
            SELECT
                u.id,
                u.public_id,
                u.property_id,
                u.unit_code,
                u.unit_name,
                u.unit_type,
                u.operational_status
            FROM units AS u
            WHERE u.public_id = $1
              AND u.property_id = $2
              AND u.deleted_at IS NULL
            LIMIT 1
            FOR UPDATE OF u
            `,
            [
                requestData.unit_public_id,
                property.id
            ]
        );

        if (unitResult.rows.length === 0) {
            return {
                unitNotFound: true
            };
        }

        unit = unitResult.rows[0];

        if (requestData.lease_public_id) {
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
                    l.currency_code,

                    t.public_id
                        AS tenant_public_id,
                    t.tenant_type,
                    t.display_name
                        AS tenant_display_name,
                    t.status
                        AS tenant_status
                FROM leases AS l
                INNER JOIN tenants AS t
                    ON t.id = l.tenant_id
                   AND t.deleted_at IS NULL
                   AND t.status = 'active'
                INNER JOIN owner_tenants AS ot
                    ON ot.tenant_id = t.id
                   AND ot.owner_id = l.owner_id
                   AND ot.relationship_status = 'active'
                   AND ot.ended_at IS NULL
                WHERE l.public_id = $1
                  AND l.owner_id = $2
                  AND l.property_id = $3
                  AND l.unit_id = $4
                  AND l.status = 'active'
                  AND CURRENT_DATE
                        BETWEEN l.start_date
                            AND l.end_date
                LIMIT 1
                FOR UPDATE OF l, t, ot
                `,
                [
                    requestData.lease_public_id,
                    owner.id,
                    property.id,
                    unit.id
                ]
            );

            if (leaseResult.rows.length === 0) {
                return {
                    leaseNotFound: true
                };
            }

            lease = leaseResult.rows[0];

            tenant = {
                id: lease.tenant_id,
                public_id:
                    lease.tenant_public_id,
                tenant_type:
                    lease.tenant_type,
                display_name:
                    lease.tenant_display_name,
                status:
                    lease.tenant_status
            };
        }
    }

    return {
        owner,
        property,
        unit,
        tenant,
        lease,
        requestScope:
            requestData.request_scope,
        reporterType:
            authenticatedUser.role === "admin"
                ? "admin"
                : "owner_user",
        currencyCode:
            lease
                ? lease.currency_code
                : requestData.currency_code ||
                    "TZS"
    };
};

/*
 * Resolve a tenant submission entirely from the active lease.
 * Client-supplied owner, property, unit and currency references
 * are intentionally not used.
 */
const resolveTenantSubmission = async ({
    client,
    requestData,
    authenticatedUser
}) => {
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
            l.currency_code,

            o.public_id AS owner_public_id,
            o.owner_type,
            o.display_name AS owner_display_name,
            o.status AS owner_status,

            p.public_id AS property_public_id,
            p.property_code,
            p.property_name,
            p.property_type,
            p.operational_status
                AS property_operational_status,

            u.public_id AS unit_public_id,
            u.unit_code,
            u.unit_name,
            u.unit_type,
            u.operational_status
                AS unit_operational_status,

            t.public_id AS tenant_public_id,
            t.tenant_type,
            t.display_name AS tenant_display_name,
            t.status AS tenant_status
        FROM leases AS l
        INNER JOIN owners AS o
            ON o.id = l.owner_id
           AND o.status = 'active'
           AND o.deleted_at IS NULL
        INNER JOIN property_owners AS po
            ON po.property_id = l.property_id
           AND po.owner_id = l.owner_id
           AND po.effective_to IS NULL
        INNER JOIN properties AS p
            ON p.id = l.property_id
           AND p.deleted_at IS NULL
        INNER JOIN units AS u
            ON u.id = l.unit_id
           AND u.property_id = p.id
           AND u.deleted_at IS NULL
        INNER JOIN tenants AS t
            ON t.id = l.tenant_id
           AND t.status = 'active'
           AND t.deleted_at IS NULL
        INNER JOIN owner_tenants AS ot
            ON ot.tenant_id = t.id
           AND ot.owner_id = o.id
           AND ot.relationship_status = 'active'
           AND ot.ended_at IS NULL
        INNER JOIN tenant_users AS tu
            ON tu.tenant_id = t.id
           AND tu.user_id = $2
           AND tu.revoked_at IS NULL
           AND tu.can_submit_maintenance = TRUE
        WHERE l.public_id = $1
          AND l.status = 'active'
          AND CURRENT_DATE
                BETWEEN l.start_date AND l.end_date
        LIMIT 1
        FOR UPDATE OF
            l,
            o,
            po,
            p,
            u,
            t,
            ot,
            tu
        `,
        [
            requestData.lease_public_id,
            authenticatedUser.id
        ]
    );

    if (leaseResult.rows.length === 0) {
        return {
            leaseNotFound: true
        };
    }

    const row = leaseResult.rows[0];

    return {
        owner: {
            id: row.owner_id,
            public_id: row.owner_public_id,
            owner_type: row.owner_type,
            display_name:
                row.owner_display_name,
            status: row.owner_status
        },

        property: {
            id: row.property_id,
            public_id:
                row.property_public_id,
            property_code:
                row.property_code,
            property_name:
                row.property_name,
            property_type:
                row.property_type,
            operational_status:
                row.property_operational_status
        },

        unit: {
            id: row.unit_id,
            public_id: row.unit_public_id,
            property_id: row.property_id,
            unit_code: row.unit_code,
            unit_name: row.unit_name,
            unit_type: row.unit_type,
            operational_status:
                row.unit_operational_status
        },

        tenant: {
            id: row.tenant_id,
            public_id: row.tenant_public_id,
            tenant_type: row.tenant_type,
            display_name:
                row.tenant_display_name,
            status: row.tenant_status
        },

        lease: {
            id: row.id,
            public_id: row.public_id,
            lease_number: row.lease_number,
            owner_id: row.owner_id,
            property_id: row.property_id,
            unit_id: row.unit_id,
            tenant_id: row.tenant_id,
            status: row.status,
            start_date: row.start_date,
            end_date: row.end_date,
            currency_code: row.currency_code
        },

        requestScope: "unit",
        reporterType: "tenant_user",
        currencyCode: row.currency_code
    };
};

/*
 * Read the complete newly created request after database
 * triggers have populated SLA and lifecycle audit fields.
 */
const getCreatedMaintenanceRequest = async ({
    client,
    requestId,
    submissionContext
}) => {
    const result = await client.query(
        `
        SELECT
            mr.public_id,
            mr.request_number,
            mr.request_scope,
            mr.request_source,
            mr.title,
            mr.description,
            mr.category,
            mr.priority,
            mr.status,
            mr.impact_level,
            mr.location_details,
            mr.problem_started_at,
            mr.preferred_visit_at,
            mr.access_instruction,
            mr.reporter_type,
            mr.reported_at,

            mr.target_review_at,
            mr.target_work_start_at,
            mr.target_resolution_at,
            mr.review_overdue,
            mr.work_start_overdue,
            mr.resolution_overdue,

            mr.resolution_confirmation_status,
            mr.resolution_confirmation_deadline_at,
            mr.total_resolution_hold_seconds,

            mr.total_estimated_cost,
            mr.total_approved_cost,
            mr.total_actual_cost,
            mr.currency_code,
            mr.coverage_type,
            mr.responsibility_status,

            mr.status_changed_at,
            mr.status_change_reason,
            mr.created_at,
            mr.updated_at,

            o.public_id AS owner_public_id,
            o.owner_type,
            o.display_name AS owner_display_name,
            o.status AS owner_status,

            p.public_id AS property_public_id,
            p.property_code,
            p.property_name,
            p.property_type,
            p.operational_status
                AS property_operational_status,

            u.public_id AS unit_public_id,
            u.unit_code,
            u.unit_name,
            u.unit_type,
            u.operational_status
                AS unit_operational_status,

            t.public_id AS tenant_public_id,
            t.tenant_type,
            t.display_name AS tenant_display_name,
            t.status AS tenant_status,

            l.public_id AS lease_public_id,
            l.lease_number,
            l.status AS lease_status,
            l.start_date AS lease_start_date,
            l.end_date AS lease_end_date,
            l.currency_code AS lease_currency_code,

            reporter.public_id AS reporter_public_id,
            reporter.full_name AS reporter_full_name,
            reporter.email AS reporter_email,
            reporter.role AS reporter_role
        FROM maintenance_requests AS mr
        INNER JOIN owners AS o
            ON o.id = mr.owner_id
        INNER JOIN properties AS p
            ON p.id = mr.property_id
        LEFT JOIN units AS u
            ON u.id = mr.unit_id
        LEFT JOIN tenants AS t
            ON t.id = mr.tenant_id
        LEFT JOIN leases AS l
            ON l.id = mr.lease_id
        INNER JOIN users AS reporter
            ON reporter.id = mr.reported_by
        WHERE mr.id = $1
        LIMIT 1
        `,
        [requestId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return shapeMaintenanceRequest({
        row: result.rows[0],
        submissionContext
    });
};

/*
 * POST /api/maintenance/requests
 */
const createMaintenanceRequest = async ({
    requestData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const submissionContext =
            authenticatedUser.role === "admin"
                ? "owner"
                : requestData.submission_context;

        if (
            ![
                "owner",
                "tenant"
            ].includes(submissionContext)
        ) {
            await client.query("ROLLBACK");

            return {
                invalidSubmissionContext: true
            };
        }

        let context;

        if (submissionContext === "tenant") {
            context = await resolveTenantSubmission({
                client,
                requestData,
                authenticatedUser
            });
        } else {
            context = await resolveOwnerSubmission({
                client,
                requestData,
                authenticatedUser
            });
        }

        if (
            context.ownerNotFound ||
            context.propertyNotFound ||
            context.unitNotFound ||
            context.leaseNotFound
        ) {
            await client.query("ROLLBACK");
            return context;
        }

        const yearResult = await client.query(
            `
            SELECT TO_CHAR(
                CURRENT_DATE,
                'YYYY'
            ) AS request_year
            `
        );

        const requestYear =
            yearResult.rows[0].request_year;

        let insertedRequest = null;

        /*
         * Retry identifier generation without aborting the
         * transaction. ON CONFLICT covers both public ID and
         * case-insensitive request-number uniqueness.
         */
        for (
            let attempt = 0;
            attempt < 5;
            attempt += 1
        ) {
            const publicId =
                generateMaintenancePublicId();

            const requestNumber =
                generateMaintenanceRequestNumber(
                    requestYear
                );

            const insertResult = await client.query(
                `
                INSERT INTO maintenance_requests (
                    public_id,
                    request_number,
                    request_scope,
                    request_source,
                    preventive_plan_id,
                    owner_id,
                    property_id,
                    unit_id,
                    tenant_id,
                    lease_id,
                    title,
                    description,
                    category,
                    priority,
                    status,
                    impact_level,
                    location_details,
                    problem_started_at,
                    preferred_visit_at,
                    access_instruction,
                    reported_by,
                    reporter_type,
                    currency_code
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    'manual',
                    NULL,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11,
                    $12,
                    'reported',
                    $13,
                    $14,
                    $15,
                    $16,
                    $17,
                    $18,
                    $19,
                    $20
                )
                ON CONFLICT DO NOTHING
                RETURNING id
                `,
                [
                    publicId,
                    requestNumber,
                    context.requestScope,
                    context.owner.id,
                    context.property.id,
                    context.unit
                        ? context.unit.id
                        : null,
                    context.tenant
                        ? context.tenant.id
                        : null,
                    context.lease
                        ? context.lease.id
                        : null,
                    requestData.title,
                    requestData.description,
                    requestData.category,
                    requestData.priority ||
                        "medium",
                    requestData.impact_level ||
                        "no_operational_impact",
                    requestData.location_details ??
                        null,
                    requestData.problem_started_at ??
                        null,
                    requestData.preferred_visit_at ??
                        null,
                    requestData.access_instruction ??
                        null,
                    authenticatedUser.id,
                    context.reporterType,
                    context.currencyCode
                ]
            );

            if (insertResult.rows.length > 0) {
                insertedRequest =
                    insertResult.rows[0];
                break;
            }
        }

        if (!insertedRequest) {
            await client.query("ROLLBACK");

            return {
                identifierConflict: true
            };
        }

        /*
         * Run all deferred cross-table maintenance checks
         * while the transaction can still be rolled back.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        const maintenanceRequest =
            await getCreatedMaintenanceRequest({
                client,
                requestId: insertedRequest.id,
                submissionContext
            });

        if (!maintenanceRequest) {
            throw new Error(
                "Created maintenance request could not be reloaded."
            );
        }

        await client.query("COMMIT");

        return {
            maintenance_request:
                maintenanceRequest
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};


/*
 * Escape LIKE wildcard characters so a free-text search
 * remains literal while still being matched case-insensitively.
 */
const escapeLikePattern = value =>
    value.replace(
        /[\\%_]/g,
        character => `\\${character}`
    );

/*
 * Shape a maintenance list row without exposing internal
 * notes, attachment paths, costs or full audit history.
 */
const shapeMaintenanceRequestListItem = row => {
    const description =
        row.description || "";

    const descriptionPreview =
        description.length > 240
            ? `${description.slice(0, 237)}...`
            : description;

    return {
        public_id: row.public_id,
        request_number: row.request_number,

        title: row.title,
        description_preview:
            descriptionPreview,

        request_scope: row.request_scope,
        request_source: row.request_source,
        category: row.category,
        priority: row.priority,
        status: row.status,
        impact_level: row.impact_level,
        location_details: row.location_details,

        reporter: {
            type: row.reporter_type,
            public_id:
                row.reporter_public_id,
            full_name:
                row.reporter_full_name
        },

        owner: {
            public_id: row.owner_public_id,
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

        unit: row.unit_public_id
            ? {
                public_id:
                    row.unit_public_id,
                unit_code:
                    row.unit_code,
                unit_name:
                    row.unit_name
            }
            : null,

        tenant: row.tenant_public_id
            ? {
                public_id:
                    row.tenant_public_id,
                display_name:
                    row.tenant_display_name
            }
            : null,

        lease: row.lease_public_id
            ? {
                public_id:
                    row.lease_public_id,
                lease_number:
                    row.lease_number,
                status:
                    row.lease_status
            }
            : null,

        sla: {
            target_review_at:
                row.target_review_at,
            target_work_start_at:
                row.target_work_start_at,
            target_resolution_at:
                row.target_resolution_at,

            review_overdue:
                row.calculated_review_overdue,
            work_start_overdue:
                row.calculated_work_start_overdue,
            resolution_overdue:
                row.calculated_resolution_overdue
        },

        reported_at: row.reported_at,
        updated_at: row.updated_at
    };
};

/*
 * GET /api/maintenance/requests
 */
const getMaintenanceRequests = async ({
    filters = {},
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query(
            `
            BEGIN TRANSACTION
            ISOLATION LEVEL REPEATABLE READ
            READ ONLY
            `
        );

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

        const accessContext =
            authenticatedUser.role === "admin"
                ? "admin"
                : filters.access_context;

        if (
            authenticatedUser.role !== "admin" &&
            ![
                "owner",
                "tenant"
            ].includes(accessContext)
        ) {
            await client.query("ROLLBACK");

            return {
                invalidAccessContext: true
            };
        }

        const reviewOverdueExpression = `
            (
                mr.reviewed_at IS NULL
                AND mr.status NOT IN (
                    'closed',
                    'rejected',
                    'cancelled'
                )
                AND mr.target_review_at
                    IS NOT NULL
                AND mr.target_review_at
                    < CURRENT_TIMESTAMP
            )
        `;

        const workStartOverdueExpression = `
            (
                mr.work_started_at IS NULL
                AND mr.status NOT IN (
                    'closed',
                    'rejected',
                    'cancelled'
                )
                AND mr.target_work_start_at
                    IS NOT NULL
                AND mr.target_work_start_at
                    < CURRENT_TIMESTAMP
            )
        `;

        const resolutionOverdueExpression = `
            (
                mr.status NOT IN (
                    'on_hold',
                    'resolved',
                    'closed',
                    'rejected',
                    'cancelled'
                )
                AND mr.target_resolution_at
                    IS NOT NULL
                AND (
                    mr.target_resolution_at
                    + make_interval(
                        secs =>
                            mr.total_resolution_hold_seconds
                                ::DOUBLE PRECISION
                    )
                ) < CURRENT_TIMESTAMP
            )
        `;

        const anyOverdueExpression = `
            (
                ${reviewOverdueExpression}
                OR
                ${workStartOverdueExpression}
                OR
                ${resolutionOverdueExpression}
            )
        `;

        const values = [];
        const conditions = [];

        /*
         * Admin sees all matching requests. Regular users
         * are isolated through the selected access context.
         */
        if (
            authenticatedUser.role !== "admin" &&
            accessContext === "owner"
        ) {
            values.push(
                authenticatedUser.id
            );

            conditions.push(`
                EXISTS (
                    SELECT 1
                    FROM owner_users AS access_ou
                    WHERE access_ou.owner_id =
                            mr.owner_id
                      AND access_ou.user_id =
                            $${values.length}
                      AND access_ou.revoked_at
                            IS NULL
                      AND (
                            access_ou.relationship_role =
                                'owner'
                            OR access_ou.is_primary =
                                TRUE
                            OR access_ou
                                .can_view_maintenance_requests =
                                    TRUE
                      )
                )
            `);
        }

        if (
            authenticatedUser.role !== "admin" &&
            accessContext === "tenant"
        ) {
            values.push(
                authenticatedUser.id
            );

            conditions.push(`
                EXISTS (
                    SELECT 1
                    FROM tenant_users AS access_tu
                    WHERE access_tu.tenant_id =
                            mr.tenant_id
                      AND access_tu.user_id =
                            $${values.length}
                      AND access_tu.revoked_at
                            IS NULL
                      AND access_tu
                            .can_submit_maintenance =
                                TRUE
                )
            `);
        }

        const addExactFilter = ({
            value,
            sql
        }) => {
            if (
                value === undefined ||
                value === null ||
                value === ""
            ) {
                return;
            }

            values.push(value);

            conditions.push(
                `${sql} = $${values.length}`
            );
        };

        /*
         * Relational public-ID filters return an empty result
         * when inaccessible instead of disclosing existence.
         */
        addExactFilter({
            value: filters.owner_public_id,
            sql: "o.public_id"
        });

        addExactFilter({
            value: filters.property_public_id,
            sql: "p.public_id"
        });

        addExactFilter({
            value: filters.unit_public_id,
            sql: "u.public_id"
        });

        addExactFilter({
            value: filters.tenant_public_id,
            sql: "t.public_id"
        });

        addExactFilter({
            value: filters.lease_public_id,
            sql: "l.public_id"
        });

        /*
         * Request classification and lifecycle filters.
         */
        addExactFilter({
            value: filters.status,
            sql: "mr.status"
        });

        addExactFilter({
            value: filters.priority,
            sql: "mr.priority"
        });

        addExactFilter({
            value: filters.category,
            sql: "mr.category"
        });

        addExactFilter({
            value: filters.request_scope,
            sql: "mr.request_scope"
        });

        addExactFilter({
            value: filters.request_source,
            sql: "mr.request_source"
        });

        addExactFilter({
            value: filters.impact_level,
            sql: "mr.impact_level"
        });

        addExactFilter({
            value: filters.reporter_type,
            sql: "mr.reporter_type"
        });

        /*
         * Literal, case-insensitive search across request and
         * related human-readable identifiers.
         */
        if (
            typeof filters.search === "string" &&
            filters.search.length > 0
        ) {
            values.push(
                `%${escapeLikePattern(
                    filters.search
                )}%`
            );

            const searchParameter =
                `$${values.length}`;

            conditions.push(`
                (
                    mr.request_number
                        ILIKE ${searchParameter}
                            ESCAPE '\\'
                    OR mr.title
                        ILIKE ${searchParameter}
                            ESCAPE '\\'
                    OR mr.description
                        ILIKE ${searchParameter}
                            ESCAPE '\\'
                    OR COALESCE(
                        mr.location_details,
                        ''
                    ) ILIKE ${searchParameter}
                            ESCAPE '\\'
                    OR p.property_code
                        ILIKE ${searchParameter}
                            ESCAPE '\\'
                    OR p.property_name
                        ILIKE ${searchParameter}
                            ESCAPE '\\'
                    OR COALESCE(
                        u.unit_code,
                        ''
                    ) ILIKE ${searchParameter}
                            ESCAPE '\\'
                    OR COALESCE(
                        u.unit_name,
                        ''
                    ) ILIKE ${searchParameter}
                            ESCAPE '\\'
                    OR COALESCE(
                        t.display_name,
                        ''
                    ) ILIKE ${searchParameter}
                            ESCAPE '\\'
                    OR COALESCE(
                        l.lease_number,
                        ''
                    ) ILIKE ${searchParameter}
                            ESCAPE '\\'
                )
            `);
        }

        if (filters.reported_from) {
            values.push(
                filters.reported_from
            );

            conditions.push(
                `mr.reported_at >= $${values.length}::timestamptz`
            );
        }

        if (filters.reported_to) {
            values.push(
                filters.reported_to
            );

            conditions.push(
                `mr.reported_at <= $${values.length}::timestamptz`
            );
        }

        /*
         * SLA state is calculated at read time so list results
         * are accurate even before the recurring refresh job.
         */
        if (filters.sla_status === "overdue") {
            conditions.push(
                anyOverdueExpression
            );
        }

        if (filters.sla_status === "on_track") {
            conditions.push(`
                mr.status NOT IN (
                    'closed',
                    'rejected',
                    'cancelled'
                )
                AND NOT ${anyOverdueExpression}
            `);
        }

        if (
            filters.sla_status ===
                "review_overdue"
        ) {
            conditions.push(
                reviewOverdueExpression
            );
        }

        if (
            filters.sla_status ===
                "work_start_overdue"
        ) {
            conditions.push(
                workStartOverdueExpression
            );
        }

        if (
            filters.sla_status ===
                "resolution_overdue"
        ) {
            conditions.push(
                resolutionOverdueExpression
            );
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(
                    "\nAND "
                )}`
                : "";

        const fromClause = `
            FROM maintenance_requests AS mr

            INNER JOIN owners AS o
                ON o.id = mr.owner_id

            INNER JOIN properties AS p
                ON p.id = mr.property_id

            LEFT JOIN units AS u
                ON u.id = mr.unit_id

            LEFT JOIN tenants AS t
                ON t.id = mr.tenant_id

            LEFT JOIN leases AS l
                ON l.id = mr.lease_id

            LEFT JOIN users AS reporter
                ON reporter.id = mr.reported_by
        `;

        /*
         * Summary is calculated over the complete authorized,
         * filtered result set rather than the current page.
         */
        const summaryResult =
            await client.query(
                `
                SELECT
                    COUNT(*) AS total_records,

                    COUNT(*) FILTER (
                        WHERE mr.status NOT IN (
                            'closed',
                            'rejected',
                            'cancelled'
                        )
                    ) AS open_requests,

                    COUNT(*) FILTER (
                        WHERE mr.status IN (
                            'closed',
                            'rejected',
                            'cancelled'
                        )
                    ) AS terminal_requests,

                    COUNT(*) FILTER (
                        WHERE ${anyOverdueExpression}
                    ) AS overdue_requests,

                    COUNT(*) FILTER (
                        WHERE mr.priority =
                            'emergency'
                    ) AS emergency_requests

                ${fromClause}
                ${whereClause}
                `,
                values
            );

        const summaryRow =
            summaryResult.rows[0];

        const totalRecords =
            toNumber(
                summaryRow.total_records
            ) || 0;

        const sortExpressions = {
            reported_at:
                "mr.reported_at",
            updated_at:
                "mr.updated_at",
            priority: `
                CASE mr.priority
                    WHEN 'low' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'high' THEN 3
                    WHEN 'emergency' THEN 4
                    ELSE 5
                END
            `,
            target_review_at:
                "mr.target_review_at",
            target_work_start_at:
                "mr.target_work_start_at",
            target_resolution_at:
                "mr.target_resolution_at"
        };

        const sortBy =
            Object.prototype.hasOwnProperty.call(
                sortExpressions,
                filters.sort_by
            )
                ? filters.sort_by
                : "reported_at";

        const sortOrder =
            filters.sort_order === "asc"
                ? "ASC"
                : "DESC";

        const listValues = [
            ...values,
            limit,
            offset
        ];

        const limitParameter =
            `$${values.length + 1}`;

        const offsetParameter =
            `$${values.length + 2}`;

        const listResult =
            await client.query(
                `
                SELECT
                    mr.public_id,
                    mr.request_number,
                    mr.title,
                    mr.description,
                    mr.request_scope,
                    mr.request_source,
                    mr.category,
                    mr.priority,
                    mr.status,
                    mr.impact_level,
                    mr.location_details,
                    mr.reporter_type,

                    mr.target_review_at,
                    mr.target_work_start_at,
                    mr.target_resolution_at,

                    ${reviewOverdueExpression}
                        AS calculated_review_overdue,

                    ${workStartOverdueExpression}
                        AS calculated_work_start_overdue,

                    ${resolutionOverdueExpression}
                        AS calculated_resolution_overdue,

                    mr.reported_at,
                    mr.updated_at,

                    reporter.public_id
                        AS reporter_public_id,
                    reporter.full_name
                        AS reporter_full_name,

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

                    t.public_id
                        AS tenant_public_id,
                    t.display_name
                        AS tenant_display_name,

                    l.public_id
                        AS lease_public_id,
                    l.lease_number,
                    l.status
                        AS lease_status

                ${fromClause}
                ${whereClause}

                ORDER BY
                    ${sortExpressions[sortBy]}
                        ${sortOrder}
                        NULLS LAST,
                    mr.id ${sortOrder}

                LIMIT ${limitParameter}
                OFFSET ${offsetParameter}
                `,
                listValues
            );

        await client.query("COMMIT");

        return {
            invalidAccessContext: false,
            access_context:
                accessContext,
            maintenance_requests:
                listResult.rows.map(
                    shapeMaintenanceRequestListItem
                ),
            pagination: {
                page,
                limit,
                total_records:
                    totalRecords,
                total_pages:
                    totalRecords === 0
                        ? 0
                        : Math.ceil(
                            totalRecords / limit
                        )
            },
            summary: {
                open_requests:
                    toNumber(
                        summaryRow.open_requests
                    ) || 0,
                terminal_requests:
                    toNumber(
                        summaryRow.terminal_requests
                    ) || 0,
                overdue_requests:
                    toNumber(
                        summaryRow.overdue_requests
                    ) || 0,
                emergency_requests:
                    toNumber(
                        summaryRow.emergency_requests
                    ) || 0
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
 * Shape the current assignment without exposing internal
 * vendor or technician details to a tenant-side reader.
 */
const shapeCurrentMaintenanceAssignment = ({
    row,
    tenantView
}) => {
    if (!row) {
        return null;
    }

    const assignment = {
        public_id: row.public_id,
        assignment_type: row.assignment_type,
        status: row.status,
        assigned_at: row.assigned_at,
        accepted_at: row.accepted_at,
        activated_at: row.activated_at
    };

    if (
        row.assignment_type ===
            "internal_technician"
    ) {
        assignment.technician =
            row.assigned_user_public_id
                ? {
                    public_id:
                        row.assigned_user_public_id,
                    full_name:
                        row.assigned_user_full_name
                }
                : null;

        return assignment;
    }

    assignment.provider = {
        display_name:
            row.company_name ||
            row.vendor_name,
        service_description:
            row.service_description
    };

    if (!tenantView) {
        assignment.provider = {
            vendor_name:
                row.vendor_name,
            company_name:
                row.company_name,
            contact_person:
                row.contact_person,
            phone_number:
                row.phone_number,
            email:
                row.email,
            service_description:
                row.service_description
        };

        assignment.assignment_notes =
            row.assignment_notes;
    }

    return assignment;
};

/*
 * Shape the next active maintenance visit.
 */
const shapeNextMaintenanceVisit = row => {
    if (!row) {
        return null;
    }

    return {
        public_id: row.public_id,
        visit_type: row.visit_type,
        status: row.status,
        scheduled_start_at:
            row.scheduled_start_at,
        scheduled_end_at:
            row.scheduled_end_at,
        visit_purpose:
            row.visit_purpose,
        access_instruction:
            row.access_instruction,
        tenant_confirmation_status:
            row.tenant_confirmation_status,
        arrival_at:
            row.arrival_at,
        departure_at:
            row.departure_at,
        updated_at:
            row.updated_at
    };
};

/*
 * Shape the most recent resolution attempt. Financial and
 * evidence-override details remain hidden from tenant users.
 */
const shapeLatestMaintenanceResolution = ({
    row,
    tenantView
}) => {
    if (!row) {
        return null;
    }

    const resolution = {
        public_id: row.public_id,
        sequence_number:
            row.sequence_number,
        resolution_summary:
            row.resolution_summary,
        work_completed_at:
            row.work_completed_at,
        confirmation_status:
            row.confirmation_status,
        confirmation_deadline_at:
            row.confirmation_deadline_at,
        submitted_at:
            row.submitted_at,
        confirmed_at:
            row.confirmed_at,
        disputed_at:
            row.disputed_at
    };

    if (!tenantView) {
        resolution.actual_cost_summary =
            row.actual_cost_summary;

        resolution.evidence_override_reason =
            row.evidence_override_reason;

        resolution.submitted_by =
            row.submitted_by_public_id
                ? {
                    public_id:
                        row.submitted_by_public_id,
                    full_name:
                        row.submitted_by_full_name
                }
                : null;
    }

    return resolution;
};

/*
 * Shape the active unit operational-status lock.
 */
const shapeActiveMaintenanceUnitLock = ({
    row,
    tenantView
}) => {
    if (!row) {
        return null;
    }

    const lock = {
        public_id: row.public_id,
        is_active: row.is_active,
        applied_at: row.applied_at
    };

    if (!tenantView) {
        lock.restoration_status =
            row.restoration_status;

        lock.applied_by =
            row.applied_by_public_id
                ? {
                    public_id:
                        row.applied_by_public_id,
                    full_name:
                        row.applied_by_full_name
                }
                : null;
    }

    return lock;
};

/*
 * Shape the full single-request response. Internal financial
 * summaries are excluded from tenant-side responses.
 */
const shapeSingleMaintenanceRequest = ({
    row,
    accessContext,
    assignment,
    nextVisit,
    latestResolution,
    activeUnitLock,
    counts
}) => {
    const tenantView =
        accessContext === "tenant";

    const result = {
        public_id: row.public_id,
        request_number:
            row.request_number,
        request_scope:
            row.request_scope,
        request_source:
            row.request_source,

        title: row.title,
        description: row.description,
        category: row.category,
        priority: row.priority,
        status: row.status,
        impact_level:
            row.impact_level,

        location_details:
            row.location_details,
        problem_started_at:
            row.problem_started_at,
        preferred_visit_at:
            row.preferred_visit_at,
        access_instruction:
            row.access_instruction,

        reporter: {
            type: row.reporter_type,
            public_id:
                row.reporter_public_id,
            full_name:
                row.reporter_public_id
                    ? row.reporter_full_name
                    : "System"
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
            property_code:
                row.property_code,
            property_name:
                row.property_name,
            property_type:
                row.property_type,
            operational_status:
                row.property_operational_status
        },

        unit: row.unit_public_id
            ? {
                public_id:
                    row.unit_public_id,
                unit_code:
                    row.unit_code,
                unit_name:
                    row.unit_name,
                unit_type:
                    row.unit_type,
                operational_status:
                    row.unit_operational_status
            }
            : null,

        tenant: row.tenant_public_id
            ? {
                public_id:
                    row.tenant_public_id,
                tenant_type:
                    row.tenant_type,
                display_name:
                    row.tenant_display_name,
                status:
                    row.tenant_status
            }
            : null,

        lease: row.lease_public_id
            ? {
                public_id:
                    row.lease_public_id,
                lease_number:
                    row.lease_number,
                status:
                    row.lease_status,
                start_date:
                    row.lease_start_date,
                end_date:
                    row.lease_end_date,
                currency_code:
                    row.lease_currency_code
            }
            : null,

        preventive_plan:
            row.preventive_plan_public_id
                ? {
                    public_id:
                        row.preventive_plan_public_id,
                    title:
                        row.preventive_plan_title,
                    frequency:
                        row.preventive_plan_frequency,
                    interval_value:
                        row
                            .preventive_plan_interval_value,
                    next_due_at:
                        row.preventive_plan_next_due_at,
                    status:
                        row.preventive_plan_status
                }
                : null,

        sla: {
            target_review_at:
                row.target_review_at,
            target_work_start_at:
                row.target_work_start_at,
            target_resolution_at:
                row.target_resolution_at,

            reviewed_at:
                row.reviewed_at,
            work_started_at:
                row.work_started_at,

            review_overdue:
                row.calculated_review_overdue,
            work_start_overdue:
                row.calculated_work_start_overdue,
            resolution_overdue:
                row.calculated_resolution_overdue,

            total_resolution_hold_seconds:
                toNumber(
                    row
                        .total_resolution_hold_seconds
                ),
            resolution_clock_paused_at:
                row.resolution_clock_paused_at
        },

        resolution_confirmation: {
            status:
                row
                    .resolution_confirmation_status,
            deadline_at:
                row
                    .resolution_confirmation_deadline_at
        },

        current_assignment:
            shapeCurrentMaintenanceAssignment({
                row: assignment,
                tenantView
            }),

        next_visit:
            shapeNextMaintenanceVisit(
                nextVisit
            ),

        latest_resolution:
            shapeLatestMaintenanceResolution({
                row: latestResolution,
                tenantView
            }),

        active_unit_status_lock:
            shapeActiveMaintenanceUnitLock({
                row: activeUnitLock,
                tenantView
            }),

        related_counts: {
            assignments:
                toNumber(
                    counts.assignments
                ) || 0,
            visits:
                toNumber(
                    counts.visits
                ) || 0,
            visible_comments:
                toNumber(
                    counts.visible_comments
                ) || 0,
            visible_attachments:
                toNumber(
                    counts.visible_attachments
                ) || 0,
            status_history_entries:
                toNumber(
                    counts.status_history_entries
                ) || 0
        },

        reported_at:
            row.reported_at,
        created_at:
            row.created_at,
        updated_at:
            row.updated_at
    };

    if (!tenantView) {
        result.responsibility = {
            coverage_type:
                row.coverage_type,
            status:
                row.responsibility_status
        };

        result.cost_summary = {
            estimated:
                toNumber(
                    row.total_estimated_cost
                ),
            approved:
                toNumber(
                    row.total_approved_cost
                ),
            actual:
                toNumber(
                    row.total_actual_cost
                ),
            currency_code:
                row.currency_code
        };
    }

    return result;
};

/*
 * GET /api/maintenance/requests/:maintenance_request_public_id
 */
const getSingleMaintenanceRequest = async ({
    maintenanceRequestPublicId,
    filters = {},
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query(
            `
            BEGIN TRANSACTION
            ISOLATION LEVEL REPEATABLE READ
            READ ONLY
            `
        );

        const accessContext =
            authenticatedUser.role === "admin"
                ? "admin"
                : filters.access_context;

        if (
            authenticatedUser.role !== "admin" &&
            ![
                "owner",
                "tenant"
            ].includes(accessContext)
        ) {
            await client.query("ROLLBACK");

            return {
                invalidAccessContext: true,
                requestNotFound: false
            };
        }

        const values = [
            maintenanceRequestPublicId
        ];

        const accessConditions = [
            "mr.public_id = $1"
        ];

        /*
         * Owner-side access is restricted to a current
         * owner_users relationship with maintenance-view
         * authority.
         */
        if (
            authenticatedUser.role !== "admin" &&
            accessContext === "owner"
        ) {
            values.push(
                authenticatedUser.id
            );

            accessConditions.push(`
                EXISTS (
                    SELECT 1
                    FROM owner_users AS access_ou
                    WHERE access_ou.owner_id =
                            mr.owner_id
                      AND access_ou.user_id =
                            $${values.length}
                      AND access_ou.revoked_at
                            IS NULL
                      AND (
                            access_ou.relationship_role =
                                'owner'
                            OR access_ou.is_primary =
                                TRUE
                            OR access_ou
                                .can_view_maintenance_requests =
                                    TRUE
                      )
                )
            `);
        }

        /*
         * Tenant-side access is restricted to requests that
         * directly belong to the tenant relationship.
         */
        if (
            authenticatedUser.role !== "admin" &&
            accessContext === "tenant"
        ) {
            values.push(
                authenticatedUser.id
            );

            accessConditions.push(`
                EXISTS (
                    SELECT 1
                    FROM tenant_users AS access_tu
                    WHERE access_tu.tenant_id =
                            mr.tenant_id
                      AND access_tu.user_id =
                            $${values.length}
                      AND access_tu.revoked_at
                            IS NULL
                      AND access_tu
                            .can_submit_maintenance =
                                TRUE
                )
            `);
        }

        const reviewOverdueExpression = `
            (
                mr.reviewed_at IS NULL
                AND mr.status NOT IN (
                    'closed',
                    'rejected',
                    'cancelled'
                )
                AND mr.target_review_at
                    IS NOT NULL
                AND mr.target_review_at
                    < CURRENT_TIMESTAMP
            )
        `;

        const workStartOverdueExpression = `
            (
                mr.work_started_at IS NULL
                AND mr.status NOT IN (
                    'closed',
                    'rejected',
                    'cancelled'
                )
                AND mr.target_work_start_at
                    IS NOT NULL
                AND mr.target_work_start_at
                    < CURRENT_TIMESTAMP
            )
        `;

        const resolutionOverdueExpression = `
            (
                mr.status NOT IN (
                    'on_hold',
                    'resolved',
                    'closed',
                    'rejected',
                    'cancelled'
                )
                AND mr.target_resolution_at
                    IS NOT NULL
                AND (
                    mr.target_resolution_at
                    + make_interval(
                        secs =>
                            mr
                                .total_resolution_hold_seconds
                                ::DOUBLE PRECISION
                    )
                ) < CURRENT_TIMESTAMP
            )
        `;

        const requestResult =
            await client.query(
                `
                SELECT
                    mr.id
                        AS internal_request_id,
                    mr.owner_id
                        AS internal_owner_id,

                    mr.public_id,
                    mr.request_number,
                    mr.request_scope,
                    mr.request_source,

                    mr.title,
                    mr.description,
                    mr.category,
                    mr.priority,
                    mr.status,
                    mr.impact_level,

                    mr.location_details,
                    mr.problem_started_at,
                    mr.preferred_visit_at,
                    mr.access_instruction,

                    mr.reporter_type,
                    mr.reported_at,

                    mr.target_review_at,
                    mr.target_work_start_at,
                    mr.target_resolution_at,
                    mr.reviewed_at,
                    mr.work_started_at,
                    mr.resolution_clock_paused_at,
                    mr.total_resolution_hold_seconds,

                    ${reviewOverdueExpression}
                        AS calculated_review_overdue,

                    ${workStartOverdueExpression}
                        AS calculated_work_start_overdue,

                    ${resolutionOverdueExpression}
                        AS calculated_resolution_overdue,

                    mr.resolution_confirmation_status,
                    mr.resolution_confirmation_deadline_at,

                    mr.total_estimated_cost,
                    mr.total_approved_cost,
                    mr.total_actual_cost,
                    mr.currency_code,

                    mr.coverage_type,
                    mr.responsibility_status,

                    mr.created_at,
                    mr.updated_at,

                    reporter.public_id
                        AS reporter_public_id,
                    reporter.full_name
                        AS reporter_full_name,

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
                    p.property_type,
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

                    l.public_id
                        AS lease_public_id,
                    l.lease_number,
                    l.status
                        AS lease_status,
                    l.start_date
                        AS lease_start_date,
                    l.end_date
                        AS lease_end_date,
                    l.currency_code
                        AS lease_currency_code,

                    pmp.public_id
                        AS preventive_plan_public_id,
                    pmp.title
                        AS preventive_plan_title,
                    pmp.frequency
                        AS preventive_plan_frequency,
                    pmp.interval_value
                        AS preventive_plan_interval_value,
                    pmp.next_due_at
                        AS preventive_plan_next_due_at,
                    pmp.status
                        AS preventive_plan_status

                FROM maintenance_requests AS mr

                INNER JOIN owners AS o
                    ON o.id = mr.owner_id

                INNER JOIN properties AS p
                    ON p.id = mr.property_id

                LEFT JOIN units AS u
                    ON u.id = mr.unit_id

                LEFT JOIN tenants AS t
                    ON t.id = mr.tenant_id

                LEFT JOIN leases AS l
                    ON l.id = mr.lease_id

                LEFT JOIN users AS reporter
                    ON reporter.id = mr.reported_by

                LEFT JOIN preventive_maintenance_plans
                    AS pmp
                    ON pmp.id =
                        mr.preventive_plan_id

                WHERE
                    ${accessConditions.join(
                        "\nAND "
                    )}

                LIMIT 1
                `,
                values
            );

        /*
         * Missing and inaccessible requests deliberately share
         * the same result to prevent identifier disclosure.
         */
        if (requestResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                invalidAccessContext: false,
                requestNotFound: true
            };
        }

        const requestRow =
            requestResult.rows[0];

        let canViewInternalNotes =
            accessContext === "admin";

        if (accessContext === "owner") {
            const permissionResult =
                await client.query(
                    `
                    SELECT
                        COALESCE(
                            BOOL_OR(
                                ou
                                    .can_view_internal_maintenance_notes
                                OR ou.relationship_role =
                                    'owner'
                                OR ou.is_primary =
                                    TRUE
                            ),
                            FALSE
                        ) AS can_view_internal_notes
                    FROM owner_users AS ou
                    WHERE ou.owner_id = $1
                      AND ou.user_id = $2
                      AND ou.revoked_at IS NULL
                    `,
                    [
                        requestRow.internal_owner_id,
                        authenticatedUser.id
                    ]
                );

            canViewInternalNotes =
                permissionResult.rows[0]
                    .can_view_internal_notes;
        }

        const assignmentResult =
            await client.query(
                `
                SELECT
                    ma.public_id,
                    ma.assignment_type,
                    ma.status,

                    ma.vendor_name,
                    ma.company_name,
                    ma.contact_person,
                    ma.phone_number,
                    ma.email,
                    ma.service_description,
                    ma.assignment_notes,

                    ma.assigned_at,
                    ma.accepted_at,
                    ma.activated_at,

                    assigned_user.public_id
                        AS assigned_user_public_id,
                    assigned_user.full_name
                        AS assigned_user_full_name

                FROM maintenance_assignments AS ma

                LEFT JOIN users AS assigned_user
                    ON assigned_user.id =
                        ma.assigned_user_id

                WHERE ma.maintenance_request_id =
                        $1
                  AND ma.status IN (
                        'pending',
                        'accepted',
                        'active'
                  )

                ORDER BY
                    CASE ma.status
                        WHEN 'active' THEN 1
                        WHEN 'accepted' THEN 2
                        WHEN 'pending' THEN 3
                        ELSE 4
                    END,
                    ma.assigned_at DESC,
                    ma.id DESC

                LIMIT 1
                `,
                [
                    requestRow.internal_request_id
                ]
            );

        const visitResult =
            await client.query(
                `
                SELECT
                    mv.public_id,
                    mv.visit_type,
                    mv.status,
                    mv.scheduled_start_at,
                    mv.scheduled_end_at,
                    mv.visit_purpose,
                    mv.access_instruction,
                    mv.tenant_confirmation_status,
                    mv.arrival_at,
                    mv.departure_at,
                    mv.updated_at

                FROM maintenance_visits AS mv

                WHERE mv.maintenance_request_id =
                        $1
                  AND mv.status IN (
                        'scheduled',
                        'confirmed',
                        'rescheduled',
                        'in_progress'
                  )

                ORDER BY
                    CASE
                        WHEN mv.status =
                            'in_progress'
                            THEN 0
                        ELSE 1
                    END,
                    mv.scheduled_start_at ASC,
                    mv.id ASC

                LIMIT 1
                `,
                [
                    requestRow.internal_request_id
                ]
            );

        const resolutionResult =
            await client.query(
                `
                SELECT
                    mres.public_id,
                    mres.sequence_number,
                    mres.resolution_summary,
                    mres.work_completed_at,
                    mres.actual_cost_summary,
                    mres.evidence_override_reason,
                    mres.confirmation_status,
                    mres.confirmation_deadline_at,
                    mres.submitted_at,
                    mres.confirmed_at,
                    mres.disputed_at,

                    submitted_by.public_id
                        AS submitted_by_public_id,
                    submitted_by.full_name
                        AS submitted_by_full_name

                FROM maintenance_resolutions AS mres

                INNER JOIN users AS submitted_by
                    ON submitted_by.id =
                        mres.submitted_by

                WHERE mres.maintenance_request_id =
                        $1

                ORDER BY
                    mres.sequence_number DESC,
                    mres.id DESC

                LIMIT 1
                `,
                [
                    requestRow.internal_request_id
                ]
            );

        const unitLockResult =
            await client.query(
                `
                SELECT
                    musl.public_id,
                    musl.restoration_status,
                    musl.is_active,
                    musl.applied_at,

                    applied_by.public_id
                        AS applied_by_public_id,
                    applied_by.full_name
                        AS applied_by_full_name

                FROM maintenance_unit_status_locks
                    AS musl

                INNER JOIN users AS applied_by
                    ON applied_by.id =
                        musl.applied_by

                WHERE musl.maintenance_request_id =
                        $1
                  AND musl.is_active = TRUE

                ORDER BY
                    musl.applied_at DESC,
                    musl.id DESC

                LIMIT 1
                `,
                [
                    requestRow.internal_request_id
                ]
            );

        const commentVisibilityCondition =
            accessContext === "admin" ||
            (
                accessContext === "owner" &&
                canViewInternalNotes
            )
                ? "TRUE"
                : `
                    mc.visibility IN (
                        'tenant_visible',
                        'shared'
                    )
                `;

        const attachmentVisibilityCondition =
            accessContext === "tenant"
                ? `
                    matt.visibility IN (
                        'tenant_visible',
                        'shared'
                    )
                `
                : "TRUE";

        const countsResult =
            await client.query(
                `
                SELECT
                    (
                        SELECT COUNT(*)
                        FROM maintenance_assignments
                            AS count_ma
                        WHERE count_ma
                            .maintenance_request_id =
                                $1
                    ) AS assignments,

                    (
                        SELECT COUNT(*)
                        FROM maintenance_visits
                            AS count_mv
                        WHERE count_mv
                            .maintenance_request_id =
                                $1
                    ) AS visits,

                    (
                        SELECT COUNT(*)
                        FROM maintenance_comments AS mc
                        WHERE mc
                            .maintenance_request_id =
                                $1
                          AND mc.hidden_at IS NULL
                          AND (
                                ${commentVisibilityCondition}
                          )
                    ) AS visible_comments,

                    (
                        SELECT COUNT(*)
                        FROM maintenance_attachments
                            AS matt
                        WHERE matt
                            .maintenance_request_id =
                                $1
                          AND matt.revoked_at IS NULL
                          AND (
                                ${attachmentVisibilityCondition}
                          )
                    ) AS visible_attachments,

                    (
                        SELECT COUNT(*)
                        FROM maintenance_status_history
                            AS msh
                        WHERE msh
                            .maintenance_request_id =
                                $1
                    ) AS status_history_entries
                `,
                [
                    requestRow.internal_request_id
                ]
            );

        await client.query("COMMIT");

        return {
            invalidAccessContext: false,
            requestNotFound: false,
            access_context:
                accessContext,
            maintenance_request:
                shapeSingleMaintenanceRequest({
                    row: requestRow,
                    accessContext,
                    assignment:
                        assignmentResult.rows[0] ||
                        null,
                    nextVisit:
                        visitResult.rows[0] ||
                        null,
                    latestResolution:
                        resolutionResult.rows[0] ||
                        null,
                    activeUnitLock:
                        unitLockResult.rows[0] ||
                        null,
                    counts:
                        countsResult.rows[0]
                })
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};


/*
 * Shape the response returned after a direct request
 * lifecycle transition.
 */
const shapeChangedMaintenanceRequestStatus = ({
    row,
    oldStatus
}) => ({
    public_id: row.public_id,
    request_number: row.request_number,
    old_status: oldStatus,
    status: row.status,
    status_change_reason:
        row.status_change_reason,
    status_changed_at:
        row.status_changed_at,
    reviewed_at: row.reviewed_at,
    work_started_at:
        row.work_started_at,
    resolution_clock_paused_at:
        row.resolution_clock_paused_at,
    total_resolution_hold_seconds:
        toNumber(
            row.total_resolution_hold_seconds
        ),
    updated_at: row.updated_at
});

/*
 * PATCH
 * /api/maintenance/requests/:maintenance_request_public_id/status
 */
const changeMaintenanceRequestStatus = async ({
    maintenanceRequestPublicId,
    expectedStatus,
    newStatus,
    reason,
    accessContext,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query(
            `
            BEGIN TRANSACTION
            ISOLATION LEVEL SERIALIZABLE
            `
        );

        /*
         * A regular user can only execute this operation
         * through an owner relationship. Admin does not need
         * an access context.
         */
        if (
            authenticatedUser.role !== "admin" &&
            accessContext !== "owner"
        ) {
            await client.query("ROLLBACK");

            return {
                invalidAccessContext: true,
                requestNotFound: false
            };
        }

        const values = [
            maintenanceRequestPublicId
        ];

        const accessConditions = [
            "mr.public_id = $1"
        ];

        /*
         * Owner-side mutation authority is intentionally
         * narrower than read authority.
         */
        if (
            authenticatedUser.role !== "admin"
        ) {
            values.push(
                authenticatedUser.id
            );

            accessConditions.push(`
                EXISTS (
                    SELECT 1
                    FROM owner_users AS access_ou
                    WHERE access_ou.owner_id =
                            mr.owner_id
                      AND access_ou.user_id =
                            $${values.length}
                      AND access_ou.revoked_at
                            IS NULL
                      AND (
                            access_ou.relationship_role =
                                'owner'
                            OR access_ou.is_primary =
                                TRUE
                      )
                )
            `);
        }

        /*
         * Lock the request before checking its current status
         * and related operational dependencies. Maintenance
         * child-table triggers also lock this request, which
         * serializes competing lifecycle work.
         */
        const requestResult =
            await client.query(
                `
                SELECT
                    mr.id,
                    mr.public_id,
                    mr.request_number,
                    mr.status,
                    mr.status_changed_at
                FROM maintenance_requests AS mr
                WHERE
                    ${accessConditions.join(
                        "\nAND "
                    )}
                FOR UPDATE OF mr
                `,
                values
            );

        /*
         * Missing and inaccessible requests share the same
         * result to prevent identifier disclosure.
         */
        if (requestResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                invalidAccessContext: false,
                requestNotFound: true
            };
        }

        const currentRequest =
            requestResult.rows[0];

        /*
         * Optimistic concurrency protection. The caller must
         * submit the status it originally read.
         */
        if (
            currentRequest.status !==
            expectedStatus
        ) {
            await client.query("ROLLBACK");

            return {
                invalidAccessContext: false,
                requestNotFound: false,
                statusConflict: true,
                expected_status:
                    expectedStatus,
                current_status:
                    currentRequest.status
            };
        }

        const allowedTransitions = {
            reported: [
                "under_review",
                "rejected",
                "cancelled"
            ],

            under_review: [
                "in_progress",
                "rejected",
                "cancelled"
            ],

            assigned: [
                "in_progress",
                "cancelled"
            ],

            in_progress: [
                "on_hold"
            ],

            on_hold: [
                "in_progress",
                "cancelled"
            ],

            resolved: [
                "in_progress"
            ]
        };

        if (
            !allowedTransitions[
                currentRequest.status
            ] ||
            !allowedTransitions[
                currentRequest.status
            ].includes(newStatus)
        ) {
            await client.query("ROLLBACK");

            return {
                invalidAccessContext: false,
                requestNotFound: false,
                statusConflict: false,
                invalidTransition: true,
                current_status:
                    currentRequest.status,
                requested_status:
                    newStatus
            };
        }

        /*
         * A cancellation cannot silently abandon active work,
         * visits, approvals or an operational unit lock.
         */
        if (newStatus === "cancelled") {
            const dependencyResult =
                await client.query(
                    `
                    SELECT
                        (
                            SELECT COUNT(*)
                            FROM maintenance_assignments
                                AS ma
                            WHERE ma
                                .maintenance_request_id =
                                    $1
                              AND ma.status IN (
                                    'pending',
                                    'accepted',
                                    'active'
                              )
                        )::BIGINT
                            AS active_assignments,

                        (
                            SELECT COUNT(*)
                            FROM maintenance_visits
                                AS mv
                            WHERE mv
                                .maintenance_request_id =
                                    $1
                              AND mv.status IN (
                                    'scheduled',
                                    'confirmed',
                                    'rescheduled',
                                    'in_progress'
                              )
                        )::BIGINT
                            AS active_visits,

                        (
                            SELECT COUNT(*)
                            FROM maintenance_cost_approvals
                                AS mca
                            INNER JOIN maintenance_costs
                                AS mc
                                ON mc.id =
                                    mca.maintenance_cost_id
                            WHERE mc
                                .maintenance_request_id =
                                    $1
                              AND mca.decision =
                                    'pending'
                        )::BIGINT
                            AS pending_cost_approvals,

                        (
                            SELECT COUNT(*)
                            FROM maintenance_unit_status_locks
                                AS musl
                            WHERE musl
                                .maintenance_request_id =
                                    $1
                              AND musl.is_active =
                                    TRUE
                        )::BIGINT
                            AS active_unit_status_locks
                    `,
                    [
                        currentRequest.id
                    ]
                );

            const dependencyRow =
                dependencyResult.rows[0];

            const dependencies = {
                active_assignments:
                    toNumber(
                        dependencyRow
                            .active_assignments
                    ) || 0,

                active_visits:
                    toNumber(
                        dependencyRow
                            .active_visits
                    ) || 0,

                pending_cost_approvals:
                    toNumber(
                        dependencyRow
                            .pending_cost_approvals
                    ) || 0,

                active_unit_status_locks:
                    toNumber(
                        dependencyRow
                            .active_unit_status_locks
                    ) || 0
            };

            const hasBlockingDependency =
                Object.values(
                    dependencies
                ).some(count => count > 0);

            if (hasBlockingDependency) {
                await client.query("ROLLBACK");

                return {
                    invalidAccessContext:
                        false,
                    requestNotFound:
                        false,
                    statusConflict:
                        false,
                    invalidTransition:
                        false,
                    dependencyConflict:
                        true,
                    dependencies
                };
            }
        }

        const updateResult =
            await client.query(
                `
                UPDATE maintenance_requests
                SET
                    status =
                        $1::VARCHAR(30),

                    status_changed_by =
                        $2::BIGINT,

                    status_changed_at =
                        CURRENT_TIMESTAMP,

                    status_change_reason =
                        $3::TEXT,

                    reviewed_at = CASE
                        WHEN status = 'reported'
                         AND $1::VARCHAR(30) =
                                'under_review'
                            THEN CURRENT_TIMESTAMP
                        ELSE reviewed_at
                    END,

                    reviewed_by = CASE
                        WHEN status = 'reported'
                         AND $1::VARCHAR(30) =
                                'under_review'
                            THEN $2::BIGINT
                        ELSE reviewed_by
                    END

                WHERE id =
                        $4::BIGINT
                  AND status =
                        $5::VARCHAR(30)

                RETURNING
                    public_id,
                    request_number,
                    status,
                    status_change_reason,
                    status_changed_at,
                    reviewed_at,
                    work_started_at,
                    resolution_clock_paused_at,
                    total_resolution_hold_seconds,
                    updated_at
                `,
                [
                    newStatus,
                    authenticatedUser.id,
                    reason.trim(),
                    currentRequest.id,
                    expectedStatus
                ]
            );

        /*
         * This should only occur if another database operation
         * changed the request unexpectedly despite locking.
         */
        if (updateResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                invalidAccessContext: false,
                requestNotFound: false,
                statusConflict: true,
                expected_status:
                    expectedStatus,
                current_status: null
            };
        }

        await client.query("COMMIT");

        return {
            invalidAccessContext: false,
            requestNotFound: false,
            statusConflict: false,
            invalidTransition: false,
            dependencyConflict: false,
            maintenance_request:
                shapeChangedMaintenanceRequestStatus({
                    row: updateResult.rows[0],
                    oldStatus:
                        currentRequest.status
                })
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    createMaintenanceRequest,
    getMaintenanceRequests,
    getSingleMaintenanceRequest,
    changeMaintenanceRequestStatus
};

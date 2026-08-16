const crypto = require("crypto");
const { nanoid } = require("nanoid");
const pool = require("../../config/db");

/*
 * Batch E — Preventive Maintenance Service
 *
 * The service owns preventive-plan and occurrence transactions,
 * owner/technician authorization, optimistic concurrency,
 * idempotent occurrence creation and preventive request generation.
 */

const PLAN_SORT_COLUMNS = {
    created_at: "pmp.created_at",
    updated_at: "pmp.updated_at",
    next_due_at: "pmp.next_due_at",
    title: "pmp.title",
    priority: "pmp.priority",
    status: "pmp.status"
};

const OCCURRENCE_SORT_COLUMNS = {
    due_at: "pmo.due_at",
    created_at: "pmo.created_at",
    updated_at: "pmo.updated_at",
    status: "pmo.status",
    generated_at: "pmo.generated_at"
};

const OWNER_PERMISSIONS = new Set([
    "can_view_maintenance_requests",
    "can_create_maintenance_requests",
    "can_update_maintenance_requests"
]);

const PLAN_MUTABLE_FIELDS = [
    "title",
    "description",
    "category",
    "priority",
    "impact_level",
    "location_details",
    "access_instruction",
    "frequency",
    "interval_value",
    "custom_interval_days",
    "next_due_at",
    "default_assignment_type",
    "assigned_user_public_id",
    "vendor_name",
    "company_name",
    "contact_person",
    "phone_number",
    "email",
    "service_description",
    "estimated_cost",
    "currency_code"
];

const createPlanPublicId = () =>
    `preventive_plan_${nanoid(24)}`;

const createOccurrencePublicId = () =>
    `preventive_occurrence_${nanoid(20)}`;

const createMaintenancePublicId = () =>
    `maintenance_${nanoid(24)}`;

const createAssignmentPublicId = () =>
    `maintenance_assignment_${nanoid(24)}`;

const createCostPublicId = () =>
    `maintenance_cost_${nanoid(24)}`;

const createMaintenanceRequestNumber = year =>
    `MNT-${year}-${crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;

const toNumber = value => {
    if (value === null || value === undefined) {
        return null;
    }

    return Number(value);
};

const toDate = value => {
    if (value === null || value === undefined) {
        return null;
    }

    const date = value instanceof Date
        ? value
        : new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : date;
};

const sameTimestamp = (firstValue, secondValue) => {
    const firstDate = toDate(firstValue);
    const secondDate = toDate(secondValue);

    if (firstDate === null || secondDate === null) {
        return firstDate === secondDate;
    }

    return firstDate.getTime() ===
        secondDate.getTime();
};

const hasOwn = (object, field) =>
    Object.prototype.hasOwnProperty.call(
        object,
        field
    );

const normalizePagination = filters => {
    const page = Number.isInteger(filters.page)
        ? filters.page
        : 1;

    const limit = Number.isInteger(filters.limit)
        ? filters.limit
        : 20;

    return {
        page,
        limit,
        offset: (page - 1) * limit
    };
};

const buildPagination = ({
    page,
    limit,
    total
}) => ({
    page,
    limit,
    total,
    total_pages:
        total === 0
            ? 0
            : Math.ceil(total / limit),
    has_previous_page: page > 1,
    has_next_page: page * limit < total
});

const runSerializable = async callback => {
    const client = await pool.connect();

    try {
        await client.query(
            `
            BEGIN TRANSACTION
            ISOLATION LEVEL SERIALIZABLE
            `
        );

        const result = await callback(client);

        await client.query("COMMIT");

        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const runRepeatableRead = async callback => {
    const client = await pool.connect();

    try {
        await client.query(
            `
            BEGIN TRANSACTION
            ISOLATION LEVEL REPEATABLE READ
            READ ONLY
            `
        );

        const result = await callback(client);

        await client.query("COMMIT");

        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/*
 * PostgreSQL BIGINT values are commonly returned by node-postgres
 * as decimal strings. Keep the original value for SQL parameters,
 * but accept either a positive integer number or a positive integer
 * string as a valid authenticated database user ID.
 */
const isValidDatabaseId = value =>
    (
        Number.isInteger(value) &&
        value > 0
    ) ||
    (
        typeof value === "string" &&
        /^[1-9]\d*$/.test(value.trim())
    );

const resolveAccessContext = ({
    authenticatedUser,
    requestedAccessContext,
    allowedContexts
}) => {
    if (
        !authenticatedUser ||
        !isValidDatabaseId(authenticatedUser.id)
    ) {
        return null;
    }

    if (authenticatedUser.role === "admin") {
        return "admin";
    }

    const normalized =
        typeof requestedAccessContext === "string"
            ? requestedAccessContext.trim()
            : "";

    return allowedContexts.includes(normalized)
        ? normalized
        : null;
};

const validateOwnerPermission = permission => {
    if (!OWNER_PERMISSIONS.has(permission)) {
        throw new Error(
            "Invalid preventive maintenance owner permission configuration."
        );
    }
};

const ownerAccessCondition = ({
    planAlias,
    userPlaceholder,
    permission
}) => {
    validateOwnerPermission(permission);

    return `
        EXISTS (
            SELECT 1
            FROM owner_users AS preventive_access_ou
            WHERE preventive_access_ou.owner_id =
                    ${planAlias}.owner_id
              AND preventive_access_ou.user_id =
                    ${userPlaceholder}::BIGINT
              AND preventive_access_ou.revoked_at IS NULL
              AND (
                    preventive_access_ou.relationship_role =
                        'owner'
                    OR preventive_access_ou.is_primary = TRUE
                    OR preventive_access_ou.${permission} = TRUE
              )
        )
    `;
};

const PLAN_SELECT = `
    SELECT
        pmp.*,

        o.public_id AS owner_public_id,
        o.owner_type,
        o.display_name AS owner_display_name,
        o.status AS owner_status,

        p.public_id AS property_public_id,
        p.property_code,
        p.property_name,
        p.property_type,
        p.operational_status AS property_operational_status,

        u.public_id AS unit_public_id,
        u.unit_code,
        u.unit_name,
        u.operational_status AS unit_operational_status,

        au.public_id AS assigned_user_public_id,
        au.full_name AS assigned_user_full_name,
        au.email AS assigned_user_email,

        cb.public_id AS created_by_public_id,
        cb.full_name AS created_by_full_name,

        pb.public_id AS paused_by_public_id,
        pb.full_name AS paused_by_full_name,

        xb.public_id AS cancelled_by_public_id,
        xb.full_name AS cancelled_by_full_name

    FROM preventive_maintenance_plans AS pmp

    INNER JOIN owners AS o
        ON o.id = pmp.owner_id

    INNER JOIN properties AS p
        ON p.id = pmp.property_id

    LEFT JOIN units AS u
        ON u.id = pmp.unit_id

    LEFT JOIN users AS au
        ON au.id = pmp.assigned_user_id

    INNER JOIN users AS cb
        ON cb.id = pmp.created_by

    LEFT JOIN users AS pb
        ON pb.id = pmp.paused_by

    LEFT JOIN users AS xb
        ON xb.id = pmp.cancelled_by
`;

const OCCURRENCE_SELECT = `
    SELECT
        pmo.*,
        mr.public_id AS maintenance_request_public_id,
        mr.request_number AS maintenance_request_number,
        mr.status AS maintenance_request_status
    FROM preventive_maintenance_occurrences AS pmo
    LEFT JOIN maintenance_requests AS mr
        ON mr.id = pmo.maintenance_request_id
`;

const shapePlan = row => ({
    public_id: row.public_id,
    request_scope: row.request_scope,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    impact_level: row.impact_level,
    location_details: row.location_details,
    access_instruction: row.access_instruction,

    schedule: {
        frequency: row.frequency,
        interval_value: row.interval_value,
        custom_interval_days:
            row.custom_interval_days,
        next_due_at: row.next_due_at,
        last_generated_at:
            row.last_generated_at,
        last_completed_at:
            row.last_completed_at,
        missed_occurrence_count:
            row.missed_occurrence_count
    },

    default_assignment:
        row.default_assignment_type === null
            ? null
            : {
                assignment_type:
                    row.default_assignment_type,
                assigned_user:
                    row.assigned_user_public_id
                        ? {
                            public_id:
                                row.assigned_user_public_id,
                            full_name:
                                row.assigned_user_full_name,
                            email:
                                row.assigned_user_email
                        }
                        : null,
                vendor:
                    row.default_assignment_type ===
                        "external_vendor"
                        ? {
                            vendor_name:
                                row.vendor_name,
                            company_name:
                                row.company_name,
                            contact_person:
                                row.contact_person,
                            phone_number:
                                row.phone_number,
                            email: row.email,
                            service_description:
                                row.service_description
                        }
                        : null,
                service_description:
                    row.default_assignment_type ===
                        "internal_technician"
                        ? row.service_description
                        : null
            },

    estimated_cost: toNumber(row.estimated_cost),
    currency_code: row.currency_code,
    status: row.status,

    pause: row.paused_at
        ? {
            reason: row.pause_reason,
            paused_at: row.paused_at,
            paused_by: row.paused_by_public_id
                ? {
                    public_id:
                        row.paused_by_public_id,
                    full_name:
                        row.paused_by_full_name
                }
                : null
        }
        : null,

    cancellation: row.cancelled_at
        ? {
            reason: row.cancellation_reason,
            cancelled_at: row.cancelled_at,
            cancelled_by:
                row.cancelled_by_public_id
                    ? {
                        public_id:
                            row.cancelled_by_public_id,
                        full_name:
                            row.cancelled_by_full_name
                    }
                    : null
        }
        : null,

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
            operational_status:
                row.unit_operational_status
        }
        : null,

    created_by: {
        public_id: row.created_by_public_id,
        full_name: row.created_by_full_name
    },

    created_at: row.created_at,
    updated_at: row.updated_at
});

const shapeOccurrence = row => ({
    public_id: row.public_id,
    due_at: row.due_at,
    status: row.status,
    generation_attempted_at:
        row.generation_attempted_at,
    generated_at: row.generated_at,
    failure_reason: row.failure_reason,
    maintenance_request:
        row.maintenance_request_public_id
            ? {
                public_id:
                    row.maintenance_request_public_id,
                request_number:
                    row.maintenance_request_number,
                status:
                    row.maintenance_request_status
            }
            : null,
    created_at: row.created_at,
    updated_at: row.updated_at
});

const getPlanById = async ({
    client,
    planId,
    lock = false
}) => {
    const lockClause = lock
        ? "FOR UPDATE OF pmp"
        : "";

    const result = await client.query(
        `
        ${PLAN_SELECT}
        WHERE pmp.id = $1::BIGINT
        LIMIT 1
        ${lockClause}
        `,
        [planId]
    );

    return result.rows[0] || null;
};

const getOccurrenceById = async ({
    client,
    occurrenceId,
    lock = false
}) => {
    const lockClause = lock
        ? "FOR UPDATE OF pmo"
        : "";

    const result = await client.query(
        `
        ${OCCURRENCE_SELECT}
        WHERE pmo.id = $1::BIGINT
        LIMIT 1
        ${lockClause}
        `,
        [occurrenceId]
    );

    return result.rows[0] || null;
};

const getAccessiblePlan = async ({
    client,
    preventivePlanPublicId,
    authenticatedUser,
    requestedAccessContext,
    allowedContexts,
    ownerPermission,
    lock = false
}) => {
    const accessContext = resolveAccessContext({
        authenticatedUser,
        requestedAccessContext,
        allowedContexts
    });

    if (!accessContext) {
        return {
            error: "invalid_access_context"
        };
    }

    const values = [preventivePlanPublicId];
    const conditions = [
        "pmp.public_id = $1::VARCHAR(50)"
    ];

    if (accessContext === "owner") {
        values.push(authenticatedUser.id);
        conditions.push(
            ownerAccessCondition({
                planAlias: "pmp",
                userPlaceholder:
                    `$${values.length}`,
                permission: ownerPermission
            })
        );
    }

    if (accessContext === "technician") {
        values.push(authenticatedUser.id);
        conditions.push(
            `pmp.assigned_user_id = $${values.length}::BIGINT`
        );
    }

    const lockClause = lock
        ? "FOR UPDATE OF pmp"
        : "";

    const result = await client.query(
        `
        ${PLAN_SELECT}
        WHERE ${conditions.join("\nAND ")}
        LIMIT 1
        ${lockClause}
        `,
        values
    );

    if (result.rows.length === 0) {
        return {
            error: "plan_not_found"
        };
    }

    return {
        error: null,
        access_context: accessContext,
        plan: result.rows[0]
    };
};

const resolveOwnerCreateContext = async ({
    client,
    planData,
    authenticatedUser,
    requestedAccessContext
}) => {
    const accessContext = resolveAccessContext({
        authenticatedUser,
        requestedAccessContext,
        allowedContexts: ["owner"]
    });

    if (!accessContext) {
        return {
            error: "invalid_access_context"
        };
    }

    const values = [planData.owner_public_id];
    const conditions = [
        "o.public_id = $1::VARCHAR(50)",
        "o.deleted_at IS NULL",
        "o.status = 'active'"
    ];

    if (accessContext === "owner") {
        values.push(authenticatedUser.id);
        conditions.push(
            `
            EXISTS (
                SELECT 1
                FROM owner_users AS ou
                WHERE ou.owner_id = o.id
                  AND ou.user_id =
                        $${values.length}::BIGINT
                  AND ou.revoked_at IS NULL
                  AND (
                        ou.relationship_role = 'owner'
                        OR ou.is_primary = TRUE
                        OR ou.can_create_maintenance_requests = TRUE
                  )
            )
            `
        );
    }

    const ownerResult = await client.query(
        `
        SELECT id, public_id
        FROM owners AS o
        WHERE ${conditions.join("\nAND ")}
        LIMIT 1
        FOR SHARE OF o
        `,
        values
    );

    if (ownerResult.rows.length === 0) {
        return {
            error: "owner_not_found"
        };
    }

    const owner = ownerResult.rows[0];

    const propertyResult = await client.query(
        `
        SELECT p.id, p.public_id
        FROM properties AS p
        INNER JOIN property_owners AS po
            ON po.property_id = p.id
           AND po.owner_id = $1::BIGINT
           AND po.effective_to IS NULL
        WHERE p.public_id = $2::VARCHAR(50)
          AND p.deleted_at IS NULL
        LIMIT 1
        FOR SHARE OF p, po
        `,
        [
            owner.id,
            planData.property_public_id
        ]
    );

    if (propertyResult.rows.length === 0) {
        return {
            error: "property_not_found"
        };
    }

    const property = propertyResult.rows[0];
    let unit = null;

    if (planData.request_scope === "unit") {
        const unitResult = await client.query(
            `
            SELECT id, public_id
            FROM units
            WHERE public_id = $1::VARCHAR(50)
              AND property_id = $2::BIGINT
              AND deleted_at IS NULL
            LIMIT 1
            FOR SHARE
            `,
            [
                planData.unit_public_id,
                property.id
            ]
        );

        if (unitResult.rows.length === 0) {
            return {
                error: "unit_not_found"
            };
        }

        unit = unitResult.rows[0];
    }

    return {
        error: null,
        access_context: accessContext,
        owner,
        property,
        unit
    };
};

const resolveAssignedUser = async ({
    client,
    assignmentType,
    assignedUserPublicId
}) => {
    if (assignmentType !== "internal_technician") {
        return {
            error: null,
            assigned_user_id: null
        };
    }

    const result = await client.query(
        `
        SELECT id
        FROM users
        WHERE public_id = $1::VARCHAR(50)
          AND deleted_at IS NULL
          AND is_verified = TRUE
        LIMIT 1
        FOR SHARE
        `,
        [assignedUserPublicId]
    );

    if (result.rows.length === 0) {
        return {
            error: "assigned_user_not_found",
            assigned_user_id: null
        };
    }

    return {
        error: null,
        assigned_user_id: result.rows[0].id
    };
};

const normalizeAssignmentValues = ({
    assignmentType,
    assignedUserId,
    source
}) => {
    if (assignmentType === null) {
        return {
            default_assignment_type: null,
            assigned_user_id: null,
            vendor_name: null,
            company_name: null,
            contact_person: null,
            phone_number: null,
            email: null,
            service_description: null
        };
    }

    if (assignmentType === "internal_technician") {
        return {
            default_assignment_type:
                "internal_technician",
            assigned_user_id: assignedUserId,
            vendor_name: null,
            company_name: null,
            contact_person: null,
            phone_number: null,
            email: null,
            service_description:
                source.service_description ?? null
        };
    }

    return {
        default_assignment_type:
            "external_vendor",
        assigned_user_id: null,
        vendor_name: source.vendor_name,
        company_name:
            source.company_name ?? null,
        contact_person:
            source.contact_person ?? null,
        phone_number:
            source.phone_number ?? null,
        email: source.email ?? null,
        service_description:
            source.service_description ?? null
    };
};

const createPreventiveMaintenancePlan = async ({
    planData,
    requestedAccessContext,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const suppliedAccessContext =
        requestedAccessContext ?? accessContext;

    const context = await resolveOwnerCreateContext({
        client,
        planData,
        authenticatedUser,
        requestedAccessContext:
            suppliedAccessContext
    });

    if (context.error) {
        return context;
    }

    const assignment = await resolveAssignedUser({
        client,
        assignmentType:
            planData.default_assignment_type ?? null,
        assignedUserPublicId:
            planData.assigned_user_public_id
    });

    if (assignment.error) {
        return assignment;
    }

    const assignmentValues =
        normalizeAssignmentValues({
            assignmentType:
                planData.default_assignment_type ?? null,
            assignedUserId:
                assignment.assigned_user_id,
            source: planData
        });

    let inserted = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await client.query(
            `
            INSERT INTO preventive_maintenance_plans (
                public_id,
                owner_id,
                property_id,
                unit_id,
                request_scope,
                title,
                description,
                category,
                priority,
                impact_level,
                location_details,
                access_instruction,
                frequency,
                interval_value,
                custom_interval_days,
                next_due_at,
                default_assignment_type,
                assigned_user_id,
                vendor_name,
                company_name,
                contact_person,
                phone_number,
                email,
                service_description,
                estimated_cost,
                currency_code,
                status,
                created_by
            )
            VALUES (
                $1::VARCHAR(50),
                $2::BIGINT,
                $3::BIGINT,
                $4::BIGINT,
                $5::VARCHAR(30),
                $6::VARCHAR(255),
                $7::TEXT,
                $8::VARCHAR(50),
                $9::VARCHAR(20),
                $10::VARCHAR(40),
                $11::VARCHAR(500),
                $12::VARCHAR(40),
                $13::VARCHAR(30),
                $14::INTEGER,
                $15::INTEGER,
                $16::TIMESTAMPTZ,
                $17::VARCHAR(30),
                $18::BIGINT,
                $19::VARCHAR(255),
                $20::VARCHAR(255),
                $21::VARCHAR(255),
                $22::VARCHAR(50),
                $23::VARCHAR(255),
                $24::VARCHAR(1000),
                $25::NUMERIC(14, 2),
                $26::VARCHAR(3),
                'active',
                $27::BIGINT
            )
            ON CONFLICT DO NOTHING
            RETURNING id
            `,
            [
                createPlanPublicId(),
                context.owner.id,
                context.property.id,
                context.unit ? context.unit.id : null,
                planData.request_scope,
                planData.title,
                planData.description,
                planData.category,
                planData.priority ?? "medium",
                planData.impact_level ??
                    "no_operational_impact",
                planData.location_details ?? null,
                planData.access_instruction ?? null,
                planData.frequency,
                planData.interval_value ?? 1,
                planData.frequency === "custom"
                    ? planData.custom_interval_days
                    : null,
                planData.next_due_at,
                assignmentValues
                    .default_assignment_type,
                assignmentValues.assigned_user_id,
                assignmentValues.vendor_name,
                assignmentValues.company_name,
                assignmentValues.contact_person,
                assignmentValues.phone_number,
                assignmentValues.email,
                assignmentValues.service_description,
                planData.estimated_cost ?? 0,
                planData.currency_code ?? "TZS",
                authenticatedUser.id
            ]
        );

        if (result.rows.length > 0) {
            inserted = result.rows[0];
            break;
        }
    }

    if (!inserted) {
        return {
            error: "identifier_conflict"
        };
    }

    const row = await getPlanById({
        client,
        planId: inserted.id
    });

    return {
        error: null,
        access_context: context.access_context,
        preventive_plan: shapePlan(row)
    };
});

const buildListAccess = ({
    authenticatedUser,
    requestedAccessContext,
    allowedContexts,
    permission,
    values,
    conditions
}) => {
    const accessContext = resolveAccessContext({
        authenticatedUser,
        requestedAccessContext,
        allowedContexts
    });

    if (!accessContext) {
        return null;
    }

    if (accessContext === "owner") {
        values.push(authenticatedUser.id);
        conditions.push(
            ownerAccessCondition({
                planAlias: "pmp",
                userPlaceholder:
                    `$${values.length}`,
                permission
            })
        );
    }

    if (accessContext === "technician") {
        values.push(authenticatedUser.id);
        conditions.push(
            `pmp.assigned_user_id = $${values.length}::BIGINT`
        );
    }

    return accessContext;
};

const applyPlanFilters = ({
    filters,
    values,
    conditions,
    dueOnly = false
}) => {
    const equalityFilters = [
        ["request_scope", "pmp.request_scope"],
        ["category", "pmp.category"],
        ["priority", "pmp.priority"],
        ["impact_level", "pmp.impact_level"],
        ["frequency", "pmp.frequency"],
        ["status", "pmp.status"],
        [
            "default_assignment_type",
            "pmp.default_assignment_type"
        ]
    ];

    for (const [field, column] of equalityFilters) {
        if (filters[field] !== undefined) {
            values.push(filters[field]);
            conditions.push(
                `${column} = $${values.length}::VARCHAR`
            );
        }
    }

    const publicFilters = [
        ["owner_public_id", "o.public_id"],
        ["property_public_id", "p.public_id"],
        ["unit_public_id", "u.public_id"],
        [
            "assigned_user_public_id",
            "au.public_id"
        ]
    ];

    for (const [field, column] of publicFilters) {
        if (filters[field] !== undefined) {
            values.push(filters[field]);
            conditions.push(
                `${column} = $${values.length}::VARCHAR(50)`
            );
        }
    }

    if (filters.due_from !== undefined) {
        values.push(filters.due_from);
        conditions.push(
            `pmp.next_due_at >= $${values.length}::TIMESTAMPTZ`
        );
    }

    if (filters.due_to !== undefined) {
        values.push(filters.due_to);
        conditions.push(
            `pmp.next_due_at <= $${values.length}::TIMESTAMPTZ`
        );
    }

    if (filters.search !== undefined) {
        values.push(`%${filters.search}%`);
        conditions.push(
            `
            (
                pmp.title ILIKE $${values.length}::TEXT
                OR pmp.description ILIKE $${values.length}::TEXT
                OR pmp.location_details ILIKE $${values.length}::TEXT
                OR p.property_name ILIKE $${values.length}::TEXT
                OR u.unit_name ILIKE $${values.length}::TEXT
            )
            `
        );
    }

    if (dueOnly) {
        conditions.push("pmp.status = 'active'");

        values.push(
            filters.due_through ??
                new Date().toISOString()
        );
        conditions.push(
            `pmp.next_due_at <= $${values.length}::TIMESTAMPTZ`
        );

        if (filters.include_overdue_only === true) {
            conditions.push(
                "pmp.next_due_at < CURRENT_TIMESTAMP"
            );
        }
    }
};

const queryPlans = async ({
    client,
    filters,
    authenticatedUser,
    requestedAccessContext,
    allowedContexts,
    permission,
    dueOnly = false
}) => {
    const values = [];
    const conditions = [];

    const accessContext = buildListAccess({
        authenticatedUser,
        requestedAccessContext,
        allowedContexts,
        permission,
        values,
        conditions
    });

    if (!accessContext) {
        return {
            error: "invalid_access_context"
        };
    }

    applyPlanFilters({
        filters,
        values,
        conditions,
        dueOnly
    });

    const { page, limit, offset } =
        normalizePagination(filters);

    const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join("\nAND ")}`
        : "";

    const countResult = await client.query(
        `
        SELECT COUNT(*)::BIGINT AS total
        FROM preventive_maintenance_plans AS pmp
        INNER JOIN owners AS o
            ON o.id = pmp.owner_id
        INNER JOIN properties AS p
            ON p.id = pmp.property_id
        LEFT JOIN units AS u
            ON u.id = pmp.unit_id
        LEFT JOIN users AS au
            ON au.id = pmp.assigned_user_id
        ${whereClause}
        `,
        values
    );

    const sortBy = dueOnly
        ? "pmp.next_due_at"
        : PLAN_SORT_COLUMNS[filters.sort_by] ||
            PLAN_SORT_COLUMNS.created_at;

    const sortOrder =
        (filters.sort_order ||
            (dueOnly ? "asc" : "desc"))
            .toUpperCase();

    const rowValues = [...values, limit, offset];

    const rowsResult = await client.query(
        `
        ${PLAN_SELECT}
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder},
                 pmp.id ${sortOrder}
        LIMIT $${rowValues.length - 1}::INTEGER
        OFFSET $${rowValues.length}::INTEGER
        `,
        rowValues
    );

    const total = Number(
        countResult.rows[0].total
    );

    return {
        error: null,
        access_context: accessContext,
        preventive_plans:
            rowsResult.rows.map(shapePlan),
        pagination: buildPagination({
            page,
            limit,
            total
        })
    };
};

const getPreventiveMaintenancePlans = async ({
    filters = {},
    requestedAccessContext,
    accessContext,
    authenticatedUser
}) => runRepeatableRead(client =>
    queryPlans({
        client,
        filters,
        authenticatedUser,
        requestedAccessContext:
            requestedAccessContext ?? accessContext,
        allowedContexts: [
            "owner",
            "technician"
        ],
        permission:
            "can_view_maintenance_requests"
    })
);

const getDuePreventiveMaintenancePlans = async ({
    filters = {},
    requestedAccessContext,
    accessContext,
    authenticatedUser
}) => runRepeatableRead(client =>
    queryPlans({
        client,
        filters,
        authenticatedUser,
        requestedAccessContext:
            requestedAccessContext ?? accessContext,
        allowedContexts: ["owner"],
        permission:
            "can_update_maintenance_requests",
        dueOnly: true
    })
);

const getSinglePreventiveMaintenancePlan = async ({
    preventivePlanPublicId,
    requestedAccessContext,
    accessContext,
    authenticatedUser
}) => runRepeatableRead(async client => {
    const access = await getAccessiblePlan({
        client,
        preventivePlanPublicId,
        authenticatedUser,
        requestedAccessContext:
            requestedAccessContext ?? accessContext,
        allowedContexts: [
            "owner",
            "technician"
        ],
        ownerPermission:
            "can_view_maintenance_requests"
    });

    if (access.error) {
        return access;
    }

    return {
        error: null,
        access_context: access.access_context,
        preventive_plan: shapePlan(access.plan)
    };
});

const buildMergedPlanUpdate = ({
    plan,
    updateData
}) => {
    const merged = {};

    for (const field of PLAN_MUTABLE_FIELDS) {
        if (field === "assigned_user_public_id") {
            continue;
        }

        merged[field] = hasOwn(updateData, field)
            ? updateData[field]
            : plan[field];
    }

    merged.default_assignment_type =
        hasOwn(
            updateData,
            "default_assignment_type"
        )
            ? updateData.default_assignment_type
            : plan.default_assignment_type;

    merged.assigned_user_public_id =
        hasOwn(
            updateData,
            "assigned_user_public_id"
        )
            ? updateData.assigned_user_public_id
            : plan.assigned_user_public_id;

    if (merged.frequency !== "custom") {
        merged.custom_interval_days = null;
    }

    if (merged.frequency === "one_time") {
        merged.interval_value = 1;
    }

    return merged;
};

const updatePreventiveMaintenancePlan = async ({
    preventivePlanPublicId,
    updateData,
    requestedAccessContext,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const access = await getAccessiblePlan({
        client,
        preventivePlanPublicId,
        authenticatedUser,
        requestedAccessContext:
            requestedAccessContext ?? accessContext,
        allowedContexts: ["owner"],
        ownerPermission:
            "can_update_maintenance_requests",
        lock: true
    });

    if (access.error) {
        return access;
    }

    if (["completed", "cancelled"].includes(
        access.plan.status
    )) {
        return {
            error: "plan_status_conflict"
        };
    }

    if (!sameTimestamp(
        access.plan.updated_at,
        updateData.expected_updated_at
    )) {
        return {
            error: "plan_version_conflict"
        };
    }

    const merged = buildMergedPlanUpdate({
        plan: access.plan,
        updateData
    });

    const assignedUser = await resolveAssignedUser({
        client,
        assignmentType:
            merged.default_assignment_type,
        assignedUserPublicId:
            merged.assigned_user_public_id
    });

    if (assignedUser.error) {
        return assignedUser;
    }

    const assignmentValues =
        normalizeAssignmentValues({
            assignmentType:
                merged.default_assignment_type,
            assignedUserId:
                assignedUser.assigned_user_id,
            source: merged
        });

    const result = await client.query(
        `
        UPDATE preventive_maintenance_plans
        SET
            title = $1::VARCHAR(255),
            description = $2::TEXT,
            category = $3::VARCHAR(50),
            priority = $4::VARCHAR(20),
            impact_level = $5::VARCHAR(40),
            location_details = $6::VARCHAR(500),
            access_instruction = $7::VARCHAR(40),
            frequency = $8::VARCHAR(30),
            interval_value = $9::INTEGER,
            custom_interval_days = $10::INTEGER,
            next_due_at = $11::TIMESTAMPTZ,
            default_assignment_type =
                $12::VARCHAR(30),
            assigned_user_id = $13::BIGINT,
            vendor_name = $14::VARCHAR(255),
            company_name = $15::VARCHAR(255),
            contact_person = $16::VARCHAR(255),
            phone_number = $17::VARCHAR(50),
            email = $18::VARCHAR(255),
            service_description =
                $19::VARCHAR(1000),
            estimated_cost = $20::NUMERIC(14, 2),
            currency_code = $21::VARCHAR(3)
        WHERE id = $22::BIGINT
        RETURNING id
        `,
        [
            merged.title,
            merged.description,
            merged.category,
            merged.priority,
            merged.impact_level,
            merged.location_details,
            merged.access_instruction,
            merged.frequency,
            merged.interval_value,
            merged.custom_interval_days,
            merged.next_due_at,
            assignmentValues
                .default_assignment_type,
            assignmentValues.assigned_user_id,
            assignmentValues.vendor_name,
            assignmentValues.company_name,
            assignmentValues.contact_person,
            assignmentValues.phone_number,
            assignmentValues.email,
            assignmentValues.service_description,
            merged.estimated_cost,
            merged.currency_code,
            access.plan.id
        ]
    );

    const row = await getPlanById({
        client,
        planId: result.rows[0].id
    });

    return {
        error: null,
        access_context: access.access_context,
        preventive_plan: shapePlan(row)
    };
});

const changePlanStatus = async ({
    preventivePlanPublicId,
    actionData,
    requestedAccessContext,
    accessContext,
    authenticatedUser,
    allowedCurrentStatuses,
    targetStatus,
    reasonField
}) => runSerializable(async client => {
    const access = await getAccessiblePlan({
        client,
        preventivePlanPublicId,
        authenticatedUser,
        requestedAccessContext:
            requestedAccessContext ?? accessContext,
        allowedContexts: ["owner"],
        ownerPermission:
            "can_update_maintenance_requests",
        lock: true
    });

    if (access.error) {
        return access;
    }

    if (!allowedCurrentStatuses.includes(
        access.plan.status
    )) {
        return {
            error: "plan_status_conflict"
        };
    }

    if (!sameTimestamp(
        access.plan.updated_at,
        actionData.expected_updated_at
    )) {
        return {
            error: "plan_version_conflict"
        };
    }

    let result;

    if (targetStatus === "paused") {
        result = await client.query(
            `
            UPDATE preventive_maintenance_plans
            SET
                status = 'paused',
                pause_reason = $1::TEXT,
                paused_at = CURRENT_TIMESTAMP,
                paused_by = $2::BIGINT
            WHERE id = $3::BIGINT
            RETURNING id
            `,
            [
                actionData[reasonField],
                authenticatedUser.id,
                access.plan.id
            ]
        );
    } else if (targetStatus === "cancelled") {
        result = await client.query(
            `
            UPDATE preventive_maintenance_plans
            SET
                status = 'cancelled',
                cancelled_at = CURRENT_TIMESTAMP,
                cancelled_by = $1::BIGINT,
                cancellation_reason = $2::TEXT
            WHERE id = $3::BIGINT
            RETURNING id
            `,
            [
                authenticatedUser.id,
                actionData[reasonField],
                access.plan.id
            ]
        );
    } else if (targetStatus === "completed") {
        result = await client.query(
            `
            UPDATE preventive_maintenance_plans
            SET
                status = 'completed',
                last_completed_at =
                    CURRENT_TIMESTAMP
            WHERE id = $1::BIGINT
            RETURNING id
            `,
            [access.plan.id]
        );
    } else {
        result = await client.query(
            `
            UPDATE preventive_maintenance_plans
            SET status = 'active'
            WHERE id = $1::BIGINT
            RETURNING id
            `,
            [access.plan.id]
        );
    }

    const row = await getPlanById({
        client,
        planId: result.rows[0].id
    });

    return {
        error: null,
        access_context: access.access_context,
        preventive_plan: shapePlan(row)
    };
});

const pausePreventiveMaintenancePlan = args =>
    changePlanStatus({
        ...args,
        actionData:
            args.actionData ?? args.pauseData,
        allowedCurrentStatuses: ["active"],
        targetStatus: "paused",
        reasonField: "pause_reason"
    });

const resumePreventiveMaintenancePlan = args =>
    changePlanStatus({
        ...args,
        actionData:
            args.actionData ?? args.resumeData,
        allowedCurrentStatuses: ["paused"],
        targetStatus: "active"
    });

const completePreventiveMaintenancePlan = args =>
    changePlanStatus({
        ...args,
        actionData:
            args.actionData ?? args.completeData,
        allowedCurrentStatuses: ["active"],
        targetStatus: "completed"
    });

const cancelPreventiveMaintenancePlan = args =>
    changePlanStatus({
        ...args,
        actionData:
            args.actionData ?? args.cancelData,
        allowedCurrentStatuses: [
            "active",
            "paused"
        ],
        targetStatus: "cancelled",
        reasonField: "cancellation_reason"
    });

const createOccurrenceInTransaction = async ({
    client,
    plan,
    dueAt
}) => {
    let inserted = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await client.query(
            `
            INSERT INTO preventive_maintenance_occurrences (
                public_id,
                preventive_plan_id,
                due_at,
                status
            )
            VALUES (
                $1::VARCHAR(50),
                $2::BIGINT,
                $3::TIMESTAMPTZ,
                'pending'
            )
            ON CONFLICT (
                preventive_plan_id,
                due_at
            ) DO NOTHING
            RETURNING id
            `,
            [
                createOccurrencePublicId(),
                plan.id,
                dueAt
            ]
        );

        if (result.rows.length > 0) {
            inserted = result.rows[0];
            break;
        }

        const existingResult = await client.query(
            `
            SELECT id
            FROM preventive_maintenance_occurrences
            WHERE preventive_plan_id = $1::BIGINT
              AND due_at = $2::TIMESTAMPTZ
            LIMIT 1
            FOR UPDATE
            `,
            [plan.id, dueAt]
        );

        if (existingResult.rows.length > 0) {
            return {
                duplicate: true,
                occurrence: await getOccurrenceById({
                    client,
                    occurrenceId:
                        existingResult.rows[0].id
                })
            };
        }
    }

    if (!inserted) {
        return {
            error: "identifier_conflict"
        };
    }

    return {
        duplicate: false,
        occurrence: await getOccurrenceById({
            client,
            occurrenceId: inserted.id
        })
    };
};

const createPreventiveMaintenanceOccurrence = async ({
    preventivePlanPublicId,
    occurrenceData,
    requestedAccessContext,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const access = await getAccessiblePlan({
        client,
        preventivePlanPublicId,
        authenticatedUser,
        requestedAccessContext:
            requestedAccessContext ?? accessContext,
        allowedContexts: ["owner"],
        ownerPermission:
            "can_update_maintenance_requests",
        lock: true
    });

    if (access.error) {
        return access;
    }

    if (access.plan.status !== "active") {
        return {
            error: "plan_status_conflict"
        };
    }

    if (!sameTimestamp(
        access.plan.updated_at,
        occurrenceData.expected_plan_updated_at
    )) {
        return {
            error: "plan_version_conflict"
        };
    }

    const created =
        await createOccurrenceInTransaction({
            client,
            plan: access.plan,
            dueAt: occurrenceData.due_at
        });

    if (created.error) {
        return created;
    }

    if (created.duplicate) {
        return {
            error: "occurrence_duplicate",
            preventive_occurrence:
                shapeOccurrence(created.occurrence)
        };
    }

    return {
        error: null,
        access_context: access.access_context,
        preventive_occurrence:
            shapeOccurrence(created.occurrence)
    };
});

const applyOccurrenceFilters = ({
    filters,
    values,
    conditions
}) => {
    const equalityFilters = [
        ["status", "pmo.status"]
    ];

    for (const [field, column] of equalityFilters) {
        if (filters[field] !== undefined) {
            values.push(filters[field]);
            conditions.push(
                `${column} = $${values.length}::VARCHAR`
            );
        }
    }

    const ranges = [
        ["due_from", "pmo.due_at", ">="],
        ["due_to", "pmo.due_at", "<="],
        [
            "created_from",
            "pmo.created_at",
            ">="
        ],
        ["created_to", "pmo.created_at", "<="]
    ];

    for (const [field, column, operator] of ranges) {
        if (filters[field] !== undefined) {
            values.push(filters[field]);
            conditions.push(
                `${column} ${operator} $${values.length}::TIMESTAMPTZ`
            );
        }
    }
};

const getPreventiveMaintenanceOccurrences = async ({
    preventivePlanPublicId,
    filters = {},
    requestedAccessContext,
    accessContext,
    authenticatedUser
}) => runRepeatableRead(async client => {
    const access = await getAccessiblePlan({
        client,
        preventivePlanPublicId,
        authenticatedUser,
        requestedAccessContext:
            requestedAccessContext ?? accessContext,
        allowedContexts: [
            "owner",
            "technician"
        ],
        ownerPermission:
            "can_view_maintenance_requests"
    });

    if (access.error) {
        return access;
    }

    const values = [access.plan.id];
    const conditions = [
        "pmo.preventive_plan_id = $1::BIGINT"
    ];

    applyOccurrenceFilters({
        filters,
        values,
        conditions
    });

    const { page, limit, offset } =
        normalizePagination(filters);

    const whereClause =
        `WHERE ${conditions.join("\nAND ")}`;

    const countResult = await client.query(
        `
        SELECT COUNT(*)::BIGINT AS total
        FROM preventive_maintenance_occurrences AS pmo
        ${whereClause}
        `,
        values
    );

    const sortBy =
        OCCURRENCE_SORT_COLUMNS[filters.sort_by] ||
        OCCURRENCE_SORT_COLUMNS.due_at;

    const sortOrder =
        (filters.sort_order || "desc")
            .toUpperCase();

    const rowValues = [...values, limit, offset];

    const rowsResult = await client.query(
        `
        ${OCCURRENCE_SELECT}
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder},
                 pmo.id ${sortOrder}
        LIMIT $${rowValues.length - 1}::INTEGER
        OFFSET $${rowValues.length}::INTEGER
        `,
        rowValues
    );

    const total = Number(
        countResult.rows[0].total
    );

    return {
        error: null,
        access_context: access.access_context,
        preventive_occurrences:
            rowsResult.rows.map(shapeOccurrence),
        pagination: buildPagination({
            page,
            limit,
            total
        })
    };
});

const getAccessibleOccurrence = async ({
    client,
    plan,
    preventiveOccurrencePublicId,
    lock = false
}) => {
    const lockClause = lock
        ? "FOR UPDATE OF pmo"
        : "";

    const result = await client.query(
        `
        ${OCCURRENCE_SELECT}
        WHERE pmo.preventive_plan_id =
                $1::BIGINT
          AND pmo.public_id =
                $2::VARCHAR(50)
        LIMIT 1
        ${lockClause}
        `,
        [
            plan.id,
            preventiveOccurrencePublicId
        ]
    );

    return result.rows[0] || null;
};

const getSinglePreventiveMaintenanceOccurrence = async ({
    preventivePlanPublicId,
    preventiveOccurrencePublicId,
    requestedAccessContext,
    accessContext,
    authenticatedUser
}) => runRepeatableRead(async client => {
    const access = await getAccessiblePlan({
        client,
        preventivePlanPublicId,
        authenticatedUser,
        requestedAccessContext:
            requestedAccessContext ?? accessContext,
        allowedContexts: [
            "owner",
            "technician"
        ],
        ownerPermission:
            "can_view_maintenance_requests"
    });

    if (access.error) {
        return access;
    }

    const occurrence = await getAccessibleOccurrence({
        client,
        plan: access.plan,
        preventiveOccurrencePublicId
    });

    if (!occurrence) {
        return {
            error: "occurrence_not_found"
        };
    }

    return {
        error: null,
        access_context: access.access_context,
        preventive_occurrence:
            shapeOccurrence(occurrence)
    };
});

const insertGeneratedRequest = async ({
    client,
    plan
}) => {
    const yearResult = await client.query(
        `SELECT TO_CHAR(CURRENT_DATE, 'YYYY') AS year`
    );

    const year = yearResult.rows[0].year;
    let request = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await client.query(
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
                access_instruction,
                reported_by,
                reporter_type,
                currency_code
            )
            VALUES (
                $1::VARCHAR(50),
                $2::VARCHAR(30),
                $3::VARCHAR(30),
                'preventive_schedule',
                $4::BIGINT,
                $5::BIGINT,
                $6::BIGINT,
                $7::BIGINT,
                NULL,
                NULL,
                $8::VARCHAR(255),
                $9::TEXT,
                $10::VARCHAR(50),
                $11::VARCHAR(20),
                'reported',
                $12::VARCHAR(40),
                $13::VARCHAR(500),
                $14::VARCHAR(40),
                NULL,
                'system',
                $15::VARCHAR(3)
            )
            ON CONFLICT DO NOTHING
            RETURNING
                id,
                public_id,
                request_number,
                status,
                updated_at
            `,
            [
                createMaintenancePublicId(),
                createMaintenanceRequestNumber(year),
                plan.request_scope,
                plan.id,
                plan.owner_id,
                plan.property_id,
                plan.unit_id,
                plan.title,
                plan.description,
                plan.category,
                plan.priority,
                plan.impact_level,
                plan.location_details,
                plan.access_instruction,
                plan.currency_code
            ]
        );

        if (result.rows.length > 0) {
            request = result.rows[0];
            break;
        }
    }

    return request;
};

const insertDefaultCost = async ({
    client,
    requestId,
    plan,
    actorUserId,
    assignmentId
}) => {
    if (toNumber(plan.estimated_cost) <= 0) {
        return null;
    }

    let inserted = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await client.query(
            `
            INSERT INTO maintenance_costs (
                public_id,
                maintenance_request_id,
                assignment_id,
                cost_type,
                description,
                quantity,
                unit_cost,
                estimated_amount,
                currency_code,
                status,
                recorded_by
            )
            VALUES (
                $1::VARCHAR(60),
                $2::BIGINT,
                $3::BIGINT,
                'service_fee',
                $4::TEXT,
                1,
                $5::NUMERIC(14, 2),
                $5::NUMERIC(14, 2),
                $6::VARCHAR(3),
                'draft',
                $7::BIGINT
            )
            ON CONFLICT DO NOTHING
            RETURNING id, public_id
            `,
            [
                createCostPublicId(),
                requestId,
                assignmentId,
                `Preventive maintenance estimate: ${plan.title}`,
                plan.estimated_cost,
                plan.currency_code,
                actorUserId
            ]
        );

        if (result.rows.length > 0) {
            inserted = result.rows[0];
            break;
        }
    }

    return inserted;
};

const insertDefaultAssignment = async ({
    client,
    requestId,
    plan,
    actorUserId
}) => {
    if (plan.default_assignment_type === null) {
        return null;
    }

    await client.query(
        `
        UPDATE maintenance_requests
        SET
            status = 'under_review',
            reviewed_at = CURRENT_TIMESTAMP,
            reviewed_by = $1::BIGINT,
            status_changed_by = $1::BIGINT,
            status_changed_at = CURRENT_TIMESTAMP,
            status_change_reason =
                'Preventive maintenance request reviewed for default assignment.'
        WHERE id = $2::BIGINT
          AND status = 'reported'
        `,
        [actorUserId, requestId]
    );

    let assignment = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await client.query(
            `
            INSERT INTO maintenance_assignments (
                public_id,
                maintenance_request_id,
                assignment_type,
                status,
                assigned_user_id,
                vendor_name,
                company_name,
                contact_person,
                phone_number,
                email,
                service_description,
                assignment_notes,
                assigned_by,
                assigned_at
            )
            VALUES (
                $1::VARCHAR(60),
                $2::BIGINT,
                $3::VARCHAR(30),
                'pending',
                $4::BIGINT,
                $5::VARCHAR(255),
                $6::VARCHAR(255),
                $7::VARCHAR(255),
                $8::VARCHAR(50),
                $9::VARCHAR(255),
                $10::VARCHAR(1000),
                'Created automatically from preventive maintenance plan.',
                $11::BIGINT,
                CURRENT_TIMESTAMP
            )
            ON CONFLICT DO NOTHING
            RETURNING id, public_id
            `,
            [
                createAssignmentPublicId(),
                requestId,
                plan.default_assignment_type,
                plan.assigned_user_id,
                plan.vendor_name,
                plan.company_name,
                plan.contact_person,
                plan.phone_number,
                plan.email,
                plan.service_description,
                actorUserId
            ]
        );

        if (result.rows.length > 0) {
            assignment = result.rows[0];
            break;
        }
    }

    if (!assignment) {
        throw new Error(
            "Default preventive assignment identifier could not be generated."
        );
    }

    return assignment;
};

const generateOccurrenceInTransaction = async ({
    client,
    plan,
    occurrence,
    actorUserId
}) => {
    if (plan.status !== "active") {
        return {
            error: "plan_status_conflict"
        };
    }

    if (occurrence.status !== "pending") {
        if (
            occurrence.status === "generated" &&
            occurrence.maintenance_request_id !== null
        ) {
            return {
                error: null,
                idempotent: true,
                occurrence
            };
        }

        return {
            error: "occurrence_status_conflict"
        };
    }

    const request = await insertGeneratedRequest({
        client,
        plan
    });

    if (!request) {
        return {
            error: "request_identifier_conflict"
        };
    }

    const assignment = await insertDefaultAssignment({
        client,
        requestId: request.id,
        plan,
        actorUserId
    });

    await insertDefaultCost({
        client,
        requestId: request.id,
        plan,
        actorUserId,
        assignmentId: assignment
            ? assignment.id
            : null
    });

    const updateResult = await client.query(
        `
        UPDATE preventive_maintenance_occurrences
        SET
            status = 'generated',
            maintenance_request_id = $1::BIGINT,
            generation_attempted_at =
                CURRENT_TIMESTAMP,
            generated_at = CURRENT_TIMESTAMP,
            failure_reason = NULL
        WHERE id = $2::BIGINT
          AND status = 'pending'
        RETURNING id
        `,
        [request.id, occurrence.id]
    );

    if (updateResult.rows.length === 0) {
        return {
            error: "occurrence_status_conflict"
        };
    }

    await client.query(
        "SET CONSTRAINTS ALL IMMEDIATE"
    );

    const reloaded = await getOccurrenceById({
        client,
        occurrenceId: occurrence.id
    });

    return {
        error: null,
        idempotent: false,
        occurrence: reloaded
    };
};

const generatePreventiveMaintenanceOccurrence = async ({
    preventivePlanPublicId,
    preventiveOccurrencePublicId,
    generationData,
    requestedAccessContext,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const access = await getAccessiblePlan({
        client,
        preventivePlanPublicId,
        authenticatedUser,
        requestedAccessContext:
            requestedAccessContext ?? accessContext,
        allowedContexts: ["owner"],
        ownerPermission:
            "can_create_maintenance_requests",
        lock: true
    });

    if (access.error) {
        return access;
    }

    if (!sameTimestamp(
        access.plan.updated_at,
        generationData.expected_plan_updated_at
    )) {
        return {
            error: "plan_version_conflict"
        };
    }

    const occurrence = await getAccessibleOccurrence({
        client,
        plan: access.plan,
        preventiveOccurrencePublicId,
        lock: true
    });

    if (!occurrence) {
        return {
            error: "occurrence_not_found"
        };
    }

    if (!sameTimestamp(
        occurrence.updated_at,
        generationData
            .expected_occurrence_updated_at
    )) {
        return {
            error: "occurrence_version_conflict"
        };
    }

    const generated =
        await generateOccurrenceInTransaction({
            client,
            plan: access.plan,
            occurrence,
            actorUserId: authenticatedUser.id
        });

    if (generated.error) {
        return generated;
    }

    return {
        error: null,
        idempotent: generated.idempotent,
        access_context: access.access_context,
        preventive_occurrence:
            shapeOccurrence(generated.occurrence)
    };
});

const advanceRecurringPlanAfterTerminalOccurrence = async ({
    client,
    plan,
    occurrence,
    incrementMissedCount
}) => {
    if (plan.frequency === "one_time") {
        return;
    }

    await client.query(
        `
        UPDATE preventive_maintenance_plans
        SET
            next_due_at =
                calculate_preventive_maintenance_next_due(
                    id,
                    $1::TIMESTAMPTZ
                ),
            missed_occurrence_count =
                missed_occurrence_count +
                $2::INTEGER
        WHERE id = $3::BIGINT
        `,
        [
            occurrence.due_at,
            incrementMissedCount ? 1 : 0,
            plan.id
        ]
    );
};

const changeOccurrenceStatus = async ({
    preventivePlanPublicId,
    preventiveOccurrencePublicId,
    actionData,
    requestedAccessContext,
    accessContext,
    authenticatedUser,
    targetStatus,
    reasonField
}) => runSerializable(async client => {
    const access = await getAccessiblePlan({
        client,
        preventivePlanPublicId,
        authenticatedUser,
        requestedAccessContext:
            requestedAccessContext ?? accessContext,
        allowedContexts: ["owner"],
        ownerPermission:
            "can_update_maintenance_requests",
        lock: true
    });

    if (access.error) {
        return access;
    }

    const occurrence = await getAccessibleOccurrence({
        client,
        plan: access.plan,
        preventiveOccurrencePublicId,
        lock: true
    });

    if (!occurrence) {
        return {
            error: "occurrence_not_found"
        };
    }

    if (occurrence.status !== "pending") {
        return {
            error: "occurrence_status_conflict"
        };
    }

    if (!sameTimestamp(
        occurrence.updated_at,
        actionData.expected_occurrence_updated_at
    )) {
        return {
            error: "occurrence_version_conflict"
        };
    }

    const generationAttempt =
        targetStatus === "failed"
            ? "CURRENT_TIMESTAMP"
            : "generation_attempted_at";

    const result = await client.query(
        `
        UPDATE preventive_maintenance_occurrences
        SET
            status = $1::VARCHAR(20),
            generation_attempted_at =
                ${generationAttempt},
            maintenance_request_id = NULL,
            generated_at = NULL,
            failure_reason = $2::TEXT
        WHERE id = $3::BIGINT
          AND status = 'pending'
        RETURNING id
        `,
        [
            targetStatus,
            actionData[reasonField],
            occurrence.id
        ]
    );

    if (result.rows.length === 0) {
        return {
            error: "occurrence_status_conflict"
        };
    }

    await advanceRecurringPlanAfterTerminalOccurrence({
        client,
        plan: access.plan,
        occurrence,
        incrementMissedCount:
            targetStatus === "skipped" ||
            targetStatus === "failed"
    });

    const row = await getOccurrenceById({
        client,
        occurrenceId: occurrence.id
    });

    return {
        error: null,
        access_context: access.access_context,
        preventive_occurrence:
            shapeOccurrence(row)
    };
});

const skipPreventiveMaintenanceOccurrence = args =>
    changeOccurrenceStatus({
        ...args,
        actionData:
            args.actionData ?? args.skipData,
        targetStatus: "skipped",
        reasonField: "skip_reason"
    });

const failPreventiveMaintenanceOccurrence = args =>
    changeOccurrenceStatus({
        ...args,
        actionData:
            args.actionData ?? args.failData,
        targetStatus: "failed",
        reasonField: "failure_reason"
    });

const cancelPreventiveMaintenanceOccurrence = args =>
    changeOccurrenceStatus({
        ...args,
        actionData:
            args.actionData ?? args.cancelData,
        targetStatus: "cancelled",
        reasonField: "cancellation_reason"
    });

const processOneDuePlan = async ({
    preventivePlanPublicId,
    dueThrough,
    actorUserId
}) => runSerializable(async client => {
    const planResult = await client.query(
        `
        ${PLAN_SELECT}
        WHERE pmp.public_id = $1::VARCHAR(50)
          AND pmp.status = 'active'
          AND pmp.next_due_at <=
                $2::TIMESTAMPTZ
        LIMIT 1
        FOR UPDATE OF pmp
        `,
        [preventivePlanPublicId, dueThrough]
    );

    if (planResult.rows.length === 0) {
        return {
            outcome: "not_due"
        };
    }

    const plan = planResult.rows[0];

    const created = await createOccurrenceInTransaction({
        client,
        plan,
        dueAt: plan.next_due_at
    });

    if (created.error) {
        return {
            outcome: "failed",
            error: created.error
        };
    }

    if (
        created.duplicate &&
        created.occurrence.status !== "pending"
    ) {
        return {
            outcome: "already_processed",
            occurrence_status:
                created.occurrence.status,
            preventive_occurrence:
                shapeOccurrence(created.occurrence)
        };
    }

    const generated =
        await generateOccurrenceInTransaction({
            client,
            plan,
            occurrence: created.occurrence,
            actorUserId
        });

    if (generated.error) {
        return {
            outcome: "failed",
            error: generated.error
        };
    }

    return {
        outcome: generated.idempotent
            ? "already_generated"
            : "generated",
        preventive_occurrence:
            shapeOccurrence(generated.occurrence)
    };
});

const processDuePreventiveMaintenancePlans = async ({
    processData = {},
    authenticatedUser
}) => {
    if (
        !authenticatedUser ||
        authenticatedUser.role !== "admin"
    ) {
        return {
            error: "forbidden"
        };
    }

    const dueThrough =
        processData.due_through ??
        new Date().toISOString();

    const limit = Number.isInteger(processData.limit)
        ? processData.limit
        : 25;

    const candidatesResult = await pool.query(
        `
        SELECT public_id
        FROM preventive_maintenance_plans
        WHERE status = 'active'
          AND next_due_at <= $1::TIMESTAMPTZ
        ORDER BY next_due_at ASC, id ASC
        LIMIT $2::INTEGER
        `,
        [dueThrough, limit]
    );

    const results = [];

    for (const candidate of candidatesResult.rows) {
        try {
            const result = await processOneDuePlan({
                preventivePlanPublicId:
                    candidate.public_id,
                dueThrough,
                actorUserId: authenticatedUser.id
            });

            results.push({
                preventive_plan_public_id:
                    candidate.public_id,
                ...result
            });
        } catch (error) {
            results.push({
                preventive_plan_public_id:
                    candidate.public_id,
                outcome: "failed",
                error: error.code ||
                    "processing_error",
                message: error.message
            });
        }
    }

    const summary = results.reduce(
        (accumulator, result) => {
            accumulator.total += 1;

            if (
                result.outcome === "generated" ||
                result.outcome ===
                    "already_generated"
            ) {
                accumulator.generated += 1;
            } else if (
                result.outcome ===
                    "already_processed"
            ) {
                accumulator.already_processed += 1;
            } else if (
                result.outcome === "not_due"
            ) {
                accumulator.not_due += 1;
            } else {
                accumulator.failed += 1;
            }

            return accumulator;
        },
        {
            total: 0,
            generated: 0,
            already_processed: 0,
            not_due: 0,
            failed: 0
        }
    );

    return {
        error: null,
        due_through: dueThrough,
        summary,
        results
    };
};

module.exports = {
    createPreventiveMaintenancePlan,
    getPreventiveMaintenancePlans,
    getDuePreventiveMaintenancePlans,
    getSinglePreventiveMaintenancePlan,
    updatePreventiveMaintenancePlan,
    pausePreventiveMaintenancePlan,
    resumePreventiveMaintenancePlan,
    completePreventiveMaintenancePlan,
    cancelPreventiveMaintenancePlan,
    createPreventiveMaintenanceOccurrence,
    getPreventiveMaintenanceOccurrences,
    getSinglePreventiveMaintenanceOccurrence,
    generatePreventiveMaintenanceOccurrence,
    skipPreventiveMaintenanceOccurrence,
    failPreventiveMaintenanceOccurrence,
    cancelPreventiveMaintenanceOccurrence,
    processDuePreventiveMaintenancePlans
};

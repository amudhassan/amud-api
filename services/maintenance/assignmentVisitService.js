const { nanoid } = require("nanoid");
const pool = require("../../config/db");

const {
    getAccessibleMaintenanceRequest
} = require("./maintenanceAccessService");

const CURRENT_ASSIGNMENT_STATUSES = [
    "pending",
    "accepted",
    "active"
];

const ACTIVE_VISIT_STATUSES = [
    "scheduled",
    "confirmed",
    "rescheduled",
    "in_progress"
];

const ASSIGNMENT_SORT_COLUMNS = {
    assigned_at: "ma.assigned_at",
    updated_at: "ma.updated_at",
    status: "ma.status",
    assignment_type: "ma.assignment_type"
};

const VISIT_SORT_COLUMNS = {
    scheduled_start_at: "mv.scheduled_start_at",
    scheduled_end_at: "mv.scheduled_end_at",
    created_at: "mv.created_at",
    updated_at: "mv.updated_at",
    status: "mv.status"
};

const createAssignmentPublicId = () =>
    `maintenance_assignment_${nanoid(24)}`;

const createVisitPublicId = () =>
    `maintenance_visit_${nanoid(24)}`;

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

const shapeAssignment = ({
    row,
    accessContext
}) => {
    const assignment = {
        public_id: row.public_id,
        assignment_type: row.assignment_type,
        status: row.status,

        assigned_user: row.assigned_user_public_id
            ? {
                public_id:
                    row.assigned_user_public_id,
                full_name:
                    row.assigned_user_full_name
            }
            : null,

        vendor: row.assignment_type ===
            "external_vendor"
            ? {
                vendor_name: row.vendor_name,
                company_name: row.company_name,
                contact_person: row.contact_person,
                phone_number: row.phone_number,
                email: row.email,
                service_description:
                    row.service_description
            }
            : null,

        assigned_at: row.assigned_at,
        accepted_at: row.accepted_at,
        declined_at: row.declined_at,
        activated_at: row.activated_at,
        completed_at: row.completed_at,
        revoked_at: row.revoked_at,
        status_changed_at:
            row.status_changed_at,
        created_at: row.created_at,
        updated_at: row.updated_at
    };

    if (
        accessContext === "admin" ||
        accessContext === "owner" ||
        accessContext === "technician"
    ) {
        assignment.assignment_notes =
            row.assignment_notes;
        assignment.decline_reason =
            row.decline_reason;
        assignment.completion_notes =
            row.completion_notes;
        assignment.revocation_reason =
            row.revocation_reason;
        assignment.status_change_reason =
            row.status_change_reason;

        assignment.assigned_by =
            row.assigned_by_public_id
                ? {
                    public_id:
                        row.assigned_by_public_id,
                    full_name:
                        row.assigned_by_full_name
                }
                : null;

        assignment.revoked_by =
            row.revoked_by_public_id
                ? {
                    public_id:
                        row.revoked_by_public_id,
                    full_name:
                        row.revoked_by_full_name
                }
                : null;
    }

    return assignment;
};

const shapeVisit = row => ({
    public_id: row.public_id,

    assignment: row.assignment_public_id
        ? {
            public_id: row.assignment_public_id,
            assignment_type:
                row.assignment_type,
            assignment_status:
                row.assignment_status,
            assigned_user_public_id:
                row.assigned_user_public_id,
            assigned_user_full_name:
                row.assigned_user_full_name,
            vendor_name: row.vendor_name,
            company_name: row.company_name
        }
        : null,

    visit_type: row.visit_type,
    scheduled_start_at:
        row.scheduled_start_at,
    scheduled_end_at:
        row.scheduled_end_at,
    status: row.status,
    visit_purpose: row.visit_purpose,
    access_instruction:
        row.access_instruction,

    tenant_confirmation_status:
        row.tenant_confirmation_status,
    tenant_confirmation_note:
        row.tenant_confirmation_note,
    tenant_confirmed_at:
        row.tenant_confirmed_at,

    arrival_at: row.arrival_at,
    departure_at: row.departure_at,
    completion_notes: row.completion_notes,
    missed_reason: row.missed_reason,
    missed_notes: row.missed_notes,
    cancelled_at: row.cancelled_at,
    cancellation_reason:
        row.cancellation_reason,

    status_change_reason:
        row.status_change_reason,
    status_changed_at:
        row.status_changed_at,
    created_at: row.created_at,
    updated_at: row.updated_at
});

const shapeVisitHistory = row => ({
    public_id: row.public_id,
    old_status: row.old_status,
    new_status: row.new_status,
    old_schedule_start_at:
        row.old_schedule_start_at,
    old_schedule_end_at:
        row.old_schedule_end_at,
    new_schedule_start_at:
        row.new_schedule_start_at,
    new_schedule_end_at:
        row.new_schedule_end_at,
    reason: row.reason,
    changed_by: row.changed_by_public_id
        ? {
            public_id:
                row.changed_by_public_id,
            full_name:
                row.changed_by_full_name
        }
        : null,
    changed_at: row.changed_at,
    metadata: row.metadata
});

const assignmentSelectColumns = `
    ma.id,
    ma.public_id,
    ma.maintenance_request_id,
    ma.assignment_type,
    ma.status,
    ma.assigned_user_id,
    ma.vendor_name,
    ma.company_name,
    ma.contact_person,
    ma.phone_number,
    ma.email,
    ma.service_description,
    ma.assignment_notes,
    ma.assigned_by,
    ma.assigned_at,
    ma.accepted_at,
    ma.declined_at,
    ma.decline_reason,
    ma.activated_at,
    ma.completed_at,
    ma.completion_notes,
    ma.revoked_at,
    ma.revoked_by,
    ma.revocation_reason,
    ma.status_changed_by,
    ma.status_changed_at,
    ma.status_change_reason,
    ma.created_at,
    ma.updated_at,

    assigned_user.public_id
        AS assigned_user_public_id,
    assigned_user.full_name
        AS assigned_user_full_name,

    assigned_by_user.public_id
        AS assigned_by_public_id,
    assigned_by_user.full_name
        AS assigned_by_full_name,

    revoked_by_user.public_id
        AS revoked_by_public_id,
    revoked_by_user.full_name
        AS revoked_by_full_name
`;

const assignmentJoins = `
    LEFT JOIN users AS assigned_user
        ON assigned_user.id =
            ma.assigned_user_id

    LEFT JOIN users AS assigned_by_user
        ON assigned_by_user.id =
            ma.assigned_by

    LEFT JOIN users AS revoked_by_user
        ON revoked_by_user.id =
            ma.revoked_by
`;

const visitSelectColumns = `
    mv.id,
    mv.public_id,
    mv.maintenance_request_id,
    mv.assignment_id,
    mv.visit_type,
    mv.scheduled_start_at,
    mv.scheduled_end_at,
    mv.status,
    mv.visit_purpose,
    mv.access_instruction,
    mv.tenant_confirmation_status,
    mv.tenant_confirmed_by,
    mv.tenant_confirmed_at,
    mv.tenant_confirmation_note,
    mv.arrival_at,
    mv.departure_at,
    mv.completion_notes,
    mv.missed_reason,
    mv.missed_notes,
    mv.cancelled_by,
    mv.cancelled_at,
    mv.cancellation_reason,
    mv.created_by,
    mv.status_changed_by,
    mv.status_changed_at,
    mv.status_change_reason,
    mv.created_at,
    mv.updated_at,

    ma.public_id AS assignment_public_id,
    ma.assignment_type,
    ma.status AS assignment_status,
    ma.vendor_name,
    ma.company_name,

    assigned_user.public_id
        AS assigned_user_public_id,
    assigned_user.full_name
        AS assigned_user_full_name
`;

const visitJoins = `
    LEFT JOIN maintenance_assignments AS ma
        ON ma.id = mv.assignment_id

    LEFT JOIN users AS assigned_user
        ON assigned_user.id =
            ma.assigned_user_id
`;

const getAssignmentByPublicId = async ({
    client,
    requestId,
    assignmentPublicId,
    lock = false
}) => {
    const lockClause = lock
        ? "FOR UPDATE OF ma"
        : "";

    const result = await client.query(
        `
        SELECT
            ${assignmentSelectColumns}

        FROM maintenance_assignments AS ma

        ${assignmentJoins}

        WHERE ma.maintenance_request_id =
                $1::BIGINT
          AND ma.public_id = $2::VARCHAR(60)

        LIMIT 1
        ${lockClause}
        `,
        [
            requestId,
            assignmentPublicId
        ]
    );

    return result.rows[0] || null;
};

const getVisitByPublicId = async ({
    client,
    requestId,
    visitPublicId,
    lock = false
}) => {
    const lockClause = lock
        ? "FOR UPDATE OF mv"
        : "";

    const result = await client.query(
        `
        SELECT
            ${visitSelectColumns}

        FROM maintenance_visits AS mv

        ${visitJoins}

        WHERE mv.maintenance_request_id =
                $1::BIGINT
          AND mv.public_id = $2::VARCHAR(60)

        LIMIT 1
        ${lockClause}
        `,
        [
            requestId,
            visitPublicId
        ]
    );

    return result.rows[0] || null;
};

const resolveRequestAccess = async ({
    client,
    maintenanceRequestPublicId,
    authenticatedUser,
    accessContext,
    allowedContexts,
    ownerPermission,
    lockRequest = false
}) => {
    const accessResult =
        await getAccessibleMaintenanceRequest({
            client,
            maintenanceRequestPublicId,
            authenticatedUser,
            requestedAccessContext:
                accessContext,
            allowedContexts,
            ownerPermission,
            lockRequest
        });

    if (accessResult.invalidAccessContext) {
        return {
            error: "invalid_access_context"
        };
    }

    if (accessResult.requestNotFound) {
        return {
            error: "request_not_found"
        };
    }

    return {
        error: null,
        accessContext:
            accessResult.access_context,
        request:
            accessResult.maintenance_request
    };
};

const checkExpectedRequest = ({
    request,
    expectedStatus,
    expectedUpdatedAt
}) => {
    if (request.status !== expectedStatus) {
        return "request_status_conflict";
    }

    if (
        !sameTimestamp(
            request.updated_at,
            expectedUpdatedAt
        )
    ) {
        return "request_version_conflict";
    }

    return null;
};

const checkExpectedRecord = ({
    record,
    expectedStatus,
    expectedUpdatedAt,
    statusConflictCode,
    versionConflictCode
}) => {
    if (record.status !== expectedStatus) {
        return statusConflictCode;
    }

    if (
        !sameTimestamp(
            record.updated_at,
            expectedUpdatedAt
        )
    ) {
        return versionConflictCode;
    }

    return null;
};

const getCurrentTechnicianAssignment = async ({
    client,
    requestId,
    authenticatedUserId,
    lock = false
}) => {
    const lockClause = lock
        ? "FOR UPDATE OF ma"
        : "";

    const result = await client.query(
        `
        SELECT
            ma.id,
            ma.public_id,
            ma.assignment_type,
            ma.status,
            ma.assigned_user_id,
            ma.updated_at
        FROM maintenance_assignments AS ma
        WHERE ma.maintenance_request_id =
                $1::BIGINT
          AND ma.assignment_type =
                'internal_technician'
          AND ma.assigned_user_id =
                $2::BIGINT
          AND ma.status = ANY(
                $3::VARCHAR[]
          )
        ORDER BY ma.assigned_at DESC,
                 ma.id DESC
        LIMIT 1
        ${lockClause}
        `,
        [
            requestId,
            authenticatedUserId,
            CURRENT_ASSIGNMENT_STATUSES
        ]
    );

    return result.rows[0] || null;
};

const technicianCanActOnAssignment = async ({
    client,
    requestId,
    assignment,
    authenticatedUser,
    accessContext,
    lock = false
}) => {
    if (accessContext !== "technician") {
        return true;
    }

    const currentAssignment =
        await getCurrentTechnicianAssignment({
            client,
            requestId,
            authenticatedUserId:
                authenticatedUser.id,
            lock
        });

    return Boolean(
        currentAssignment &&
        currentAssignment.id === assignment.id
    );
};

const technicianCanActOnVisit = async ({
    client,
    requestId,
    visit,
    authenticatedUser,
    accessContext,
    lock = false
}) => {
    if (accessContext !== "technician") {
        return true;
    }

    if (visit.assignment_id === null) {
        return false;
    }

    const currentAssignment =
        await getCurrentTechnicianAssignment({
            client,
            requestId,
            authenticatedUserId:
                authenticatedUser.id,
            lock
        });

    return Boolean(
        currentAssignment &&
        currentAssignment.id ===
            visit.assignment_id
    );
};

const recordManualActivity = async ({
    client,
    requestId,
    activityType,
    oldValue = null,
    newValue = null,
    reason,
    performedBy,
    metadata = {}
}) => {
    await client.query(
        `
        SELECT record_maintenance_activity(
            $1::BIGINT,
            $2::VARCHAR,
            $3::JSONB,
            $4::JSONB,
            $5::TEXT,
            $6::BIGINT,
            $7::JSONB
        )
        `,
        [
            requestId,
            activityType,
            oldValue === null
                ? null
                : JSON.stringify(oldValue),
            newValue === null
                ? null
                : JSON.stringify(newValue),
            reason,
            performedBy,
            JSON.stringify(metadata)
        ]
    );
};

const createMaintenanceAssignment = async ({
    maintenanceRequestPublicId,
    assignmentData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const access = await resolveRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: ["owner"],
        ownerPermission:
            "can_assign_maintenance_work",
        lockRequest: true
    });

    if (access.error) {
        return access;
    }

    const expectedError = checkExpectedRequest({
        request: access.request,
        expectedStatus:
            assignmentData.expected_request_status,
        expectedUpdatedAt:
            assignmentData
                .expected_request_updated_at
    });

    if (expectedError) {
        return { error: expectedError };
    }

    const currentAssignmentResult =
        await client.query(
            `
            SELECT id
            FROM maintenance_assignments
            WHERE maintenance_request_id =
                    $1::BIGINT
              AND status = ANY(
                    $2::VARCHAR[]
              )
            LIMIT 1
            FOR UPDATE
            `,
            [
                access.request.id,
                CURRENT_ASSIGNMENT_STATUSES
            ]
        );

    if (currentAssignmentResult.rows.length > 0) {
        return {
            error: "active_assignment_conflict"
        };
    }

    let assignedUserId = null;

    if (
        assignmentData.assignment_type ===
            "internal_technician"
    ) {
        const userResult = await client.query(
            `
            SELECT id
            FROM users
            WHERE public_id = $1::VARCHAR(50)
              AND deleted_at IS NULL
              AND is_verified = TRUE
            LIMIT 1
            FOR SHARE
            `,
            [
                assignmentData
                    .assigned_user_public_id
            ]
        );

        if (userResult.rows.length === 0) {
            return {
                error: "assigned_user_not_found"
            };
        }

        assignedUserId =
            userResult.rows[0].id;
    }

    let insertedRow = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const publicId =
            createAssignmentPublicId();

        try {
            const insertResult =
                await client.query(
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
                        assigned_at,
                        created_at,
                        updated_at
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
                        $9::VARCHAR(320),
                        $10::TEXT,
                        $11::TEXT,
                        $12::BIGINT,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    RETURNING public_id
                    `,
                    [
                        publicId,
                        access.request.id,
                        assignmentData.assignment_type,
                        assignedUserId,
                        assignmentData.vendor_name ?? null,
                        assignmentData.company_name ?? null,
                        assignmentData.contact_person ?? null,
                        assignmentData.phone_number ?? null,
                        assignmentData.email ?? null,
                        assignmentData.service_description ?? null,
                        assignmentData.assignment_notes ?? null,
                        authenticatedUser.id
                    ]
                );

            insertedRow = insertResult.rows[0];
            break;
        } catch (error) {
            if (
                error.code === "23505" &&
                attempt < 2
            ) {
                continue;
            }

            throw error;
        }
    }

    if (!insertedRow) {
        return { error: "identifier_conflict" };
    }

    const assignment =
        await getAssignmentByPublicId({
            client,
            requestId: access.request.id,
            assignmentPublicId:
                insertedRow.public_id
        });

    const requestResult = await client.query(
        `
        SELECT status, updated_at
        FROM maintenance_requests
        WHERE id = $1::BIGINT
        `,
        [access.request.id]
    );

    return {
        error: null,
        access_context: access.accessContext,
        maintenance_request: {
            public_id: access.request.public_id,
            status:
                requestResult.rows[0].status,
            updated_at:
                requestResult.rows[0].updated_at
        },
        maintenance_assignment:
            shapeAssignment({
                row: assignment,
                accessContext:
                    access.accessContext
            })
    };
});

const getMaintenanceAssignments = async ({
    maintenanceRequestPublicId,
    filters,
    authenticatedUser
}) => runRepeatableRead(async client => {
    const access = await resolveRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext: filters.access_context,
        allowedContexts: [
            "owner",
            "tenant",
            "technician"
        ],
        ownerPermission:
            "can_view_maintenance_requests"
    });

    if (access.error) {
        return access;
    }

    const values = [access.request.id];
    const conditions = [
        "ma.maintenance_request_id = $1::BIGINT"
    ];

    const addValue = value => {
        values.push(value);
        return `$${values.length}`;
    };

    if (access.accessContext === "technician") {
        const placeholder = addValue(
            authenticatedUser.id
        );

        conditions.push(
            `ma.assigned_user_id = ${placeholder}::BIGINT`
        );
    }

    if (filters.status !== undefined) {
        const placeholder = addValue(filters.status);
        conditions.push(
            `ma.status = ${placeholder}::VARCHAR(20)`
        );
    }

    if (filters.assignment_type !== undefined) {
        const placeholder = addValue(
            filters.assignment_type
        );
        conditions.push(
            `ma.assignment_type = ${placeholder}::VARCHAR(30)`
        );
    }

    if (
        filters.assigned_user_public_id !==
            undefined
    ) {
        const placeholder = addValue(
            filters.assigned_user_public_id
        );
        conditions.push(
            `assigned_user.public_id = ${placeholder}::VARCHAR(50)`
        );
    }

    if (filters.assigned_from !== undefined) {
        const placeholder = addValue(
            filters.assigned_from
        );
        conditions.push(
            `ma.assigned_at >= ${placeholder}::TIMESTAMPTZ`
        );
    }

    if (filters.assigned_to !== undefined) {
        const placeholder = addValue(
            filters.assigned_to
        );
        conditions.push(
            `ma.assigned_at <= ${placeholder}::TIMESTAMPTZ`
        );
    }

    const { page, limit, offset } =
        normalizePagination(filters);

    const countResult = await client.query(
        `
        SELECT COUNT(*)::INTEGER AS total
        FROM maintenance_assignments AS ma
        ${assignmentJoins}
        WHERE ${conditions.join("\nAND ")}
        `,
        values
    );

    const total = countResult.rows[0].total;

    const limitPlaceholder = addValue(limit);
    const offsetPlaceholder = addValue(offset);

    const sortColumn =
        ASSIGNMENT_SORT_COLUMNS[
            filters.sort_by || "assigned_at"
        ];

    const sortOrder =
        filters.sort_order === "asc"
            ? "ASC"
            : "DESC";

    const dataResult = await client.query(
        `
        SELECT
            ${assignmentSelectColumns}
        FROM maintenance_assignments AS ma
        ${assignmentJoins}
        WHERE ${conditions.join("\nAND ")}
        ORDER BY
            ${sortColumn} ${sortOrder},
            ma.id ${sortOrder}
        LIMIT ${limitPlaceholder}::INTEGER
        OFFSET ${offsetPlaceholder}::INTEGER
        `,
        values
    );

    return {
        error: null,
        access_context: access.accessContext,
        maintenance_request: {
            public_id: access.request.public_id,
            request_number:
                access.request.request_number,
            status: access.request.status
        },
        pagination: buildPagination({
            page,
            limit,
            total
        }),
        maintenance_assignments:
            dataResult.rows.map(row =>
                shapeAssignment({
                    row,
                    accessContext:
                        access.accessContext
                })
            )
    };
});

const getSingleMaintenanceAssignment = async ({
    maintenanceRequestPublicId,
    maintenanceAssignmentPublicId,
    accessContext,
    authenticatedUser
}) => runRepeatableRead(async client => {
    const access = await resolveRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: [
            "owner",
            "tenant",
            "technician"
        ],
        ownerPermission:
            "can_view_maintenance_requests"
    });

    if (access.error) {
        return access;
    }

    const assignment =
        await getAssignmentByPublicId({
            client,
            requestId: access.request.id,
            assignmentPublicId:
                maintenanceAssignmentPublicId
        });

    if (!assignment) {
        return { error: "assignment_not_found" };
    }

    if (
        access.accessContext === "technician" &&
        assignment.assigned_user_id !==
            authenticatedUser.id
    ) {
        return { error: "assignment_not_found" };
    }

    return {
        error: null,
        access_context: access.accessContext,
        maintenance_assignment:
            shapeAssignment({
                row: assignment,
                accessContext:
                    access.accessContext
            })
    };
});

const changeAssignmentStatus = async ({
    maintenanceRequestPublicId,
    maintenanceAssignmentPublicId,
    expectedStatus,
    expectedUpdatedAt,
    accessContext,
    authenticatedUser,
    transition
}) => runSerializable(async client => {
    const access = await resolveRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: [
            "owner",
            "technician"
        ],
        ownerPermission:
            "can_assign_maintenance_work",
        lockRequest: true
    });

    if (access.error) {
        return access;
    }

    const assignment =
        await getAssignmentByPublicId({
            client,
            requestId: access.request.id,
            assignmentPublicId:
                maintenanceAssignmentPublicId,
            lock: true
        });

    if (!assignment) {
        return { error: "assignment_not_found" };
    }

    const expectedError = checkExpectedRecord({
        record: assignment,
        expectedStatus,
        expectedUpdatedAt,
        statusConflictCode:
            "assignment_status_conflict",
        versionConflictCode:
            "assignment_version_conflict"
    });

    if (expectedError) {
        return { error: expectedError };
    }

    const actorAllowed =
        await technicianCanActOnAssignment({
            client,
            requestId: access.request.id,
            assignment,
            authenticatedUser,
            accessContext:
                access.accessContext,
            lock: true
        });

    if (!actorAllowed) {
        return {
            error: "assignment_actor_forbidden"
        };
    }

    if (transition.name === "complete") {
        const visitResult = await client.query(
            `
            SELECT id
            FROM maintenance_visits
            WHERE assignment_id = $1::BIGINT
              AND status = 'in_progress'
            LIMIT 1
            FOR UPDATE
            `,
            [assignment.id]
        );

        if (visitResult.rows.length > 0) {
            return {
                error: "active_visit_dependency_conflict"
            };
        }

        if (access.request.status !== "in_progress") {
            return {
                error: "request_status_conflict"
            };
        }
    }

    if (transition.name === "revoke") {
        const visitResult = await client.query(
            `
            SELECT id
            FROM maintenance_visits
            WHERE assignment_id = $1::BIGINT
              AND status = 'in_progress'
            LIMIT 1
            FOR UPDATE
            `,
            [assignment.id]
        );

        if (visitResult.rows.length > 0) {
            return {
                error: "active_visit_dependency_conflict"
            };
        }
    }

    const now = new Date();
    const setClauses = [
        "status = $1::VARCHAR(20)",
        "status_changed_by = $2::BIGINT",
        "status_changed_at = $3::TIMESTAMPTZ",
        "status_change_reason = $4::TEXT"
    ];

    const values = [
        transition.newStatus,
        authenticatedUser.id,
        now,
        transition.auditReason,
        assignment.id
    ];

    const assignmentIdPlaceholder = "$5";

    if (transition.name === "accept") {
        setClauses.push(
            "accepted_at = $3::TIMESTAMPTZ"
        );
    }

    if (transition.name === "decline") {
        setClauses.push(
            "declined_at = $3::TIMESTAMPTZ",
            "decline_reason = $4::TEXT"
        );
    }

    if (transition.name === "activate") {
        setClauses.push(
            "accepted_at = COALESCE(accepted_at, $3::TIMESTAMPTZ)",
            "activated_at = $3::TIMESTAMPTZ"
        );
    }

    if (transition.name === "complete") {
        setClauses.push(
            "completed_at = $3::TIMESTAMPTZ",
            "completion_notes = $4::TEXT"
        );
    }

    if (transition.name === "revoke") {
        setClauses.push(
            "revoked_at = $3::TIMESTAMPTZ",
            "revoked_by = $2::BIGINT",
            "revocation_reason = $4::TEXT"
        );
    }

    await client.query(
        `
        UPDATE maintenance_assignments
        SET
            ${setClauses.join(",\n")}
        WHERE id = ${assignmentIdPlaceholder}::BIGINT
        `,
        values
    );

    const updatedAssignment =
        await getAssignmentByPublicId({
            client,
            requestId: access.request.id,
            assignmentPublicId:
                maintenanceAssignmentPublicId
        });

    const requestResult = await client.query(
        `
        SELECT status, updated_at
        FROM maintenance_requests
        WHERE id = $1::BIGINT
        `,
        [access.request.id]
    );

    return {
        error: null,
        access_context: access.accessContext,
        maintenance_request: {
            public_id: access.request.public_id,
            status:
                requestResult.rows[0].status,
            updated_at:
                requestResult.rows[0].updated_at
        },
        maintenance_assignment:
            shapeAssignment({
                row: updatedAssignment,
                accessContext:
                    access.accessContext
            })
    };
});

const acceptMaintenanceAssignment = input =>
    changeAssignmentStatus({
        ...input,
        transition: {
            name: "accept",
            newStatus: "accepted",
            auditReason: input.reason
        }
    });

const declineMaintenanceAssignment = input =>
    changeAssignmentStatus({
        ...input,
        transition: {
            name: "decline",
            newStatus: "declined",
            auditReason: input.declineReason
        }
    });

const activateMaintenanceAssignment = input =>
    changeAssignmentStatus({
        ...input,
        transition: {
            name: "activate",
            newStatus: "active",
            auditReason: input.reason
        }
    });

const completeMaintenanceAssignment = input =>
    changeAssignmentStatus({
        ...input,
        transition: {
            name: "complete",
            newStatus: "completed",
            auditReason:
                input.completionNotes
        }
    });

const revokeMaintenanceAssignment = input =>
    changeAssignmentStatus({
        ...input,
        transition: {
            name: "revoke",
            newStatus: "revoked",
            auditReason:
                input.revocationReason
        }
    });

const resolveVisitAssignment = async ({
    client,
    requestId,
    assignmentPublicId,
    authenticatedUser,
    accessContext
}) => {
    if (accessContext === "technician") {
        const currentAssignment =
            await getCurrentTechnicianAssignment({
                client,
                requestId,
                authenticatedUserId:
                    authenticatedUser.id,
                lock: true
            });

        if (!currentAssignment) {
            return {
                error: "assignment_actor_forbidden"
            };
        }

        if (
            assignmentPublicId &&
            assignmentPublicId !==
                currentAssignment.public_id
        ) {
            return {
                error: "assignment_dependency_conflict"
            };
        }

        return {
            error: null,
            assignmentId:
                currentAssignment.id
        };
    }

    if (!assignmentPublicId) {
        return {
            error: null,
            assignmentId: null
        };
    }

    const assignment =
        await getAssignmentByPublicId({
            client,
            requestId,
            assignmentPublicId,
            lock: true
        });

    if (!assignment) {
        return {
            error: "assignment_not_found"
        };
    }

    if (
        !CURRENT_ASSIGNMENT_STATUSES.includes(
            assignment.status
        )
    ) {
        return {
            error: "assignment_dependency_conflict"
        };
    }

    return {
        error: null,
        assignmentId: assignment.id
    };
};

const hasEligibleActiveLease = async ({
    client,
    request
}) => {
    if (
        request.tenant_id === null ||
        request.lease_id === null ||
        request.unit_id === null
    ) {
        return false;
    }

    const result = await client.query(
        `
        SELECT EXISTS (
            SELECT 1
            FROM leases AS l
            WHERE l.id = $1::BIGINT
              AND l.tenant_id = $2::BIGINT
              AND l.owner_id = $3::BIGINT
              AND l.property_id = $4::BIGINT
              AND l.unit_id = $5::BIGINT
              AND l.status = 'active'
              AND CURRENT_DATE BETWEEN
                    l.start_date AND l.end_date
        ) AS eligible
        `,
        [
            request.lease_id,
            request.tenant_id,
            request.owner_id,
            request.property_id,
            request.unit_id
        ]
    );

    return Boolean(result.rows[0].eligible);
};

const createMaintenanceVisit = async ({
    maintenanceRequestPublicId,
    visitData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const access = await resolveRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: [
            "owner",
            "technician"
        ],
        ownerPermission:
            "can_assign_maintenance_work",
        lockRequest: true
    });

    if (access.error) {
        return access;
    }

    const expectedError = checkExpectedRequest({
        request: access.request,
        expectedStatus:
            visitData.expected_request_status,
        expectedUpdatedAt:
            visitData.expected_request_updated_at
    });

    if (expectedError) {
        return { error: expectedError };
    }

    const assignmentResolution =
        await resolveVisitAssignment({
            client,
            requestId: access.request.id,
            assignmentPublicId:
                visitData.assignment_public_id,
            authenticatedUser,
            accessContext:
                access.accessContext
        });

    if (assignmentResolution.error) {
        return assignmentResolution;
    }

    if (
        assignmentResolution.assignmentId === null &&
        (
            !["reported", "under_review"].includes(
                access.request.status
            ) ||
            visitData.visit_type !== "inspection"
        )
    ) {
        return {
            error: "assignment_dependency_conflict"
        };
    }

    if (
        visitData.requires_tenant_confirmation
    ) {
        const eligibleLease =
            await hasEligibleActiveLease({
                client,
                request: access.request
            });

        if (!eligibleLease) {
            return {
                error: "tenant_confirmation_dependency_conflict"
            };
        }
    }

    const scheduledStart =
        toDate(visitData.scheduled_start_at);
    const reportedAt =
        toDate(access.request.reported_at);

    if (
        scheduledStart === null ||
        reportedAt === null ||
        scheduledStart.getTime() <
            reportedAt.getTime()
    ) {
        return { error: "schedule_conflict" };
    }

    let insertedPublicId = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const publicId = createVisitPublicId();

        try {
            const result = await client.query(
                `
                INSERT INTO maintenance_visits (
                    public_id,
                    maintenance_request_id,
                    assignment_id,
                    visit_type,
                    scheduled_start_at,
                    scheduled_end_at,
                    status,
                    visit_purpose,
                    access_instruction,
                    tenant_confirmation_status,
                    created_by,
                    created_at,
                    updated_at
                )
                VALUES (
                    $1::VARCHAR(60),
                    $2::BIGINT,
                    $3::BIGINT,
                    $4::VARCHAR(30),
                    $5::TIMESTAMPTZ,
                    $6::TIMESTAMPTZ,
                    'scheduled',
                    $7::TEXT,
                    $8::VARCHAR(40),
                    $9::VARCHAR(30),
                    $10::BIGINT,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                RETURNING public_id
                `,
                [
                    publicId,
                    access.request.id,
                    assignmentResolution
                        .assignmentId,
                    visitData.visit_type,
                    visitData.scheduled_start_at,
                    visitData.scheduled_end_at,
                    visitData.visit_purpose,
                    visitData.access_instruction ?? null,
                    visitData.requires_tenant_confirmation
                        ? "pending"
                        : "not_required",
                    authenticatedUser.id
                ]
            );

            insertedPublicId =
                result.rows[0].public_id;
            break;
        } catch (error) {
            if (
                error.code === "23505" &&
                attempt < 2
            ) {
                continue;
            }

            throw error;
        }
    }

    if (!insertedPublicId) {
        return { error: "identifier_conflict" };
    }

    const visit = await getVisitByPublicId({
        client,
        requestId: access.request.id,
        visitPublicId: insertedPublicId
    });

    return {
        error: null,
        access_context: access.accessContext,
        maintenance_visit: shapeVisit(visit)
    };
});

const getMaintenanceVisits = async ({
    maintenanceRequestPublicId,
    filters,
    authenticatedUser
}) => runRepeatableRead(async client => {
    const access = await resolveRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext: filters.access_context,
        allowedContexts: [
            "owner",
            "tenant",
            "technician"
        ],
        ownerPermission:
            "can_view_maintenance_requests"
    });

    if (access.error) {
        return access;
    }

    const values = [access.request.id];
    const conditions = [
        "mv.maintenance_request_id = $1::BIGINT"
    ];

    const addValue = value => {
        values.push(value);
        return `$${values.length}`;
    };

    if (access.accessContext === "technician") {
        const placeholder = addValue(
            authenticatedUser.id
        );

        conditions.push(`
            EXISTS (
                SELECT 1
                FROM maintenance_assignments
                    AS technician_ma
                WHERE technician_ma.id =
                        mv.assignment_id
                  AND technician_ma.assigned_user_id =
                        ${placeholder}::BIGINT
                  AND technician_ma.status = ANY(
                        ARRAY[
                            'pending',
                            'accepted',
                            'active'
                        ]::VARCHAR[]
                  )
            )
        `);
    }

    if (filters.status !== undefined) {
        const placeholder = addValue(filters.status);
        conditions.push(
            `mv.status = ${placeholder}::VARCHAR(20)`
        );
    }

    if (filters.visit_type !== undefined) {
        const placeholder = addValue(
            filters.visit_type
        );
        conditions.push(
            `mv.visit_type = ${placeholder}::VARCHAR(30)`
        );
    }

    if (
        filters.tenant_confirmation_status !==
            undefined
    ) {
        const placeholder = addValue(
            filters.tenant_confirmation_status
        );
        conditions.push(
            `mv.tenant_confirmation_status = ${placeholder}::VARCHAR(30)`
        );
    }

    if (filters.assignment_public_id !== undefined) {
        const placeholder = addValue(
            filters.assignment_public_id
        );
        conditions.push(
            `ma.public_id = ${placeholder}::VARCHAR(60)`
        );
    }

    if (filters.scheduled_from !== undefined) {
        const placeholder = addValue(
            filters.scheduled_from
        );
        conditions.push(
            `mv.scheduled_start_at >= ${placeholder}::TIMESTAMPTZ`
        );
    }

    if (filters.scheduled_to !== undefined) {
        const placeholder = addValue(
            filters.scheduled_to
        );
        conditions.push(
            `mv.scheduled_start_at <= ${placeholder}::TIMESTAMPTZ`
        );
    }

    if (filters.upcoming_only === true) {
        conditions.push(`
            mv.status = ANY(
                ARRAY[
                    'scheduled',
                    'confirmed',
                    'rescheduled'
                ]::VARCHAR[]
            )
            AND mv.scheduled_end_at >=
                CURRENT_TIMESTAMP
        `);
    }

    const { page, limit, offset } =
        normalizePagination(filters);

    const countResult = await client.query(
        `
        SELECT COUNT(*)::INTEGER AS total
        FROM maintenance_visits AS mv
        ${visitJoins}
        WHERE ${conditions.join("\nAND ")}
        `,
        values
    );

    const total = countResult.rows[0].total;

    const limitPlaceholder = addValue(limit);
    const offsetPlaceholder = addValue(offset);

    const sortColumn =
        VISIT_SORT_COLUMNS[
            filters.sort_by ||
                "scheduled_start_at"
        ];

    const sortOrder =
        filters.sort_order === "desc"
            ? "DESC"
            : "ASC";

    const dataResult = await client.query(
        `
        SELECT
            ${visitSelectColumns}
        FROM maintenance_visits AS mv
        ${visitJoins}
        WHERE ${conditions.join("\nAND ")}
        ORDER BY
            ${sortColumn} ${sortOrder},
            mv.id ${sortOrder}
        LIMIT ${limitPlaceholder}::INTEGER
        OFFSET ${offsetPlaceholder}::INTEGER
        `,
        values
    );

    return {
        error: null,
        access_context: access.accessContext,
        maintenance_request: {
            public_id: access.request.public_id,
            request_number:
                access.request.request_number,
            status: access.request.status
        },
        pagination: buildPagination({
            page,
            limit,
            total
        }),
        maintenance_visits:
            dataResult.rows.map(shapeVisit)
    };
});

const getSingleMaintenanceVisit = async ({
    maintenanceRequestPublicId,
    maintenanceVisitPublicId,
    accessContext,
    authenticatedUser
}) => runRepeatableRead(async client => {
    const access = await resolveRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: [
            "owner",
            "tenant",
            "technician"
        ],
        ownerPermission:
            "can_view_maintenance_requests"
    });

    if (access.error) {
        return access;
    }

    const visit = await getVisitByPublicId({
        client,
        requestId: access.request.id,
        visitPublicId:
            maintenanceVisitPublicId
    });

    if (!visit) {
        return { error: "visit_not_found" };
    }

    if (access.accessContext === "technician") {
        const canAct =
            await technicianCanActOnVisit({
                client,
                requestId: access.request.id,
                visit,
                authenticatedUser,
                accessContext:
                    access.accessContext
            });

        if (!canAct) {
            return { error: "visit_not_found" };
        }
    }

    return {
        error: null,
        access_context: access.accessContext,
        maintenance_visit: shapeVisit(visit)
    };
});

const respondToMaintenanceVisit = async ({
    maintenanceRequestPublicId,
    maintenanceVisitPublicId,
    expectedStatus,
    expectedTenantConfirmationStatus,
    expectedUpdatedAt,
    response,
    note,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const access = await resolveRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: ["tenant"],
        ownerPermission:
            "can_view_maintenance_requests",
        lockRequest: true
    });

    if (access.error) {
        return access;
    }

    const visit = await getVisitByPublicId({
        client,
        requestId: access.request.id,
        visitPublicId:
            maintenanceVisitPublicId,
        lock: true
    });

    if (!visit) {
        return { error: "visit_not_found" };
    }

    const expectedError = checkExpectedRecord({
        record: visit,
        expectedStatus,
        expectedUpdatedAt,
        statusConflictCode:
            "visit_status_conflict",
        versionConflictCode:
            "visit_version_conflict"
    });

    if (expectedError) {
        return { error: expectedError };
    }

    if (
        visit.tenant_confirmation_status !==
            expectedTenantConfirmationStatus
    ) {
        return {
            error: "tenant_confirmation_conflict"
        };
    }

    if (
        visit.tenant_confirmation_status ===
            "not_required" ||
        visit.tenant_confirmation_status ===
            "no_response"
    ) {
        return {
            error: "tenant_confirmation_conflict"
        };
    }

    const oldConfirmation =
        visit.tenant_confirmation_status;
    const now = new Date();

    const shouldConfirmVisitStatus =
        response === "confirmed" &&
        visit.status !== "confirmed";

    if (shouldConfirmVisitStatus) {
        await client.query(
            `
            UPDATE maintenance_visits
            SET
                status = 'confirmed',
                tenant_confirmation_status =
                    'confirmed',
                tenant_confirmed_by = $1::BIGINT,
                tenant_confirmed_at = $2::TIMESTAMPTZ,
                tenant_confirmation_note = $3::TEXT,
                status_changed_by = $1::BIGINT,
                status_changed_at = $2::TIMESTAMPTZ,
                status_change_reason =
                    'Tenant confirmed the visit schedule.'
            WHERE id = $4::BIGINT
            `,
            [
                authenticatedUser.id,
                now,
                note ?? null,
                visit.id
            ]
        );
    } else {
        await client.query(
            `
            UPDATE maintenance_visits
            SET
                tenant_confirmation_status =
                    $1::VARCHAR(30),
                tenant_confirmed_by = $2::BIGINT,
                tenant_confirmed_at = $3::TIMESTAMPTZ,
                tenant_confirmation_note = $4::TEXT
            WHERE id = $5::BIGINT
            `,
            [
                response,
                authenticatedUser.id,
                now,
                note ?? null,
                visit.id
            ]
        );
    }

    await recordManualActivity({
        client,
        requestId: access.request.id,
        activityType: "status_changed",
        oldValue: {
            visit_public_id: visit.public_id,
            tenant_confirmation_status:
                oldConfirmation
        },
        newValue: {
            visit_public_id: visit.public_id,
            tenant_confirmation_status:
                response
        },
        reason:
            note ||
            `Tenant ${response} the visit schedule.`,
        performedBy: authenticatedUser.id,
        metadata: {
            action:
                response === "confirmed"
                    ? "visit_schedule_confirmed"
                    : "visit_schedule_declined",
            visit_public_id: visit.public_id
        }
    });

    const updatedVisit = await getVisitByPublicId({
        client,
        requestId: access.request.id,
        visitPublicId:
            maintenanceVisitPublicId
    });

    return {
        error: null,
        access_context: access.accessContext,
        maintenance_visit:
            shapeVisit(updatedVisit)
    };
});

const changeVisitLifecycle = async ({
    maintenanceRequestPublicId,
    maintenanceVisitPublicId,
    expectedStatus,
    expectedUpdatedAt,
    accessContext,
    authenticatedUser,
    transition
}) => runSerializable(async client => {
    const access = await resolveRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: [
            "owner",
            "technician"
        ],
        ownerPermission:
            "can_assign_maintenance_work",
        lockRequest: true
    });

    if (access.error) {
        return access;
    }

    const visit = await getVisitByPublicId({
        client,
        requestId: access.request.id,
        visitPublicId:
            maintenanceVisitPublicId,
        lock: true
    });

    if (!visit) {
        return { error: "visit_not_found" };
    }

    const expectedError = checkExpectedRecord({
        record: visit,
        expectedStatus,
        expectedUpdatedAt,
        statusConflictCode:
            "visit_status_conflict",
        versionConflictCode:
            "visit_version_conflict"
    });

    if (expectedError) {
        return { error: expectedError };
    }

    const actorAllowed =
        await technicianCanActOnVisit({
            client,
            requestId: access.request.id,
            visit,
            authenticatedUser,
            accessContext:
                access.accessContext,
            lock: true
        });

    if (!actorAllowed) {
        return {
            error: "visit_actor_forbidden"
        };
    }

    const now = new Date();

    if (
        transition.name === "start" &&
        ![
            "under_review",
            "assigned",
            "in_progress"
        ].includes(access.request.status)
    ) {
        return {
            error: "request_status_conflict"
        };
    }

    if (transition.name === "reschedule") {
        const start = toDate(
            transition.scheduledStartAt
        );
        const end = toDate(
            transition.scheduledEndAt
        );
        const reported = toDate(
            access.request.reported_at
        );

        if (
            !start ||
            !end ||
            !reported ||
            start.getTime() < reported.getTime() ||
            end.getTime() <= start.getTime()
        ) {
            return { error: "schedule_conflict" };
        }

        await client.query(
            `
            UPDATE maintenance_visits
            SET
                scheduled_start_at =
                    $1::TIMESTAMPTZ,
                scheduled_end_at =
                    $2::TIMESTAMPTZ,
                status = 'rescheduled',
                tenant_confirmation_status =
                    CASE
                        WHEN tenant_confirmation_status =
                            'not_required'
                            THEN 'not_required'
                        ELSE 'pending'
                    END,
                tenant_confirmed_by = NULL,
                tenant_confirmed_at = NULL,
                tenant_confirmation_note = NULL,
                status_changed_by = $3::BIGINT,
                status_changed_at = $4::TIMESTAMPTZ,
                status_change_reason = $5::TEXT
            WHERE id = $6::BIGINT
            `,
            [
                transition.scheduledStartAt,
                transition.scheduledEndAt,
                authenticatedUser.id,
                now,
                transition.auditReason,
                visit.id
            ]
        );
    }

    if (transition.name === "start") {
        if (
            ![
                "not_required",
                "confirmed"
            ].includes(
                visit.tenant_confirmation_status
            )
        ) {
            return {
                error: "tenant_confirmation_conflict"
            };
        }

        const arrivalAt =
            transition.arrivalAt
                ? toDate(transition.arrivalAt)
                : now;

        const scheduledStart =
            toDate(visit.scheduled_start_at);

        if (
            !arrivalAt ||
            !scheduledStart ||
            arrivalAt.getTime() <
                scheduledStart.getTime()
        ) {
            return { error: "schedule_conflict" };
        }

        await client.query(
            `
            UPDATE maintenance_visits
            SET
                status = 'in_progress',
                arrival_at = $1::TIMESTAMPTZ,
                status_changed_by = $2::BIGINT,
                status_changed_at = $3::TIMESTAMPTZ,
                status_change_reason = $4::TEXT
            WHERE id = $5::BIGINT
            `,
            [
                arrivalAt,
                authenticatedUser.id,
                now,
                transition.auditReason,
                visit.id
            ]
        );
    }

    if (transition.name === "complete") {
        const departureAt =
            transition.departureAt
                ? toDate(transition.departureAt)
                : now;
        const arrivalAt = toDate(visit.arrival_at);

        if (
            !departureAt ||
            !arrivalAt ||
            departureAt.getTime() <
                arrivalAt.getTime()
        ) {
            return { error: "schedule_conflict" };
        }

        await client.query(
            `
            UPDATE maintenance_visits
            SET
                status = 'completed',
                departure_at = $1::TIMESTAMPTZ,
                completion_notes = $2::TEXT,
                status_changed_by = $3::BIGINT,
                status_changed_at = $4::TIMESTAMPTZ,
                status_change_reason = $2::TEXT
            WHERE id = $5::BIGINT
            `,
            [
                departureAt,
                transition.completionNotes,
                authenticatedUser.id,
                now,
                visit.id
            ]
        );
    }

    if (transition.name === "missed") {
        await client.query(
            `
            UPDATE maintenance_visits
            SET
                status = 'missed',
                missed_reason = $1::VARCHAR(50),
                missed_notes = $2::TEXT,
                status_changed_by = $3::BIGINT,
                status_changed_at = $4::TIMESTAMPTZ,
                status_change_reason = $5::TEXT
            WHERE id = $6::BIGINT
            `,
            [
                transition.missedReason,
                transition.missedNotes ?? null,
                authenticatedUser.id,
                now,
                transition.auditReason,
                visit.id
            ]
        );
    }

    if (transition.name === "cancel") {
        await client.query(
            `
            UPDATE maintenance_visits
            SET
                status = 'cancelled',
                cancelled_by = $1::BIGINT,
                cancelled_at = $2::TIMESTAMPTZ,
                cancellation_reason = $3::TEXT,
                status_changed_by = $1::BIGINT,
                status_changed_at = $2::TIMESTAMPTZ,
                status_change_reason = $3::TEXT
            WHERE id = $4::BIGINT
            `,
            [
                authenticatedUser.id,
                now,
                transition.auditReason,
                visit.id
            ]
        );
    }

    const updatedVisit = await getVisitByPublicId({
        client,
        requestId: access.request.id,
        visitPublicId:
            maintenanceVisitPublicId
    });

    const requestResult = await client.query(
        `
        SELECT status, updated_at
        FROM maintenance_requests
        WHERE id = $1::BIGINT
        `,
        [access.request.id]
    );

    return {
        error: null,
        access_context: access.accessContext,
        maintenance_request: {
            public_id: access.request.public_id,
            status:
                requestResult.rows[0].status,
            updated_at:
                requestResult.rows[0].updated_at
        },
        maintenance_visit:
            shapeVisit(updatedVisit)
    };
});

const rescheduleMaintenanceVisit = input =>
    changeVisitLifecycle({
        ...input,
        transition: {
            name: "reschedule",
            scheduledStartAt:
                input.scheduledStartAt,
            scheduledEndAt:
                input.scheduledEndAt,
            auditReason: input.reason
        }
    });

const startMaintenanceVisit = input =>
    changeVisitLifecycle({
        ...input,
        transition: {
            name: "start",
            arrivalAt: input.arrivalAt,
            auditReason: input.reason
        }
    });

const completeMaintenanceVisit = input =>
    changeVisitLifecycle({
        ...input,
        transition: {
            name: "complete",
            departureAt: input.departureAt,
            completionNotes:
                input.completionNotes
        }
    });

const markMaintenanceVisitMissed = input =>
    changeVisitLifecycle({
        ...input,
        transition: {
            name: "missed",
            missedReason: input.missedReason,
            missedNotes: input.missedNotes,
            auditReason: input.reason
        }
    });

const cancelMaintenanceVisit = input =>
    changeVisitLifecycle({
        ...input,
        transition: {
            name: "cancel",
            auditReason:
                input.cancellationReason
        }
    });

const getMaintenanceVisitHistory = async ({
    maintenanceRequestPublicId,
    maintenanceVisitPublicId,
    filters,
    authenticatedUser
}) => runRepeatableRead(async client => {
    const access = await resolveRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext: filters.access_context,
        allowedContexts: [
            "owner",
            "tenant",
            "technician"
        ],
        ownerPermission:
            "can_view_maintenance_requests"
    });

    if (access.error) {
        return access;
    }

    const visit = await getVisitByPublicId({
        client,
        requestId: access.request.id,
        visitPublicId:
            maintenanceVisitPublicId
    });

    if (!visit) {
        return { error: "visit_not_found" };
    }

    if (access.accessContext === "technician") {
        const canAct =
            await technicianCanActOnVisit({
                client,
                requestId: access.request.id,
                visit,
                authenticatedUser,
                accessContext:
                    access.accessContext
            });

        if (!canAct) {
            return { error: "visit_not_found" };
        }
    }

    const values = [visit.id];
    const conditions = [
        "mvh.maintenance_visit_id = $1::BIGINT"
    ];

    const addValue = value => {
        values.push(value);
        return `$${values.length}`;
    };

    if (filters.new_status !== undefined) {
        const placeholder = addValue(
            filters.new_status
        );
        conditions.push(
            `mvh.new_status = ${placeholder}::VARCHAR(20)`
        );
    }

    if (filters.changed_from !== undefined) {
        const placeholder = addValue(
            filters.changed_from
        );
        conditions.push(
            `mvh.changed_at >= ${placeholder}::TIMESTAMPTZ`
        );
    }

    if (filters.changed_to !== undefined) {
        const placeholder = addValue(
            filters.changed_to
        );
        conditions.push(
            `mvh.changed_at <= ${placeholder}::TIMESTAMPTZ`
        );
    }

    const { page, limit, offset } =
        normalizePagination(filters);

    const countResult = await client.query(
        `
        SELECT COUNT(*)::INTEGER AS total
        FROM maintenance_visit_history AS mvh
        WHERE ${conditions.join("\nAND ")}
        `,
        values
    );

    const total = countResult.rows[0].total;

    const limitPlaceholder = addValue(limit);
    const offsetPlaceholder = addValue(offset);
    const sortOrder =
        filters.sort_order === "asc"
            ? "ASC"
            : "DESC";

    const historyResult = await client.query(
        `
        SELECT
            mvh.public_id,
            mvh.old_status,
            mvh.new_status,
            mvh.old_schedule_start_at,
            mvh.old_schedule_end_at,
            mvh.new_schedule_start_at,
            mvh.new_schedule_end_at,
            mvh.reason,
            mvh.changed_at,
            mvh.metadata,
            changed_by_user.public_id
                AS changed_by_public_id,
            changed_by_user.full_name
                AS changed_by_full_name
        FROM maintenance_visit_history AS mvh
        LEFT JOIN users AS changed_by_user
            ON changed_by_user.id =
                mvh.changed_by
        WHERE ${conditions.join("\nAND ")}
        ORDER BY
            mvh.changed_at ${sortOrder},
            mvh.id ${sortOrder}
        LIMIT ${limitPlaceholder}::INTEGER
        OFFSET ${offsetPlaceholder}::INTEGER
        `,
        values
    );

    return {
        error: null,
        access_context: access.accessContext,
        maintenance_visit: {
            public_id: visit.public_id,
            status: visit.status,
            updated_at: visit.updated_at
        },
        pagination: buildPagination({
            page,
            limit,
            total
        }),
        maintenance_visit_history:
            historyResult.rows.map(
                shapeVisitHistory
            )
    };
});

module.exports = {
    createMaintenanceAssignment,
    getMaintenanceAssignments,
    getSingleMaintenanceAssignment,
    acceptMaintenanceAssignment,
    declineMaintenanceAssignment,
    activateMaintenanceAssignment,
    completeMaintenanceAssignment,
    revokeMaintenanceAssignment,

    createMaintenanceVisit,
    getMaintenanceVisits,
    getSingleMaintenanceVisit,
    respondToMaintenanceVisit,
    rescheduleMaintenanceVisit,
    startMaintenanceVisit,
    completeMaintenanceVisit,
    markMaintenanceVisitMissed,
    cancelMaintenanceVisit,
    getMaintenanceVisitHistory
};

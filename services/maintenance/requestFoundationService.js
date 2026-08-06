const pool = require("../../config/db");

const {
    resolveMaintenanceAccessContext,
    getAccessibleMaintenanceRequest,
    canViewInternalMaintenanceNotes
} = require(
    "./maintenanceAccessService"
);

const TERMINAL_STATUSES = new Set([
    "closed",
    "rejected",
    "cancelled"
]);

const EDITABLE_REQUEST_FIELDS = [
    "title",
    "description",
    "category",
    "priority",
    "impact_level",
    "location_details",
    "problem_started_at",
    "preferred_visit_at",
    "access_instruction"
];

const SLA_TARGET_FIELDS = [
    "target_review_at",
    "target_work_start_at",
    "target_resolution_at"
];

const OVERDUE_SORT_COLUMNS = {
    reported_at: "mr.reported_at",
    target_review_at: "mr.target_review_at",
    target_work_start_at:
        "mr.target_work_start_at",
    target_resolution_at:
        "mr.target_resolution_at"
};

const TENANT_ACTIVITY_TYPES = [
    "request_created",
    "request_updated",
    "status_changed",
    "assignment_created",
    "assignment_changed",
    "assignment_declined",
    "assignment_revoked",
    "visit_scheduled",
    "visit_rescheduled",
    "visit_started",
    "visit_completed",
    "visit_missed",
    "visit_cancelled",
    "request_resolved",
    "resolution_confirmed",
    "resolution_disputed",
    "request_closed",
    "request_cancelled",
    "request_rejected",
    "request_reopened",
    "unit_status_applied",
    "unit_status_released",
    "sla_target_changed",
    "maintenance_overdue",
    "emergency_escalated",
    "preventive_request_created"
];

const TECHNICIAN_ACTIVITY_TYPES = [
    ...TENANT_ACTIVITY_TYPES,
    "cost_created",
    "cost_submitted",
    "cost_approved",
    "cost_rejected",
    "cost_cancelled",
    "cost_incurred",
    "responsibility_determined",
    "responsibility_allocated"
];

const toNumber = value => {
    if (value === null || value === undefined) {
        return null;
    }

    const numericValue = Number(value);

    return Number.isNaN(numericValue)
        ? null
        : numericValue;
};

const toDateTime = value => {
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
    const firstDate = toDateTime(firstValue);
    const secondDate = toDateTime(secondValue);

    if (firstDate === null || secondDate === null) {
        return firstDate === secondDate;
    }

    return firstDate.getTime() ===
        secondDate.getTime();
};

const sameFieldValue = ({
    field,
    currentValue,
    suppliedValue
}) => {
    if (
        field.endsWith("_at") &&
        (
            currentValue !== null ||
            suppliedValue !== null
        )
    ) {
        return sameTimestamp(
            currentValue,
            suppliedValue
        );
    }

    return currentValue === suppliedValue;
};

const beginSerializable = client =>
    client.query(
        `
        BEGIN TRANSACTION
        ISOLATION LEVEL SERIALIZABLE
        `
    );

const beginRepeatableRead = client =>
    client.query(
        `
        BEGIN TRANSACTION
        ISOLATION LEVEL REPEATABLE READ
        READ ONLY
        `
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
    has_previous_page:
        page > 1,
    has_next_page:
        page * limit < total
});

const shapeRequestFoundation = row => ({
    public_id: row.public_id,
    request_number: row.request_number,
    request_scope: row.request_scope,
    request_source: row.request_source,

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

    reported_at: row.reported_at,
    target_review_at: row.target_review_at,
    target_work_start_at:
        row.target_work_start_at,
    target_resolution_at:
        row.target_resolution_at,

    review_overdue:
        Boolean(row.review_overdue),
    work_start_overdue:
        Boolean(row.work_start_overdue),
    resolution_overdue:
        Boolean(row.resolution_overdue),

    reviewed_at: row.reviewed_at,
    work_started_at: row.work_started_at,
    resolution_clock_paused_at:
        row.resolution_clock_paused_at,
    total_resolution_hold_seconds:
        toNumber(
            row.total_resolution_hold_seconds
        ) || 0,

    status_changed_at:
        row.status_changed_at,
    updated_at: row.updated_at
});

const selectRequestFoundationById = async ({
    client,
    requestId
}) => {
    const requestResult = await client.query(
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
            mr.reported_at,
            mr.target_review_at,
            mr.target_work_start_at,
            mr.target_resolution_at,
            mr.review_overdue,
            mr.work_start_overdue,
            mr.resolution_overdue,
            mr.reviewed_at,
            mr.work_started_at,
            mr.resolution_clock_paused_at,
            mr.total_resolution_hold_seconds,
            mr.status_changed_at,
            mr.updated_at
        FROM maintenance_requests AS mr
        WHERE mr.id = $1::BIGINT
        LIMIT 1
        `,
        [requestId]
    );

    return requestResult.rows[0] || null;
};


const refreshSlaFlagsIfNeeded = async ({
    client,
    requestId
}) => {
    const stateResult = await client.query(
        `
        SELECT
            mr.review_overdue,
            mr.work_start_overdue,
            mr.resolution_overdue,
            (
                mr.reviewed_at IS NULL
                AND mr.status NOT IN (
                    'rejected',
                    'cancelled',
                    'closed'
                )
                AND mr.target_review_at IS NOT NULL
                AND mr.target_review_at <
                    CURRENT_TIMESTAMP
            ) AS computed_review_overdue,
            (
                mr.work_started_at IS NULL
                AND mr.status NOT IN (
                    'rejected',
                    'cancelled',
                    'closed'
                )
                AND mr.target_work_start_at
                    IS NOT NULL
                AND mr.target_work_start_at <
                    CURRENT_TIMESTAMP
            ) AS computed_work_start_overdue,
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
                            mr.total_resolution_hold_seconds::DOUBLE PRECISION
                    )
                ) < CURRENT_TIMESTAMP
            ) AS computed_resolution_overdue
        FROM maintenance_requests AS mr
        WHERE mr.id = $1::BIGINT
        LIMIT 1
        FOR UPDATE OF mr
        `,
        [requestId]
    );

    if (stateResult.rows.length === 0) {
        return false;
    }

    const state = stateResult.rows[0];

    const requiresRefresh =
        Boolean(state.review_overdue) !==
            Boolean(
                state.computed_review_overdue
            ) ||
        Boolean(state.work_start_overdue) !==
            Boolean(
                state.computed_work_start_overdue
            ) ||
        Boolean(state.resolution_overdue) !==
            Boolean(
                state.computed_resolution_overdue
            );

    if (!requiresRefresh) {
        return false;
    }

    await client.query(
        `
        SELECT refresh_maintenance_sla_flags(
            $1::BIGINT
        )
        `,
        [requestId]
    );

    return true;
};

const recordActivity = async ({
    client,
    requestId,
    activityType,
    oldValue,
    newValue,
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

/*
 * PATCH /api/maintenance/requests/:id
 */
const updateMaintenanceRequestDetails = async ({
    maintenanceRequestPublicId,
    updateData,
    accessContext,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginSerializable(client);

        const accessResult =
            await getAccessibleMaintenanceRequest({
                client,
                maintenanceRequestPublicId,
                authenticatedUser,
                requestedAccessContext:
                    accessContext,
                allowedContexts: ["owner"],
                ownerPermission:
                    "can_update_maintenance_requests",
                lockRequest: true
            });

        if (
            accessResult.invalidAccessContext ||
            accessResult.requestNotFound
        ) {
            await client.query("ROLLBACK");
            return accessResult;
        }

        const currentRequest =
            accessResult.maintenance_request;

        if (
            TERMINAL_STATUSES.has(
                currentRequest.status
            )
        ) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: false,
                requestNotFound: false,
                lifecycleConflict: true
            };
        }

        if (
            !sameTimestamp(
                currentRequest.updated_at,
                updateData.expected_updated_at
            )
        ) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: false,
                requestNotFound: false,
                staleRequest: true,
                current_updated_at:
                    currentRequest.updated_at
            };
        }

        const changedFields =
            EDITABLE_REQUEST_FIELDS.filter(
                field =>
                    Object.prototype
                        .hasOwnProperty.call(
                            updateData,
                            field
                        ) &&
                    !sameFieldValue({
                        field,
                        currentValue:
                            currentRequest[field],
                        suppliedValue:
                            updateData[field]
                    })
            );

        if (changedFields.length === 0) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: false,
                requestNotFound: false,
                noChanges: true,
                maintenance_request:
                    shapeRequestFoundation(
                        currentRequest
                    )
            };
        }

        const values = [];
        const assignments = [];

        for (const field of changedFields) {
            values.push(updateData[field]);
            assignments.push(
                `${field} = $${values.length}`
            );
        }

        values.push(currentRequest.id);

        await client.query(
            `
            UPDATE maintenance_requests
            SET
                ${assignments.join(",\n                ")}
            WHERE id = $${values.length}::BIGINT
            `,
            values
        );

        const updatedRequest =
            await selectRequestFoundationById({
                client,
                requestId: currentRequest.id
            });

        const oldValue = {};
        const newValue = {};

        for (const field of changedFields) {
            oldValue[field] =
                currentRequest[field];
            newValue[field] =
                updatedRequest[field];
        }

        await recordActivity({
            client,
            requestId: currentRequest.id,
            activityType: "request_updated",
            oldValue,
            newValue,
            reason: updateData.reason,
            performedBy: authenticatedUser.id,
            metadata: {
                changed_fields: changedFields,
                access_context:
                    accessResult.access_context
            }
        });

        if (changedFields.includes("priority")) {
            await refreshSlaFlagsIfNeeded({
                client,
                requestId: currentRequest.id
            });
        }

        const finalRequest =
            await selectRequestFoundationById({
                client,
                requestId: currentRequest.id
            });

        await client.query("COMMIT");

        return {
            invalidAccessContext: false,
            requestNotFound: false,
            lifecycleConflict: false,
            staleRequest: false,
            noChanges: false,
            changed_fields: changedFields,
            maintenance_request:
                shapeRequestFoundation(
                    finalRequest
                )
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/*
 * GET /api/maintenance/requests/:id/status-history
 */
const getMaintenanceStatusHistory = async ({
    maintenanceRequestPublicId,
    filters,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginRepeatableRead(client);

        const accessResult =
            await getAccessibleMaintenanceRequest({
                client,
                maintenanceRequestPublicId,
                authenticatedUser,
                requestedAccessContext:
                    filters.access_context,
                allowedContexts: [
                    "owner",
                    "tenant",
                    "technician"
                ],
                ownerPermission:
                    "can_view_maintenance_requests"
            });

        if (
            accessResult.invalidAccessContext ||
            accessResult.requestNotFound
        ) {
            await client.query("ROLLBACK");
            return accessResult;
        }

        const {
            page,
            limit,
            offset
        } = normalizePagination(filters);

        const values = [
            accessResult.maintenance_request.id
        ];

        const conditions = [
            "msh.maintenance_request_id = $1::BIGINT"
        ];

        const addValue = value => {
            values.push(value);
            return `$${values.length}`;
        };

        if (filters.old_status !== undefined) {
            conditions.push(
                `msh.old_status = ${addValue(
                    filters.old_status
                )}::VARCHAR`
            );
        }

        if (filters.new_status !== undefined) {
            conditions.push(
                `msh.new_status = ${addValue(
                    filters.new_status
                )}::VARCHAR`
            );
        }

        if (filters.changed_from !== undefined) {
            conditions.push(
                `msh.changed_at >= ${addValue(
                    filters.changed_from
                )}::TIMESTAMPTZ`
            );
        }

        if (filters.changed_to !== undefined) {
            conditions.push(
                `msh.changed_at <= ${addValue(
                    filters.changed_to
                )}::TIMESTAMPTZ`
            );
        }

        const whereClause =
            conditions.join("\nAND ");

        const countResult = await client.query(
            `
            SELECT COUNT(*)::INTEGER AS total
            FROM maintenance_status_history AS msh
            WHERE ${whereClause}
            `,
            values
        );

        const total =
            countResult.rows[0].total;

        const dataValues = [
            ...values,
            limit,
            offset
        ];

        const limitPlaceholder =
            `$${values.length + 1}`;
        const offsetPlaceholder =
            `$${values.length + 2}`;

        const sortOrder =
            filters.sort_order === "asc"
                ? "ASC"
                : "DESC";

        const historyResult = await client.query(
            `
            SELECT
                msh.public_id,
                msh.old_status,
                msh.new_status,
                msh.reason,
                msh.changed_at,
                msh.metadata,
                actor.public_id
                    AS changed_by_public_id,
                actor.full_name
                    AS changed_by_full_name
            FROM maintenance_status_history AS msh
            LEFT JOIN users AS actor
                ON actor.id = msh.changed_by
            WHERE ${whereClause}
            ORDER BY
                msh.changed_at ${sortOrder},
                msh.id ${sortOrder}
            LIMIT ${limitPlaceholder}::INTEGER
            OFFSET ${offsetPlaceholder}::INTEGER
            `,
            dataValues
        );

        await client.query("COMMIT");

        return {
            invalidAccessContext: false,
            requestNotFound: false,
            access_context:
                accessResult.access_context,
            maintenance_request: {
                public_id:
                    accessResult
                        .maintenance_request
                        .public_id,
                request_number:
                    accessResult
                        .maintenance_request
                        .request_number
            },
            status_history:
                historyResult.rows,
            pagination: buildPagination({
                page,
                limit,
                total
            })
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const buildActivityVisibilityCondition = ({
    accessContext,
    canViewInternalNotes,
    addValue
}) => {
    if (
        accessContext === "admin" ||
        (
            accessContext === "owner" &&
            canViewInternalNotes
        )
    ) {
        return "TRUE";
    }

    if (accessContext === "owner") {
        return `
            (
                mah.activity_type NOT IN (
                    'comment_added',
                    'comment_hidden',
                    'attachment_added',
                    'attachment_revoked'
                )
                OR
                (
                    mah.activity_type = 'comment_added'
                    AND COALESCE(
                        mah.new_value->>'visibility',
                        ''
                    ) <> 'internal'
                )
                OR
                (
                    mah.activity_type = 'attachment_added'
                    AND COALESCE(
                        mah.new_value->>'visibility',
                        ''
                    ) <> 'internal'
                )
            )
        `;
    }

    const allowedTypes =
        accessContext === "technician"
            ? TECHNICIAN_ACTIVITY_TYPES
            : TENANT_ACTIVITY_TYPES;

    const typePlaceholders =
        allowedTypes.map(
            activityType =>
                `${addValue(activityType)}::VARCHAR`
        );

    const visibleValues =
        accessContext === "technician"
            ? ["technician_visible", "shared"]
            : ["tenant_visible", "shared"];

    const visibilityPlaceholders =
        visibleValues.map(
            visibility =>
                `${addValue(visibility)}::VARCHAR`
        );

    return `
        (
            mah.activity_type IN (
                ${typePlaceholders.join(", ")}
            )
            OR
            (
                mah.activity_type IN (
                    'comment_added',
                    'attachment_added'
                )
                AND mah.new_value->>'visibility' IN (
                    ${visibilityPlaceholders.join(", ")}
                )
            )
        )
    `;
};

/*
 * GET /api/maintenance/requests/:id/activity-history
 */
const getMaintenanceActivityHistory = async ({
    maintenanceRequestPublicId,
    filters,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginRepeatableRead(client);

        const accessResult =
            await getAccessibleMaintenanceRequest({
                client,
                maintenanceRequestPublicId,
                authenticatedUser,
                requestedAccessContext:
                    filters.access_context,
                allowedContexts: [
                    "owner",
                    "tenant",
                    "technician"
                ],
                ownerPermission:
                    "can_view_maintenance_requests"
            });

        if (
            accessResult.invalidAccessContext ||
            accessResult.requestNotFound
        ) {
            await client.query("ROLLBACK");
            return accessResult;
        }

        const internalNotesAllowed =
            await canViewInternalMaintenanceNotes({
                client,
                requestOwnerId:
                    accessResult
                        .maintenance_request
                        .owner_id,
                authenticatedUser,
                accessContext:
                    accessResult.access_context
            });

        const {
            page,
            limit,
            offset
        } = normalizePagination(filters);

        const values = [
            accessResult.maintenance_request.id
        ];

        const addValue = value => {
            values.push(value);
            return `$${values.length}`;
        };

        const conditions = [
            "mah.maintenance_request_id = $1::BIGINT"
        ];

        const visibilityCondition =
            buildActivityVisibilityCondition({
                accessContext:
                    accessResult.access_context,
                canViewInternalNotes:
                    internalNotesAllowed,
                addValue
            });

        conditions.push(
            `(${visibilityCondition})`
        );

        if (filters.activity_type !== undefined) {
            conditions.push(
                `mah.activity_type = ${addValue(
                    filters.activity_type
                )}::VARCHAR`
            );
        }

        if (filters.created_from !== undefined) {
            conditions.push(
                `mah.created_at >= ${addValue(
                    filters.created_from
                )}::TIMESTAMPTZ`
            );
        }

        if (filters.created_to !== undefined) {
            conditions.push(
                `mah.created_at <= ${addValue(
                    filters.created_to
                )}::TIMESTAMPTZ`
            );
        }

        const whereClause =
            conditions.join("\nAND ");

        const countResult = await client.query(
            `
            SELECT COUNT(*)::INTEGER AS total
            FROM maintenance_activity_history AS mah
            WHERE ${whereClause}
            `,
            values
        );

        const total =
            countResult.rows[0].total;

        const dataValues = [
            ...values,
            limit,
            offset
        ];

        const limitPlaceholder =
            `$${values.length + 1}`;
        const offsetPlaceholder =
            `$${values.length + 2}`;

        const sortOrder =
            filters.sort_order === "asc"
                ? "ASC"
                : "DESC";

        const historyResult = await client.query(
            `
            SELECT
                mah.public_id,
                mah.activity_type,
                mah.old_value,
                mah.new_value,
                mah.metadata,
                mah.reason,
                mah.created_at,
                actor.public_id
                    AS performed_by_public_id,
                actor.full_name
                    AS performed_by_full_name
            FROM maintenance_activity_history AS mah
            LEFT JOIN users AS actor
                ON actor.id = mah.performed_by
            WHERE ${whereClause}
            ORDER BY
                mah.created_at ${sortOrder},
                mah.id ${sortOrder}
            LIMIT ${limitPlaceholder}::INTEGER
            OFFSET ${offsetPlaceholder}::INTEGER
            `,
            dataValues
        );

        await client.query("COMMIT");

        return {
            invalidAccessContext: false,
            requestNotFound: false,
            access_context:
                accessResult.access_context,
            maintenance_request: {
                public_id:
                    accessResult
                        .maintenance_request
                        .public_id,
                request_number:
                    accessResult
                        .maintenance_request
                        .request_number
            },
            activity_history:
                historyResult.rows,
            pagination: buildPagination({
                page,
                limit,
                total
            })
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const validateEffectiveSlaOrder = request => {
    const reviewAt =
        toDateTime(request.target_review_at);
    const workStartAt =
        toDateTime(
            request.target_work_start_at
        );
    const resolutionAt =
        toDateTime(
            request.target_resolution_at
        );

    if (
        reviewAt &&
        workStartAt &&
        reviewAt.getTime() >
            workStartAt.getTime()
    ) {
        return false;
    }

    if (
        workStartAt &&
        resolutionAt &&
        workStartAt.getTime() >
            resolutionAt.getTime()
    ) {
        return false;
    }

    if (
        reviewAt &&
        resolutionAt &&
        reviewAt.getTime() >
            resolutionAt.getTime()
    ) {
        return false;
    }

    return true;
};

/*
 * PATCH /api/maintenance/requests/:id/sla-targets
 */
const updateMaintenanceSlaTargets = async ({
    maintenanceRequestPublicId,
    updateData,
    accessContext,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginSerializable(client);

        const accessResult =
            await getAccessibleMaintenanceRequest({
                client,
                maintenanceRequestPublicId,
                authenticatedUser,
                requestedAccessContext:
                    accessContext,
                allowedContexts: ["owner"],
                ownerPermission:
                    "can_update_maintenance_requests",
                lockRequest: true
            });

        if (
            accessResult.invalidAccessContext ||
            accessResult.requestNotFound
        ) {
            await client.query("ROLLBACK");
            return accessResult;
        }

        const currentRequest =
            accessResult.maintenance_request;

        if (
            TERMINAL_STATUSES.has(
                currentRequest.status
            )
        ) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: false,
                requestNotFound: false,
                lifecycleConflict: true
            };
        }

        if (
            !sameTimestamp(
                currentRequest.updated_at,
                updateData.expected_updated_at
            )
        ) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: false,
                requestNotFound: false,
                staleRequest: true,
                current_updated_at:
                    currentRequest.updated_at
            };
        }

        const effectiveTargets = {
            target_review_at:
                Object.prototype
                    .hasOwnProperty.call(
                        updateData,
                        "target_review_at"
                    )
                    ? updateData.target_review_at
                    : currentRequest
                        .target_review_at,
            target_work_start_at:
                Object.prototype
                    .hasOwnProperty.call(
                        updateData,
                        "target_work_start_at"
                    )
                    ? updateData
                        .target_work_start_at
                    : currentRequest
                        .target_work_start_at,
            target_resolution_at:
                Object.prototype
                    .hasOwnProperty.call(
                        updateData,
                        "target_resolution_at"
                    )
                    ? updateData
                        .target_resolution_at
                    : currentRequest
                        .target_resolution_at
        };

        if (
            !validateEffectiveSlaOrder(
                effectiveTargets
            )
        ) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: false,
                requestNotFound: false,
                invalidSlaTargets: true
            };
        }

        const changedFields =
            SLA_TARGET_FIELDS.filter(
                field =>
                    Object.prototype
                        .hasOwnProperty.call(
                            updateData,
                            field
                        ) &&
                    !sameTimestamp(
                        currentRequest[field],
                        updateData[field]
                    )
            );

        if (changedFields.length === 0) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: false,
                requestNotFound: false,
                noChanges: true,
                maintenance_request:
                    shapeRequestFoundation(
                        currentRequest
                    )
            };
        }

        const values = [];
        const assignments = [];

        for (const field of changedFields) {
            values.push(updateData[field]);
            assignments.push(
                `${field} = $${values.length}::TIMESTAMPTZ`
            );
        }

        values.push(currentRequest.id);

        await client.query(
            `
            UPDATE maintenance_requests
            SET
                ${assignments.join(",\n                ")}
            WHERE id = $${values.length}::BIGINT
            `,
            values
        );

        await refreshSlaFlagsIfNeeded({
            client,
            requestId: currentRequest.id
        });

        const updatedRequest =
            await selectRequestFoundationById({
                client,
                requestId: currentRequest.id
            });

        const oldValue = {};
        const newValue = {};

        for (const field of changedFields) {
            oldValue[field] =
                currentRequest[field];
            newValue[field] =
                updatedRequest[field];
        }

        await recordActivity({
            client,
            requestId: currentRequest.id,
            activityType:
                "sla_target_changed",
            oldValue,
            newValue,
            reason: updateData.reason,
            performedBy: authenticatedUser.id,
            metadata: {
                changed_fields: changedFields,
                access_context:
                    accessResult.access_context
            }
        });

        await client.query("COMMIT");

        return {
            invalidAccessContext: false,
            requestNotFound: false,
            lifecycleConflict: false,
            staleRequest: false,
            invalidSlaTargets: false,
            noChanges: false,
            changed_fields: changedFields,
            maintenance_request:
                shapeRequestFoundation(
                    updatedRequest
                )
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/*
 * POST /api/maintenance/requests/:id/escalate
 */
const escalateMaintenanceRequest = async ({
    maintenanceRequestPublicId,
    expectedPriority,
    reason,
    accessContext,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginSerializable(client);

        const accessResult =
            await getAccessibleMaintenanceRequest({
                client,
                maintenanceRequestPublicId,
                authenticatedUser,
                requestedAccessContext:
                    accessContext,
                allowedContexts: ["owner"],
                ownerPermission:
                    "can_change_maintenance_status",
                lockRequest: true
            });

        if (
            accessResult.invalidAccessContext ||
            accessResult.requestNotFound
        ) {
            await client.query("ROLLBACK");
            return accessResult;
        }

        const currentRequest =
            accessResult.maintenance_request;

        if (
            TERMINAL_STATUSES.has(
                currentRequest.status
            )
        ) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: false,
                requestNotFound: false,
                lifecycleConflict: true
            };
        }

        if (
            currentRequest.priority ===
                "emergency"
        ) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: false,
                requestNotFound: false,
                alreadyEmergency: true
            };
        }

        if (
            currentRequest.priority !==
                expectedPriority
        ) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: false,
                requestNotFound: false,
                priorityConflict: true,
                current_priority:
                    currentRequest.priority
            };
        }

        await client.query(
            `
            UPDATE maintenance_requests
            SET priority = 'emergency'
            WHERE id = $1::BIGINT
            `,
            [currentRequest.id]
        );

        await refreshSlaFlagsIfNeeded({
            client,
            requestId: currentRequest.id
        });

        const updatedRequest =
            await selectRequestFoundationById({
                client,
                requestId: currentRequest.id
            });

        await recordActivity({
            client,
            requestId: currentRequest.id,
            activityType:
                "emergency_escalated",
            oldValue: {
                priority:
                    currentRequest.priority,
                target_review_at:
                    currentRequest
                        .target_review_at,
                target_work_start_at:
                    currentRequest
                        .target_work_start_at,
                target_resolution_at:
                    currentRequest
                        .target_resolution_at
            },
            newValue: {
                priority:
                    updatedRequest.priority,
                target_review_at:
                    updatedRequest
                        .target_review_at,
                target_work_start_at:
                    updatedRequest
                        .target_work_start_at,
                target_resolution_at:
                    updatedRequest
                        .target_resolution_at
            },
            reason,
            performedBy: authenticatedUser.id,
            metadata: {
                access_context:
                    accessResult.access_context,
                manual_escalation: true
            }
        });

        await client.query("COMMIT");

        return {
            invalidAccessContext: false,
            requestNotFound: false,
            lifecycleConflict: false,
            alreadyEmergency: false,
            priorityConflict: false,
            maintenance_request:
                shapeRequestFoundation(
                    updatedRequest
                )
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const buildOverdueAccess = ({
    filters,
    authenticatedUser,
    accessContext
}) => {
    const values = [];
    const conditions = [
        `mr.status NOT IN (
            'closed',
            'rejected',
            'cancelled'
        )`
    ];

    const addValue = value => {
        values.push(value);
        return `$${values.length}`;
    };

    if (accessContext === "owner") {
        const userPlaceholder =
            addValue(authenticatedUser.id);

        conditions.push(`
            EXISTS (
                SELECT 1
                FROM owner_users AS access_ou
                WHERE access_ou.owner_id =
                        mr.owner_id
                  AND access_ou.user_id =
                        ${userPlaceholder}::BIGINT
                  AND access_ou.revoked_at IS NULL
                  AND (
                        access_ou.relationship_role =
                            'owner'
                        OR access_ou.is_primary = TRUE
                        OR access_ou
                            .can_view_maintenance_requests =
                                TRUE
                  )
            )
        `);
    }

    if (filters.owner_public_id !== undefined) {
        conditions.push(
            `o.public_id = ${addValue(
                filters.owner_public_id
            )}::VARCHAR`
        );
    }

    if (
        filters.property_public_id !== undefined
    ) {
        conditions.push(
            `p.public_id = ${addValue(
                filters.property_public_id
            )}::VARCHAR`
        );
    }

    if (filters.unit_public_id !== undefined) {
        conditions.push(
            `u.public_id = ${addValue(
                filters.unit_public_id
            )}::VARCHAR`
        );
    }

    if (filters.status !== undefined) {
        conditions.push(
            `mr.status = ${addValue(
                filters.status
            )}::VARCHAR`
        );
    }

    if (filters.priority !== undefined) {
        conditions.push(
            `mr.priority = ${addValue(
                filters.priority
            )}::VARCHAR`
        );
    }

    return {
        values,
        conditions,
        addValue
    };
};

const overdueConditionForType = overdueType => {
    switch (overdueType) {
        case "review":
            return "mr.review_overdue = TRUE";
        case "work_start":
            return "mr.work_start_overdue = TRUE";
        case "resolution":
            return "mr.resolution_overdue = TRUE";
        default:
            return `(
                mr.review_overdue = TRUE
                OR mr.work_start_overdue = TRUE
                OR mr.resolution_overdue = TRUE
            )`;
    }
};

/*
 * GET /api/maintenance/sla/overdue
 */
const getOverdueMaintenanceRequests = async ({
    filters,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginSerializable(client);

        const contextResult =
            resolveMaintenanceAccessContext({
                authenticatedUser,
                requestedAccessContext:
                    filters.access_context,
                allowedContexts: ["owner"]
            });

        if (contextResult.invalidAccessContext) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: true,
                maintenance_requests: []
            };
        }

        const access = buildOverdueAccess({
            filters,
            authenticatedUser,
            accessContext:
                contextResult.accessContext
        });

        /*
         * Refresh only requests whose SLA state may have changed.
         * Request rows are locked before the database helper writes
         * flags and immutable overdue activities.
         */
        const refreshCandidates =
            await client.query(
                `
                SELECT
                    mr.id,
                    mr.review_overdue,
                    mr.work_start_overdue,
                    mr.resolution_overdue,
                    (
                        mr.reviewed_at IS NULL
                        AND mr.target_review_at
                            IS NOT NULL
                        AND mr.target_review_at <
                            CURRENT_TIMESTAMP
                    ) AS computed_review_overdue,
                    (
                        mr.work_started_at IS NULL
                        AND mr.target_work_start_at
                            IS NOT NULL
                        AND mr.target_work_start_at <
                            CURRENT_TIMESTAMP
                    ) AS computed_work_start_overdue,
                    (
                        mr.status NOT IN (
                            'on_hold',
                            'resolved'
                        )
                        AND mr.target_resolution_at
                            IS NOT NULL
                        AND (
                            mr.target_resolution_at
                            + make_interval(
                                secs =>
                                    mr.total_resolution_hold_seconds::DOUBLE PRECISION
                            )
                        ) < CURRENT_TIMESTAMP
                    ) AS computed_resolution_overdue
                FROM maintenance_requests AS mr
                INNER JOIN owners AS o
                    ON o.id = mr.owner_id
                INNER JOIN properties AS p
                    ON p.id = mr.property_id
                LEFT JOIN units AS u
                    ON u.id = mr.unit_id
                WHERE
                    ${access.conditions.join(
                        "\nAND "
                    )}
                  AND (
                        (
                            mr.reviewed_at IS NULL
                            AND mr.target_review_at
                                IS NOT NULL
                            AND mr.target_review_at <
                                CURRENT_TIMESTAMP
                        )
                        OR
                        (
                            mr.work_started_at IS NULL
                            AND mr.target_work_start_at
                                IS NOT NULL
                            AND mr.target_work_start_at <
                                CURRENT_TIMESTAMP
                        )
                        OR
                        (
                            mr.status NOT IN (
                                'on_hold',
                                'resolved'
                            )
                            AND mr.target_resolution_at
                                IS NOT NULL
                            AND (
                                mr.target_resolution_at
                                + make_interval(
                                    secs =>
                                        mr.total_resolution_hold_seconds::DOUBLE PRECISION
                                )
                            ) < CURRENT_TIMESTAMP
                        )
                        OR mr.review_overdue = TRUE
                        OR mr.work_start_overdue = TRUE
                        OR mr.resolution_overdue = TRUE
                  )
                FOR UPDATE OF mr
                `,
                access.values
            );

        for (
            const row of refreshCandidates.rows
        ) {
            const requiresRefresh =
                Boolean(row.review_overdue) !==
                    Boolean(
                        row.computed_review_overdue
                    ) ||
                Boolean(row.work_start_overdue) !==
                    Boolean(
                        row.computed_work_start_overdue
                    ) ||
                Boolean(row.resolution_overdue) !==
                    Boolean(
                        row.computed_resolution_overdue
                    );

            if (requiresRefresh) {
                await client.query(
                    `
                    SELECT refresh_maintenance_sla_flags(
                        $1::BIGINT
                    )
                    `,
                    [row.id]
                );
            }
        }

        const {
            page,
            limit,
            offset
        } = normalizePagination(filters);

        const overdueConditions = [
            ...access.conditions,
            overdueConditionForType(
                filters.overdue_type || "any"
            )
        ];

        const whereClause =
            overdueConditions.join("\nAND ");

        const countResult = await client.query(
            `
            SELECT COUNT(*)::INTEGER AS total
            FROM maintenance_requests AS mr
            INNER JOIN owners AS o
                ON o.id = mr.owner_id
            INNER JOIN properties AS p
                ON p.id = mr.property_id
            LEFT JOIN units AS u
                ON u.id = mr.unit_id
            WHERE ${whereClause}
            `,
            access.values
        );

        const total =
            countResult.rows[0].total;

        const values = [
            ...access.values,
            limit,
            offset
        ];

        const limitPlaceholder =
            `$${access.values.length + 1}`;
        const offsetPlaceholder =
            `$${access.values.length + 2}`;

        const sortOrder =
            filters.sort_order === "asc"
                ? "ASC"
                : "DESC";

        let sortExpression;

        if (filters.sort_by === "priority") {
            sortExpression = `
                CASE mr.priority
                    WHEN 'low' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'high' THEN 3
                    WHEN 'emergency' THEN 4
                    ELSE 5
                END
            `;
        } else {
            sortExpression =
                OVERDUE_SORT_COLUMNS[
                    filters.sort_by
                ] || "mr.reported_at";
        }

        const requestsResult = await client.query(
            `
            SELECT
                mr.public_id,
                mr.request_number,
                mr.title,
                mr.category,
                mr.priority,
                mr.status,
                mr.impact_level,
                mr.reported_at,
                mr.target_review_at,
                mr.target_work_start_at,
                mr.target_resolution_at,
                mr.review_overdue,
                mr.work_start_overdue,
                mr.resolution_overdue,
                mr.updated_at,

                o.public_id AS owner_public_id,
                o.display_name AS owner_display_name,

                p.public_id AS property_public_id,
                p.property_name,

                u.public_id AS unit_public_id,
                u.unit_code
            FROM maintenance_requests AS mr
            INNER JOIN owners AS o
                ON o.id = mr.owner_id
            INNER JOIN properties AS p
                ON p.id = mr.property_id
            LEFT JOIN units AS u
                ON u.id = mr.unit_id
            WHERE ${whereClause}
            ORDER BY
                ${sortExpression} ${sortOrder}
                    NULLS LAST,
                mr.id DESC
            LIMIT ${limitPlaceholder}::INTEGER
            OFFSET ${offsetPlaceholder}::INTEGER
            `,
            values
        );

        const summaryResult = await client.query(
            `
            SELECT
                COUNT(*) FILTER (
                    WHERE mr.review_overdue = TRUE
                )::INTEGER AS review_overdue,
                COUNT(*) FILTER (
                    WHERE mr.work_start_overdue = TRUE
                )::INTEGER AS work_start_overdue,
                COUNT(*) FILTER (
                    WHERE mr.resolution_overdue = TRUE
                )::INTEGER AS resolution_overdue,
                COUNT(*) FILTER (
                    WHERE mr.priority = 'emergency'
                )::INTEGER AS emergency
            FROM maintenance_requests AS mr
            INNER JOIN owners AS o
                ON o.id = mr.owner_id
            INNER JOIN properties AS p
                ON p.id = mr.property_id
            LEFT JOIN units AS u
                ON u.id = mr.unit_id
            WHERE
                ${access.conditions.join(
                    "\nAND "
                )}
              AND (
                    mr.review_overdue = TRUE
                    OR mr.work_start_overdue = TRUE
                    OR mr.resolution_overdue = TRUE
              )
            `,
            access.values
        );

        await client.query("COMMIT");

        return {
            invalidAccessContext: false,
            access_context:
                contextResult.accessContext,
            maintenance_requests:
                requestsResult.rows,
            summary: summaryResult.rows[0],
            pagination: buildPagination({
                page,
                limit,
                total
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
 * POST /api/maintenance/requests/:id/unit-status-lock
 */
const applyMaintenanceUnitStatusLock = async ({
    maintenanceRequestPublicId,
    reason,
    accessContext,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginSerializable(client);

        const accessResult =
            await getAccessibleMaintenanceRequest({
                client,
                maintenanceRequestPublicId,
                authenticatedUser,
                requestedAccessContext:
                    accessContext,
                allowedContexts: ["owner"],
                ownerPermission:
                    "can_change_maintenance_status",
                lockRequest: true
            });

        if (
            accessResult.invalidAccessContext ||
            accessResult.requestNotFound
        ) {
            await client.query("ROLLBACK");
            return accessResult;
        }

        const currentRequest =
            accessResult.maintenance_request;

        if (
            TERMINAL_STATUSES.has(
                currentRequest.status
            )
        ) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: false,
                requestNotFound: false,
                lifecycleConflict: true
            };
        }

        if (
            currentRequest.request_scope !== "unit" ||
            currentRequest.unit_id === null ||
            currentRequest.impact_level !==
                "uninhabitable"
        ) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: false,
                requestNotFound: false,
                lockNotApplicable: true
            };
        }

        const existingLock = await client.query(
            `
            SELECT public_id
            FROM maintenance_unit_status_locks
            WHERE maintenance_request_id =
                    $1::BIGINT
              AND is_active = TRUE
            LIMIT 1
            FOR UPDATE
            `,
            [currentRequest.id]
        );

        if (existingLock.rows.length > 0) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: false,
                requestNotFound: false,
                unitStatusAlreadyLocked: true,
                unit_status_lock_public_id:
                    existingLock.rows[0]
                        .public_id
            };
        }

        const applyResult = await client.query(
            `
            SELECT apply_maintenance_unit_status(
                $1::BIGINT,
                $2::BIGINT,
                $3::TEXT
            ) AS lock_id
            `,
            [
                currentRequest.id,
                authenticatedUser.id,
                reason
            ]
        );

        const lockResult = await client.query(
            `
            SELECT
                musl.public_id,
                musl.restoration_status,
                musl.is_active,
                musl.applied_at,
                u.public_id AS unit_public_id,
                u.unit_code,
                u.operational_status
            FROM maintenance_unit_status_locks
                AS musl
            INNER JOIN units AS u
                ON u.id = musl.unit_id
            WHERE musl.id = $1::BIGINT
            LIMIT 1
            `,
            [applyResult.rows[0].lock_id]
        );

        await client.query("COMMIT");

        return {
            invalidAccessContext: false,
            requestNotFound: false,
            lifecycleConflict: false,
            lockNotApplicable: false,
            unitStatusAlreadyLocked: false,
            unit_status_lock:
                lockResult.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/*
 * POST /api/maintenance/requests/:id/unit-status-lock/release
 */
const releaseMaintenanceUnitStatusLock = async ({
    maintenanceRequestPublicId,
    reason,
    accessContext,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await beginSerializable(client);

        const accessResult =
            await getAccessibleMaintenanceRequest({
                client,
                maintenanceRequestPublicId,
                authenticatedUser,
                requestedAccessContext:
                    accessContext,
                allowedContexts: ["owner"],
                ownerPermission:
                    "can_change_maintenance_status",
                lockRequest: true
            });

        if (
            accessResult.invalidAccessContext ||
            accessResult.requestNotFound
        ) {
            await client.query("ROLLBACK");
            return accessResult;
        }

        const currentRequest =
            accessResult.maintenance_request;

        const activeLockResult =
            await client.query(
                `
                SELECT
                    musl.id,
                    musl.public_id,
                    musl.unit_id,
                    musl.restoration_status,
                    musl.applied_at
                FROM maintenance_unit_status_locks
                    AS musl
                WHERE musl.maintenance_request_id =
                        $1::BIGINT
                  AND musl.is_active = TRUE
                LIMIT 1
                FOR UPDATE
                `,
                [currentRequest.id]
            );

        if (activeLockResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return {
                invalidAccessContext: false,
                requestNotFound: false,
                activeUnitStatusLockNotFound: true
            };
        }

        const activeLock =
            activeLockResult.rows[0];

        await client.query(
            `
            SELECT release_maintenance_unit_status(
                $1::BIGINT,
                $2::BIGINT,
                $3::TEXT
            )
            `,
            [
                currentRequest.id,
                authenticatedUser.id,
                reason
            ]
        );

        const releasedLockResult =
            await client.query(
                `
                SELECT
                    musl.public_id,
                    musl.restoration_status,
                    musl.is_active,
                    musl.applied_at,
                    musl.released_at,
                    musl.release_reason,
                    u.public_id AS unit_public_id,
                    u.unit_code,
                    u.operational_status
                FROM maintenance_unit_status_locks
                    AS musl
                INNER JOIN units AS u
                    ON u.id = musl.unit_id
                WHERE musl.id = $1::BIGINT
                LIMIT 1
                `,
                [activeLock.id]
            );

        await client.query("COMMIT");

        return {
            invalidAccessContext: false,
            requestNotFound: false,
            activeUnitStatusLockNotFound: false,
            unit_status_lock:
                releasedLockResult.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    updateMaintenanceRequestDetails,
    getMaintenanceStatusHistory,
    getMaintenanceActivityHistory,
    updateMaintenanceSlaTargets,
    escalateMaintenanceRequest,
    getOverdueMaintenanceRequests,
    applyMaintenanceUnitStatusLock,
    releaseMaintenanceUnitStatusLock
};

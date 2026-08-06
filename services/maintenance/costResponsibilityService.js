const { nanoid } = require("nanoid");
const pool = require("../../config/db");

const {
    getAccessibleMaintenanceRequest
} = require("./maintenanceAccessService");

const COST_SORT_COLUMNS = {
    created_at: "mc.created_at",
    updated_at: "mc.updated_at",
    status: "mc.status",
    cost_type: "mc.cost_type",
    estimated_amount: "mc.estimated_amount",
    approved_amount: "mc.approved_amount",
    actual_amount: "mc.actual_amount",
    incurred_at: "mc.incurred_at"
};

const createCostPublicId = () =>
    `maintenance_cost_${nanoid(24)}`;

const createCostApprovalPublicId = () =>
    `maintenance_cost_approval_${nanoid(24)}`;

const createResponsibilityPublicId = () =>
    `maintenance_responsibility_${nanoid(24)}`;

const createAllocationPublicId = () =>
    `maintenance_responsibility_allocation_${nanoid(24)}`;

const toNumber = value => {
    if (value === null || value === undefined) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
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

const roundMoney = value =>
    Math.round((Number(value) + Number.EPSILON) * 100) /
        100;

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

const baseFailure = ({
    invalidAccessContext = false,
    requestNotFound = false,
    costNotFound = false,
    assignmentNotFound = false,
    approvalNotFound = false,
    responsibilityNotFound = false,
    allocationNotFound = false,
    tenantNotFound = false,
    concurrencyConflict = false,
    lifecycleConflict = false,
    currencyConflict = false,
    identifierConflict = false,
    conflictReason = null
} = {}) => ({
    invalidAccessContext,
    requestNotFound,
    costNotFound,
    assignmentNotFound,
    approvalNotFound,
    responsibilityNotFound,
    allocationNotFound,
    tenantNotFound,
    concurrencyConflict,
    lifecycleConflict,
    currencyConflict,
    identifierConflict,
    conflict_reason: conflictReason
});

const shapeCost = ({
    row,
    accessContext
}) => {
    const cost = {
        public_id: row.public_id,
        cost_type: row.cost_type,
        description: row.description,
        quantity: toNumber(row.quantity),
        unit_cost: toNumber(row.unit_cost),
        estimated_amount:
            toNumber(row.estimated_amount),
        approved_amount:
            toNumber(row.approved_amount),
        actual_amount:
            toNumber(row.actual_amount),
        currency_code: row.currency_code,
        status: row.status,
        incurred_at: row.incurred_at,
        status_changed_at:
            row.status_changed_at,
        created_at: row.created_at,
        updated_at: row.updated_at,

        assignment: row.assignment_public_id
            ? {
                public_id:
                    row.assignment_public_id,
                assignment_type:
                    row.assignment_type,
                status:
                    row.assignment_status,
                assigned_user_public_id:
                    row.assigned_user_public_id,
                assigned_user_full_name:
                    row.assigned_user_full_name,
                vendor_name: row.vendor_name,
                company_name: row.company_name
            }
            : null
    };

    if (
        accessContext === "admin" ||
        accessContext === "owner" ||
        accessContext === "technician"
    ) {
        cost.vendor_reference =
            row.vendor_reference;
        cost.quotation_reference =
            row.quotation_reference;
        cost.status_change_reason =
            row.status_change_reason;
        cost.recorded_by =
            row.recorded_by_public_id
                ? {
                    public_id:
                        row.recorded_by_public_id,
                    full_name:
                        row.recorded_by_full_name
                }
                : null;
        cost.status_changed_by =
            row.status_changed_by_public_id
                ? {
                    public_id:
                        row.status_changed_by_public_id,
                    full_name:
                        row.status_changed_by_full_name
                }
                : null;
    }

    if (row.latest_approval_public_id) {
        cost.latest_approval = {
            public_id:
                row.latest_approval_public_id,
            approval_type:
                row.latest_approval_type,
            submitted_amount:
                toNumber(
                    row.latest_approval_submitted_amount
                ),
            decision:
                row.latest_approval_decision,
            submitted_at:
                row.latest_approval_submitted_at,
            decided_at:
                row.latest_approval_decided_at
        };
    } else {
        cost.latest_approval = null;
    }

    return cost;
};

const shapeApproval = ({
    row,
    accessContext
}) => {
    const approval = {
        public_id: row.public_id,
        approval_type: row.approval_type,
        submitted_amount:
            toNumber(row.submitted_amount),
        decision: row.decision,
        submitted_at: row.submitted_at,
        decided_at: row.decided_at,
        created_at: row.created_at
    };

    if (
        accessContext === "admin" ||
        accessContext === "owner" ||
        accessContext === "technician"
    ) {
        approval.submission_note =
            row.submission_note;
        approval.decision_note =
            row.decision_note;
        approval.submitted_by =
            row.submitted_by_public_id
                ? {
                    public_id:
                        row.submitted_by_public_id,
                    full_name:
                        row.submitted_by_full_name
                }
                : null;
        approval.decided_by =
            row.decided_by_public_id
                ? {
                    public_id:
                        row.decided_by_public_id,
                    full_name:
                        row.decided_by_full_name
                }
                : null;
    }

    return approval;
};

const shapeResponsibility = row => {
    if (!row) {
        return null;
    }

    return {
        public_id: row.public_id,
        coverage_type: row.coverage_type,
        provider_name: row.provider_name,
        contract_or_policy_reference:
            row.contract_or_policy_reference,
        coverage_start_date:
            row.coverage_start_date,
        coverage_end_date:
            row.coverage_end_date,
        claim_reference: row.claim_reference,
        coverage_notes: row.coverage_notes,
        responsibility_status:
            row.responsibility_status,
        determined_by:
            row.determined_by_public_id
                ? {
                    public_id:
                        row.determined_by_public_id,
                    full_name:
                        row.determined_by_full_name
                }
                : null,
        determined_at: row.determined_at,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
};

const shapeAllocation = ({
    row,
    accessContext
}) => {
    const allocation = {
        public_id: row.public_id,
        party_type: row.party_type,
        tenant: row.tenant_public_id
            ? {
                public_id:
                    row.tenant_public_id,
                tenant_name:
                    row.tenant_name
            }
            : null,
        provider_name: row.provider_name,
        allocated_amount:
            toNumber(row.allocated_amount),
        allocation_percentage:
            toNumber(row.allocation_percentage),
        allocation_method:
            row.allocated_amount !== null
                ? "amount"
                : "percentage",
        reason: row.reason,
        approved_at: row.approved_at,
        revoked: row.revoked_at !== null,
        revoked_at: row.revoked_at,
        created_at: row.created_at
    };

    if (
        accessContext === "admin" ||
        accessContext === "owner"
    ) {
        allocation.approved_by =
            row.approved_by_public_id
                ? {
                    public_id:
                        row.approved_by_public_id,
                    full_name:
                        row.approved_by_full_name
                }
                : null;
        allocation.revoked_by =
            row.revoked_by_public_id
                ? {
                    public_id:
                        row.revoked_by_public_id,
                    full_name:
                        row.revoked_by_full_name
                }
                : null;
        allocation.revocation_reason =
            row.revocation_reason;
    }

    return allocation;
};

const getRequestAccess = async ({
    client,
    maintenanceRequestPublicId,
    authenticatedUser,
    accessContext,
    ownerPermission,
    allowedContexts,
    lockRequest
}) => getAccessibleMaintenanceRequest({
    client,
    maintenanceRequestPublicId,
    authenticatedUser,
    requestedAccessContext: accessContext,
    allowedContexts,
    ownerPermission,
    lockRequest
});

const checkExpectedRequestState = ({
    request,
    expectedStatus,
    expectedUpdatedAt
}) => {
    if (
        request.status !== expectedStatus ||
        !sameTimestamp(
            request.updated_at,
            expectedUpdatedAt
        )
    ) {
        return baseFailure({
            concurrencyConflict: true,
            conflictReason:
                "The maintenance request changed after it was read."
        });
    }

    return null;
};

const COST_SELECT = `
    SELECT
        mc.*,

        ma.public_id AS assignment_public_id,
        ma.assignment_type,
        ma.status AS assignment_status,
        ma.vendor_name,
        ma.company_name,

        assigned_user.public_id
            AS assigned_user_public_id,
        assigned_user.full_name
            AS assigned_user_full_name,

        recorded_by.public_id
            AS recorded_by_public_id,
        recorded_by.full_name
            AS recorded_by_full_name,

        status_actor.public_id
            AS status_changed_by_public_id,
        status_actor.full_name
            AS status_changed_by_full_name,

        latest_approval.public_id
            AS latest_approval_public_id,
        latest_approval.approval_type
            AS latest_approval_type,
        latest_approval.submitted_amount
            AS latest_approval_submitted_amount,
        latest_approval.decision
            AS latest_approval_decision,
        latest_approval.submitted_at
            AS latest_approval_submitted_at,
        latest_approval.decided_at
            AS latest_approval_decided_at

    FROM maintenance_costs AS mc

    LEFT JOIN maintenance_assignments AS ma
        ON ma.id = mc.assignment_id

    LEFT JOIN users AS assigned_user
        ON assigned_user.id = ma.assigned_user_id

    LEFT JOIN users AS recorded_by
        ON recorded_by.id = mc.recorded_by

    LEFT JOIN users AS status_actor
        ON status_actor.id = mc.status_changed_by

    LEFT JOIN LATERAL (
        SELECT
            mca.public_id,
            mca.approval_type,
            mca.submitted_amount,
            mca.decision,
            mca.submitted_at,
            mca.decided_at
        FROM maintenance_cost_approvals AS mca
        WHERE mca.maintenance_cost_id = mc.id
        ORDER BY
            mca.submitted_at DESC,
            mca.id DESC
        LIMIT 1
    ) AS latest_approval ON TRUE
`;

const fetchCostById = async ({
    client,
    costId,
    accessContext
}) => {
    const result = await client.query(
        `
        ${COST_SELECT}
        WHERE mc.id = $1::BIGINT
        LIMIT 1
        `,
        [costId]
    );

    return result.rows.length === 0
        ? null
        : shapeCost({
            row: result.rows[0],
            accessContext
        });
};

const fetchResponsibilityByRequestId = async ({
    client,
    requestId
}) => {
    const result = await client.query(
        `
        SELECT
            mr.*,
            actor.public_id
                AS determined_by_public_id,
            actor.full_name
                AS determined_by_full_name
        FROM maintenance_responsibilities AS mr
        LEFT JOIN users AS actor
            ON actor.id = mr.determined_by
        WHERE mr.maintenance_request_id = $1::BIGINT
        LIMIT 1
        `,
        [requestId]
    );

    return result.rows[0] || null;
};

const createMaintenanceCost = async ({
    maintenanceRequestPublicId,
    costData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const accessResult = await getRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: ["owner"],
        ownerPermission:
            "can_manage_maintenance_costs",
        lockRequest: true
    });

    if (
        accessResult.invalidAccessContext ||
        accessResult.requestNotFound
    ) {
        return {
            ...baseFailure(accessResult),
            ...accessResult
        };
    }

    const request =
        accessResult.maintenance_request;

    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                costData.expected_request_status,
            expectedUpdatedAt:
                costData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    if (
        ["closed", "rejected", "cancelled"]
            .includes(request.status)
    ) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "A cost cannot be created for a terminal maintenance request."
        });
    }

    let assignmentId = null;

    if (costData.assignment_public_id) {
        const assignmentResult = await client.query(
            `
            SELECT id
            FROM maintenance_assignments
            WHERE public_id = $1::VARCHAR(60)
              AND maintenance_request_id = $2::BIGINT
            LIMIT 1
            `,
            [
                costData.assignment_public_id,
                request.id
            ]
        );

        if (assignmentResult.rows.length === 0) {
            return baseFailure({
                assignmentNotFound: true
            });
        }

        assignmentId =
            assignmentResult.rows[0].id;
    }

    if (
        costData.currency_code !==
            request.currency_code
    ) {
        return baseFailure({
            currencyConflict: true,
            conflictReason:
                "Maintenance cost currency must match the request currency."
        });
    }

    const quantity = Number(costData.quantity);
    const unitCost = Number(costData.unit_cost);
    const estimatedAmount = roundMoney(
        quantity * unitCost
    );

    let insertedRow = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const insertResult = await client.query(
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
                    vendor_reference,
                    quotation_reference,
                    recorded_by,
                    created_at,
                    updated_at
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
                    'draft',
                    $10,
                    $11,
                    $12,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                RETURNING id
                `,
                [
                    createCostPublicId(),
                    request.id,
                    assignmentId,
                    costData.cost_type,
                    costData.description,
                    quantity,
                    unitCost,
                    estimatedAmount,
                    costData.currency_code,
                    costData.vendor_reference ?? null,
                    costData.quotation_reference ?? null,
                    authenticatedUser.id
                ]
            );

            insertedRow = insertResult.rows[0];
            break;
        } catch (error) {
            if (error.code !== "23505") {
                throw error;
            }
        }
    }

    if (!insertedRow) {
        return baseFailure({
            identifierConflict: true
        });
    }

    return {
        ...baseFailure(),
        access_context:
            accessResult.access_context,
        maintenance_cost:
            await fetchCostById({
                client,
                costId: insertedRow.id,
                accessContext:
                    accessResult.access_context
            })
    };
});

const getMaintenanceCosts = async ({
    maintenanceRequestPublicId,
    filters,
    authenticatedUser
}) => runRepeatableRead(async client => {
    const accessResult = await getRequestAccess({
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
            "can_view_maintenance_requests",
        lockRequest: false
    });

    if (
        accessResult.invalidAccessContext ||
        accessResult.requestNotFound
    ) {
        return {
            ...baseFailure(accessResult),
            ...accessResult
        };
    }

    const request =
        accessResult.maintenance_request;
    const { page, limit, offset } =
        normalizePagination(filters);

    const values = [request.id];
    const conditions = [
        "mc.maintenance_request_id = $1::BIGINT"
    ];

    const addValue = value => {
        values.push(value);
        return `$${values.length}`;
    };

    if (filters.status !== undefined) {
        const placeholder = addValue(
            filters.status
        );
        conditions.push(
            `mc.status = ${placeholder}`
        );
    }

    if (filters.cost_type !== undefined) {
        const placeholder = addValue(
            filters.cost_type
        );
        conditions.push(
            `mc.cost_type = ${placeholder}`
        );
    }

    if (
        filters.assignment_public_id !==
        undefined
    ) {
        const placeholder = addValue(
            filters.assignment_public_id
        );
        conditions.push(
            `ma.public_id = ${placeholder}`
        );
    }

    if (filters.currency_code !== undefined) {
        const placeholder = addValue(
            filters.currency_code
        );
        conditions.push(
            `mc.currency_code = ${placeholder}`
        );
    }

    if (filters.created_from !== undefined) {
        const placeholder = addValue(
            filters.created_from
        );
        conditions.push(
            `mc.created_at >= ${placeholder}::TIMESTAMPTZ`
        );
    }

    if (filters.created_to !== undefined) {
        const placeholder = addValue(
            filters.created_to
        );
        conditions.push(
            `mc.created_at <= ${placeholder}::TIMESTAMPTZ`
        );
    }

    const whereClause =
        conditions.join("\nAND ");

    const countResult = await client.query(
        `
        SELECT COUNT(*)::INTEGER AS total
        FROM maintenance_costs AS mc
        LEFT JOIN maintenance_assignments AS ma
            ON ma.id = mc.assignment_id
        WHERE ${whereClause}
        `,
        values
    );

    const total = countResult.rows[0].total;
    const sortColumn =
        COST_SORT_COLUMNS[filters.sort_by] ||
        COST_SORT_COLUMNS.created_at;
    const sortOrder = filters.sort_order === "asc"
        ? "ASC"
        : "DESC";

    const dataValues = [
        ...values,
        limit,
        offset
    ];

    const result = await client.query(
        `
        ${COST_SELECT}
        WHERE ${whereClause}
        ORDER BY
            ${sortColumn} ${sortOrder} NULLS LAST,
            mc.id ${sortOrder}
        LIMIT $${values.length + 1}::INTEGER
        OFFSET $${values.length + 2}::INTEGER
        `,
        dataValues
    );

    const filteredSummaryResult =
        await client.query(
            `
            SELECT
                COALESCE(
                    SUM(mc.estimated_amount), 0
                ) AS estimated_total,
                COALESCE(
                    SUM(mc.approved_amount), 0
                ) AS approved_total,
                COALESCE(
                    SUM(mc.actual_amount), 0
                ) AS actual_total
            FROM maintenance_costs AS mc
            LEFT JOIN maintenance_assignments AS ma
                ON ma.id = mc.assignment_id
            WHERE ${whereClause}
            `,
            values
        );

    return {
        ...baseFailure(),
        access_context:
            accessResult.access_context,
        maintenance_costs:
            result.rows.map(row =>
                shapeCost({
                    row,
                    accessContext:
                        accessResult.access_context
                })
            ),
        pagination: buildPagination({
            page,
            limit,
            total
        }),
        summary: {
            filtered_estimated_total:
                toNumber(
                    filteredSummaryResult.rows[0]
                        .estimated_total
                ),
            filtered_approved_total:
                toNumber(
                    filteredSummaryResult.rows[0]
                        .approved_total
                ),
            filtered_actual_total:
                toNumber(
                    filteredSummaryResult.rows[0]
                        .actual_total
                ),
            request_estimated_total:
                toNumber(
                    request.total_estimated_cost
                ),
            request_approved_total:
                toNumber(
                    request.total_approved_cost
                ),
            request_actual_total:
                toNumber(
                    request.total_actual_cost
                ),
            currency_code:
                request.currency_code
        }
    };
});

const getSingleMaintenanceCost = async ({
    maintenanceRequestPublicId,
    maintenanceCostPublicId,
    accessContext,
    authenticatedUser
}) => runRepeatableRead(async client => {
    const accessResult = await getRequestAccess({
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
            "can_view_maintenance_requests",
        lockRequest: false
    });

    if (
        accessResult.invalidAccessContext ||
        accessResult.requestNotFound
    ) {
        return {
            ...baseFailure(accessResult),
            ...accessResult
        };
    }

    const result = await client.query(
        `
        ${COST_SELECT}
        WHERE mc.public_id = $1::VARCHAR(60)
          AND mc.maintenance_request_id = $2::BIGINT
        LIMIT 1
        `,
        [
            maintenanceCostPublicId,
            accessResult.maintenance_request.id
        ]
    );

    if (result.rows.length === 0) {
        return baseFailure({
            costNotFound: true
        });
    }

    return {
        ...baseFailure(),
        access_context:
            accessResult.access_context,
        maintenance_cost: shapeCost({
            row: result.rows[0],
            accessContext:
                accessResult.access_context
        })
    };
});

const updateMaintenanceCost = async ({
    maintenanceRequestPublicId,
    maintenanceCostPublicId,
    updateData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const accessResult = await getRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: ["owner"],
        ownerPermission:
            "can_manage_maintenance_costs",
        lockRequest: true
    });

    if (
        accessResult.invalidAccessContext ||
        accessResult.requestNotFound
    ) {
        return {
            ...baseFailure(accessResult),
            ...accessResult
        };
    }

    const costResult = await client.query(
        `
        SELECT *
        FROM maintenance_costs
        WHERE public_id = $1::VARCHAR(60)
          AND maintenance_request_id = $2::BIGINT
        FOR UPDATE
        `,
        [
            maintenanceCostPublicId,
            accessResult.maintenance_request.id
        ]
    );

    if (costResult.rows.length === 0) {
        return baseFailure({
            costNotFound: true
        });
    }

    const cost = costResult.rows[0];

    if (
        cost.status !== updateData.expected_status ||
        !sameTimestamp(
            cost.updated_at,
            updateData.expected_updated_at
        )
    ) {
        return baseFailure({
            concurrencyConflict: true,
            conflictReason:
                "The maintenance cost changed after it was read."
        });
    }

    if (cost.status !== "draft") {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "Only a draft maintenance cost can be updated."
        });
    }

    const quantity =
        updateData.quantity !== undefined
            ? Number(updateData.quantity)
            : Number(cost.quantity);
    const unitCost =
        updateData.unit_cost !== undefined
            ? Number(updateData.unit_cost)
            : Number(cost.unit_cost);
    const currencyCode =
        updateData.currency_code !== undefined
            ? updateData.currency_code
            : cost.currency_code;

    if (
        currencyCode !==
        accessResult.maintenance_request.currency_code
    ) {
        return baseFailure({
            currencyConflict: true,
            conflictReason:
                "Maintenance cost currency must match the request currency."
        });
    }

    const updatedResult = await client.query(
        `
        UPDATE maintenance_costs
        SET
            description = COALESCE(
                $1::TEXT,
                description
            ),
            quantity = $2::NUMERIC(12, 3),
            unit_cost = $3::NUMERIC(14, 2),
            estimated_amount = $4::NUMERIC(14, 2),
            currency_code = $5::VARCHAR(3),
            vendor_reference = CASE
                WHEN $6::BOOLEAN THEN $7::VARCHAR(255)
                ELSE vendor_reference
            END,
            quotation_reference = CASE
                WHEN $8::BOOLEAN THEN $9::VARCHAR(255)
                ELSE quotation_reference
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $10::BIGINT
        RETURNING id
        `,
        [
            updateData.description ?? null,
            quantity,
            unitCost,
            roundMoney(quantity * unitCost),
            currencyCode,
            Object.prototype.hasOwnProperty.call(
                updateData,
                "vendor_reference"
            ),
            updateData.vendor_reference ?? null,
            Object.prototype.hasOwnProperty.call(
                updateData,
                "quotation_reference"
            ),
            updateData.quotation_reference ?? null,
            cost.id
        ]
    );

    return {
        ...baseFailure(),
        access_context:
            accessResult.access_context,
        maintenance_cost:
            await fetchCostById({
                client,
                costId: updatedResult.rows[0].id,
                accessContext:
                    accessResult.access_context
            })
    };
});

const lockCostForLifecycle = async ({
    client,
    requestId,
    maintenanceCostPublicId,
    expectedStatus,
    expectedUpdatedAt
}) => {
    const result = await client.query(
        `
        SELECT *
        FROM maintenance_costs
        WHERE public_id = $1::VARCHAR(60)
          AND maintenance_request_id = $2::BIGINT
        FOR UPDATE
        `,
        [maintenanceCostPublicId, requestId]
    );

    if (result.rows.length === 0) {
        return {
            failure: baseFailure({
                costNotFound: true
            }),
            cost: null
        };
    }

    const cost = result.rows[0];

    if (
        cost.status !== expectedStatus ||
        !sameTimestamp(
            cost.updated_at,
            expectedUpdatedAt
        )
    ) {
        return {
            failure: baseFailure({
                concurrencyConflict: true,
                conflictReason:
                    "The maintenance cost changed after it was read."
            }),
            cost: null
        };
    }

    return {
        failure: null,
        cost
    };
};

const insertCostApproval = async ({
    client,
    costId,
    approvalType,
    submittedAmount,
    submissionNote,
    authenticatedUser
}) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const result = await client.query(
                `
                INSERT INTO maintenance_cost_approvals (
                    public_id,
                    maintenance_cost_id,
                    approval_type,
                    submitted_amount,
                    decision,
                    submission_note,
                    submitted_by,
                    submitted_at,
                    created_at
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    'pending',
                    $5,
                    $6,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                RETURNING *
                `,
                [
                    createCostApprovalPublicId(),
                    costId,
                    approvalType,
                    submittedAmount,
                    submissionNote ?? null,
                    authenticatedUser.id
                ]
            );

            return result.rows[0];
        } catch (error) {
            if (error.code !== "23505") {
                throw error;
            }
        }
    }

    return null;
};

const fetchApprovalById = async ({
    client,
    approvalId,
    accessContext
}) => {
    const result = await client.query(
        `
        SELECT
            mca.*,
            submitter.public_id
                AS submitted_by_public_id,
            submitter.full_name
                AS submitted_by_full_name,
            decider.public_id
                AS decided_by_public_id,
            decider.full_name
                AS decided_by_full_name
        FROM maintenance_cost_approvals AS mca
        INNER JOIN users AS submitter
            ON submitter.id = mca.submitted_by
        LEFT JOIN users AS decider
            ON decider.id = mca.decided_by
        WHERE mca.id = $1::BIGINT
        LIMIT 1
        `,
        [approvalId]
    );

    return result.rows.length === 0
        ? null
        : shapeApproval({
            row: result.rows[0],
            accessContext
        });
};

const submitMaintenanceCost = async ({
    maintenanceRequestPublicId,
    maintenanceCostPublicId,
    submissionData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const accessResult = await getRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: ["owner"],
        ownerPermission:
            "can_manage_maintenance_costs",
        lockRequest: true
    });

    if (
        accessResult.invalidAccessContext ||
        accessResult.requestNotFound
    ) {
        return {
            ...baseFailure(accessResult),
            ...accessResult
        };
    }

    const lockResult = await lockCostForLifecycle({
        client,
        requestId:
            accessResult.maintenance_request.id,
        maintenanceCostPublicId,
        expectedStatus:
            submissionData.expected_status,
        expectedUpdatedAt:
            submissionData.expected_updated_at
    });

    if (lockResult.failure) {
        return lockResult.failure;
    }

    if (lockResult.cost.status !== "draft") {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "Only a draft maintenance cost can be submitted."
        });
    }

    const statusReason =
        submissionData.submission_note ||
        "Maintenance cost submitted for approval.";

    await client.query(
        `
        UPDATE maintenance_costs
        SET
            status = 'submitted',
            status_changed_by = $1::BIGINT,
            status_changed_at = CURRENT_TIMESTAMP,
            status_change_reason = $2::TEXT,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3::BIGINT
        `,
        [
            authenticatedUser.id,
            statusReason,
            lockResult.cost.id
        ]
    );

    const approval = await insertCostApproval({
        client,
        costId: lockResult.cost.id,
        approvalType: "initial",
        submittedAmount:
            submissionData.submitted_amount,
        submissionNote:
            submissionData.submission_note,
        authenticatedUser
    });

    if (!approval) {
        return baseFailure({
            identifierConflict: true
        });
    }

    return {
        ...baseFailure(),
        access_context:
            accessResult.access_context,
        maintenance_cost:
            await fetchCostById({
                client,
                costId: lockResult.cost.id,
                accessContext:
                    accessResult.access_context
            }),
        cost_approval:
            await fetchApprovalById({
                client,
                approvalId: approval.id,
                accessContext:
                    accessResult.access_context
            })
    };
});

const decideMaintenanceCost = async ({
    decision,
    ownerPermission,
    maintenanceRequestPublicId,
    maintenanceCostPublicId,
    decisionData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const accessResult = await getRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: ["owner"],
        ownerPermission,
        lockRequest: true
    });

    if (
        accessResult.invalidAccessContext ||
        accessResult.requestNotFound
    ) {
        return {
            ...baseFailure(accessResult),
            ...accessResult
        };
    }

    const lockResult = await lockCostForLifecycle({
        client,
        requestId:
            accessResult.maintenance_request.id,
        maintenanceCostPublicId,
        expectedStatus:
            decisionData.expected_status,
        expectedUpdatedAt:
            decisionData.expected_updated_at
    });

    if (lockResult.failure) {
        return lockResult.failure;
    }

    if (
        !["submitted", "approved"].includes(
            lockResult.cost.status
        )
    ) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "The maintenance cost is not awaiting an approval decision."
        });
    }

    const approvalResult = await client.query(
        `
        SELECT *
        FROM maintenance_cost_approvals
        WHERE maintenance_cost_id = $1::BIGINT
          AND decision = 'pending'
        ORDER BY submitted_at DESC, id DESC
        LIMIT 1
        FOR UPDATE
        `,
        [lockResult.cost.id]
    );

    if (approvalResult.rows.length === 0) {
        return baseFailure({
            approvalNotFound: true,
            lifecycleConflict: true,
            conflictReason:
                "No pending cost approval exists for this maintenance cost."
        });
    }

    const approval = approvalResult.rows[0];

    const updateResult = await client.query(
        `
        UPDATE maintenance_cost_approvals
        SET
            decision = $1::VARCHAR(20),
            decided_by = $2::BIGINT,
            decided_at = CURRENT_TIMESTAMP,
            decision_note = $3::TEXT
        WHERE id = $4::BIGINT
        RETURNING id
        `,
        [
            decision,
            authenticatedUser.id,
            decisionData.decision_note,
            approval.id
        ]
    );

    return {
        ...baseFailure(),
        access_context:
            accessResult.access_context,
        maintenance_cost:
            await fetchCostById({
                client,
                costId: lockResult.cost.id,
                accessContext:
                    accessResult.access_context
            }),
        cost_approval:
            await fetchApprovalById({
                client,
                approvalId: updateResult.rows[0].id,
                accessContext:
                    accessResult.access_context
            })
    };
});

const approveMaintenanceCost = options =>
    decideMaintenanceCost({
        ...options,
        decision: "approved",
        ownerPermission:
            "can_approve_maintenance_costs"
    });

const rejectMaintenanceCost = options =>
    decideMaintenanceCost({
        ...options,
        decision: "rejected",
        ownerPermission:
            "can_approve_maintenance_costs"
    });

const cancelMaintenanceCost = async ({
    maintenanceRequestPublicId,
    maintenanceCostPublicId,
    cancellationData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const accessResult = await getRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: ["owner"],
        ownerPermission:
            "can_manage_maintenance_costs",
        lockRequest: true
    });

    if (
        accessResult.invalidAccessContext ||
        accessResult.requestNotFound
    ) {
        return {
            ...baseFailure(accessResult),
            ...accessResult
        };
    }

    const lockResult = await lockCostForLifecycle({
        client,
        requestId:
            accessResult.maintenance_request.id,
        maintenanceCostPublicId,
        expectedStatus:
            cancellationData.expected_status,
        expectedUpdatedAt:
            cancellationData.expected_updated_at
    });

    if (lockResult.failure) {
        return lockResult.failure;
    }

    if (
        !["draft", "submitted", "approved"]
            .includes(lockResult.cost.status)
    ) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "The maintenance cost cannot be cancelled from its current status."
        });
    }

    const pendingApprovalResult =
        await client.query(
            `
            SELECT id
            FROM maintenance_cost_approvals
            WHERE maintenance_cost_id = $1::BIGINT
              AND decision = 'pending'
            ORDER BY submitted_at DESC, id DESC
            LIMIT 1
            FOR UPDATE
            `,
            [lockResult.cost.id]
        );

    let decidedApprovalId = null;

    if (pendingApprovalResult.rows.length > 0) {
        decidedApprovalId =
            pendingApprovalResult.rows[0].id;

        await client.query(
            `
            UPDATE maintenance_cost_approvals
            SET
                decision = 'cancelled',
                decided_by = $1::BIGINT,
                decided_at = CURRENT_TIMESTAMP,
                decision_note = $2::TEXT
            WHERE id = $3::BIGINT
            `,
            [
                authenticatedUser.id,
                cancellationData.cancellation_reason,
                decidedApprovalId
            ]
        );
    }

    const currentCostResult = await client.query(
        `
        SELECT status
        FROM maintenance_costs
        WHERE id = $1::BIGINT
        FOR UPDATE
        `,
        [lockResult.cost.id]
    );

    if (
        currentCostResult.rows[0].status !==
        "cancelled"
    ) {
        await client.query(
            `
            UPDATE maintenance_costs
            SET
                status = 'cancelled',
                status_changed_by = $1::BIGINT,
                status_changed_at = CURRENT_TIMESTAMP,
                status_change_reason = $2::TEXT,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3::BIGINT
            `,
            [
                authenticatedUser.id,
                cancellationData.cancellation_reason,
                lockResult.cost.id
            ]
        );
    }

    return {
        ...baseFailure(),
        access_context:
            accessResult.access_context,
        maintenance_cost:
            await fetchCostById({
                client,
                costId: lockResult.cost.id,
                accessContext:
                    accessResult.access_context
            }),
        cost_approval:
            decidedApprovalId
                ? await fetchApprovalById({
                    client,
                    approvalId:
                        decidedApprovalId,
                    accessContext:
                        accessResult.access_context
                })
                : null
    };
});

const incurMaintenanceCost = async ({
    maintenanceRequestPublicId,
    maintenanceCostPublicId,
    incurrenceData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const accessResult = await getRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: ["owner"],
        ownerPermission:
            "can_manage_maintenance_costs",
        lockRequest: true
    });

    if (
        accessResult.invalidAccessContext ||
        accessResult.requestNotFound
    ) {
        return {
            ...baseFailure(accessResult),
            ...accessResult
        };
    }

    const lockResult = await lockCostForLifecycle({
        client,
        requestId:
            accessResult.maintenance_request.id,
        maintenanceCostPublicId,
        expectedStatus:
            incurrenceData.expected_status,
        expectedUpdatedAt:
            incurrenceData.expected_updated_at
    });

    if (lockResult.failure) {
        return lockResult.failure;
    }

    if (lockResult.cost.status !== "approved") {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "Only an approved maintenance cost can be incurred."
        });
    }

    if (
        Number(incurrenceData.actual_amount) >
        Number(lockResult.cost.approved_amount)
    ) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "Actual cost exceeds the currently approved amount. An additional or correction approval is required first."
        });
    }

    const incurredAt =
        toDate(incurrenceData.incurred_at);
    const createdAt =
        toDate(lockResult.cost.created_at);

    if (
        incurredAt &&
        createdAt &&
        incurredAt.getTime() < createdAt.getTime()
    ) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "The incurred-at timestamp cannot be before cost creation."
        });
    }

    await client.query(
        `
        UPDATE maintenance_costs
        SET
            status = 'incurred',
            actual_amount = $1::NUMERIC(14, 2),
            incurred_at = $2::TIMESTAMPTZ,
            status_changed_by = $3::BIGINT,
            status_changed_at = CURRENT_TIMESTAMP,
            status_change_reason = $4::TEXT,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5::BIGINT
        `,
        [
            incurrenceData.actual_amount,
            incurrenceData.incurred_at,
            authenticatedUser.id,
            incurrenceData.reason,
            lockResult.cost.id
        ]
    );

    return {
        ...baseFailure(),
        access_context:
            accessResult.access_context,
        maintenance_cost:
            await fetchCostById({
                client,
                costId: lockResult.cost.id,
                accessContext:
                    accessResult.access_context
            })
    };
});

const getMaintenanceCostApprovalHistory = async ({
    maintenanceRequestPublicId,
    maintenanceCostPublicId,
    filters,
    authenticatedUser
}) => runRepeatableRead(async client => {
    const accessResult = await getRequestAccess({
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
            "can_view_maintenance_requests",
        lockRequest: false
    });

    if (
        accessResult.invalidAccessContext ||
        accessResult.requestNotFound
    ) {
        return {
            ...baseFailure(accessResult),
            ...accessResult
        };
    }

    const costResult = await client.query(
        `
        SELECT id
        FROM maintenance_costs
        WHERE public_id = $1::VARCHAR(60)
          AND maintenance_request_id = $2::BIGINT
        LIMIT 1
        `,
        [
            maintenanceCostPublicId,
            accessResult.maintenance_request.id
        ]
    );

    if (costResult.rows.length === 0) {
        return baseFailure({
            costNotFound: true
        });
    }

    const { page, limit, offset } =
        normalizePagination(filters);
    const values = [costResult.rows[0].id];
    const conditions = [
        "mca.maintenance_cost_id = $1::BIGINT"
    ];

    const addValue = value => {
        values.push(value);
        return `$${values.length}`;
    };

    if (filters.approval_type !== undefined) {
        const placeholder = addValue(
            filters.approval_type
        );
        conditions.push(
            `mca.approval_type = ${placeholder}`
        );
    }

    if (filters.decision !== undefined) {
        const placeholder = addValue(
            filters.decision
        );
        conditions.push(
            `mca.decision = ${placeholder}`
        );
    }

    if (filters.submitted_from !== undefined) {
        const placeholder = addValue(
            filters.submitted_from
        );
        conditions.push(
            `mca.submitted_at >= ${placeholder}::TIMESTAMPTZ`
        );
    }

    if (filters.submitted_to !== undefined) {
        const placeholder = addValue(
            filters.submitted_to
        );
        conditions.push(
            `mca.submitted_at <= ${placeholder}::TIMESTAMPTZ`
        );
    }

    const whereClause =
        conditions.join("\nAND ");

    const countResult = await client.query(
        `
        SELECT COUNT(*)::INTEGER AS total
        FROM maintenance_cost_approvals AS mca
        WHERE ${whereClause}
        `,
        values
    );

    const total = countResult.rows[0].total;
    const sortOrder = filters.sort_order === "asc"
        ? "ASC"
        : "DESC";

    const result = await client.query(
        `
        SELECT
            mca.*,
            submitter.public_id
                AS submitted_by_public_id,
            submitter.full_name
                AS submitted_by_full_name,
            decider.public_id
                AS decided_by_public_id,
            decider.full_name
                AS decided_by_full_name
        FROM maintenance_cost_approvals AS mca
        INNER JOIN users AS submitter
            ON submitter.id = mca.submitted_by
        LEFT JOIN users AS decider
            ON decider.id = mca.decided_by
        WHERE ${whereClause}
        ORDER BY
            mca.submitted_at ${sortOrder},
            mca.id ${sortOrder}
        LIMIT $${values.length + 1}::INTEGER
        OFFSET $${values.length + 2}::INTEGER
        `,
        [
            ...values,
            limit,
            offset
        ]
    );

    return {
        ...baseFailure(),
        access_context:
            accessResult.access_context,
        cost_approvals:
            result.rows.map(row =>
                shapeApproval({
                    row,
                    accessContext:
                        accessResult.access_context
                })
            ),
        pagination: buildPagination({
            page,
            limit,
            total
        })
    };
});

const determineMaintenanceResponsibility = async ({
    maintenanceRequestPublicId,
    responsibilityData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const accessResult = await getRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: ["owner"],
        ownerPermission:
            "can_manage_maintenance_costs",
        lockRequest: true
    });

    if (
        accessResult.invalidAccessContext ||
        accessResult.requestNotFound
    ) {
        return {
            ...baseFailure(accessResult),
            ...accessResult
        };
    }

    const request =
        accessResult.maintenance_request;
    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                responsibilityData.expected_request_status,
            expectedUpdatedAt:
                responsibilityData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    const existingResult = await client.query(
        `
        SELECT *
        FROM maintenance_responsibilities
        WHERE maintenance_request_id = $1::BIGINT
        FOR UPDATE
        `,
        [request.id]
    );

    const existing =
        existingResult.rows[0] || null;
    const updating =
        responsibilityData.responsibility_public_id !==
            undefined &&
        responsibilityData.responsibility_public_id !==
            null;

    if (updating) {
        if (
            !existing ||
            existing.public_id !==
                responsibilityData
                    .responsibility_public_id
        ) {
            return baseFailure({
                responsibilityNotFound: true
            });
        }

        if (
            !sameTimestamp(
                existing.updated_at,
                responsibilityData
                    .expected_responsibility_updated_at
            )
        ) {
            return baseFailure({
                concurrencyConflict: true,
                conflictReason:
                    "The responsibility determination changed after it was read."
            });
        }
    } else if (existing) {
        return baseFailure({
            concurrencyConflict: true,
            conflictReason:
                "A responsibility determination already exists. Supply its public ID and expected updated-at timestamp to update it."
        });
    }

    const determined =
        responsibilityData.responsibility_status !==
        "pending_review";

    let responsibilityId = null;

    if (existing) {
        const result = await client.query(
            `
            UPDATE maintenance_responsibilities
            SET
                coverage_type = $1,
                provider_name = $2,
                contract_or_policy_reference = $3,
                coverage_start_date = $4::DATE,
                coverage_end_date = $5::DATE,
                claim_reference = $6,
                coverage_notes = $7,
                responsibility_status = $8,
                determined_by = $9::BIGINT,
                determined_at = $10::TIMESTAMPTZ,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $11::BIGINT
            RETURNING id
            `,
            [
                responsibilityData.coverage_type,
                responsibilityData.provider_name ?? null,
                responsibilityData
                    .contract_or_policy_reference ?? null,
                responsibilityData.coverage_start_date ?? null,
                responsibilityData.coverage_end_date ?? null,
                responsibilityData.claim_reference ?? null,
                responsibilityData.coverage_notes ?? null,
                responsibilityData.responsibility_status,
                determined
                    ? authenticatedUser.id
                    : null,
                determined
                    ? new Date()
                    : null,
                existing.id
            ]
        );

        responsibilityId = result.rows[0].id;
    } else {
        for (
            let attempt = 0;
            attempt < 3;
            attempt += 1
        ) {
            try {
                const result = await client.query(
                    `
                    INSERT INTO maintenance_responsibilities (
                        public_id,
                        maintenance_request_id,
                        coverage_type,
                        provider_name,
                        contract_or_policy_reference,
                        coverage_start_date,
                        coverage_end_date,
                        claim_reference,
                        coverage_notes,
                        responsibility_status,
                        determined_by,
                        determined_at,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6::DATE,
                        $7::DATE,
                        $8,
                        $9,
                        $10,
                        $11::BIGINT,
                        $12::TIMESTAMPTZ,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    RETURNING id
                    `,
                    [
                        createResponsibilityPublicId(),
                        request.id,
                        responsibilityData.coverage_type,
                        responsibilityData.provider_name ?? null,
                        responsibilityData
                            .contract_or_policy_reference ?? null,
                        responsibilityData.coverage_start_date ?? null,
                        responsibilityData.coverage_end_date ?? null,
                        responsibilityData.claim_reference ?? null,
                        responsibilityData.coverage_notes ?? null,
                        responsibilityData.responsibility_status,
                        determined
                            ? authenticatedUser.id
                            : null,
                        determined
                            ? new Date()
                            : null
                    ]
                );

                responsibilityId =
                    result.rows[0].id;
                break;
            } catch (error) {
                if (error.code !== "23505") {
                    throw error;
                }
            }
        }

        if (!responsibilityId) {
            return baseFailure({
                identifierConflict: true
            });
        }
    }

    const responsibility =
        await fetchResponsibilityByRequestId({
            client,
            requestId: request.id
        });

    return {
        ...baseFailure(),
        access_context:
            accessResult.access_context,
        maintenance_responsibility:
            shapeResponsibility(responsibility)
    };
});

const createMaintenanceResponsibilityAllocation = async ({
    maintenanceRequestPublicId,
    allocationData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const accessResult = await getRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: ["owner"],
        ownerPermission:
            "can_manage_maintenance_costs",
        lockRequest: true
    });

    if (
        accessResult.invalidAccessContext ||
        accessResult.requestNotFound
    ) {
        return {
            ...baseFailure(accessResult),
            ...accessResult
        };
    }

    const request =
        accessResult.maintenance_request;
    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                allocationData.expected_request_status,
            expectedUpdatedAt:
                allocationData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    const responsibilityResult =
        await client.query(
            `
            SELECT *
            FROM maintenance_responsibilities
            WHERE public_id = $1::VARCHAR(70)
              AND maintenance_request_id = $2::BIGINT
            FOR UPDATE
            `,
            [
                allocationData.responsibility_public_id,
                request.id
            ]
        );

    if (responsibilityResult.rows.length === 0) {
        return baseFailure({
            responsibilityNotFound: true
        });
    }

    const responsibility =
        responsibilityResult.rows[0];

    if (
        !sameTimestamp(
            responsibility.updated_at,
            allocationData
                .expected_responsibility_updated_at
        )
    ) {
        return baseFailure({
            concurrencyConflict: true,
            conflictReason:
                "The responsibility determination changed after it was read."
        });
    }

    let tenantId = null;

    if (allocationData.party_type === "tenant") {
        const tenantResult = await client.query(
            `
            SELECT id
            FROM tenants
            WHERE public_id = $1::VARCHAR(50)
              AND id = $2::BIGINT
              AND deleted_at IS NULL
            LIMIT 1
            `,
            [
                allocationData.tenant_public_id,
                request.tenant_id
            ]
        );

        if (tenantResult.rows.length === 0) {
            return baseFailure({
                tenantNotFound: true
            });
        }

        tenantId = tenantResult.rows[0].id;
    }

    let allocationId = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const result = await client.query(
                `
                INSERT INTO maintenance_responsibility_allocations (
                    public_id,
                    maintenance_responsibility_id,
                    party_type,
                    tenant_id,
                    provider_name,
                    allocated_amount,
                    allocation_percentage,
                    reason,
                    approved_by,
                    approved_at,
                    created_at
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6::NUMERIC(14, 2),
                    $7::NUMERIC(7, 4),
                    $8,
                    $9,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                RETURNING id
                `,
                [
                    createAllocationPublicId(),
                    responsibility.id,
                    allocationData.party_type,
                    tenantId,
                    allocationData.provider_name ?? null,
                    allocationData.allocated_amount ?? null,
                    allocationData.allocation_percentage ?? null,
                    allocationData.reason,
                    authenticatedUser.id
                ]
            );

            allocationId = result.rows[0].id;
            break;
        } catch (error) {
            if (error.code !== "23505") {
                throw error;
            }
        }
    }

    if (!allocationId) {
        return baseFailure({
            identifierConflict: true
        });
    }

    await client.query(
        `
        UPDATE maintenance_responsibilities
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::BIGINT
        `,
        [responsibility.id]
    );

    const allocationResult = await client.query(
        `
        SELECT
            mra.*,
            t.public_id AS tenant_public_id,
            t.display_name AS tenant_name,
            approver.public_id
                AS approved_by_public_id,
            approver.full_name
                AS approved_by_full_name,
            revoker.public_id
                AS revoked_by_public_id,
            revoker.full_name
                AS revoked_by_full_name
        FROM maintenance_responsibility_allocations AS mra
        LEFT JOIN tenants AS t
            ON t.id = mra.tenant_id
        INNER JOIN users AS approver
            ON approver.id = mra.approved_by
        LEFT JOIN users AS revoker
            ON revoker.id = mra.revoked_by
        WHERE mra.id = $1::BIGINT
        LIMIT 1
        `,
        [allocationId]
    );

    return {
        ...baseFailure(),
        access_context:
            accessResult.access_context,
        responsibility_allocation:
            shapeAllocation({
                row: allocationResult.rows[0],
                accessContext:
                    accessResult.access_context
            }),
        maintenance_responsibility:
            shapeResponsibility(
                await fetchResponsibilityByRequestId({
                    client,
                    requestId: request.id
                })
            )
    };
});

const getMaintenanceResponsibilityAllocations = async ({
    maintenanceRequestPublicId,
    filters,
    authenticatedUser
}) => runRepeatableRead(async client => {
    const accessResult = await getRequestAccess({
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
            "can_view_maintenance_requests",
        lockRequest: false
    });

    if (
        accessResult.invalidAccessContext ||
        accessResult.requestNotFound
    ) {
        return {
            ...baseFailure(accessResult),
            ...accessResult
        };
    }

    const responsibility =
        await fetchResponsibilityByRequestId({
            client,
            requestId:
                accessResult.maintenance_request.id
        });

    if (!responsibility) {
        return baseFailure({
            responsibilityNotFound: true
        });
    }

    const { page, limit, offset } =
        normalizePagination(filters);
    const values = [responsibility.id];
    const conditions = [
        "mra.maintenance_responsibility_id = $1::BIGINT"
    ];

    const addValue = value => {
        values.push(value);
        return `$${values.length}`;
    };

    if (!filters.include_revoked) {
        conditions.push("mra.revoked_at IS NULL");
    }

    if (filters.party_type !== undefined) {
        const placeholder = addValue(
            filters.party_type
        );
        conditions.push(
            `mra.party_type = ${placeholder}`
        );
    }

    if (filters.allocation_method === "amount") {
        conditions.push(
            "mra.allocated_amount IS NOT NULL"
        );
    }

    if (
        filters.allocation_method === "percentage"
    ) {
        conditions.push(
            "mra.allocation_percentage IS NOT NULL"
        );
    }

    const whereClause =
        conditions.join("\nAND ");

    const countResult = await client.query(
        `
        SELECT COUNT(*)::INTEGER AS total
        FROM maintenance_responsibility_allocations
            AS mra
        WHERE ${whereClause}
        `,
        values
    );

    const total = countResult.rows[0].total;
    const sortOrder = filters.sort_order === "asc"
        ? "ASC"
        : "DESC";

    const result = await client.query(
        `
        SELECT
            mra.*,
            t.public_id AS tenant_public_id,
            t.display_name AS tenant_name,
            approver.public_id
                AS approved_by_public_id,
            approver.full_name
                AS approved_by_full_name,
            revoker.public_id
                AS revoked_by_public_id,
            revoker.full_name
                AS revoked_by_full_name
        FROM maintenance_responsibility_allocations
            AS mra
        LEFT JOIN tenants AS t
            ON t.id = mra.tenant_id
        INNER JOIN users AS approver
            ON approver.id = mra.approved_by
        LEFT JOIN users AS revoker
            ON revoker.id = mra.revoked_by
        WHERE ${whereClause}
        ORDER BY
            mra.approved_at ${sortOrder},
            mra.id ${sortOrder}
        LIMIT $${values.length + 1}::INTEGER
        OFFSET $${values.length + 2}::INTEGER
        `,
        [
            ...values,
            limit,
            offset
        ]
    );

    return {
        ...baseFailure(),
        access_context:
            accessResult.access_context,
        maintenance_responsibility:
            shapeResponsibility(responsibility),
        responsibility_allocations:
            result.rows.map(row =>
                shapeAllocation({
                    row,
                    accessContext:
                        accessResult.access_context
                })
            ),
        pagination: buildPagination({
            page,
            limit,
            total
        })
    };
});

const revokeMaintenanceResponsibilityAllocation = async ({
    maintenanceRequestPublicId,
    maintenanceResponsibilityAllocationPublicId,
    revocationData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const accessResult = await getRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: ["owner"],
        ownerPermission:
            "can_manage_maintenance_costs",
        lockRequest: true
    });

    if (
        accessResult.invalidAccessContext ||
        accessResult.requestNotFound
    ) {
        return {
            ...baseFailure(accessResult),
            ...accessResult
        };
    }

    const request =
        accessResult.maintenance_request;
    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                revocationData.expected_request_status,
            expectedUpdatedAt:
                revocationData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    const responsibilityResult =
        await client.query(
            `
            SELECT *
            FROM maintenance_responsibilities
            WHERE public_id = $1::VARCHAR(70)
              AND maintenance_request_id = $2::BIGINT
            FOR UPDATE
            `,
            [
                revocationData.responsibility_public_id,
                request.id
            ]
        );

    if (responsibilityResult.rows.length === 0) {
        return baseFailure({
            responsibilityNotFound: true
        });
    }

    const responsibility =
        responsibilityResult.rows[0];

    if (
        !sameTimestamp(
            responsibility.updated_at,
            revocationData
                .expected_responsibility_updated_at
        )
    ) {
        return baseFailure({
            concurrencyConflict: true,
            conflictReason:
                "The responsibility determination changed after it was read."
        });
    }

    const allocationResult = await client.query(
        `
        SELECT *
        FROM maintenance_responsibility_allocations
        WHERE public_id = $1::VARCHAR(80)
          AND maintenance_responsibility_id =
                $2::BIGINT
        FOR UPDATE
        `,
        [
            maintenanceResponsibilityAllocationPublicId,
            responsibility.id
        ]
    );

    if (allocationResult.rows.length === 0) {
        return baseFailure({
            allocationNotFound: true
        });
    }

    if (
        allocationResult.rows[0].revoked_at !== null
    ) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "The responsibility allocation is already revoked."
        });
    }

    await client.query(
        `
        UPDATE maintenance_responsibility_allocations
        SET
            revoked_at = CURRENT_TIMESTAMP,
            revoked_by = $1::BIGINT,
            revocation_reason = $2::TEXT
        WHERE id = $3::BIGINT
        `,
        [
            authenticatedUser.id,
            revocationData.revocation_reason,
            allocationResult.rows[0].id
        ]
    );

    await client.query(
        `
        UPDATE maintenance_responsibilities
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::BIGINT
        `,
        [responsibility.id]
    );

    const shapedResult = await client.query(
        `
        SELECT
            mra.*,
            t.public_id AS tenant_public_id,
            t.display_name AS tenant_name,
            approver.public_id
                AS approved_by_public_id,
            approver.full_name
                AS approved_by_full_name,
            revoker.public_id
                AS revoked_by_public_id,
            revoker.full_name
                AS revoked_by_full_name
        FROM maintenance_responsibility_allocations
            AS mra
        LEFT JOIN tenants AS t
            ON t.id = mra.tenant_id
        INNER JOIN users AS approver
            ON approver.id = mra.approved_by
        LEFT JOIN users AS revoker
            ON revoker.id = mra.revoked_by
        WHERE mra.id = $1::BIGINT
        LIMIT 1
        `,
        [allocationResult.rows[0].id]
    );

    return {
        ...baseFailure(),
        access_context:
            accessResult.access_context,
        responsibility_allocation:
            shapeAllocation({
                row: shapedResult.rows[0],
                accessContext:
                    accessResult.access_context
            }),
        maintenance_responsibility:
            shapeResponsibility(
                await fetchResponsibilityByRequestId({
                    client,
                    requestId: request.id
                })
            )
    };
});

module.exports = {
    createMaintenanceCost,
    getMaintenanceCosts,
    getSingleMaintenanceCost,
    updateMaintenanceCost,
    submitMaintenanceCost,
    approveMaintenanceCost,
    rejectMaintenanceCost,
    cancelMaintenanceCost,
    incurMaintenanceCost,
    getMaintenanceCostApprovalHistory,
    determineMaintenanceResponsibility,
    createMaintenanceResponsibilityAllocation,
    getMaintenanceResponsibilityAllocations,
    revokeMaintenanceResponsibilityAllocation
};

const { nanoid } = require("nanoid");
const pool = require("../../config/db");

const {
    getAccessibleMaintenanceRequest,
    canViewInternalMaintenanceNotes
} = require("./maintenanceAccessService");

const createCommentPublicId = () =>
    `maintenance_comment_${nanoid(24)}`;

const createAttachmentPublicId = () =>
    `maintenance_attachment_${nanoid(24)}`;

const createResolutionPublicId = () =>
    `maintenance_resolution_${nanoid(24)}`;

const createReopenPublicId = () =>
    `maintenance_reopen_${nanoid(24)}`;

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

const forceDeferredChecks = client =>
    client.query("SET CONSTRAINTS ALL IMMEDIATE");

const baseFailure = ({
    invalidAccessContext = false,
    requestNotFound = false,
    commentNotFound = false,
    attachmentNotFound = false,
    childContextNotFound = false,
    resolutionNotFound = false,
    reopenRequestNotFound = false,
    concurrencyConflict = false,
    lifecycleConflict = false,
    visibilityConflict = false,
    deadlineConflict = false,
    identifierConflict = false,
    conflictReason = null
} = {}) => ({
    invalidAccessContext,
    requestNotFound,
    commentNotFound,
    attachmentNotFound,
    childContextNotFound,
    resolutionNotFound,
    reopenRequestNotFound,
    concurrencyConflict,
    lifecycleConflict,
    visibilityConflict,
    deadlineConflict,
    identifierConflict,
    conflict_reason: conflictReason
});

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

const shapeRequestSummary = row => ({
    public_id: row.public_id,
    request_number: row.request_number,
    status: row.status,
    resolution_confirmation_status:
        row.resolution_confirmation_status,
    resolution_confirmation_deadline_at:
        row.resolution_confirmation_deadline_at,
    total_actual_cost:
        row.total_actual_cost === null
            ? null
            : Number(row.total_actual_cost),
    coverage_type: row.coverage_type,
    responsibility_status:
        row.responsibility_status,
    status_changed_at: row.status_changed_at,
    updated_at: row.updated_at
});

const fetchRequestSummary = async ({
    client,
    requestId
}) => {
    const result = await client.query(
        `
        SELECT
            public_id,
            request_number,
            status,
            resolution_confirmation_status,
            resolution_confirmation_deadline_at,
            total_actual_cost,
            coverage_type,
            responsibility_status,
            status_changed_at,
            updated_at
        FROM maintenance_requests
        WHERE id = $1::BIGINT
        LIMIT 1
        `,
        [requestId]
    );

    return result.rows.length === 0
        ? null
        : shapeRequestSummary(result.rows[0]);
};

const getInternalNotePermission = async ({
    client,
    request,
    authenticatedUser,
    accessContext
}) => canViewInternalMaintenanceNotes({
    client,
    requestOwnerId: request.owner_id,
    authenticatedUser,
    accessContext
});

const canExposeHiddenOrRevoked = ({
    accessContext,
    canViewInternal
}) =>
    accessContext === "admin" ||
    (
        accessContext === "owner" &&
        canViewInternal === true
    );

const addVisibilityCondition = ({
    conditions,
    alias,
    accessContext,
    canViewInternal
}) => {
    if (accessContext === "tenant") {
        conditions.push(
            `${alias}.visibility IN ('tenant_visible', 'shared')`
        );
        return;
    }

    if (accessContext === "technician") {
        conditions.push(
            `${alias}.visibility IN ('technician_visible', 'shared')`
        );
        return;
    }

    if (
        accessContext === "owner" &&
        canViewInternal !== true
    ) {
        conditions.push(
            `${alias}.visibility <> 'internal'`
        );
    }
};

const isInternalRecord = row =>
    row && row.visibility === "internal";

const COMMENT_SELECT = `
    SELECT
        mc.*,
        creator.public_id AS created_by_public_id,
        creator.full_name AS created_by_full_name,
        moderator.public_id AS hidden_by_public_id,
        moderator.full_name AS hidden_by_full_name
    FROM maintenance_comments AS mc
    INNER JOIN users AS creator
        ON creator.id = mc.created_by
    LEFT JOIN users AS moderator
        ON moderator.id = mc.hidden_by
`;

const shapeComment = ({
    row,
    accessContext,
    canViewInternal
}) => {
    const comment = {
        public_id: row.public_id,
        comment_type: row.comment_type,
        visibility: row.visibility,
        message: row.message,
        created_by: {
            public_id: row.created_by_public_id,
            full_name: row.created_by_full_name
        },
        created_at: row.created_at,
        hidden: row.hidden_at !== null,
        hidden_at: row.hidden_at
    };

    if (
        accessContext === "admin" ||
        (
            accessContext === "owner" &&
            canViewInternal === true
        )
    ) {
        comment.hidden_by = row.hidden_by_public_id
            ? {
                public_id: row.hidden_by_public_id,
                full_name: row.hidden_by_full_name
            }
            : null;
        comment.moderation_reason =
            row.moderation_reason;
    }

    return comment;
};

const fetchCommentById = async ({
    client,
    commentId,
    accessContext,
    canViewInternal
}) => {
    const result = await client.query(
        `
        ${COMMENT_SELECT}
        WHERE mc.id = $1::BIGINT
        LIMIT 1
        `,
        [commentId]
    );

    return result.rows.length === 0
        ? null
        : shapeComment({
            row: result.rows[0],
            accessContext,
            canViewInternal
        });
};

const ATTACHMENT_SELECT = `
    SELECT
        ma.*,
        uploader.public_id AS uploaded_by_public_id,
        uploader.full_name AS uploaded_by_full_name,
        revoker.public_id AS revoked_by_public_id,
        revoker.full_name AS revoked_by_full_name,
        mc.public_id AS comment_public_id,
        mcost.public_id AS cost_public_id,
        mv.public_id AS visit_public_id,
        mr.public_id AS resolution_public_id
    FROM maintenance_attachments AS ma
    INNER JOIN users AS uploader
        ON uploader.id = ma.uploaded_by
    LEFT JOIN users AS revoker
        ON revoker.id = ma.revoked_by
    LEFT JOIN maintenance_comments AS mc
        ON mc.id = ma.comment_id
    LEFT JOIN maintenance_costs AS mcost
        ON mcost.id = ma.cost_id
    LEFT JOIN maintenance_visits AS mv
        ON mv.id = ma.visit_id
    LEFT JOIN maintenance_resolutions AS mr
        ON mr.id = ma.resolution_id
`;

const shapeAttachment = ({
    row,
    accessContext,
    canViewInternal
}) => {
    const attachment = {
        public_id: row.public_id,
        attachment_type: row.attachment_type,
        visibility: row.visibility,
        original_file_name: row.original_file_name,
        mime_type: row.mime_type,
        file_size_bytes: Number(row.file_size_bytes),
        file_checksum: row.file_checksum,
        description: row.description,
        uploaded_by: {
            public_id: row.uploaded_by_public_id,
            full_name: row.uploaded_by_full_name
        },
        uploaded_at: row.uploaded_at,
        revoked: row.revoked_at !== null,
        revoked_at: row.revoked_at,
        context: {
            comment_public_id:
                row.comment_public_id,
            cost_public_id:
                row.cost_public_id,
            visit_public_id:
                row.visit_public_id,
            resolution_public_id:
                row.resolution_public_id
        }
    };

    if (
        accessContext === "admin" ||
        (
            accessContext === "owner" &&
            canViewInternal === true
        )
    ) {
        attachment.revoked_by =
            row.revoked_by_public_id
                ? {
                    public_id:
                        row.revoked_by_public_id,
                    full_name:
                        row.revoked_by_full_name
                }
                : null;
        attachment.revocation_reason =
            row.revocation_reason;
    }

    return attachment;
};

const fetchAttachmentById = async ({
    client,
    attachmentId,
    accessContext,
    canViewInternal
}) => {
    const result = await client.query(
        `
        ${ATTACHMENT_SELECT}
        WHERE ma.id = $1::BIGINT
        LIMIT 1
        `,
        [attachmentId]
    );

    return result.rows.length === 0
        ? null
        : shapeAttachment({
            row: result.rows[0],
            accessContext,
            canViewInternal
        });
};

const RESOLUTION_SELECT = `
    SELECT
        mr.*,
        submitter.public_id AS submitted_by_public_id,
        submitter.full_name AS submitted_by_full_name,
        confirmer.public_id AS confirmed_by_public_id,
        confirmer.full_name AS confirmed_by_full_name,
        disputer.public_id AS disputed_by_public_id,
        disputer.full_name AS disputed_by_full_name
    FROM maintenance_resolutions AS mr
    INNER JOIN users AS submitter
        ON submitter.id = mr.submitted_by
    LEFT JOIN users AS confirmer
        ON confirmer.id = mr.confirmed_by
    LEFT JOIN users AS disputer
        ON disputer.id = mr.disputed_by
`;

const shapeResolution = ({
    row,
    accessContext
}) => {
    const resolution = {
        public_id: row.public_id,
        sequence_number: row.sequence_number,
        resolution_summary: row.resolution_summary,
        work_completed_at: row.work_completed_at,
        actual_cost_summary: row.actual_cost_summary,
        confirmation_status: row.confirmation_status,
        confirmation_deadline_at:
            row.confirmation_deadline_at,
        submitted_by: {
            public_id: row.submitted_by_public_id,
            full_name: row.submitted_by_full_name
        },
        submitted_at: row.submitted_at,
        confirmed_by: row.confirmed_by_public_id
            ? {
                public_id: row.confirmed_by_public_id,
                full_name: row.confirmed_by_full_name
            }
            : null,
        confirmed_at: row.confirmed_at,
        confirmation_note: row.confirmation_note,
        disputed_by: row.disputed_by_public_id
            ? {
                public_id: row.disputed_by_public_id,
                full_name: row.disputed_by_full_name
            }
            : null,
        disputed_at: row.disputed_at,
        dispute_reason: row.dispute_reason,
        created_at: row.created_at
    };

    if (accessContext !== "tenant") {
        resolution.evidence_override_reason =
            row.evidence_override_reason;
    }

    return resolution;
};

const fetchResolutionById = async ({
    client,
    resolutionId,
    accessContext
}) => {
    const result = await client.query(
        `
        ${RESOLUTION_SELECT}
        WHERE mr.id = $1::BIGINT
        LIMIT 1
        `,
        [resolutionId]
    );

    return result.rows.length === 0
        ? null
        : shapeResolution({
            row: result.rows[0],
            accessContext
        });
};

const REOPEN_SELECT = `
    SELECT
        mrr.*,
        requester.public_id AS requested_by_public_id,
        requester.full_name AS requested_by_full_name,
        decider.public_id AS decided_by_public_id,
        decider.full_name AS decided_by_full_name
    FROM maintenance_reopen_requests AS mrr
    INNER JOIN users AS requester
        ON requester.id = mrr.requested_by
    LEFT JOIN users AS decider
        ON decider.id = mrr.decided_by
`;

const shapeReopenRequest = row => ({
    public_id: row.public_id,
    from_status: row.from_status,
    target_status: row.target_status,
    reason: row.reason,
    status: row.status,
    requested_by: {
        public_id: row.requested_by_public_id,
        full_name: row.requested_by_full_name
    },
    requested_at: row.requested_at,
    decided_by: row.decided_by_public_id
        ? {
            public_id: row.decided_by_public_id,
            full_name: row.decided_by_full_name
        }
        : null,
    decided_at: row.decided_at,
    decision_note: row.decision_note
});

const fetchReopenRequestById = async ({
    client,
    reopenRequestId
}) => {
    const result = await client.query(
        `
        ${REOPEN_SELECT}
        WHERE mrr.id = $1::BIGINT
        LIMIT 1
        `,
        [reopenRequestId]
    );

    return result.rows.length === 0
        ? null
        : shapeReopenRequest(result.rows[0]);
};

const createMaintenanceComment = async ({
    maintenanceRequestPublicId,
    commentData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
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
            "can_update_maintenance_requests",
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
                commentData.expected_request_status,
            expectedUpdatedAt:
                commentData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    if (
        [
            "closed",
            "rejected",
            "cancelled"
        ].includes(request.status)
    ) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "A comment cannot be added to a terminal maintenance request."
        });
    }

    const effectiveContext =
        accessResult.access_context;

    if (
        effectiveContext === "tenant" &&
        (
            ![
                "tenant_message",
                "resolution_feedback"
            ].includes(commentData.comment_type) ||
            ![
                "tenant_visible",
                "shared"
            ].includes(commentData.visibility)
        )
    ) {
        return baseFailure({
            visibilityConflict: true,
            conflictReason:
                "The tenant comment type or visibility is not allowed."
        });
    }

    if (
        effectiveContext === "technician" &&
        (
            ![
                "technician_update",
                "public_update"
            ].includes(commentData.comment_type) ||
            ![
                "technician_visible",
                "shared"
            ].includes(commentData.visibility)
        )
    ) {
        return baseFailure({
            visibilityConflict: true,
            conflictReason:
                "The technician comment type or visibility is not allowed."
        });
    }

    const canViewInternal =
        await getInternalNotePermission({
            client,
            request,
            authenticatedUser,
            accessContext: effectiveContext
        });

    if (
        effectiveContext === "owner" &&
        (
            commentData.visibility === "internal" ||
            commentData.comment_type === "internal_note"
        ) &&
        canViewInternal !== true
    ) {
        return baseFailure({
            visibilityConflict: true,
            conflictReason:
                "You do not have permission to create internal maintenance notes."
        });
    }

    let insertedComment = null;

    for (
        let attempt = 0;
        attempt < 5;
        attempt += 1
    ) {
        const insertResult = await client.query(
            `
            INSERT INTO maintenance_comments (
                public_id,
                maintenance_request_id,
                comment_type,
                visibility,
                message,
                created_by
            )
            VALUES (
                $1,
                $2::BIGINT,
                $3,
                $4,
                $5,
                $6::BIGINT
            )
            ON CONFLICT (public_id) DO NOTHING
            RETURNING id
            `,
            [
                createCommentPublicId(),
                request.id,
                commentData.comment_type,
                commentData.visibility,
                commentData.message,
                authenticatedUser.id
            ]
        );

        if (insertResult.rows.length > 0) {
            insertedComment =
                insertResult.rows[0];
            break;
        }
    }

    if (!insertedComment) {
        return baseFailure({
            identifierConflict: true,
            conflictReason:
                "A unique maintenance comment identifier could not be generated."
        });
    }

    await forceDeferredChecks(client);

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_comment:
            await fetchCommentById({
                client,
                commentId: insertedComment.id,
                accessContext: effectiveContext,
                canViewInternal
            })
    };
});

const getMaintenanceComments = async ({
    maintenanceRequestPublicId,
    filters,
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

    const request =
        accessResult.maintenance_request;
    const effectiveContext =
        accessResult.access_context;
    const canViewInternal =
        await getInternalNotePermission({
            client,
            request,
            authenticatedUser,
            accessContext: effectiveContext
        });

    const values = [request.id];
    const conditions = [
        "mc.maintenance_request_id = $1::BIGINT"
    ];

    addVisibilityCondition({
        conditions,
        alias: "mc",
        accessContext: effectiveContext,
        canViewInternal
    });

    const allowHidden =
        filters.include_hidden === true &&
        canExposeHiddenOrRevoked({
            accessContext: effectiveContext,
            canViewInternal
        });

    if (!allowHidden) {
        conditions.push("mc.hidden_at IS NULL");
    }

    if (filters.comment_type) {
        values.push(filters.comment_type);
        conditions.push(
            `mc.comment_type = $${values.length}`
        );
    }

    if (filters.visibility) {
        values.push(filters.visibility);
        conditions.push(
            `mc.visibility = $${values.length}`
        );
    }

    if (filters.created_from) {
        values.push(filters.created_from);
        conditions.push(
            `mc.created_at >= $${values.length}::TIMESTAMPTZ`
        );
    }

    if (filters.created_to) {
        values.push(filters.created_to);
        conditions.push(
            `mc.created_at <= $${values.length}::TIMESTAMPTZ`
        );
    }

    const countResult = await client.query(
        `
        SELECT COUNT(*)::INTEGER AS total
        FROM maintenance_comments AS mc
        WHERE ${conditions.join("\nAND ")}
        `,
        values
    );

    const pagination =
        normalizePagination(filters);
    const listValues = [...values];

    listValues.push(pagination.limit);
    const limitPlaceholder =
        `$${listValues.length}`;
    listValues.push(pagination.offset);
    const offsetPlaceholder =
        `$${listValues.length}`;

    const sortOrder =
        filters.sort_order === "asc"
            ? "ASC"
            : "DESC";

    const commentsResult = await client.query(
        `
        ${COMMENT_SELECT}
        WHERE ${conditions.join("\nAND ")}
        ORDER BY mc.created_at ${sortOrder},
                 mc.id ${sortOrder}
        LIMIT ${limitPlaceholder}::INTEGER
        OFFSET ${offsetPlaceholder}::INTEGER
        `,
        listValues
    );

    const total =
        countResult.rows[0].total;

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_comments:
            commentsResult.rows.map(row =>
                shapeComment({
                    row,
                    accessContext: effectiveContext,
                    canViewInternal
                })
            ),
        pagination: buildPagination({
            page: pagination.page,
            limit: pagination.limit,
            total
        })
    };
});

const getSingleMaintenanceComment = async ({
    maintenanceRequestPublicId,
    maintenanceCommentPublicId,
    filters,
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

    const request =
        accessResult.maintenance_request;
    const effectiveContext =
        accessResult.access_context;
    const canViewInternal =
        await getInternalNotePermission({
            client,
            request,
            authenticatedUser,
            accessContext: effectiveContext
        });

    const values = [
        request.id,
        maintenanceCommentPublicId
    ];
    const conditions = [
        "mc.maintenance_request_id = $1::BIGINT",
        "mc.public_id = $2::VARCHAR(70)"
    ];

    addVisibilityCondition({
        conditions,
        alias: "mc",
        accessContext: effectiveContext,
        canViewInternal
    });

    const allowHidden =
        filters.include_hidden === true &&
        canExposeHiddenOrRevoked({
            accessContext: effectiveContext,
            canViewInternal
        });

    if (!allowHidden) {
        conditions.push("mc.hidden_at IS NULL");
    }

    const commentResult = await client.query(
        `
        ${COMMENT_SELECT}
        WHERE ${conditions.join("\nAND ")}
        LIMIT 1
        `,
        values
    );

    if (commentResult.rows.length === 0) {
        return baseFailure({
            commentNotFound: true
        });
    }

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_comment: shapeComment({
            row: commentResult.rows[0],
            accessContext: effectiveContext,
            canViewInternal
        })
    };
});

const hideMaintenanceComment = async ({
    maintenanceRequestPublicId,
    maintenanceCommentPublicId,
    moderationData,
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
            "can_update_maintenance_requests",
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
    const effectiveContext =
        accessResult.access_context;

    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                moderationData.expected_request_status,
            expectedUpdatedAt:
                moderationData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    const canViewInternal =
        await getInternalNotePermission({
            client,
            request,
            authenticatedUser,
            accessContext: effectiveContext
        });

    const commentResult = await client.query(
        `
        SELECT *
        FROM maintenance_comments
        WHERE maintenance_request_id = $1::BIGINT
          AND public_id = $2::VARCHAR(70)
        LIMIT 1
        FOR UPDATE
        `,
        [
            request.id,
            maintenanceCommentPublicId
        ]
    );

    if (commentResult.rows.length === 0) {
        return baseFailure({
            commentNotFound: true
        });
    }

    const comment = commentResult.rows[0];

    if (
        isInternalRecord(comment) &&
        effectiveContext === "owner" &&
        canViewInternal !== true
    ) {
        return baseFailure({
            commentNotFound: true
        });
    }

    if (comment.hidden_at !== null) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "The maintenance comment is already hidden."
        });
    }

    await client.query(
        `
        UPDATE maintenance_comments
        SET
            hidden_at = CURRENT_TIMESTAMP,
            hidden_by = $1::BIGINT,
            moderation_reason = $2
        WHERE id = $3::BIGINT
        `,
        [
            authenticatedUser.id,
            moderationData.moderation_reason,
            comment.id
        ]
    );

    await forceDeferredChecks(client);

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_comment:
            await fetchCommentById({
                client,
                commentId: comment.id,
                accessContext: effectiveContext,
                canViewInternal
            })
    };
});

const resolveAttachmentContext = async ({
    client,
    requestId,
    attachmentData
}) => {
    const mappings = [
        {
            field: "comment_public_id",
            table: "maintenance_comments",
            column: "comment_id",
            castLength: 70
        },
        {
            field: "cost_public_id",
            table: "maintenance_costs",
            column: "cost_id",
            castLength: 60
        },
        {
            field: "visit_public_id",
            table: "maintenance_visits",
            column: "visit_id",
            castLength: 60
        },
        {
            field: "resolution_public_id",
            table: "maintenance_resolutions",
            column: "resolution_id",
            castLength: 70
        }
    ];

    const supplied = mappings.filter(mapping =>
        attachmentData[mapping.field] !== undefined &&
        attachmentData[mapping.field] !== null
    );

    if (supplied.length === 0) {
        return {
            childContextNotFound: false,
            comment_id: null,
            cost_id: null,
            visit_id: null,
            resolution_id: null
        };
    }

    if (supplied.length > 1) {
        return {
            childContextNotFound: true
        };
    }

    const mapping = supplied[0];
    const result = await client.query(
        `
        SELECT id
        FROM ${mapping.table}
        WHERE maintenance_request_id = $1::BIGINT
          AND public_id = $2::VARCHAR(${mapping.castLength})
        LIMIT 1
        FOR SHARE
        `,
        [
            requestId,
            attachmentData[mapping.field]
        ]
    );

    if (result.rows.length === 0) {
        return {
            childContextNotFound: true
        };
    }

    return {
        childContextNotFound: false,
        comment_id:
            mapping.column === "comment_id"
                ? result.rows[0].id
                : null,
        cost_id:
            mapping.column === "cost_id"
                ? result.rows[0].id
                : null,
        visit_id:
            mapping.column === "visit_id"
                ? result.rows[0].id
                : null,
        resolution_id:
            mapping.column === "resolution_id"
                ? result.rows[0].id
                : null
    };
};

const createMaintenanceAttachment = async ({
    maintenanceRequestPublicId,
    attachmentData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
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
            "can_update_maintenance_requests",
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
    const effectiveContext =
        accessResult.access_context;

    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                attachmentData.expected_request_status,
            expectedUpdatedAt:
                attachmentData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    if (
        [
            "closed",
            "rejected",
            "cancelled"
        ].includes(request.status)
    ) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "An attachment cannot be added to a terminal maintenance request."
        });
    }

    if (
        effectiveContext === "tenant" &&
        (
            ![
                "problem_evidence",
                "work_progress",
                "completion_evidence",
                "other"
            ].includes(
                attachmentData.attachment_type
            ) ||
            ![
                "tenant_visible",
                "shared"
            ].includes(attachmentData.visibility) ||
            attachmentData.cost_public_id !== undefined &&
            attachmentData.cost_public_id !== null
        )
    ) {
        return baseFailure({
            visibilityConflict: true,
            conflictReason:
                "The tenant attachment type, visibility or context is not allowed."
        });
    }

    if (
        effectiveContext === "technician" &&
        (
            ![
                "problem_evidence",
                "work_progress",
                "completion_evidence",
                "other"
            ].includes(
                attachmentData.attachment_type
            ) ||
            ![
                "technician_visible",
                "shared"
            ].includes(attachmentData.visibility)
        )
    ) {
        return baseFailure({
            visibilityConflict: true,
            conflictReason:
                "The technician attachment type or visibility is not allowed."
        });
    }

    const canViewInternal =
        await getInternalNotePermission({
            client,
            request,
            authenticatedUser,
            accessContext: effectiveContext
        });

    if (
        effectiveContext === "owner" &&
        attachmentData.visibility === "internal" &&
        canViewInternal !== true
    ) {
        return baseFailure({
            visibilityConflict: true,
            conflictReason:
                "You do not have permission to register internal maintenance attachments."
        });
    }

    const contextResult =
        await resolveAttachmentContext({
            client,
            requestId: request.id,
            attachmentData
        });

    if (contextResult.childContextNotFound) {
        return baseFailure({
            childContextNotFound: true,
            conflictReason:
                "The selected attachment context was not found for this maintenance request."
        });
    }

    let insertedAttachment = null;

    for (
        let attempt = 0;
        attempt < 5;
        attempt += 1
    ) {
        const insertResult = await client.query(
            `
            INSERT INTO maintenance_attachments (
                public_id,
                maintenance_request_id,
                comment_id,
                cost_id,
                visit_id,
                resolution_id,
                attachment_type,
                visibility,
                original_file_name,
                stored_file_name,
                storage_path,
                mime_type,
                file_size_bytes,
                file_checksum,
                description,
                uploaded_by
            )
            VALUES (
                $1,
                $2::BIGINT,
                $3::BIGINT,
                $4::BIGINT,
                $5::BIGINT,
                $6::BIGINT,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13::BIGINT,
                $14,
                $15,
                $16::BIGINT
            )
            ON CONFLICT (public_id) DO NOTHING
            RETURNING id
            `,
            [
                createAttachmentPublicId(),
                request.id,
                contextResult.comment_id,
                contextResult.cost_id,
                contextResult.visit_id,
                contextResult.resolution_id,
                attachmentData.attachment_type,
                attachmentData.visibility,
                attachmentData.original_file_name,
                attachmentData.stored_file_name,
                attachmentData.storage_path,
                attachmentData.mime_type,
                attachmentData.file_size_bytes,
                attachmentData.file_checksum,
                attachmentData.description ?? null,
                authenticatedUser.id
            ]
        );

        if (insertResult.rows.length > 0) {
            insertedAttachment =
                insertResult.rows[0];
            break;
        }
    }

    if (!insertedAttachment) {
        return baseFailure({
            identifierConflict: true,
            conflictReason:
                "A unique maintenance attachment identifier could not be generated."
        });
    }

    await forceDeferredChecks(client);

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_attachment:
            await fetchAttachmentById({
                client,
                attachmentId:
                    insertedAttachment.id,
                accessContext: effectiveContext,
                canViewInternal
            })
    };
});

const getMaintenanceAttachments = async ({
    maintenanceRequestPublicId,
    filters,
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

    const request =
        accessResult.maintenance_request;
    const effectiveContext =
        accessResult.access_context;
    const canViewInternal =
        await getInternalNotePermission({
            client,
            request,
            authenticatedUser,
            accessContext: effectiveContext
        });

    const values = [request.id];
    const conditions = [
        "ma.maintenance_request_id = $1::BIGINT"
    ];

    addVisibilityCondition({
        conditions,
        alias: "ma",
        accessContext: effectiveContext,
        canViewInternal
    });

    const allowRevoked =
        filters.include_revoked === true &&
        canExposeHiddenOrRevoked({
            accessContext: effectiveContext,
            canViewInternal
        });

    if (!allowRevoked) {
        conditions.push("ma.revoked_at IS NULL");
    }

    if (filters.attachment_type) {
        values.push(filters.attachment_type);
        conditions.push(
            `ma.attachment_type = $${values.length}`
        );
    }

    if (filters.visibility) {
        values.push(filters.visibility);
        conditions.push(
            `ma.visibility = $${values.length}`
        );
    }

    const contextFilters = [
        {
            field: "comment_public_id",
            sql: "mc.public_id"
        },
        {
            field: "cost_public_id",
            sql: "mcost.public_id"
        },
        {
            field: "visit_public_id",
            sql: "mv.public_id"
        },
        {
            field: "resolution_public_id",
            sql: "mr.public_id"
        }
    ];

    for (const contextFilter of contextFilters) {
        if (filters[contextFilter.field]) {
            values.push(
                filters[contextFilter.field]
            );
            conditions.push(
                `${contextFilter.sql} = $${values.length}`
            );
        }
    }

    if (filters.uploaded_from) {
        values.push(filters.uploaded_from);
        conditions.push(
            `ma.uploaded_at >= $${values.length}::TIMESTAMPTZ`
        );
    }

    if (filters.uploaded_to) {
        values.push(filters.uploaded_to);
        conditions.push(
            `ma.uploaded_at <= $${values.length}::TIMESTAMPTZ`
        );
    }

    const fromClause = `
        FROM maintenance_attachments AS ma
        LEFT JOIN maintenance_comments AS mc
            ON mc.id = ma.comment_id
        LEFT JOIN maintenance_costs AS mcost
            ON mcost.id = ma.cost_id
        LEFT JOIN maintenance_visits AS mv
            ON mv.id = ma.visit_id
        LEFT JOIN maintenance_resolutions AS mr
            ON mr.id = ma.resolution_id
    `;

    const countResult = await client.query(
        `
        SELECT COUNT(*)::INTEGER AS total
        ${fromClause}
        WHERE ${conditions.join("\nAND ")}
        `,
        values
    );

    const pagination =
        normalizePagination(filters);
    const listValues = [...values];

    listValues.push(pagination.limit);
    const limitPlaceholder =
        `$${listValues.length}`;
    listValues.push(pagination.offset);
    const offsetPlaceholder =
        `$${listValues.length}`;

    const sortOrder =
        filters.sort_order === "asc"
            ? "ASC"
            : "DESC";

    const attachmentsResult = await client.query(
        `
        ${ATTACHMENT_SELECT}
        WHERE ${conditions.join("\nAND ")}
        ORDER BY ma.uploaded_at ${sortOrder},
                 ma.id ${sortOrder}
        LIMIT ${limitPlaceholder}::INTEGER
        OFFSET ${offsetPlaceholder}::INTEGER
        `,
        listValues
    );

    const total =
        countResult.rows[0].total;

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_attachments:
            attachmentsResult.rows.map(row =>
                shapeAttachment({
                    row,
                    accessContext: effectiveContext,
                    canViewInternal
                })
            ),
        pagination: buildPagination({
            page: pagination.page,
            limit: pagination.limit,
            total
        })
    };
});

const getSingleMaintenanceAttachment = async ({
    maintenanceRequestPublicId,
    maintenanceAttachmentPublicId,
    filters,
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

    const request =
        accessResult.maintenance_request;
    const effectiveContext =
        accessResult.access_context;
    const canViewInternal =
        await getInternalNotePermission({
            client,
            request,
            authenticatedUser,
            accessContext: effectiveContext
        });

    const conditions = [
        "ma.maintenance_request_id = $1::BIGINT",
        "ma.public_id = $2::VARCHAR(80)"
    ];

    addVisibilityCondition({
        conditions,
        alias: "ma",
        accessContext: effectiveContext,
        canViewInternal
    });

    const allowRevoked =
        filters.include_revoked === true &&
        canExposeHiddenOrRevoked({
            accessContext: effectiveContext,
            canViewInternal
        });

    if (!allowRevoked) {
        conditions.push("ma.revoked_at IS NULL");
    }

    const attachmentResult = await client.query(
        `
        ${ATTACHMENT_SELECT}
        WHERE ${conditions.join("\nAND ")}
        LIMIT 1
        `,
        [
            request.id,
            maintenanceAttachmentPublicId
        ]
    );

    if (attachmentResult.rows.length === 0) {
        return baseFailure({
            attachmentNotFound: true
        });
    }

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_attachment:
            shapeAttachment({
                row: attachmentResult.rows[0],
                accessContext: effectiveContext,
                canViewInternal
            })
    };
});

const revokeMaintenanceAttachment = async ({
    maintenanceRequestPublicId,
    maintenanceAttachmentPublicId,
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
            "can_update_maintenance_requests",
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
    const effectiveContext =
        accessResult.access_context;

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

    const canViewInternal =
        await getInternalNotePermission({
            client,
            request,
            authenticatedUser,
            accessContext: effectiveContext
        });

    const attachmentResult = await client.query(
        `
        SELECT *
        FROM maintenance_attachments
        WHERE maintenance_request_id = $1::BIGINT
          AND public_id = $2::VARCHAR(80)
        LIMIT 1
        FOR UPDATE
        `,
        [
            request.id,
            maintenanceAttachmentPublicId
        ]
    );

    if (attachmentResult.rows.length === 0) {
        return baseFailure({
            attachmentNotFound: true
        });
    }

    const attachment =
        attachmentResult.rows[0];

    if (
        isInternalRecord(attachment) &&
        effectiveContext === "owner" &&
        canViewInternal !== true
    ) {
        return baseFailure({
            attachmentNotFound: true
        });
    }

    if (
        !sameTimestamp(
            attachment.uploaded_at,
            revocationData
                .expected_attachment_uploaded_at
        )
    ) {
        return baseFailure({
            concurrencyConflict: true,
            conflictReason:
                "The maintenance attachment changed after it was read."
        });
    }

    if (attachment.revoked_at !== null) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "The maintenance attachment is already revoked."
        });
    }

    await client.query(
        `
        UPDATE maintenance_attachments
        SET
            revoked_at = CURRENT_TIMESTAMP,
            revoked_by = $1::BIGINT,
            revocation_reason = $2
        WHERE id = $3::BIGINT
        `,
        [
            authenticatedUser.id,
            revocationData.revocation_reason,
            attachment.id
        ]
    );

    await forceDeferredChecks(client);

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_attachment:
            await fetchAttachmentById({
                client,
                attachmentId: attachment.id,
                accessContext: effectiveContext,
                canViewInternal
            })
    };
});

const resolveMaintenanceRequest = async ({
    maintenanceRequestPublicId,
    resolutionData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const accessResult = await getRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: [
            "owner",
            "technician"
        ],
        ownerPermission:
            "can_change_maintenance_status",
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
    const effectiveContext =
        accessResult.access_context;

    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                resolutionData.expected_request_status,
            expectedUpdatedAt:
                resolutionData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    if (request.status !== "in_progress") {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "Only an in-progress maintenance request can be resolved."
        });
    }

    if (
        effectiveContext === "technician" &&
        resolutionData.evidence_override_reason !==
            undefined &&
        resolutionData.evidence_override_reason !== null
    ) {
        return baseFailure({
            visibilityConflict: true,
            conflictReason:
                "A technician cannot waive completion evidence."
        });
    }

    const pendingResolutionResult =
        await client.query(
            `
            SELECT id
            FROM maintenance_resolutions
            WHERE maintenance_request_id = $1::BIGINT
              AND confirmation_status = 'pending'
            LIMIT 1
            FOR UPDATE
            `,
            [request.id]
        );

    if (pendingResolutionResult.rows.length > 0) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "This maintenance request already has a pending resolution confirmation."
        });
    }

    const evidenceResult = await client.query(
        `
        SELECT EXISTS (
            SELECT 1
            FROM maintenance_attachments AS ma
            WHERE ma.maintenance_request_id = $1::BIGINT
              AND ma.attachment_type =
                    'completion_evidence'
              AND ma.revoked_at IS NULL
              AND ma.resolution_id IS NULL
        ) AS has_completion_evidence
        `,
        [request.id]
    );

    if (
        evidenceResult.rows[0]
            .has_completion_evidence !== true &&
        (
            resolutionData.evidence_override_reason ===
                undefined ||
            resolutionData.evidence_override_reason === null
        )
    ) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "Completion evidence or an authorized evidence-override reason is required before resolution."
        });
    }

    const sequenceResult = await client.query(
        `
        SELECT COALESCE(MAX(sequence_number), 0) + 1
            AS next_sequence
        FROM maintenance_resolutions
        WHERE maintenance_request_id = $1::BIGINT
        `,
        [request.id]
    );

    const nextSequence =
        Number(sequenceResult.rows[0].next_sequence);

    let insertedResolution = null;

    for (
        let attempt = 0;
        attempt < 5;
        attempt += 1
    ) {
        const insertResult = await client.query(
            `
            INSERT INTO maintenance_resolutions (
                public_id,
                maintenance_request_id,
                sequence_number,
                resolution_summary,
                work_completed_at,
                actual_cost_summary,
                evidence_override_reason,
                confirmation_deadline_at,
                submitted_by
            )
            VALUES (
                $1,
                $2::BIGINT,
                $3::INTEGER,
                $4,
                $5::TIMESTAMPTZ,
                $6,
                $7,
                $8::TIMESTAMPTZ,
                $9::BIGINT
            )
            ON CONFLICT (public_id) DO NOTHING
            RETURNING id
            `,
            [
                createResolutionPublicId(),
                request.id,
                nextSequence,
                resolutionData.resolution_summary,
                resolutionData.work_completed_at,
                resolutionData.actual_cost_summary ?? null,
                resolutionData.evidence_override_reason ?? null,
                resolutionData.confirmation_deadline_at ?? null,
                authenticatedUser.id
            ]
        );

        if (insertResult.rows.length > 0) {
            insertedResolution =
                insertResult.rows[0];
            break;
        }
    }

    if (!insertedResolution) {
        return baseFailure({
            identifierConflict: true,
            conflictReason:
                "A unique maintenance resolution identifier could not be generated."
        });
    }

    await forceDeferredChecks(client);

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_resolution:
            await fetchResolutionById({
                client,
                resolutionId:
                    insertedResolution.id,
                accessContext: effectiveContext
            }),
        maintenance_request:
            await fetchRequestSummary({
                client,
                requestId: request.id
            })
    };
});

const getMaintenanceResolutions = async ({
    maintenanceRequestPublicId,
    filters,
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

    const request =
        accessResult.maintenance_request;
    const effectiveContext =
        accessResult.access_context;
    const values = [request.id];
    const conditions = [
        "mr.maintenance_request_id = $1::BIGINT"
    ];

    if (filters.confirmation_status) {
        values.push(filters.confirmation_status);
        conditions.push(
            `mr.confirmation_status = $${values.length}`
        );
    }

    if (filters.submitted_from) {
        values.push(filters.submitted_from);
        conditions.push(
            `mr.submitted_at >= $${values.length}::TIMESTAMPTZ`
        );
    }

    if (filters.submitted_to) {
        values.push(filters.submitted_to);
        conditions.push(
            `mr.submitted_at <= $${values.length}::TIMESTAMPTZ`
        );
    }

    const countResult = await client.query(
        `
        SELECT COUNT(*)::INTEGER AS total
        FROM maintenance_resolutions AS mr
        WHERE ${conditions.join("\nAND ")}
        `,
        values
    );

    const pagination =
        normalizePagination(filters);
    const listValues = [...values];

    listValues.push(pagination.limit);
    const limitPlaceholder =
        `$${listValues.length}`;
    listValues.push(pagination.offset);
    const offsetPlaceholder =
        `$${listValues.length}`;

    const sortOrder =
        filters.sort_order === "asc"
            ? "ASC"
            : "DESC";

    const resolutionsResult = await client.query(
        `
        ${RESOLUTION_SELECT}
        WHERE ${conditions.join("\nAND ")}
        ORDER BY mr.sequence_number ${sortOrder},
                 mr.id ${sortOrder}
        LIMIT ${limitPlaceholder}::INTEGER
        OFFSET ${offsetPlaceholder}::INTEGER
        `,
        listValues
    );

    const total =
        countResult.rows[0].total;

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_resolutions:
            resolutionsResult.rows.map(row =>
                shapeResolution({
                    row,
                    accessContext: effectiveContext
                })
            ),
        pagination: buildPagination({
            page: pagination.page,
            limit: pagination.limit,
            total
        })
    };
});

const getSingleMaintenanceResolution = async ({
    maintenanceRequestPublicId,
    maintenanceResolutionPublicId,
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

    const request =
        accessResult.maintenance_request;
    const effectiveContext =
        accessResult.access_context;

    const resolutionResult = await client.query(
        `
        ${RESOLUTION_SELECT}
        WHERE mr.maintenance_request_id = $1::BIGINT
          AND mr.public_id = $2::VARCHAR(70)
        LIMIT 1
        `,
        [
            request.id,
            maintenanceResolutionPublicId
        ]
    );

    if (resolutionResult.rows.length === 0) {
        return baseFailure({
            resolutionNotFound: true
        });
    }

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_resolution:
            shapeResolution({
                row: resolutionResult.rows[0],
                accessContext: effectiveContext
            })
    };
});

const lockResolutionForResponse = async ({
    client,
    requestId,
    maintenanceResolutionPublicId
}) => {
    const result = await client.query(
        `
        SELECT *
        FROM maintenance_resolutions
        WHERE maintenance_request_id = $1::BIGINT
          AND public_id = $2::VARCHAR(70)
        LIMIT 1
        FOR UPDATE
        `,
        [
            requestId,
            maintenanceResolutionPublicId
        ]
    );

    return result.rows[0] || null;
};

const checkExpectedResolutionState = ({
    resolution,
    expectedStatus,
    expectedSubmittedAt
}) => {
    if (
        resolution.confirmation_status !==
            expectedStatus ||
        !sameTimestamp(
            resolution.submitted_at,
            expectedSubmittedAt
        )
    ) {
        return baseFailure({
            concurrencyConflict: true,
            conflictReason:
                "The maintenance resolution changed after it was read."
        });
    }

    return null;
};

const confirmMaintenanceResolution = async ({
    maintenanceRequestPublicId,
    maintenanceResolutionPublicId,
    confirmationData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const accessResult = await getRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: ["tenant"],
        ownerPermission:
            "can_view_maintenance_requests",
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
    const effectiveContext =
        accessResult.access_context;

    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                confirmationData.expected_request_status,
            expectedUpdatedAt:
                confirmationData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    if (
        request.status !== "resolved" ||
        request.tenant_id === null
    ) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "This maintenance resolution is not awaiting tenant confirmation."
        });
    }

    const resolution =
        await lockResolutionForResponse({
            client,
            requestId: request.id,
            maintenanceResolutionPublicId
        });

    if (!resolution) {
        return baseFailure({
            resolutionNotFound: true
        });
    }

    const resolutionConflict =
        checkExpectedResolutionState({
            resolution,
            expectedStatus:
                confirmationData
                    .expected_resolution_status,
            expectedSubmittedAt:
                confirmationData
                    .expected_resolution_submitted_at
        });

    if (resolutionConflict) {
        return resolutionConflict;
    }

    if (resolution.confirmation_status !== "pending") {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "The maintenance resolution is no longer pending confirmation."
        });
    }

    await client.query(
        `
        UPDATE maintenance_resolutions
        SET
            confirmation_status = 'confirmed',
            confirmed_by = $1::BIGINT,
            confirmed_at = CURRENT_TIMESTAMP,
            confirmation_note = $2
        WHERE id = $3::BIGINT
        `,
        [
            authenticatedUser.id,
            confirmationData.confirmation_note ?? null,
            resolution.id
        ]
    );

    await forceDeferredChecks(client);

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_resolution:
            await fetchResolutionById({
                client,
                resolutionId: resolution.id,
                accessContext: effectiveContext
            }),
        maintenance_request:
            await fetchRequestSummary({
                client,
                requestId: request.id
            })
    };
});

const disputeMaintenanceResolution = async ({
    maintenanceRequestPublicId,
    maintenanceResolutionPublicId,
    disputeData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const accessResult = await getRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: ["tenant"],
        ownerPermission:
            "can_view_maintenance_requests",
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
    const effectiveContext =
        accessResult.access_context;

    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                disputeData.expected_request_status,
            expectedUpdatedAt:
                disputeData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    if (
        request.status !== "resolved" ||
        request.tenant_id === null
    ) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "This maintenance resolution is not awaiting a tenant response."
        });
    }

    const resolution =
        await lockResolutionForResponse({
            client,
            requestId: request.id,
            maintenanceResolutionPublicId
        });

    if (!resolution) {
        return baseFailure({
            resolutionNotFound: true
        });
    }

    const resolutionConflict =
        checkExpectedResolutionState({
            resolution,
            expectedStatus:
                disputeData
                    .expected_resolution_status,
            expectedSubmittedAt:
                disputeData
                    .expected_resolution_submitted_at
        });

    if (resolutionConflict) {
        return resolutionConflict;
    }

    if (resolution.confirmation_status !== "pending") {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "The maintenance resolution is no longer pending a tenant response."
        });
    }

    await client.query(
        `
        UPDATE maintenance_resolutions
        SET
            confirmation_status = 'disputed',
            disputed_by = $1::BIGINT,
            disputed_at = CURRENT_TIMESTAMP,
            dispute_reason = $2
        WHERE id = $3::BIGINT
        `,
        [
            authenticatedUser.id,
            disputeData.dispute_reason,
            resolution.id
        ]
    );

    await forceDeferredChecks(client);

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_resolution:
            await fetchResolutionById({
                client,
                resolutionId: resolution.id,
                accessContext: effectiveContext
            }),
        maintenance_request:
            await fetchRequestSummary({
                client,
                requestId: request.id
            })
    };
});

const markMaintenanceResolutionNoResponse = async ({
    maintenanceRequestPublicId,
    maintenanceResolutionPublicId,
    noResponseData,
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
            "can_close_maintenance_requests",
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
    const effectiveContext =
        accessResult.access_context;

    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                noResponseData.expected_request_status,
            expectedUpdatedAt:
                noResponseData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    if (request.status !== "resolved") {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "Only a resolved request can be marked as having no tenant response."
        });
    }

    const resolution =
        await lockResolutionForResponse({
            client,
            requestId: request.id,
            maintenanceResolutionPublicId
        });

    if (!resolution) {
        return baseFailure({
            resolutionNotFound: true
        });
    }

    const resolutionConflict =
        checkExpectedResolutionState({
            resolution,
            expectedStatus:
                noResponseData
                    .expected_resolution_status,
            expectedSubmittedAt:
                noResponseData
                    .expected_resolution_submitted_at
        });

    if (resolutionConflict) {
        return resolutionConflict;
    }

    if (resolution.confirmation_status !== "pending") {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "The maintenance resolution is no longer pending confirmation."
        });
    }

    const deadlineResult = await client.query(
        `
        SELECT
            $1::TIMESTAMPTZ <= CURRENT_TIMESTAMP
                AS deadline_passed
        `,
        [resolution.confirmation_deadline_at]
    );

    if (
        deadlineResult.rows[0].deadline_passed !== true
    ) {
        return baseFailure({
            deadlineConflict: true,
            conflictReason:
                "The tenant confirmation deadline has not passed."
        });
    }

    await client.query(
        `
        UPDATE maintenance_resolutions
        SET
            confirmation_status = 'no_response',
            confirmed_by = $1::BIGINT,
            confirmed_at = CURRENT_TIMESTAMP,
            confirmation_note = $2
        WHERE id = $3::BIGINT
        `,
        [
            authenticatedUser.id,
            noResponseData.confirmation_note,
            resolution.id
        ]
    );

    await forceDeferredChecks(client);

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_resolution:
            await fetchResolutionById({
                client,
                resolutionId: resolution.id,
                accessContext: effectiveContext
            }),
        maintenance_request:
            await fetchRequestSummary({
                client,
                requestId: request.id
            })
    };
});

const getClosureBlocker = async ({
    client,
    request
}) => {
    const readinessResult = await client.query(
        `
        WITH latest_resolution AS (
            SELECT
                id,
                confirmation_status,
                evidence_override_reason
            FROM maintenance_resolutions
            WHERE maintenance_request_id = $1::BIGINT
            ORDER BY sequence_number DESC
            LIMIT 1
        )
        SELECT
            EXISTS (
                SELECT 1
                FROM latest_resolution
            ) AS has_resolution,

            (
                SELECT confirmation_status
                FROM latest_resolution
            ) AS confirmation_status,

            EXISTS (
                SELECT 1
                FROM maintenance_attachments AS ma
                LEFT JOIN latest_resolution AS lr
                    ON TRUE
                WHERE ma.maintenance_request_id = $1::BIGINT
                  AND ma.attachment_type =
                        'completion_evidence'
                  AND ma.revoked_at IS NULL
                  AND (
                        ma.resolution_id = lr.id
                        OR ma.resolution_id IS NULL
                  )
            ) AS has_completion_evidence,

            (
                SELECT evidence_override_reason
                FROM latest_resolution
            ) AS evidence_override_reason,

            EXISTS (
                SELECT 1
                FROM maintenance_assignments
                WHERE maintenance_request_id = $1::BIGINT
                  AND status IN (
                        'pending',
                        'accepted',
                        'active'
                  )
            ) AS has_active_assignment,

            EXISTS (
                SELECT 1
                FROM maintenance_visits
                WHERE maintenance_request_id = $1::BIGINT
                  AND status IN (
                        'scheduled',
                        'confirmed',
                        'rescheduled',
                        'in_progress'
                  )
            ) AS has_active_visit,

            EXISTS (
                SELECT 1
                FROM maintenance_cost_approvals AS mca
                INNER JOIN maintenance_costs AS mc
                    ON mc.id = mca.maintenance_cost_id
                WHERE mc.maintenance_request_id =
                        $1::BIGINT
                  AND mca.decision = 'pending'
            ) AS has_pending_cost_approval,

            EXISTS (
                SELECT 1
                FROM maintenance_unit_status_locks
                WHERE maintenance_request_id = $1::BIGINT
                  AND is_active = TRUE
            ) AS has_active_unit_lock
        `,
        [request.id]
    );

    const readiness = readinessResult.rows[0];

    if (readiness.has_resolution !== true) {
        return "A resolution record is required before closure.";
    }

    if (
        ![
            "confirmed",
            "no_response",
            "not_required"
        ].includes(readiness.confirmation_status)
    ) {
        return "The latest resolution requires terminal confirmation before closure.";
    }

    if (
        readiness.has_completion_evidence !== true &&
        readiness.evidence_override_reason === null
    ) {
        return "Completion evidence or an authorized override is required before closure.";
    }

    if (readiness.has_active_assignment === true) {
        return "The maintenance request still has an active assignment.";
    }

    if (readiness.has_active_visit === true) {
        return "The maintenance request still has an active visit.";
    }

    if (
        readiness.has_pending_cost_approval === true
    ) {
        return "The maintenance request still has a pending cost approval.";
    }

    if (readiness.has_active_unit_lock === true) {
        return "The maintenance unit-status lock must be released before closure.";
    }

    if (
        Number(request.total_actual_cost) > 0 &&
        request.responsibility_status ===
            "pending_review"
    ) {
        return "Maintenance cost responsibility must be determined before closure.";
    }

    return null;
};

const closeMaintenanceRequest = async ({
    maintenanceRequestPublicId,
    closureData,
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
            "can_close_maintenance_requests",
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
    const effectiveContext =
        accessResult.access_context;

    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                closureData.expected_request_status,
            expectedUpdatedAt:
                closureData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    if (request.status !== "resolved") {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "Only a resolved maintenance request can be closed."
        });
    }

    const closureBlocker =
        await getClosureBlocker({
            client,
            request
        });

    if (closureBlocker) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason: closureBlocker
        });
    }

    await client.query(
        `
        UPDATE maintenance_requests
        SET
            status = 'closed',
            status_changed_by = $1::BIGINT,
            status_changed_at = CURRENT_TIMESTAMP,
            status_change_reason = $2
        WHERE id = $3::BIGINT
        `,
        [
            authenticatedUser.id,
            closureData.reason,
            request.id
        ]
    );

    await forceDeferredChecks(client);

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_request:
            await fetchRequestSummary({
                client,
                requestId: request.id
            })
    };
});

const deriveReopenTargetStatus = fromStatus => {
    if (
        fromStatus === "closed" ||
        fromStatus === "rejected"
    ) {
        return "under_review";
    }

    if (fromStatus === "cancelled") {
        return "reported";
    }

    return null;
};

const createMaintenanceReopenRequest = async ({
    maintenanceRequestPublicId,
    reopenData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const accessResult = await getRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: [
            "owner",
            "tenant"
        ],
        ownerPermission:
            "can_reopen_maintenance_requests",
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
    const effectiveContext =
        accessResult.access_context;

    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                reopenData.expected_request_status,
            expectedUpdatedAt:
                reopenData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    const targetStatus =
        deriveReopenTargetStatus(request.status);

    if (!targetStatus) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "Only a closed, rejected or cancelled maintenance request can enter the reopening workflow."
        });
    }

    const pendingResult = await client.query(
        `
        SELECT id
        FROM maintenance_reopen_requests
        WHERE maintenance_request_id = $1::BIGINT
          AND status = 'pending'
        LIMIT 1
        FOR UPDATE
        `,
        [request.id]
    );

    if (pendingResult.rows.length > 0) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "This maintenance request already has a pending reopening request."
        });
    }

    let insertedReopen = null;

    for (
        let attempt = 0;
        attempt < 5;
        attempt += 1
    ) {
        const insertResult = await client.query(
            `
            INSERT INTO maintenance_reopen_requests (
                public_id,
                maintenance_request_id,
                from_status,
                target_status,
                reason,
                status,
                requested_by
            )
            VALUES (
                $1,
                $2::BIGINT,
                $3,
                $4,
                $5,
                'pending',
                $6::BIGINT
            )
            ON CONFLICT (public_id) DO NOTHING
            RETURNING id
            `,
            [
                createReopenPublicId(),
                request.id,
                request.status,
                targetStatus,
                reopenData.reason,
                authenticatedUser.id
            ]
        );

        if (insertResult.rows.length > 0) {
            insertedReopen =
                insertResult.rows[0];
            break;
        }
    }

    if (!insertedReopen) {
        return baseFailure({
            identifierConflict: true,
            conflictReason:
                "A unique maintenance reopening identifier could not be generated."
        });
    }

    await forceDeferredChecks(client);

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_reopen_request:
            await fetchReopenRequestById({
                client,
                reopenRequestId:
                    insertedReopen.id
            })
    };
});

const getMaintenanceReopenRequests = async ({
    maintenanceRequestPublicId,
    filters,
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

    const request =
        accessResult.maintenance_request;
    const effectiveContext =
        accessResult.access_context;
    const values = [request.id];
    const conditions = [
        "mrr.maintenance_request_id = $1::BIGINT"
    ];

    if (filters.status) {
        values.push(filters.status);
        conditions.push(
            `mrr.status = $${values.length}`
        );
    }

    if (filters.from_status) {
        values.push(filters.from_status);
        conditions.push(
            `mrr.from_status = $${values.length}`
        );
    }

    if (filters.target_status) {
        values.push(filters.target_status);
        conditions.push(
            `mrr.target_status = $${values.length}`
        );
    }

    if (filters.requested_from) {
        values.push(filters.requested_from);
        conditions.push(
            `mrr.requested_at >= $${values.length}::TIMESTAMPTZ`
        );
    }

    if (filters.requested_to) {
        values.push(filters.requested_to);
        conditions.push(
            `mrr.requested_at <= $${values.length}::TIMESTAMPTZ`
        );
    }

    const countResult = await client.query(
        `
        SELECT COUNT(*)::INTEGER AS total
        FROM maintenance_reopen_requests AS mrr
        WHERE ${conditions.join("\nAND ")}
        `,
        values
    );

    const pagination =
        normalizePagination(filters);
    const listValues = [...values];

    listValues.push(pagination.limit);
    const limitPlaceholder =
        `$${listValues.length}`;
    listValues.push(pagination.offset);
    const offsetPlaceholder =
        `$${listValues.length}`;

    const sortOrder =
        filters.sort_order === "asc"
            ? "ASC"
            : "DESC";

    const reopenResult = await client.query(
        `
        ${REOPEN_SELECT}
        WHERE ${conditions.join("\nAND ")}
        ORDER BY mrr.requested_at ${sortOrder},
                 mrr.id ${sortOrder}
        LIMIT ${limitPlaceholder}::INTEGER
        OFFSET ${offsetPlaceholder}::INTEGER
        `,
        listValues
    );

    const total =
        countResult.rows[0].total;

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_reopen_requests:
            reopenResult.rows.map(
                shapeReopenRequest
            ),
        pagination: buildPagination({
            page: pagination.page,
            limit: pagination.limit,
            total
        })
    };
});

const getSingleMaintenanceReopenRequest = async ({
    maintenanceRequestPublicId,
    maintenanceReopenPublicId,
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

    const request =
        accessResult.maintenance_request;
    const effectiveContext =
        accessResult.access_context;

    const reopenResult = await client.query(
        `
        ${REOPEN_SELECT}
        WHERE mrr.maintenance_request_id = $1::BIGINT
          AND mrr.public_id = $2::VARCHAR(50)
        LIMIT 1
        `,
        [
            request.id,
            maintenanceReopenPublicId
        ]
    );

    if (reopenResult.rows.length === 0) {
        return baseFailure({
            reopenRequestNotFound: true
        });
    }

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_reopen_request:
            shapeReopenRequest(
                reopenResult.rows[0]
            )
    };
});

const lockReopenRequest = async ({
    client,
    requestId,
    maintenanceReopenPublicId
}) => {
    const result = await client.query(
        `
        SELECT *
        FROM maintenance_reopen_requests
        WHERE maintenance_request_id = $1::BIGINT
          AND public_id = $2::VARCHAR(50)
        LIMIT 1
        FOR UPDATE
        `,
        [
            requestId,
            maintenanceReopenPublicId
        ]
    );

    return result.rows[0] || null;
};

const checkExpectedReopenState = ({
    reopenRequest,
    expectedStatus,
    expectedRequestedAt
}) => {
    if (
        reopenRequest.status !== expectedStatus ||
        !sameTimestamp(
            reopenRequest.requested_at,
            expectedRequestedAt
        )
    ) {
        return baseFailure({
            concurrencyConflict: true,
            conflictReason:
                "The maintenance reopening request changed after it was read."
        });
    }

    return null;
};

const approveMaintenanceReopenRequest = async ({
    maintenanceRequestPublicId,
    maintenanceReopenPublicId,
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
        ownerPermission:
            "can_reopen_maintenance_requests",
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
    const effectiveContext =
        accessResult.access_context;

    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                decisionData.expected_request_status,
            expectedUpdatedAt:
                decisionData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    const reopenRequest =
        await lockReopenRequest({
            client,
            requestId: request.id,
            maintenanceReopenPublicId
        });

    if (!reopenRequest) {
        return baseFailure({
            reopenRequestNotFound: true
        });
    }

    const reopenConflict =
        checkExpectedReopenState({
            reopenRequest,
            expectedStatus:
                decisionData.expected_reopen_status,
            expectedRequestedAt:
                decisionData.expected_reopen_requested_at
        });

    if (reopenConflict) {
        return reopenConflict;
    }

    if (reopenRequest.status !== "pending") {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "The maintenance reopening request is no longer pending."
        });
    }

    if (
        reopenRequest.from_status !== request.status ||
        reopenRequest.target_status !==
            deriveReopenTargetStatus(request.status)
    ) {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "The reopening request no longer matches the current maintenance lifecycle."
        });
    }

    await client.query(
        `
        UPDATE maintenance_reopen_requests
        SET
            status = 'approved',
            decided_by = $1::BIGINT,
            decided_at = CURRENT_TIMESTAMP,
            decision_note = $2
        WHERE id = $3::BIGINT
        `,
        [
            authenticatedUser.id,
            decisionData.decision_note,
            reopenRequest.id
        ]
    );

    await client.query(
        `
        UPDATE maintenance_requests
        SET
            status = $1,
            status_changed_by = $2::BIGINT,
            status_changed_at = CURRENT_TIMESTAMP,
            status_change_reason = $3
        WHERE id = $4::BIGINT
        `,
        [
            reopenRequest.target_status,
            authenticatedUser.id,
            decisionData.decision_note,
            request.id
        ]
    );

    await forceDeferredChecks(client);

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_reopen_request:
            await fetchReopenRequestById({
                client,
                reopenRequestId:
                    reopenRequest.id
            }),
        maintenance_request:
            await fetchRequestSummary({
                client,
                requestId: request.id
            })
    };
});

const rejectMaintenanceReopenRequest = async ({
    maintenanceRequestPublicId,
    maintenanceReopenPublicId,
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
        ownerPermission:
            "can_reopen_maintenance_requests",
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
    const effectiveContext =
        accessResult.access_context;

    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                decisionData.expected_request_status,
            expectedUpdatedAt:
                decisionData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    const reopenRequest =
        await lockReopenRequest({
            client,
            requestId: request.id,
            maintenanceReopenPublicId
        });

    if (!reopenRequest) {
        return baseFailure({
            reopenRequestNotFound: true
        });
    }

    const reopenConflict =
        checkExpectedReopenState({
            reopenRequest,
            expectedStatus:
                decisionData.expected_reopen_status,
            expectedRequestedAt:
                decisionData.expected_reopen_requested_at
        });

    if (reopenConflict) {
        return reopenConflict;
    }

    if (reopenRequest.status !== "pending") {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "The maintenance reopening request is no longer pending."
        });
    }

    await client.query(
        `
        UPDATE maintenance_reopen_requests
        SET
            status = 'rejected',
            decided_by = $1::BIGINT,
            decided_at = CURRENT_TIMESTAMP,
            decision_note = $2
        WHERE id = $3::BIGINT
        `,
        [
            authenticatedUser.id,
            decisionData.decision_note,
            reopenRequest.id
        ]
    );

    await forceDeferredChecks(client);

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_reopen_request:
            await fetchReopenRequestById({
                client,
                reopenRequestId:
                    reopenRequest.id
            })
    };
});

const cancelMaintenanceReopenRequest = async ({
    maintenanceRequestPublicId,
    maintenanceReopenPublicId,
    decisionData,
    accessContext,
    authenticatedUser
}) => runSerializable(async client => {
    const accessResult = await getRequestAccess({
        client,
        maintenanceRequestPublicId,
        authenticatedUser,
        accessContext,
        allowedContexts: [
            "owner",
            "tenant"
        ],
        ownerPermission:
            "can_reopen_maintenance_requests",
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
    const effectiveContext =
        accessResult.access_context;

    const requestConflict =
        checkExpectedRequestState({
            request,
            expectedStatus:
                decisionData.expected_request_status,
            expectedUpdatedAt:
                decisionData.expected_request_updated_at
        });

    if (requestConflict) {
        return requestConflict;
    }

    const reopenRequest =
        await lockReopenRequest({
            client,
            requestId: request.id,
            maintenanceReopenPublicId
        });

    if (!reopenRequest) {
        return baseFailure({
            reopenRequestNotFound: true
        });
    }

    const reopenConflict =
        checkExpectedReopenState({
            reopenRequest,
            expectedStatus:
                decisionData.expected_reopen_status,
            expectedRequestedAt:
                decisionData.expected_reopen_requested_at
        });

    if (reopenConflict) {
        return reopenConflict;
    }

    if (reopenRequest.status !== "pending") {
        return baseFailure({
            lifecycleConflict: true,
            conflictReason:
                "The maintenance reopening request is no longer pending."
        });
    }

    if (
        effectiveContext === "tenant" &&
        reopenRequest.requested_by !==
            authenticatedUser.id
    ) {
        return baseFailure({
            reopenRequestNotFound: true
        });
    }

    await client.query(
        `
        UPDATE maintenance_reopen_requests
        SET
            status = 'cancelled',
            decided_by = $1::BIGINT,
            decided_at = CURRENT_TIMESTAMP,
            decision_note = $2
        WHERE id = $3::BIGINT
        `,
        [
            authenticatedUser.id,
            decisionData.decision_note,
            reopenRequest.id
        ]
    );

    await forceDeferredChecks(client);

    return {
        ...baseFailure(),
        access_context: effectiveContext,
        maintenance_reopen_request:
            await fetchReopenRequestById({
                client,
                reopenRequestId:
                    reopenRequest.id
            })
    };
});

module.exports = {
    createMaintenanceComment,
    getMaintenanceComments,
    getSingleMaintenanceComment,
    hideMaintenanceComment,
    createMaintenanceAttachment,
    getMaintenanceAttachments,
    getSingleMaintenanceAttachment,
    revokeMaintenanceAttachment,
    resolveMaintenanceRequest,
    getMaintenanceResolutions,
    getSingleMaintenanceResolution,
    confirmMaintenanceResolution,
    disputeMaintenanceResolution,
    markMaintenanceResolutionNoResponse,
    closeMaintenanceRequest,
    createMaintenanceReopenRequest,
    getMaintenanceReopenRequests,
    getSingleMaintenanceReopenRequest,
    approveMaintenanceReopenRequest,
    rejectMaintenanceReopenRequest,
    cancelMaintenanceReopenRequest
};

/*
 * Shared Maintenance Access Service
 *
 * This helper centralizes request-level authorization for the
 * modular maintenance APIs. It deliberately does not open,
 * commit or roll back transactions. The calling service owns
 * the PostgreSQL client and transaction lifecycle.
 */

const OWNER_PERMISSION_COLUMNS = new Set([
    "can_view_maintenance_requests",
    "can_create_maintenance_requests",
    "can_update_maintenance_requests",
    "can_assign_maintenance_work",
    "can_manage_maintenance_costs",
    "can_approve_maintenance_costs",
    "can_change_maintenance_status",
    "can_close_maintenance_requests",
    "can_reopen_maintenance_requests",
    "can_view_internal_maintenance_notes"
]);

const SUPPORTED_ACCESS_CONTEXTS = new Set([
    "admin",
    "owner",
    "tenant",
    "technician"
]);

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

/*
 * Resolve the effective access context.
 *
 * Admin always operates using the admin context and may omit
 * access_context. Every non-admin user must supply one of the
 * explicitly allowed contexts for the calling operation.
 */
const resolveMaintenanceAccessContext = ({
    authenticatedUser,
    requestedAccessContext,
    allowedContexts = []
}) => {
    if (
        !authenticatedUser ||
        !isValidDatabaseId(authenticatedUser.id)
    ) {
        return {
            invalidAccessContext: true,
            accessContext: null
        };
    }

    if (authenticatedUser.role === "admin") {
        return {
            invalidAccessContext: false,
            accessContext: "admin"
        };
    }

    const normalizedContext =
        typeof requestedAccessContext === "string"
            ? requestedAccessContext.trim()
            : "";

    if (
        !SUPPORTED_ACCESS_CONTEXTS.has(
            normalizedContext
        ) ||
        normalizedContext === "admin" ||
        !allowedContexts.includes(
            normalizedContext
        )
    ) {
        return {
            invalidAccessContext: true,
            accessContext: null
        };
    }

    return {
        invalidAccessContext: false,
        accessContext: normalizedContext
    };
};

/*
 * Owner permission names become SQL identifiers, so they must
 * be selected from the fixed server-side whitelist.
 */
const validateOwnerPermission = ownerPermission => {
    if (
        typeof ownerPermission !== "string" ||
        !OWNER_PERMISSION_COLUMNS.has(
            ownerPermission
        )
    ) {
        throw new Error(
            "Invalid maintenance owner permission configuration."
        );
    }
};

/*
 * Build the owner-side EXISTS condition.
 *
 * An owner or primary relationship has elevated authority.
 * A regular owner-side relationship must have the operation's
 * specific maintenance permission.
 */
const buildOwnerAccessCondition = ({
    requestAlias,
    userPlaceholder,
    ownerPermission
}) => {
    validateOwnerPermission(ownerPermission);

    return `
        EXISTS (
            SELECT 1
            FROM owner_users AS maintenance_access_ou
            WHERE maintenance_access_ou.owner_id =
                    ${requestAlias}.owner_id
              AND maintenance_access_ou.user_id =
                    ${userPlaceholder}::BIGINT
              AND maintenance_access_ou.revoked_at IS NULL
              AND (
                    maintenance_access_ou.relationship_role =
                        'owner'
                    OR maintenance_access_ou.is_primary = TRUE
                    OR maintenance_access_ou.${ownerPermission} =
                        TRUE
              )
        )
    `;
};

/*
 * Tenant access is tied to the request's current active lease,
 * not merely to historical tenant membership.
 */
const buildTenantAccessCondition = ({
    requestAlias,
    userPlaceholder
}) => `
    ${requestAlias}.tenant_id IS NOT NULL
    AND ${requestAlias}.lease_id IS NOT NULL
    AND EXISTS (
        SELECT 1
        FROM leases AS maintenance_access_l
        INNER JOIN tenant_users AS maintenance_access_tu
            ON maintenance_access_tu.tenant_id =
                maintenance_access_l.tenant_id
           AND maintenance_access_tu.user_id =
                ${userPlaceholder}::BIGINT
           AND maintenance_access_tu.revoked_at IS NULL
           AND maintenance_access_tu.can_submit_maintenance =
                TRUE
        INNER JOIN tenants AS maintenance_access_t
            ON maintenance_access_t.id =
                maintenance_access_l.tenant_id
           AND maintenance_access_t.status = 'active'
           AND maintenance_access_t.deleted_at IS NULL
        WHERE maintenance_access_l.id =
                ${requestAlias}.lease_id
          AND maintenance_access_l.tenant_id =
                ${requestAlias}.tenant_id
          AND maintenance_access_l.owner_id =
                ${requestAlias}.owner_id
          AND maintenance_access_l.property_id =
                ${requestAlias}.property_id
          AND maintenance_access_l.unit_id =
                ${requestAlias}.unit_id
          AND maintenance_access_l.status = 'active'
          AND CURRENT_DATE BETWEEN
                maintenance_access_l.start_date
                AND maintenance_access_l.end_date
    )
`;

/*
 * Technician access depends on a current assignment whose
 * assigned_user_id matches the authenticated user.
 */
const buildTechnicianAccessCondition = ({
    requestAlias,
    userPlaceholder
}) => `
    EXISTS (
        SELECT 1
        FROM maintenance_assignments
            AS maintenance_access_ma
        WHERE maintenance_access_ma
                .maintenance_request_id =
                    ${requestAlias}.id
          AND maintenance_access_ma.assigned_user_id =
                ${userPlaceholder}::BIGINT
          AND maintenance_access_ma.status IN (
                'pending',
                'accepted',
                'active'
          )
    )
`;

/*
 * Retrieve one maintenance request only when the authenticated
 * user can execute the requested operation.
 *
 * Missing and inaccessible requests deliberately return the
 * same requestNotFound result to prevent identifier disclosure.
 */
const getAccessibleMaintenanceRequest = async ({
    client,
    maintenanceRequestPublicId,
    authenticatedUser,
    requestedAccessContext,
    allowedContexts,
    ownerPermission =
        "can_view_maintenance_requests",
    lockRequest = false
}) => {
    if (
        !client ||
        typeof client.query !== "function"
    ) {
        throw new Error(
            "A PostgreSQL client is required for maintenance access resolution."
        );
    }

    const contextResult =
        resolveMaintenanceAccessContext({
            authenticatedUser,
            requestedAccessContext,
            allowedContexts
        });

    if (contextResult.invalidAccessContext) {
        return {
            invalidAccessContext: true,
            requestNotFound: false,
            access_context: null,
            maintenance_request: null
        };
    }

    const accessContext =
        contextResult.accessContext;

    const values = [
        maintenanceRequestPublicId
    ];

    const conditions = [
        "mr.public_id = $1::VARCHAR(50)"
    ];

    if (accessContext === "owner") {
        values.push(authenticatedUser.id);

        conditions.push(
            buildOwnerAccessCondition({
                requestAlias: "mr",
                userPlaceholder:
                    `$${values.length}`,
                ownerPermission
            })
        );
    }

    if (accessContext === "tenant") {
        values.push(authenticatedUser.id);

        conditions.push(
            buildTenantAccessCondition({
                requestAlias: "mr",
                userPlaceholder:
                    `$${values.length}`
            })
        );
    }

    if (accessContext === "technician") {
        values.push(authenticatedUser.id);

        conditions.push(
            buildTechnicianAccessCondition({
                requestAlias: "mr",
                userPlaceholder:
                    `$${values.length}`
            })
        );
    }

    const lockClause = lockRequest
        ? "FOR UPDATE OF mr"
        : "";

    const requestResult = await client.query(
        `
        SELECT
            mr.id,
            mr.public_id,
            mr.request_number,
            mr.request_scope,
            mr.request_source,
            mr.preventive_plan_id,

            mr.owner_id,
            mr.property_id,
            mr.unit_id,
            mr.tenant_id,
            mr.lease_id,

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

            mr.reported_by,
            mr.reporter_type,
            mr.reported_at,

            mr.target_review_at,
            mr.target_work_start_at,
            mr.target_resolution_at,
            mr.review_overdue,
            mr.work_start_overdue,
            mr.resolution_overdue,

            mr.reviewed_at,
            mr.reviewed_by,
            mr.work_started_at,
            mr.work_started_by,
            mr.resolution_clock_paused_at,
            mr.total_resolution_hold_seconds,

            mr.resolution_confirmation_status,
            mr.resolution_confirmation_deadline_at,

            mr.total_estimated_cost,
            mr.total_approved_cost,
            mr.total_actual_cost,
            mr.currency_code,
            mr.coverage_type,
            mr.responsibility_status,

            mr.status_changed_by,
            mr.status_changed_at,
            mr.status_change_reason,
            mr.created_at,
            mr.updated_at

        FROM maintenance_requests AS mr

        WHERE
            ${conditions.join("\nAND ")}

        LIMIT 1
        ${lockClause}
        `,
        values
    );

    if (requestResult.rows.length === 0) {
        return {
            invalidAccessContext: false,
            requestNotFound: true,
            access_context: accessContext,
            maintenance_request: null
        };
    }

    return {
        invalidAccessContext: false,
        requestNotFound: false,
        access_context: accessContext,
        maintenance_request:
            requestResult.rows[0]
    };
};

/*
 * Resolve whether owner-side access may expose internal notes.
 * Admin always has that authority. Tenant and technician
 * contexts never obtain owner-internal-note permission here.
 */
const canViewInternalMaintenanceNotes = async ({
    client,
    requestOwnerId,
    authenticatedUser,
    accessContext
}) => {
    if (accessContext === "admin") {
        return true;
    }

    if (accessContext !== "owner") {
        return false;
    }

    const permissionResult = await client.query(
        `
        SELECT EXISTS (
            SELECT 1
            FROM owner_users AS ou
            WHERE ou.owner_id = $1::BIGINT
              AND ou.user_id = $2::BIGINT
              AND ou.revoked_at IS NULL
              AND (
                    ou.relationship_role = 'owner'
                    OR ou.is_primary = TRUE
                    OR ou.can_view_internal_maintenance_notes =
                        TRUE
              )
        ) AS can_view_internal_notes
        `,
        [
            requestOwnerId,
            authenticatedUser.id
        ]
    );

    return Boolean(
        permissionResult.rows[0]
            .can_view_internal_notes
    );
};

module.exports = {
    resolveMaintenanceAccessContext,
    getAccessibleMaintenanceRequest,
    canViewInternalMaintenanceNotes
};

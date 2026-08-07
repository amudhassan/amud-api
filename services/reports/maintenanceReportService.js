const pool = require("../../config/db");

const {
    REPORT_PERMISSION_MODES,
    resolveReportScope
} = require(
    "./reportAccessService"
);

const {
    createConditionBuilder,
    normalizeAmount,
    normalizeDecimal,
    buildReportContext,
    isScopeFailure
} = require(
    "./reportQueryUtils"
);

const resolveMaintenanceScope = async ({
    filters,
    authenticatedUser
}) => {
    return resolveReportScope({
        authenticatedUser,
        ownerPublicId:
            filters.owner_public_id || null,
        propertyPublicId:
            filters.property_public_id || null,
        permissionMode:
            REPORT_PERMISSION_MODES.MAINTENANCE
    });
};

const addMaintenanceFilters = ({
    conditions,
    builder,
    scope,
    filters,
    includeCurrency = false
}) => {
    if (scope.owner_ids !== null) {
        const placeholder =
            builder.addValue(
                scope.owner_ids
            );

        conditions.push(
            `mr.owner_id = ANY(${placeholder}::BIGINT[])`
        );
    }

    if (filters.property_public_id) {
        const placeholder =
            builder.addValue(
                filters.property_public_id
            );

        conditions.push(
            `p.public_id = ${placeholder}`
        );
    }

    if (filters.date_from) {
        const placeholder =
            builder.addValue(
                filters.date_from
            );

        conditions.push(
            `mr.reported_at >= ${placeholder}::date`
        );
    }

    if (filters.date_to) {
        const placeholder =
            builder.addValue(
                filters.date_to
            );

        conditions.push(
            `mr.reported_at < (${placeholder}::date + INTERVAL '1 day')`
        );
    }

    if (filters.status) {
        const placeholder =
            builder.addValue(
                filters.status
            );

        conditions.push(
            `mr.status = ${placeholder}`
        );
    }

    if (filters.priority) {
        const placeholder =
            builder.addValue(
                filters.priority
            );

        conditions.push(
            `mr.priority = ${placeholder}`
        );
    }

    if (filters.category) {
        const placeholder =
            builder.addValue(
                filters.category
            );

        conditions.push(
            `mr.category = ${placeholder}`
        );
    }

    if (
        includeCurrency &&
        filters.currency_code
    ) {
        const placeholder =
            builder.addValue(
                filters.currency_code
            );

        conditions.push(
            `mr.currency_code = ${placeholder}`
        );
    }
};

const buildMaintenanceContext = ({
    scope,
    filters,
    extraFilters = {}
}) => buildReportContext({
    scope,
    filters,
    extraFilters: {
        status:
            filters.status || null,
        priority:
            filters.priority || null,
        category:
            filters.category || null,
        ...extraFilters
    }
});

const getMaintenanceSummary = async ({
    filters,
    authenticatedUser
}) => {
    const scope = await resolveMaintenanceScope({
        filters,
        authenticatedUser
    });

    if (isScopeFailure(scope)) {
        return scope;
    }

    const builder =
        createConditionBuilder();

    const conditions = [
        "p.deleted_at IS NULL"
    ];

    addMaintenanceFilters({
        conditions,
        builder,
        scope,
        filters
    });

    const summaryResult = await pool.query(
        `
        SELECT
            COUNT(*)::INTEGER
                AS total_requests,

            COUNT(*) FILTER (
                WHERE mr.status NOT IN (
                    'closed',
                    'rejected',
                    'cancelled'
                )
            )::INTEGER
                AS open_requests,

            COUNT(*) FILTER (
                WHERE mr.status = 'resolved'
            )::INTEGER
                AS resolved_requests,

            COUNT(*) FILTER (
                WHERE mr.status = 'closed'
            )::INTEGER
                AS closed_requests,

            COUNT(*) FILTER (
                WHERE mr.priority = 'emergency'
            )::INTEGER
                AS emergency_requests,

            COUNT(*) FILTER (
                WHERE
                    mr.review_overdue = TRUE
                    OR mr.work_start_overdue = TRUE
                    OR mr.resolution_overdue = TRUE
            )::INTEGER
                AS overdue_requests
        FROM maintenance_requests AS mr
        INNER JOIN properties AS p
            ON p.id = mr.property_id
        WHERE ${conditions.join("\n          AND ")}
        `,
        builder.values
    );

    const groupBuilder =
        createConditionBuilder();

    const groupConditions = [
        "p.deleted_at IS NULL"
    ];

    addMaintenanceFilters({
        conditions: groupConditions,
        builder: groupBuilder,
        scope,
        filters
    });

    const statusResult = await pool.query(
        `
        SELECT
            mr.status,
            COUNT(*)::INTEGER AS request_count
        FROM maintenance_requests AS mr
        INNER JOIN properties AS p
            ON p.id = mr.property_id
        WHERE ${groupConditions.join("\n          AND ")}
        GROUP BY mr.status
        ORDER BY mr.status
        `,
        groupBuilder.values
    );

    const categoryBuilder =
        createConditionBuilder();

    const categoryConditions = [
        "p.deleted_at IS NULL"
    ];

    addMaintenanceFilters({
        conditions: categoryConditions,
        builder: categoryBuilder,
        scope,
        filters
    });

    const categoryResult = await pool.query(
        `
        SELECT
            mr.category,
            COUNT(*)::INTEGER AS request_count
        FROM maintenance_requests AS mr
        INNER JOIN properties AS p
            ON p.id = mr.property_id
        WHERE ${categoryConditions.join("\n          AND ")}
        GROUP BY mr.category
        ORDER BY
            request_count DESC,
            mr.category
        `,
        categoryBuilder.values
    );

    const priorityBuilder =
        createConditionBuilder();

    const priorityConditions = [
        "p.deleted_at IS NULL"
    ];

    addMaintenanceFilters({
        conditions: priorityConditions,
        builder: priorityBuilder,
        scope,
        filters
    });

    const priorityResult = await pool.query(
        `
        SELECT
            mr.priority,
            COUNT(*)::INTEGER AS request_count
        FROM maintenance_requests AS mr
        INNER JOIN properties AS p
            ON p.id = mr.property_id
        WHERE ${priorityConditions.join("\n          AND ")}
        GROUP BY mr.priority
        ORDER BY
            CASE mr.priority
                WHEN 'emergency' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
                ELSE 5
            END
        `,
        priorityBuilder.values
    );

    return {
        forbidden: false,
        report: {
            context:
                buildMaintenanceContext({
                    scope,
                    filters
                }),
            summary:
                summaryResult.rows[0],
            by_status:
                statusResult.rows,
            by_category:
                categoryResult.rows,
            by_priority:
                priorityResult.rows
        }
    };
};

const getMaintenancePerformance = async ({
    filters,
    authenticatedUser
}) => {
    const scope = await resolveMaintenanceScope({
        filters,
        authenticatedUser
    });

    if (isScopeFailure(scope)) {
        return scope;
    }

    const builder =
        createConditionBuilder();

    const conditions = [
        "p.deleted_at IS NULL"
    ];

    addMaintenanceFilters({
        conditions,
        builder,
        scope,
        filters
    });

    const performanceResult =
        await pool.query(
            `
            SELECT
                COUNT(*)::INTEGER
                    AS request_count,

                AVG(
                    EXTRACT(
                        EPOCH FROM (
                            mr.reviewed_at -
                            mr.reported_at
                        )
                    ) / 3600.0
                ) FILTER (
                    WHERE mr.reviewed_at
                        IS NOT NULL
                ) AS average_review_hours,

                AVG(
                    EXTRACT(
                        EPOCH FROM (
                            mr.work_started_at -
                            mr.reported_at
                        )
                    ) / 3600.0
                ) FILTER (
                    WHERE mr.work_started_at
                        IS NOT NULL
                ) AS average_work_start_hours,

                AVG(
                    GREATEST(
                        EXTRACT(
                            EPOCH FROM (
                                latest_resolution
                                    .work_completed_at -
                                mr.reported_at
                            )
                        ) -
                        mr.total_resolution_hold_seconds,
                        0
                    ) / 3600.0
                ) FILTER (
                    WHERE latest_resolution
                        .work_completed_at
                        IS NOT NULL
                ) AS average_resolution_hours,

                COUNT(*) FILTER (
                    WHERE mr.review_overdue = TRUE
                )::INTEGER
                    AS review_overdue_count,

                COUNT(*) FILTER (
                    WHERE mr.work_start_overdue = TRUE
                )::INTEGER
                    AS work_start_overdue_count,

                COUNT(*) FILTER (
                    WHERE mr.resolution_overdue = TRUE
                )::INTEGER
                    AS resolution_overdue_count
            FROM maintenance_requests AS mr
            INNER JOIN properties AS p
                ON p.id = mr.property_id
            LEFT JOIN LATERAL (
                SELECT
                    r.work_completed_at
                FROM maintenance_resolutions AS r
                WHERE
                    r.maintenance_request_id =
                        mr.id
                ORDER BY
                    r.sequence_number DESC
                LIMIT 1
            ) AS latest_resolution
                ON TRUE
            WHERE ${conditions.join("\n              AND ")}
            `,
            builder.values
        );

    const workloadBuilder =
        createConditionBuilder();

    const workloadConditions = [
        "p.deleted_at IS NULL",
        "ma.assignment_type = 'internal_technician'"
    ];

    addMaintenanceFilters({
        conditions: workloadConditions,
        builder: workloadBuilder,
        scope,
        filters
    });

    const limit =
        filters.limit || 50;

    const limitPlaceholder =
        workloadBuilder.addValue(limit);

    const workloadResult = await pool.query(
        `
        SELECT
            u.public_id
                AS user_public_id,
            u.full_name,

            COUNT(*) FILTER (
                WHERE ma.status IN (
                    'pending',
                    'accepted',
                    'active'
                )
            )::INTEGER
                AS active_assignment_count,

            COUNT(*) FILTER (
                WHERE ma.status = 'completed'
            )::INTEGER
                AS completed_assignment_count
        FROM maintenance_assignments AS ma
        INNER JOIN maintenance_requests AS mr
            ON mr.id =
                ma.maintenance_request_id
        INNER JOIN properties AS p
            ON p.id = mr.property_id
        INNER JOIN users AS u
            ON u.id = ma.assigned_user_id
        WHERE ${workloadConditions.join("\n          AND ")}
        GROUP BY
            u.id,
            u.public_id,
            u.full_name
        ORDER BY
            active_assignment_count DESC,
            completed_assignment_count DESC,
            u.full_name
        LIMIT ${limitPlaceholder}
        `,
        workloadBuilder.values
    );

    const row =
        performanceResult.rows[0];

    return {
        forbidden: false,
        report: {
            context:
                buildMaintenanceContext({
                    scope,
                    filters,
                    extraFilters: {
                        limit
                    }
                }),
            performance: {
                request_count:
                    Number(row.request_count),
                average_review_hours:
                    normalizeDecimal(
                        row.average_review_hours
                    ),
                average_work_start_hours:
                    normalizeDecimal(
                        row.average_work_start_hours
                    ),
                average_resolution_hours:
                    normalizeDecimal(
                        row.average_resolution_hours
                    ),
                review_overdue_count:
                    Number(
                        row.review_overdue_count
                    ),
                work_start_overdue_count:
                    Number(
                        row.work_start_overdue_count
                    ),
                resolution_overdue_count:
                    Number(
                        row.resolution_overdue_count
                    )
            },
            technician_workload:
                workloadResult.rows
        }
    };
};

const getMaintenanceCosts = async ({
    filters,
    authenticatedUser
}) => {
    const scope = await resolveMaintenanceScope({
        filters,
        authenticatedUser
    });

    if (isScopeFailure(scope)) {
        return scope;
    }

    const totalsBuilder =
        createConditionBuilder();

    const totalsConditions = [
        "p.deleted_at IS NULL"
    ];

    addMaintenanceFilters({
        conditions: totalsConditions,
        builder: totalsBuilder,
        scope,
        filters,
        includeCurrency: true
    });

    const totalsResult = await pool.query(
        `
        SELECT
            mr.currency_code,
            COUNT(*)::INTEGER
                AS request_count,
            COALESCE(
                SUM(mr.total_estimated_cost),
                0
            ) AS estimated_cost,
            COALESCE(
                SUM(mr.total_approved_cost),
                0
            ) AS approved_cost,
            COALESCE(
                SUM(mr.total_actual_cost),
                0
            ) AS actual_cost
        FROM maintenance_requests AS mr
        INNER JOIN properties AS p
            ON p.id = mr.property_id
        WHERE ${totalsConditions.join("\n          AND ")}
        GROUP BY mr.currency_code
        ORDER BY mr.currency_code
        `,
        totalsBuilder.values
    );

    const typeBuilder =
        createConditionBuilder();

    const typeConditions = [
        "p.deleted_at IS NULL"
    ];

    addMaintenanceFilters({
        conditions: typeConditions,
        builder: typeBuilder,
        scope,
        filters,
        includeCurrency: true
    });

    if (filters.currency_code) {
        const placeholder =
            typeBuilder.addValue(
                filters.currency_code
            );

        typeConditions.push(
            `mc.currency_code = ${placeholder}`
        );
    }

    const typeResult = await pool.query(
        `
        SELECT
            mc.currency_code,
            mc.cost_type,
            COUNT(*)::INTEGER
                AS cost_record_count,

            COALESCE(
                SUM(
                    CASE
                        WHEN mc.status NOT IN (
                            'rejected',
                            'cancelled'
                        )
                            THEN mc.estimated_amount
                        ELSE 0
                    END
                ),
                0
            ) AS estimated_cost,

            COALESCE(
                SUM(mc.approved_amount),
                0
            ) AS approved_cost,

            COALESCE(
                SUM(mc.actual_amount),
                0
            ) AS actual_cost
        FROM maintenance_costs AS mc
        INNER JOIN maintenance_requests AS mr
            ON mr.id =
                mc.maintenance_request_id
        INNER JOIN properties AS p
            ON p.id = mr.property_id
        WHERE ${typeConditions.join("\n          AND ")}
        GROUP BY
            mc.currency_code,
            mc.cost_type
        ORDER BY
            mc.currency_code,
            actual_cost DESC,
            mc.cost_type
        `,
        typeBuilder.values
    );

    return {
        forbidden: false,
        report: {
            context:
                buildMaintenanceContext({
                    scope,
                    filters
                }),
            currencies:
                totalsResult.rows.map(
                    row => ({
                        currency_code:
                            row.currency_code,
                        request_count:
                            row.request_count,
                        estimated_cost:
                            normalizeAmount(
                                row.estimated_cost
                            ),
                        approved_cost:
                            normalizeAmount(
                                row.approved_cost
                            ),
                        actual_cost:
                            normalizeAmount(
                                row.actual_cost
                            )
                    })
                ),
            by_cost_type:
                typeResult.rows.map(
                    row => ({
                        currency_code:
                            row.currency_code,
                        cost_type:
                            row.cost_type,
                        cost_record_count:
                            row.cost_record_count,
                        estimated_cost:
                            normalizeAmount(
                                row.estimated_cost
                            ),
                        approved_cost:
                            normalizeAmount(
                                row.approved_cost
                            ),
                        actual_cost:
                            normalizeAmount(
                                row.actual_cost
                            )
                    })
                )
        }
    };
};

module.exports = {
    resolveMaintenanceScope,
    getMaintenanceSummary,
    getMaintenancePerformance,
    getMaintenanceCosts
};

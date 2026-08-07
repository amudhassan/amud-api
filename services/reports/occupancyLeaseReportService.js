const pool = require("../../config/db");

const {
    REPORT_PERMISSION_MODES,
    resolveReportScope
} = require(
    "./reportAccessService"
);

const {
    createConditionBuilder,
    buildReportContext,
    isScopeFailure
} = require(
    "./reportQueryUtils"
);

const resolvePropertyScope = async ({
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
            REPORT_PERMISSION_MODES.PROPERTY
    });
};

const addPropertyScopeFilters = ({
    conditions,
    builder,
    scope,
    filters,
    propertyAlias = "p"
}) => {
    if (scope.owner_ids !== null) {
        const placeholder =
            builder.addValue(
                scope.owner_ids
            );

        conditions.push(`
            EXISTS (
                SELECT 1
                FROM property_owners AS po_scope
                WHERE po_scope.property_id =
                    ${propertyAlias}.id
                  AND po_scope.owner_id =
                    ANY(
                        ${placeholder}::BIGINT[]
                    )
                  AND po_scope.effective_to IS NULL
            )
        `);
    }

    if (filters.property_public_id) {
        const placeholder =
            builder.addValue(
                filters.property_public_id
            );

        conditions.push(
            `${propertyAlias}.public_id = ${placeholder}`
        );
    }
};

const addLeaseScopeFilters = ({
    conditions,
    builder,
    scope,
    filters
}) => {
    if (scope.owner_ids !== null) {
        const placeholder =
            builder.addValue(
                scope.owner_ids
            );

        conditions.push(
            `l.owner_id = ANY(${placeholder}::BIGINT[])`
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
};

const getOccupancyReport = async ({
    filters,
    authenticatedUser
}) => {
    const scope = await resolvePropertyScope({
        filters,
        authenticatedUser
    });

    if (isScopeFailure(scope)) {
        return scope;
    }

    const builder =
        createConditionBuilder();

    const conditions = [
        "p.deleted_at IS NULL",
        "u.deleted_at IS NULL"
    ];

    addPropertyScopeFilters({
        conditions,
        builder,
        scope,
        filters
    });

    const result = await pool.query(
        `
        SELECT
            COUNT(*)::INTEGER
                AS total_units,

            COUNT(*) FILTER (
                WHERE u.operational_status <> 'inactive'
            )::INTEGER
                AS rentable_units,

            COUNT(*) FILTER (
                WHERE u.operational_status = 'occupied'
            )::INTEGER
                AS occupied_units,

            COUNT(*) FILTER (
                WHERE u.operational_status = 'available'
            )::INTEGER
                AS available_units,

            COUNT(*) FILTER (
                WHERE u.operational_status = 'reserved'
            )::INTEGER
                AS reserved_units,

            COUNT(*) FILTER (
                WHERE u.operational_status = 'maintenance'
            )::INTEGER
                AS maintenance_units,

            COUNT(*) FILTER (
                WHERE u.operational_status = 'inactive'
            )::INTEGER
                AS inactive_units
        FROM units AS u
        INNER JOIN properties AS p
            ON p.id = u.property_id
        WHERE ${conditions.join("\n          AND ")}
        `,
        builder.values
    );

    const summaryRow =
        result.rows[0];

    const rentableUnits =
        Number(summaryRow.rentable_units);

    const occupiedUnits =
        Number(summaryRow.occupied_units);

    const propertyBuilder =
        createConditionBuilder();

    const propertyConditions = [
        "p.deleted_at IS NULL",
        "u.deleted_at IS NULL"
    ];

    addPropertyScopeFilters({
        conditions: propertyConditions,
        builder: propertyBuilder,
        scope,
        filters
    });

    const byPropertyResult =
        await pool.query(
            `
            SELECT
                p.public_id
                    AS property_public_id,
                p.property_code,
                p.property_name,
                p.operational_status
                    AS property_status,

                COUNT(*)::INTEGER
                    AS total_units,

                COUNT(*) FILTER (
                    WHERE u.operational_status
                        <> 'inactive'
                )::INTEGER
                    AS rentable_units,

                COUNT(*) FILTER (
                    WHERE u.operational_status =
                        'occupied'
                )::INTEGER
                    AS occupied_units,

                COUNT(*) FILTER (
                    WHERE u.operational_status =
                        'available'
                )::INTEGER
                    AS available_units,

                COUNT(*) FILTER (
                    WHERE u.operational_status =
                        'reserved'
                )::INTEGER
                    AS reserved_units,

                COUNT(*) FILTER (
                    WHERE u.operational_status =
                        'maintenance'
                )::INTEGER
                    AS maintenance_units,

                COUNT(*) FILTER (
                    WHERE u.operational_status =
                        'inactive'
                )::INTEGER
                    AS inactive_units
            FROM units AS u
            INNER JOIN properties AS p
                ON p.id = u.property_id
            WHERE ${propertyConditions.join("\n              AND ")}
            GROUP BY
                p.id,
                p.public_id,
                p.property_code,
                p.property_name,
                p.operational_status
            ORDER BY
                p.property_name,
                p.property_code
            `,
            propertyBuilder.values
        );

    return {
        forbidden: false,
        report: {
            context: buildReportContext({
                scope,
                filters
            }),
            summary: {
                total_units:
                    Number(summaryRow.total_units),
                rentable_units:
                    rentableUnits,
                occupied_units:
                    occupiedUnits,
                available_units:
                    Number(
                        summaryRow.available_units
                    ),
                reserved_units:
                    Number(
                        summaryRow.reserved_units
                    ),
                maintenance_units:
                    Number(
                        summaryRow.maintenance_units
                    ),
                inactive_units:
                    Number(
                        summaryRow.inactive_units
                    ),
                occupancy_rate_percent:
                    rentableUnits > 0
                        ? (
                            occupiedUnits /
                            rentableUnits *
                            100
                        ).toFixed(2)
                        : "0.00"
            },
            by_property:
                byPropertyResult.rows.map(
                    row => {
                        const propertyRentable =
                            Number(
                                row.rentable_units
                            );

                        const propertyOccupied =
                            Number(
                                row.occupied_units
                            );

                        return {
                            property: {
                                public_id:
                                    row.property_public_id,
                                property_code:
                                    row.property_code,
                                property_name:
                                    row.property_name,
                                operational_status:
                                    row.property_status
                            },
                            total_units:
                                Number(
                                    row.total_units
                                ),
                            rentable_units:
                                propertyRentable,
                            occupied_units:
                                propertyOccupied,
                            available_units:
                                Number(
                                    row.available_units
                                ),
                            reserved_units:
                                Number(
                                    row.reserved_units
                                ),
                            maintenance_units:
                                Number(
                                    row.maintenance_units
                                ),
                            inactive_units:
                                Number(
                                    row.inactive_units
                                ),
                            occupancy_rate_percent:
                                propertyRentable > 0
                                    ? (
                                        propertyOccupied /
                                        propertyRentable *
                                        100
                                    ).toFixed(2)
                                    : "0.00"
                        };
                    }
                )
        }
    };
};

const getLeaseReport = async ({
    filters,
    authenticatedUser
}) => {
    const scope = await resolvePropertyScope({
        filters,
        authenticatedUser
    });

    if (isScopeFailure(scope)) {
        return scope;
    }

    const summaryBuilder =
        createConditionBuilder();

    const summaryConditions = [
        "p.deleted_at IS NULL"
    ];

    addLeaseScopeFilters({
        conditions: summaryConditions,
        builder: summaryBuilder,
        scope,
        filters
    });

    if (filters.date_from) {
        const placeholder =
            summaryBuilder.addValue(
                filters.date_from
            );

        summaryConditions.push(
            `l.end_date >= ${placeholder}::date`
        );
    }

    if (filters.date_to) {
        const placeholder =
            summaryBuilder.addValue(
                filters.date_to
            );

        summaryConditions.push(
            `l.end_date <= ${placeholder}::date`
        );
    }

    if (filters.status) {
        const placeholder =
            summaryBuilder.addValue(
                filters.status
            );

        summaryConditions.push(
            `l.status = ${placeholder}`
        );
    }

    const summaryResult =
        await pool.query(
            `
            SELECT
                COUNT(*)::INTEGER
                    AS total_leases,

                COUNT(*) FILTER (
                    WHERE l.status = 'draft'
                )::INTEGER
                    AS draft_leases,

                COUNT(*) FILTER (
                    WHERE l.status = 'scheduled'
                )::INTEGER
                    AS scheduled_leases,

                COUNT(*) FILTER (
                    WHERE l.status = 'active'
                )::INTEGER
                    AS active_leases,

                COUNT(*) FILTER (
                    WHERE l.status = 'expired'
                )::INTEGER
                    AS expired_leases,

                COUNT(*) FILTER (
                    WHERE l.status = 'terminated'
                )::INTEGER
                    AS terminated_leases,

                COUNT(*) FILTER (
                    WHERE l.status = 'cancelled'
                )::INTEGER
                    AS cancelled_leases,

                COUNT(*) FILTER (
                    WHERE l.status = 'active'
                      AND l.end_date >= CURRENT_DATE
                      AND l.end_date <
                          CURRENT_DATE +
                          INTERVAL '30 days'
                )::INTEGER
                    AS expiring_30_days,

                COUNT(*) FILTER (
                    WHERE l.status = 'active'
                      AND l.end_date >= CURRENT_DATE
                      AND l.end_date <
                          CURRENT_DATE +
                          INTERVAL '60 days'
                )::INTEGER
                    AS expiring_60_days,

                COUNT(*) FILTER (
                    WHERE l.status = 'active'
                      AND l.end_date >= CURRENT_DATE
                      AND l.end_date <
                          CURRENT_DATE +
                          INTERVAL '90 days'
                )::INTEGER
                    AS expiring_90_days
            FROM leases AS l
            INNER JOIN properties AS p
                ON p.id = l.property_id
            WHERE ${summaryConditions.join("\n              AND ")}
            `,
            summaryBuilder.values
        );

    const detailBuilder =
        createConditionBuilder();

    const detailConditions = [
        "p.deleted_at IS NULL",
        "u.deleted_at IS NULL"
    ];

    addLeaseScopeFilters({
        conditions: detailConditions,
        builder: detailBuilder,
        scope,
        filters
    });

    if (filters.date_from) {
        const placeholder =
            detailBuilder.addValue(
                filters.date_from
            );

        detailConditions.push(
            `l.end_date >= ${placeholder}::date`
        );
    }

    if (filters.date_to) {
        const placeholder =
            detailBuilder.addValue(
                filters.date_to
            );

        detailConditions.push(
            `l.end_date <= ${placeholder}::date`
        );
    }

    if (filters.status) {
        const placeholder =
            detailBuilder.addValue(
                filters.status
            );

        detailConditions.push(
            `l.status = ${placeholder}`
        );
    }

    const limit =
        filters.limit || 50;

    const limitPlaceholder =
        detailBuilder.addValue(limit);

    const detailResult =
        await pool.query(
            `
            SELECT
                l.public_id
                    AS lease_public_id,
                l.lease_number,
                l.status,
                l.start_date,
                l.end_date,
                l.currency_code,
                l.rent_amount,
                l.billing_frequency,

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
                t.tenant_type,
                t.display_name
                    AS tenant_display_name
            FROM leases AS l
            INNER JOIN properties AS p
                ON p.id = l.property_id
            INNER JOIN units AS u
                ON u.id = l.unit_id
            INNER JOIN tenants AS t
                ON t.id = l.tenant_id
            WHERE ${detailConditions.join("\n              AND ")}
            ORDER BY
                l.end_date,
                l.id
            LIMIT ${limitPlaceholder}
            `,
            detailBuilder.values
        );

    return {
        forbidden: false,
        report: {
            context: buildReportContext({
                scope,
                filters,
                extraFilters: {
                    status:
                        filters.status || null,
                    limit
                }
            }),
            summary:
                summaryResult.rows[0],
            leases:
                detailResult.rows.map(
                    row => ({
                        public_id:
                            row.lease_public_id,
                        lease_number:
                            row.lease_number,
                        status:
                            row.status,
                        start_date:
                            row.start_date,
                        end_date:
                            row.end_date,
                        currency_code:
                            row.currency_code,
                        rent_amount:
                            Number(
                                row.rent_amount
                            ).toFixed(2),
                        billing_frequency:
                            row.billing_frequency,
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
                                row.unit_name
                        },
                        tenant: {
                            public_id:
                                row.tenant_public_id,
                            tenant_type:
                                row.tenant_type,
                            display_name:
                                row.tenant_display_name
                        }
                    })
                )
        }
    };
};

const getExpiringLeasesReport = async ({
    filters,
    authenticatedUser
}) => {
    const scope = await resolvePropertyScope({
        filters,
        authenticatedUser
    });

    if (isScopeFailure(scope)) {
        return scope;
    }

    const builder =
        createConditionBuilder();

    const conditions = [
        "l.status = 'active'",
        "l.end_date >= CURRENT_DATE",
        "p.deleted_at IS NULL",
        "u.deleted_at IS NULL"
    ];

    addLeaseScopeFilters({
        conditions,
        builder,
        scope,
        filters
    });

    const days =
        filters.days || 30;

    const daysPlaceholder =
        builder.addValue(days);

    conditions.push(
        `l.end_date < CURRENT_DATE + (${daysPlaceholder}::INTEGER * INTERVAL '1 day')`
    );

    const limit =
        filters.limit || 100;

    const limitPlaceholder =
        builder.addValue(limit);

    const result = await pool.query(
        `
        SELECT
            l.public_id
                AS lease_public_id,
            l.lease_number,
            l.start_date,
            l.end_date,
            (l.end_date - CURRENT_DATE)::INTEGER
                AS days_remaining,
            l.currency_code,
            l.rent_amount,

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
            t.tenant_type,
            t.display_name
                AS tenant_display_name
        FROM leases AS l
        INNER JOIN properties AS p
            ON p.id = l.property_id
        INNER JOIN units AS u
            ON u.id = l.unit_id
        INNER JOIN tenants AS t
            ON t.id = l.tenant_id
        WHERE ${conditions.join("\n          AND ")}
        ORDER BY
            l.end_date,
            l.id
        LIMIT ${limitPlaceholder}
        `,
        builder.values
    );

    return {
        forbidden: false,
        report: {
            context: buildReportContext({
                scope,
                filters,
                extraFilters: {
                    days,
                    limit
                }
            }),
            expiring_count:
                result.rows.length,
            leases:
                result.rows.map(
                    row => ({
                        public_id:
                            row.lease_public_id,
                        lease_number:
                            row.lease_number,
                        start_date:
                            row.start_date,
                        end_date:
                            row.end_date,
                        days_remaining:
                            row.days_remaining,
                        currency_code:
                            row.currency_code,
                        rent_amount:
                            Number(
                                row.rent_amount
                            ).toFixed(2),
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
                                row.unit_name
                        },
                        tenant: {
                            public_id:
                                row.tenant_public_id,
                            tenant_type:
                                row.tenant_type,
                            display_name:
                                row.tenant_display_name
                        }
                    })
                )
        }
    };
};

module.exports = {
    resolvePropertyScope,
    getOccupancyReport,
    getLeaseReport,
    getExpiringLeasesReport
};

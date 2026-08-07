const pool = require("../../config/db");

const {
    REPORT_PERMISSION_MODES,
    resolveReportScope
} = require(
    "./reportAccessService"
);

const {
    getOccupancyReport,
    getExpiringLeasesReport
} = require(
    "./occupancyLeaseReportService"
);

const {
    getFinancialSummary
} = require(
    "./financialReportService"
);

const {
    getMaintenanceSummary
} = require(
    "./maintenanceReportService"
);

const {
    createConditionBuilder,
    buildReportContext,
    isScopeFailure
} = require(
    "./reportQueryUtils"
);

const getRecentPaymentActivity = async ({
    filters,
    authenticatedUser
}) => {
    const scope = await resolveReportScope({
        authenticatedUser,
        ownerPublicId:
            filters.owner_public_id || null,
        propertyPublicId:
            filters.property_public_id || null,
        permissionMode:
            REPORT_PERMISSION_MODES.FINANCIAL
    });

    if (isScopeFailure(scope)) {
        return [];
    }

    const builder =
        createConditionBuilder();

    const conditions = [];

    if (scope.owner_ids !== null) {
        const placeholder =
            builder.addValue(
                scope.owner_ids
            );

        conditions.push(
            `rp.owner_id = ANY(${placeholder}::BIGINT[])`
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

    const whereClause =
        conditions.length > 0
            ? `WHERE ${conditions.join("\n          AND ")}`
            : "";

    const result = await pool.query(
        `
        SELECT
            recent.payment_public_id,
            recent.receipt_number,
            recent.status,
            recent.amount,
            recent.currency_code,
            recent.occurred_at,
            recent.property_public_id,
            recent.property_code,
            recent.property_name
        FROM (
            SELECT DISTINCT ON (rp.id)
                rp.id,
                rp.public_id
                    AS payment_public_id,
                rp.receipt_number,
                rp.status,
                rp.amount,
                rp.currency_code,
                rp.paid_at
                    AS occurred_at,
                p.public_id
                    AS property_public_id,
                p.property_code,
                p.property_name
            FROM rent_payments AS rp
            INNER JOIN rent_payment_allocations AS rpa
                ON rpa.payment_id = rp.id
            INNER JOIN rent_invoices AS ri
                ON ri.id = rpa.invoice_id
            INNER JOIN properties AS p
                ON p.id = ri.property_id
            ${whereClause}
            ORDER BY
                rp.id,
                rp.paid_at DESC
        ) AS recent
        ORDER BY
            recent.occurred_at DESC,
            recent.id DESC
        LIMIT 10
        `,
        builder.values
    );

    return result.rows.map(
        row => ({
            activity_type:
                row.status === "reversed"
                    ? "payment_reversed"
                    : "payment_recorded",
            occurred_at:
                row.occurred_at,
            reference: {
                type: "payment",
                public_id:
                    row.payment_public_id,
                receipt_number:
                    row.receipt_number
            },
            summary: {
                status:
                    row.status,
                amount:
                    Number(
                        row.amount
                    ).toFixed(2),
                currency_code:
                    row.currency_code
            },
            property: {
                public_id:
                    row.property_public_id,
                property_code:
                    row.property_code,
                property_name:
                    row.property_name
            }
        })
    );
};

const getRecentMaintenanceActivity = async ({
    filters,
    authenticatedUser
}) => {
    const scope = await resolveReportScope({
        authenticatedUser,
        ownerPublicId:
            filters.owner_public_id || null,
        propertyPublicId:
            filters.property_public_id || null,
        permissionMode:
            REPORT_PERMISSION_MODES.MAINTENANCE
    });

    if (isScopeFailure(scope)) {
        return [];
    }

    const builder =
        createConditionBuilder();

    const conditions = [];

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

    const whereClause =
        conditions.length > 0
            ? `WHERE ${conditions.join("\n          AND ")}`
            : "";

    const result = await pool.query(
        `
        SELECT
            mah.activity_type,
            mah.created_at
                AS occurred_at,
            mr.public_id
                AS maintenance_request_public_id,
            mr.request_number,
            mr.title,
            mr.status,
            mr.priority,
            p.public_id
                AS property_public_id,
            p.property_code,
            p.property_name
        FROM maintenance_activity_history AS mah
        INNER JOIN maintenance_requests AS mr
            ON mr.id =
                mah.maintenance_request_id
        INNER JOIN properties AS p
            ON p.id = mr.property_id
        ${whereClause}
        ORDER BY
            mah.created_at DESC,
            mah.id DESC
        LIMIT 10
        `,
        builder.values
    );

    return result.rows.map(
        row => ({
            activity_type:
                row.activity_type,
            occurred_at:
                row.occurred_at,
            reference: {
                type:
                    "maintenance_request",
                public_id:
                    row.maintenance_request_public_id,
                request_number:
                    row.request_number
            },
            summary: {
                title:
                    row.title,
                status:
                    row.status,
                priority:
                    row.priority
            },
            property: {
                public_id:
                    row.property_public_id,
                property_code:
                    row.property_code,
                property_name:
                    row.property_name
            }
        })
    );
};

const getDashboard = async ({
    filters,
    authenticatedUser
}) => {
    const [
        occupancyResult,
        expiringResult,
        financialResult,
        maintenanceResult,
        recentPayments,
        recentMaintenance
    ] = await Promise.all([
        getOccupancyReport({
            filters,
            authenticatedUser
        }),
        getExpiringLeasesReport({
            filters: {
                ...filters,
                days: 30,
                limit: 10
            },
            authenticatedUser
        }),
        getFinancialSummary({
            filters,
            authenticatedUser
        }),
        getMaintenanceSummary({
            filters,
            authenticatedUser
        }),
        getRecentPaymentActivity({
            filters,
            authenticatedUser
        }),
        getRecentMaintenanceActivity({
            filters,
            authenticatedUser
        })
    ]);

    const propertyAccessible =
        !isScopeFailure(
            occupancyResult
        );

    const financeAccessible =
        !isScopeFailure(
            financialResult
        );

    const maintenanceAccessible =
        !isScopeFailure(
            maintenanceResult
        );

    if (
        !propertyAccessible &&
        !financeAccessible &&
        !maintenanceAccessible
    ) {
        if (
            filters.property_public_id &&
            (
                occupancyResult
                    .propertyNotFound ||
                financialResult
                    .propertyNotFound ||
                maintenanceResult
                    .propertyNotFound
            )
        ) {
            return {
                propertyNotFound: true
            };
        }

        if (
            filters.owner_public_id &&
            (
                occupancyResult.ownerNotFound ||
                financialResult.ownerNotFound ||
                maintenanceResult.ownerNotFound
            )
        ) {
            return {
                ownerNotFound: true
            };
        }

        return {
            forbidden: true
        };
    }

    const managementScope =
        await resolveReportScope({
            authenticatedUser,
            ownerPublicId:
                filters.owner_public_id || null,
            propertyPublicId:
                filters.property_public_id || null,
            permissionMode:
                REPORT_PERMISSION_MODES.MANAGEMENT
        });

    const recentActivity = [
        ...recentPayments,
        ...recentMaintenance
    ]
        .sort(
            (left, right) =>
                new Date(
                    right.occurred_at
                ).getTime() -
                new Date(
                    left.occurred_at
                ).getTime()
        )
        .slice(0, 10);

    return {
        forbidden: false,
        dashboard: {
            context:
                isScopeFailure(
                    managementScope
                )
                    ? {
                        access_type:
                            authenticatedUser.role ===
                                "admin"
                                ? "admin"
                                : "owner_user",
                        selected_owner: null,
                        selected_property: null,
                        filters
                    }
                    : buildReportContext({
                        scope:
                            managementScope,
                        filters
                    }),

            section_access: {
                portfolio_and_leases:
                    propertyAccessible,
                financial:
                    financeAccessible,
                maintenance:
                    maintenanceAccessible
            },

            portfolio:
                propertyAccessible
                    ? occupancyResult.report
                        .summary
                    : null,

            expiring_leases_30_days:
                propertyAccessible
                    ? {
                        count:
                            expiringResult.report
                                .expiring_count,
                        leases:
                            expiringResult.report
                                .leases
                    }
                    : null,

            financial:
                financeAccessible
                    ? financialResult.report
                        .currencies
                    : null,

            maintenance:
                maintenanceAccessible
                    ? maintenanceResult.report
                        .summary
                    : null,

            recent_activity:
                recentActivity
        }
    };
};

module.exports = {
    getDashboard
};

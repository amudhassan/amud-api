const pool = require("../../config/db");

const {
    REPORT_PERMISSION_MODES,
    resolveReportScope
} = require(
    "./reportAccessService"
);

const PERIOD_SQL = Object.freeze({
    daily: "day",
    weekly: "week",
    monthly: "month",
    quarterly: "quarter",
    yearly: "year"
});

const resolveFinancialScope = async ({
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
            REPORT_PERMISSION_MODES.FINANCIAL
    });
};

const createConditionBuilder = () => {
    const values = [];

    const addValue = value => {
        values.push(value);
        return `$${values.length}`;
    };

    return {
        values,
        addValue
    };
};

const addSharedInvoiceFilters = ({
    conditions,
    builder,
    scope,
    filters,
    dateColumn = "ri.issue_date"
}) => {
    if (scope.owner_ids !== null) {
        const placeholder =
            builder.addValue(
                scope.owner_ids
            );

        conditions.push(
            `ri.owner_id = ANY(${placeholder}::BIGINT[])`
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

    if (filters.currency_code) {
        const placeholder =
            builder.addValue(
                filters.currency_code
            );

        conditions.push(
            `ri.currency_code = ${placeholder}`
        );
    }

    if (filters.date_from) {
        const placeholder =
            builder.addValue(
                filters.date_from
            );

        conditions.push(
            `${dateColumn} >= ${placeholder}::date`
        );
    }

    if (filters.date_to) {
        const placeholder =
            builder.addValue(
                filters.date_to
            );

        conditions.push(
            `${dateColumn} < (${placeholder}::date + INTERVAL '1 day')`
        );
    }
};

const addSharedPaymentFilters = ({
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
            `ri.owner_id = ANY(${placeholder}::BIGINT[])`
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

    if (filters.currency_code) {
        const placeholder =
            builder.addValue(
                filters.currency_code
            );

        conditions.push(
            `rp.currency_code = ${placeholder}`
        );
    }

    if (filters.date_from) {
        const placeholder =
            builder.addValue(
                filters.date_from
            );

        conditions.push(
            `rp.paid_at >= ${placeholder}::date`
        );
    }

    if (filters.date_to) {
        const placeholder =
            builder.addValue(
                filters.date_to
            );

        conditions.push(
            `rp.paid_at < (${placeholder}::date + INTERVAL '1 day')`
        );
    }
};

const normalizeAmount = value => {
    if (value === null || value === undefined) {
        return "0.00";
    }

    return Number(value).toFixed(2);
};

const buildContext = ({
    scope,
    filters,
    period = null
}) => ({
    access_type: scope.access_type,
    selected_owner: scope.selected_owner,
    selected_property: scope.selected_property,
    filters: {
        date_from: filters.date_from || null,
        date_to: filters.date_to || null,
        currency_code:
            filters.currency_code || null,
        period
    }
});

const getFinancialSummary = async ({
    filters,
    authenticatedUser
}) => {
    const scope = await resolveFinancialScope({
        filters,
        authenticatedUser
    });

    if (
        scope.forbidden ||
        scope.ownerNotFound ||
        scope.propertyNotFound
    ) {
        return scope;
    }

    const invoiceBuilder =
        createConditionBuilder();

    const invoiceConditions = [
        "ri.status NOT IN ('draft', 'void')"
    ];

    addSharedInvoiceFilters({
        conditions: invoiceConditions,
        builder: invoiceBuilder,
        scope,
        filters
    });

    const invoiceResult = await pool.query(
        `
        SELECT
            ri.currency_code,
            COUNT(*)::INTEGER
                AS invoice_count,
            COALESCE(
                SUM(ri.total_amount),
                0
            ) AS total_invoiced,
            COALESCE(
                SUM(ri.balance_amount),
                0
            ) AS outstanding_balance,
            COALESCE(
                SUM(
                    CASE
                        WHEN ri.balance_amount > 0
                         AND ri.due_date < CURRENT_DATE
                            THEN ri.balance_amount
                        ELSE 0
                    END
                ),
                0
            ) AS overdue_balance,
            COUNT(*) FILTER (
                WHERE ri.balance_amount > 0
                  AND ri.due_date < CURRENT_DATE
            )::INTEGER AS overdue_invoice_count
        FROM rent_invoices AS ri
        INNER JOIN properties AS p
            ON p.id = ri.property_id
        WHERE ${invoiceConditions.join("\n          AND ")}
        GROUP BY ri.currency_code
        ORDER BY ri.currency_code
        `,
        invoiceBuilder.values
    );

    const paymentBuilder =
        createConditionBuilder();

    const paymentConditions = [
        "rp.status = 'completed'"
    ];

    addSharedPaymentFilters({
        conditions: paymentConditions,
        builder: paymentBuilder,
        scope,
        filters
    });

    const paymentResult = await pool.query(
        `
        SELECT
            rp.currency_code,
            COUNT(DISTINCT rp.id)::INTEGER
                AS completed_payment_count,
            COALESCE(
                SUM(rpa.allocated_amount),
                0
            ) AS total_collected
        FROM rent_payment_allocations AS rpa
        INNER JOIN rent_payments AS rp
            ON rp.id = rpa.payment_id
        INNER JOIN rent_invoices AS ri
            ON ri.id = rpa.invoice_id
        INNER JOIN properties AS p
            ON p.id = ri.property_id
        WHERE ${paymentConditions.join("\n          AND ")}
        GROUP BY rp.currency_code
        ORDER BY rp.currency_code
        `,
        paymentBuilder.values
    );

    const currencies = new Map();

    for (const row of invoiceResult.rows) {
        currencies.set(
            row.currency_code,
            {
                currency_code:
                    row.currency_code,
                invoice_count:
                    row.invoice_count,
                completed_payment_count: 0,
                total_invoiced:
                    normalizeAmount(
                        row.total_invoiced
                    ),
                total_collected: "0.00",
                outstanding_balance:
                    normalizeAmount(
                        row.outstanding_balance
                    ),
                overdue_balance:
                    normalizeAmount(
                        row.overdue_balance
                    ),
                overdue_invoice_count:
                    row.overdue_invoice_count,
                collection_rate_percent:
                    "0.00"
            }
        );
    }

    for (const row of paymentResult.rows) {
        const existing =
            currencies.get(row.currency_code) || {
                currency_code:
                    row.currency_code,
                invoice_count: 0,
                completed_payment_count: 0,
                total_invoiced: "0.00",
                total_collected: "0.00",
                outstanding_balance: "0.00",
                overdue_balance: "0.00",
                overdue_invoice_count: 0,
                collection_rate_percent:
                    "0.00"
            };

        existing.completed_payment_count =
            row.completed_payment_count;

        existing.total_collected =
            normalizeAmount(
                row.total_collected
            );

        currencies.set(
            row.currency_code,
            existing
        );
    }

    for (const summary of currencies.values()) {
        const invoiced =
            Number(summary.total_invoiced);

        const collected =
            Number(summary.total_collected);

        summary.collection_rate_percent =
            invoiced > 0
                ? (
                    collected /
                    invoiced *
                    100
                ).toFixed(2)
                : "0.00";
    }

    return {
        forbidden: false,
        report: {
            context: buildContext({
                scope,
                filters
            }),
            currencies: Array.from(
                currencies.values()
            )
        }
    };
};

const getRevenueReport = async ({
    filters,
    authenticatedUser
}) => {
    const scope = await resolveFinancialScope({
        filters,
        authenticatedUser
    });

    if (
        scope.forbidden ||
        scope.ownerNotFound ||
        scope.propertyNotFound
    ) {
        return scope;
    }

    const period =
        filters.period || "monthly";

    const sqlPeriod =
        PERIOD_SQL[period] || "month";

    const trendBuilder =
        createConditionBuilder();

    const trendConditions = [
        "rp.status = 'completed'"
    ];

    addSharedPaymentFilters({
        conditions: trendConditions,
        builder: trendBuilder,
        scope,
        filters
    });

    const trendResult = await pool.query(
        `
        SELECT
            to_char(
                date_trunc(
                    '${sqlPeriod}',
                    rp.paid_at
                ),
                'YYYY-MM-DD'
            ) AS period_start,
            rp.currency_code,
            COUNT(DISTINCT rp.id)::INTEGER
                AS payment_count,
            COALESCE(
                SUM(rpa.allocated_amount),
                0
            ) AS collected_amount
        FROM rent_payment_allocations AS rpa
        INNER JOIN rent_payments AS rp
            ON rp.id = rpa.payment_id
        INNER JOIN rent_invoices AS ri
            ON ri.id = rpa.invoice_id
        INNER JOIN properties AS p
            ON p.id = ri.property_id
        WHERE ${trendConditions.join("\n          AND ")}
        GROUP BY
            date_trunc(
                '${sqlPeriod}',
                rp.paid_at
            ),
            rp.currency_code
        ORDER BY
            date_trunc(
                '${sqlPeriod}',
                rp.paid_at
            ),
            rp.currency_code
        `,
        trendBuilder.values
    );

    const propertyBuilder =
        createConditionBuilder();

    const propertyConditions = [
        "rp.status = 'completed'"
    ];

    addSharedPaymentFilters({
        conditions: propertyConditions,
        builder: propertyBuilder,
        scope,
        filters
    });

    const propertyResult = await pool.query(
        `
        SELECT
            p.public_id
                AS property_public_id,
            p.property_code,
            p.property_name,
            rp.currency_code,
            COUNT(DISTINCT rp.id)::INTEGER
                AS payment_count,
            COALESCE(
                SUM(rpa.allocated_amount),
                0
            ) AS collected_amount
        FROM rent_payment_allocations AS rpa
        INNER JOIN rent_payments AS rp
            ON rp.id = rpa.payment_id
        INNER JOIN rent_invoices AS ri
            ON ri.id = rpa.invoice_id
        INNER JOIN properties AS p
            ON p.id = ri.property_id
        WHERE ${propertyConditions.join("\n          AND ")}
        GROUP BY
            p.id,
            p.public_id,
            p.property_code,
            p.property_name,
            rp.currency_code
        ORDER BY
            collected_amount DESC,
            p.property_name,
            rp.currency_code
        `,
        propertyBuilder.values
    );

    return {
        forbidden: false,
        report: {
            context: buildContext({
                scope,
                filters,
                period
            }),
            trend: trendResult.rows.map(
                row => ({
                    period_start:
                        row.period_start,
                    currency_code:
                        row.currency_code,
                    payment_count:
                        row.payment_count,
                    collected_amount:
                        normalizeAmount(
                            row.collected_amount
                        )
                })
            ),
            by_property:
                propertyResult.rows.map(
                    row => ({
                        property: {
                            public_id:
                                row.property_public_id,
                            property_code:
                                row.property_code,
                            property_name:
                                row.property_name
                        },
                        currency_code:
                            row.currency_code,
                        payment_count:
                            row.payment_count,
                        collected_amount:
                            normalizeAmount(
                                row.collected_amount
                            )
                    })
                )
        }
    };
};

const getOutstandingReport = async ({
    filters,
    authenticatedUser
}) => {
    const scope = await resolveFinancialScope({
        filters,
        authenticatedUser
    });

    if (
        scope.forbidden ||
        scope.ownerNotFound ||
        scope.propertyNotFound
    ) {
        return scope;
    }

    const limit =
        filters.limit || 20;

    const summaryBuilder =
        createConditionBuilder();

    const summaryConditions = [
        "ri.status IN ('issued', 'partially_paid', 'overdue')",
        "ri.balance_amount > 0"
    ];

    addSharedInvoiceFilters({
        conditions: summaryConditions,
        builder: summaryBuilder,
        scope,
        filters
    });

    const summaryResult = await pool.query(
        `
        SELECT
            ri.currency_code,
            COUNT(*)::INTEGER
                AS open_invoice_count,
            COALESCE(
                SUM(ri.balance_amount),
                0
            ) AS outstanding_balance,
            COUNT(*) FILTER (
                WHERE ri.due_date < CURRENT_DATE
            )::INTEGER AS overdue_invoice_count,
            COALESCE(
                SUM(
                    CASE
                        WHEN ri.due_date < CURRENT_DATE
                            THEN ri.balance_amount
                        ELSE 0
                    END
                ),
                0
            ) AS overdue_balance
        FROM rent_invoices AS ri
        INNER JOIN properties AS p
            ON p.id = ri.property_id
        WHERE ${summaryConditions.join("\n          AND ")}
        GROUP BY ri.currency_code
        ORDER BY ri.currency_code
        `,
        summaryBuilder.values
    );

    const tenantBuilder =
        createConditionBuilder();

    const tenantConditions = [
        "ri.status IN ('issued', 'partially_paid', 'overdue')",
        "ri.balance_amount > 0"
    ];

    addSharedInvoiceFilters({
        conditions: tenantConditions,
        builder: tenantBuilder,
        scope,
        filters
    });

    const limitPlaceholder =
        tenantBuilder.addValue(limit);

    const tenantResult = await pool.query(
        `
        SELECT
            t.public_id
                AS tenant_public_id,
            t.tenant_type,
            t.display_name
                AS tenant_display_name,
            ri.currency_code,
            COUNT(*)::INTEGER
                AS open_invoice_count,
            COALESCE(
                SUM(ri.balance_amount),
                0
            ) AS outstanding_balance,
            MIN(ri.due_date)
                AS oldest_due_date
        FROM rent_invoices AS ri
        INNER JOIN properties AS p
            ON p.id = ri.property_id
        INNER JOIN tenants AS t
            ON t.id = ri.tenant_id
        WHERE ${tenantConditions.join("\n          AND ")}
        GROUP BY
            t.id,
            t.public_id,
            t.tenant_type,
            t.display_name,
            ri.currency_code
        ORDER BY
            outstanding_balance DESC,
            oldest_due_date,
            t.display_name
        LIMIT ${limitPlaceholder}
        `,
        tenantBuilder.values
    );

    const invoiceBuilder =
        createConditionBuilder();

    const invoiceConditions = [
        "ri.status IN ('issued', 'partially_paid', 'overdue')",
        "ri.balance_amount > 0"
    ];

    addSharedInvoiceFilters({
        conditions: invoiceConditions,
        builder: invoiceBuilder,
        scope,
        filters
    });

    const invoiceLimitPlaceholder =
        invoiceBuilder.addValue(limit);

    const invoiceResult = await pool.query(
        `
        SELECT
            ri.public_id
                AS invoice_public_id,
            ri.invoice_number,
            ri.status,
            ri.due_date,
            ri.currency_code,
            ri.total_amount,
            ri.paid_amount,
            ri.balance_amount,
            (ri.due_date < CURRENT_DATE)
                AS is_overdue,
            p.public_id
                AS property_public_id,
            p.property_code,
            p.property_name,
            t.public_id
                AS tenant_public_id,
            t.tenant_type,
            t.display_name
                AS tenant_display_name
        FROM rent_invoices AS ri
        INNER JOIN properties AS p
            ON p.id = ri.property_id
        INNER JOIN tenants AS t
            ON t.id = ri.tenant_id
        WHERE ${invoiceConditions.join("\n          AND ")}
        ORDER BY
            is_overdue DESC,
            ri.due_date,
            ri.id
        LIMIT ${invoiceLimitPlaceholder}
        `,
        invoiceBuilder.values
    );

    return {
        forbidden: false,
        report: {
            context: buildContext({
                scope,
                filters
            }),
            summary: summaryResult.rows.map(
                row => ({
                    currency_code:
                        row.currency_code,
                    open_invoice_count:
                        row.open_invoice_count,
                    outstanding_balance:
                        normalizeAmount(
                            row.outstanding_balance
                        ),
                    overdue_invoice_count:
                        row.overdue_invoice_count,
                    overdue_balance:
                        normalizeAmount(
                            row.overdue_balance
                        )
                })
            ),
            top_tenants:
                tenantResult.rows.map(
                    row => ({
                        tenant: {
                            public_id:
                                row.tenant_public_id,
                            tenant_type:
                                row.tenant_type,
                            display_name:
                                row.tenant_display_name
                        },
                        currency_code:
                            row.currency_code,
                        open_invoice_count:
                            row.open_invoice_count,
                        outstanding_balance:
                            normalizeAmount(
                                row.outstanding_balance
                            ),
                        oldest_due_date:
                            row.oldest_due_date
                    })
                ),
            invoices:
                invoiceResult.rows.map(
                    row => ({
                        public_id:
                            row.invoice_public_id,
                        invoice_number:
                            row.invoice_number,
                        status: row.status,
                        due_date: row.due_date,
                        currency_code:
                            row.currency_code,
                        total_amount:
                            normalizeAmount(
                                row.total_amount
                            ),
                        paid_amount:
                            normalizeAmount(
                                row.paid_amount
                            ),
                        balance_amount:
                            normalizeAmount(
                                row.balance_amount
                            ),
                        is_overdue:
                            row.is_overdue === true,
                        property: {
                            public_id:
                                row.property_public_id,
                            property_code:
                                row.property_code,
                            property_name:
                                row.property_name
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

const getCollectionsReport = async ({
    filters,
    authenticatedUser
}) => {
    const scope = await resolveFinancialScope({
        filters,
        authenticatedUser
    });

    if (
        scope.forbidden ||
        scope.ownerNotFound ||
        scope.propertyNotFound
    ) {
        return scope;
    }

    const period =
        filters.period || "monthly";

    const sqlPeriod =
        PERIOD_SQL[period] || "month";

    const methodBuilder =
        createConditionBuilder();

    const methodConditions = [
        "rp.status = 'completed'"
    ];

    addSharedPaymentFilters({
        conditions: methodConditions,
        builder: methodBuilder,
        scope,
        filters
    });

    const methodResult = await pool.query(
        `
        SELECT
            rp.currency_code,
            rp.payment_method,
            COUNT(DISTINCT rp.id)::INTEGER
                AS payment_count,
            COALESCE(
                SUM(rpa.allocated_amount),
                0
            ) AS collected_amount
        FROM rent_payment_allocations AS rpa
        INNER JOIN rent_payments AS rp
            ON rp.id = rpa.payment_id
        INNER JOIN rent_invoices AS ri
            ON ri.id = rpa.invoice_id
        INNER JOIN properties AS p
            ON p.id = ri.property_id
        WHERE ${methodConditions.join("\n          AND ")}
        GROUP BY
            rp.currency_code,
            rp.payment_method
        ORDER BY
            rp.currency_code,
            collected_amount DESC,
            rp.payment_method
        `,
        methodBuilder.values
    );

    const trendBuilder =
        createConditionBuilder();

    const trendConditions = [
        "rp.status = 'completed'"
    ];

    addSharedPaymentFilters({
        conditions: trendConditions,
        builder: trendBuilder,
        scope,
        filters
    });

    const trendResult = await pool.query(
        `
        SELECT
            to_char(
                date_trunc(
                    '${sqlPeriod}',
                    rp.paid_at
                ),
                'YYYY-MM-DD'
            ) AS period_start,
            rp.currency_code,
            COUNT(DISTINCT rp.id)::INTEGER
                AS payment_count,
            COALESCE(
                SUM(rpa.allocated_amount),
                0
            ) AS collected_amount
        FROM rent_payment_allocations AS rpa
        INNER JOIN rent_payments AS rp
            ON rp.id = rpa.payment_id
        INNER JOIN rent_invoices AS ri
            ON ri.id = rpa.invoice_id
        INNER JOIN properties AS p
            ON p.id = ri.property_id
        WHERE ${trendConditions.join("\n          AND ")}
        GROUP BY
            date_trunc(
                '${sqlPeriod}',
                rp.paid_at
            ),
            rp.currency_code
        ORDER BY
            date_trunc(
                '${sqlPeriod}',
                rp.paid_at
            ),
            rp.currency_code
        `,
        trendBuilder.values
    );

    return {
        forbidden: false,
        report: {
            context: buildContext({
                scope,
                filters,
                period
            }),
            by_payment_method:
                methodResult.rows.map(
                    row => ({
                        currency_code:
                            row.currency_code,
                        payment_method:
                            row.payment_method,
                        payment_count:
                            row.payment_count,
                        collected_amount:
                            normalizeAmount(
                                row.collected_amount
                            )
                    })
                ),
            trend: trendResult.rows.map(
                row => ({
                    period_start:
                        row.period_start,
                    currency_code:
                        row.currency_code,
                    payment_count:
                        row.payment_count,
                    collected_amount:
                        normalizeAmount(
                            row.collected_amount
                        )
                })
            )
        }
    };
};

module.exports = {
    PERIOD_SQL,
    resolveFinancialScope,
    getFinancialSummary,
    getRevenueReport,
    getOutstandingReport,
    getCollectionsReport
};

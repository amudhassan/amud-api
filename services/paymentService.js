const {
    nanoid
} = require("nanoid");

const pool = require("../config/db");

const supportedPaymentMethods = [
    "cash",
    "bank_transfer",
    "mobile_money",
    "card",
    "cheque",
    "other"
];

const referencedPaymentMethods = [
    "bank_transfer",
    "mobile_money",
    "card",
    "cheque"
];


/**
 * Retrieve payments visible to the authenticated user.
 *
 * Administrator:
 * - Can view every payment.
 *
 * Regular users:
 * - Can view payments belonging to an active owner relationship
 *   with can_manage_finances = TRUE; and/or
 * - Can view payments belonging to an active tenant relationship
 *   with can_view_finances = TRUE.
 */
const getPayments = async ({
    queryData,
    authenticatedUser
}) => {
    const page = Number(queryData.page) || 1;
    const limit = Number(queryData.limit) || 20;
    const offset = (page - 1) * limit;

    /*
     * A non-admin must have at least one qualifying active
     * financial relationship before payment data is queried.
     */
    if (authenticatedUser.role !== "admin") {
        const accessResult = await pool.query(
            `
            SELECT
                EXISTS (
                    SELECT 1
                    FROM owner_users AS ou
                    WHERE ou.user_id = $1
                      AND ou.revoked_at IS NULL
                      AND ou.can_manage_finances = TRUE
                )
                OR EXISTS (
                    SELECT 1
                    FROM tenant_users AS tu
                    WHERE tu.user_id = $1
                      AND tu.revoked_at IS NULL
                      AND tu.can_view_finances = TRUE
                ) AS has_financial_access
            `,
            [authenticatedUser.id]
        );

        if (
            accessResult.rows[0]
                .has_financial_access !== true
        ) {
            return {
                forbidden: true
            };
        }
    }

    const values = [];
    const conditions = [];

    const addValue = (value) => {
        values.push(value);
        return `$${values.length}`;
    };

    if (authenticatedUser.role !== "admin") {
        const userPlaceholder = addValue(
            authenticatedUser.id
        );

        conditions.push(
            `(
                EXISTS (
                    SELECT 1
                    FROM owner_users AS ou
                    WHERE ou.owner_id = rp.owner_id
                      AND ou.user_id = ${userPlaceholder}
                      AND ou.revoked_at IS NULL
                      AND ou.can_manage_finances = TRUE
                )
                OR EXISTS (
                    SELECT 1
                    FROM tenant_users AS tu
                    WHERE tu.tenant_id = rp.tenant_id
                      AND tu.user_id = ${userPlaceholder}
                      AND tu.revoked_at IS NULL
                      AND tu.can_view_finances = TRUE
                )
            )`
        );
    }

    const search =
        typeof queryData.search === "string"
            ? queryData.search.trim()
            : "";

    if (search) {
        const searchPlaceholder = addValue(
            `%${search}%`
        );

        conditions.push(
            `(
                rp.payment_number ILIKE ${searchPlaceholder}
                OR rp.receipt_number ILIKE ${searchPlaceholder}
                OR rp.transaction_reference ILIKE ${searchPlaceholder}
                OR o.display_name ILIKE ${searchPlaceholder}
                OR t.display_name ILIKE ${searchPlaceholder}
                OR EXISTS (
                    SELECT 1
                    FROM rent_payment_allocations AS srpa
                    INNER JOIN rent_invoices AS sri
                        ON sri.id = srpa.invoice_id
                    WHERE srpa.payment_id = rp.id
                      AND sri.invoice_number ILIKE ${searchPlaceholder}
                )
            )`
        );
    }

    const directFilters = [
        ["status", "rp.status"],
        ["payment_method", "rp.payment_method"],
        ["owner_public_id", "o.public_id"],
        ["tenant_public_id", "t.public_id"],
        ["payment_number", "rp.payment_number"],
        ["receipt_number", "rp.receipt_number"]
    ];

    for (const [field, column] of directFilters) {
        if (
            queryData[field] !== undefined &&
            queryData[field] !== ""
        ) {
            conditions.push(
                `${column} = ${addValue(queryData[field])}`
            );
        }
    }

    if (queryData.invoice_public_id) {
        const invoicePlaceholder = addValue(
            queryData.invoice_public_id
        );

        conditions.push(
            `EXISTS (
                SELECT 1
                FROM rent_payment_allocations AS frpa
                INNER JOIN rent_invoices AS fri
                    ON fri.id = frpa.invoice_id
                WHERE frpa.payment_id = rp.id
                  AND fri.public_id = ${invoicePlaceholder}
            )`
        );
    }

    if (queryData.paid_at_from) {
        conditions.push(
            `rp.paid_at >= ${addValue(
                queryData.paid_at_from
            )}::timestamptz`
        );
    }

    if (queryData.paid_at_to) {
        conditions.push(
            `rp.paid_at <= ${addValue(
                queryData.paid_at_to
            )}::timestamptz`
        );
    }

    const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    /*
     * Count matching payments independently from
     * pagination so an out-of-range page still
     * returns accurate pagination metadata.
     */
    const countResult = await pool.query(
        `
        SELECT COUNT(*)::bigint AS total_count
        FROM rent_payments AS rp
        INNER JOIN owners AS o
            ON o.id = rp.owner_id
        INNER JOIN tenants AS t
            ON t.id = rp.tenant_id
        ${whereClause}
        `,
        values
    );

    const totalItems = Number(
        countResult.rows[0].total_count
    );

    const limitPlaceholder = addValue(limit);
    const offsetPlaceholder = addValue(offset);

    const paymentsResult = await pool.query(
        `
        WITH filtered_payments AS (
            SELECT
                rp.id
            FROM rent_payments AS rp
            INNER JOIN owners AS o
                ON o.id = rp.owner_id
            INNER JOIN tenants AS t
                ON t.id = rp.tenant_id
            ${whereClause}
            ORDER BY rp.paid_at DESC, rp.created_at DESC, rp.id DESC
            LIMIT ${limitPlaceholder}
            OFFSET ${offsetPlaceholder}
        )
        SELECT
            rp.public_id,
            rp.payment_number,
            rp.receipt_number,
            rp.amount,
            rp.currency_code,
            rp.payment_method,
            rp.transaction_reference,
            rp.paid_at,
            rp.status,
            rp.notes,
            rp.reversed_at,
            rp.reversal_reason,
            rp.created_at,
            rp.updated_at,
            jsonb_build_object(
                'public_id', o.public_id,
                'owner_type', o.owner_type,
                'display_name', o.display_name,
                'status', o.status
            ) AS owner,
            jsonb_build_object(
                'public_id', t.public_id,
                'tenant_type', t.tenant_type,
                'display_name', t.display_name,
                'status', t.status
            ) AS tenant,
            jsonb_build_object(
                'public_id', cb.public_id,
                'role', cb.role
            ) AS created_by,
            CASE
                WHEN rb.id IS NULL THEN NULL
                ELSE jsonb_build_object(
                    'public_id', rb.public_id,
                    'role', rb.role
                )
            END AS reversed_by,
            COALESCE(
                allocations.items,
                '[]'::jsonb
            ) AS allocations
        FROM filtered_payments AS fp
        INNER JOIN rent_payments AS rp
            ON rp.id = fp.id
        INNER JOIN owners AS o
            ON o.id = rp.owner_id
        INNER JOIN tenants AS t
            ON t.id = rp.tenant_id
        INNER JOIN users AS cb
            ON cb.id = rp.created_by
        LEFT JOIN users AS rb
            ON rb.id = rp.reversed_by
        LEFT JOIN LATERAL (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'public_id', rpa.public_id,
                    'allocated_amount', rpa.allocated_amount,
                    'created_at', rpa.created_at,
                    'invoice', jsonb_build_object(
                        'public_id', ri.public_id,
                        'invoice_number', ri.invoice_number,
                        'status', ri.status,
                        'issue_date', ri.issue_date,
                        'due_date', ri.due_date,
                        'currency_code', ri.currency_code,
                        'total_amount', ri.total_amount,
                        'paid_amount', ri.paid_amount,
                        'balance_amount', ri.balance_amount
                    )
                )
                ORDER BY rpa.created_at ASC, rpa.id ASC
            ) AS items
            FROM rent_payment_allocations AS rpa
            INNER JOIN rent_invoices AS ri
                ON ri.id = rpa.invoice_id
            WHERE rpa.payment_id = rp.id
        ) AS allocations ON TRUE
        ORDER BY rp.paid_at DESC, rp.created_at DESC, rp.id DESC
        `,
        values
    );

    const payments = paymentsResult.rows;

    return {
        payments,
        pagination: {
            page,
            limit,
            total_items: totalItems,
            total_pages: totalItems === 0
                ? 0
                : Math.ceil(totalItems / limit)
        }
    };
};


/**
 * Retrieve one payment visible to the authenticated user.
 */
const getSinglePayment = async ({
    paymentPublicId,
    authenticatedUser
}) => {
    /*
     * Resolve the payment and its authorization
     * relationships without exposing internal IDs.
     */
    const paymentReferenceResult =
        await pool.query(
            `
            SELECT
                id,
                owner_id,
                tenant_id
            FROM rent_payments
            WHERE public_id = $1
            LIMIT 1
            `,
            [paymentPublicId]
        );

    if (paymentReferenceResult.rows.length === 0) {
        return {
            paymentNotFound: true
        };
    }

    const paymentReference =
        paymentReferenceResult.rows[0];

    if (authenticatedUser.role !== "admin") {
        const accessResult = await pool.query(
            `
            SELECT
                EXISTS (
                    SELECT 1
                    FROM owner_users AS ou
                    WHERE ou.owner_id = $1
                      AND ou.user_id = $3
                      AND ou.revoked_at IS NULL
                      AND ou.can_manage_finances = TRUE
                )
                OR EXISTS (
                    SELECT 1
                    FROM tenant_users AS tu
                    WHERE tu.tenant_id = $2
                      AND tu.user_id = $3
                      AND tu.revoked_at IS NULL
                      AND tu.can_view_finances = TRUE
                ) AS can_view_payment
            `,
            [
                paymentReference.owner_id,
                paymentReference.tenant_id,
                authenticatedUser.id
            ]
        );

        if (
            accessResult.rows[0]
                .can_view_payment !== true
        ) {
            return {
                forbidden: true
            };
        }
    }

    const paymentResult = await pool.query(
        `
        SELECT
            rp.public_id,
            rp.payment_number,
            rp.receipt_number,
            rp.amount,
            rp.currency_code,
            rp.payment_method,
            rp.transaction_reference,
            rp.paid_at,
            rp.status,
            rp.notes,
            rp.reversed_at,
            rp.reversal_reason,
            rp.created_at,
            rp.updated_at,
            jsonb_build_object(
                'public_id', o.public_id,
                'owner_type', o.owner_type,
                'display_name', o.display_name,
                'status', o.status
            ) AS owner,
            jsonb_build_object(
                'public_id', t.public_id,
                'tenant_type', t.tenant_type,
                'display_name', t.display_name,
                'status', t.status
            ) AS tenant,
            jsonb_build_object(
                'public_id', cb.public_id,
                'role', cb.role
            ) AS created_by,
            CASE
                WHEN rb.id IS NULL THEN NULL
                ELSE jsonb_build_object(
                    'public_id', rb.public_id,
                    'role', rb.role
                )
            END AS reversed_by,
            COALESCE(
                allocations.items,
                '[]'::jsonb
            ) AS allocations
        FROM rent_payments AS rp
        INNER JOIN owners AS o
            ON o.id = rp.owner_id
        INNER JOIN tenants AS t
            ON t.id = rp.tenant_id
        INNER JOIN users AS cb
            ON cb.id = rp.created_by
        LEFT JOIN users AS rb
            ON rb.id = rp.reversed_by
        LEFT JOIN LATERAL (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'public_id', rpa.public_id,
                    'allocated_amount', rpa.allocated_amount,
                    'created_at', rpa.created_at,
                    'invoice', jsonb_build_object(
                        'public_id', ri.public_id,
                        'invoice_number', ri.invoice_number,
                        'status', ri.status,
                        'issue_date', ri.issue_date,
                        'due_date', ri.due_date,
                        'currency_code', ri.currency_code,
                        'total_amount', ri.total_amount,
                        'paid_amount', ri.paid_amount,
                        'balance_amount', ri.balance_amount
                    )
                )
                ORDER BY rpa.created_at ASC, rpa.id ASC
            ) AS items
            FROM rent_payment_allocations AS rpa
            INNER JOIN rent_invoices AS ri
                ON ri.id = rpa.invoice_id
            WHERE rpa.payment_id = rp.id
        ) AS allocations ON TRUE
        WHERE rp.id = $1
        LIMIT 1
        `,
        [paymentReference.id]
    );

    if (paymentResult.rows.length === 0) {
        return {
            paymentNotFound: true
        };
    }

    return {
        payment: paymentResult.rows[0]
    };
};


/**
 * Reverse a completed rent payment while retaining
 * its permanent payment, receipt and allocation audit.
 */
const reverseRentPayment = async ({
    paymentPublicId,
    reversalData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const reversalReason =
            typeof reversalData
                .reversal_reason === "string"
                ? reversalData
                    .reversal_reason.trim()
                : "";

        if (
            reversalReason.length === 0 ||
            reversalReason.length > 1000
        ) {
            await client.query("ROLLBACK");

            return {
                invalidReversalReason: true
            };
        }

        /*
         * Lock the payment before authorization and
         * lifecycle checks to serialize reversals.
         */
        const paymentResult = await client.query(
            `
            SELECT
                id,
                public_id,
                payment_number,
                receipt_number,
                owner_id,
                tenant_id,
                amount,
                currency_code,
                payment_method,
                transaction_reference,
                paid_at,
                status,
                notes,
                reversed_at,
                reversal_reason,
                created_at,
                updated_at
            FROM rent_payments
            WHERE public_id = $1
            LIMIT 1
            FOR UPDATE
            `,
            [paymentPublicId]
        );

        if (paymentResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                paymentNotFound: true
            };
        }

        const currentPayment =
            paymentResult.rows[0];

        /*
         * Tenant financial visibility never grants
         * payment-reversal authority.
         */
        if (authenticatedUser.role !== "admin") {
            const accessResult = await client.query(
                `
                SELECT EXISTS (
                    SELECT 1
                    FROM owner_users AS ou
                    WHERE ou.owner_id = $1
                      AND ou.user_id = $2
                      AND ou.revoked_at IS NULL
                      AND ou.can_manage_finances = TRUE
                ) AS can_reverse_payment
                `,
                [
                    currentPayment.owner_id,
                    authenticatedUser.id
                ]
            );

            if (
                accessResult.rows[0]
                    .can_reverse_payment !== true
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        if (currentPayment.status === "reversed") {
            await client.query("ROLLBACK");

            return {
                paymentAlreadyReversed: true
            };
        }

        if (currentPayment.status !== "completed") {
            await client.query("ROLLBACK");

            return {
                paymentNotReversible: true
            };
        }

        /*
         * Lock every affected invoice in deterministic
         * order before the synchronization trigger runs.
         */
        const lockedInvoicesResult =
            await client.query(
                `
                SELECT ri.id
                FROM rent_payment_allocations AS rpa
                INNER JOIN rent_invoices AS ri
                    ON ri.id = rpa.invoice_id
                WHERE rpa.payment_id = $1
                ORDER BY ri.id ASC
                FOR UPDATE OF ri
                `,
                [currentPayment.id]
            );

        if (lockedInvoicesResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                relationshipConflict: true
            };
        }

        const reversedPaymentResult =
            await client.query(
                `
                UPDATE rent_payments
                SET
                    status = 'reversed',
                    reversed_at = CURRENT_TIMESTAMP,
                    reversed_by = $2,
                    reversal_reason = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING
                    public_id,
                    payment_number,
                    receipt_number,
                    amount,
                    currency_code,
                    payment_method,
                    transaction_reference,
                    paid_at,
                    status,
                    notes,
                    reversed_at,
                    reversal_reason,
                    created_at,
                    updated_at
                `,
                [
                    currentPayment.id,
                    authenticatedUser.id,
                    reversalReason
                ]
            );

        /*
         * Execute deferred payment and invoice checks
         * inside this transaction before committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        const contextResult = await client.query(
            `
            SELECT
                jsonb_build_object(
                    'public_id', o.public_id,
                    'owner_type', o.owner_type,
                    'display_name', o.display_name,
                    'status', o.status
                ) AS owner,
                jsonb_build_object(
                    'public_id', t.public_id,
                    'tenant_type', t.tenant_type,
                    'display_name', t.display_name,
                    'status', t.status
                ) AS tenant,
                jsonb_build_object(
                    'public_id', rb.public_id,
                    'role', rb.role
                ) AS reversed_by
            FROM rent_payments AS rp
            INNER JOIN owners AS o
                ON o.id = rp.owner_id
            INNER JOIN tenants AS t
                ON t.id = rp.tenant_id
            INNER JOIN users AS rb
                ON rb.id = rp.reversed_by
            WHERE rp.id = $1
            LIMIT 1
            `,
            [currentPayment.id]
        );

        const allocationsResult = await client.query(
            `
            SELECT
                rpa.public_id,
                rpa.allocated_amount,
                rpa.created_at,
                jsonb_build_object(
                    'public_id', ri.public_id,
                    'invoice_number', ri.invoice_number,
                    'status', ri.status,
                    'issue_date', ri.issue_date,
                    'due_date', ri.due_date,
                    'currency_code', ri.currency_code,
                    'total_amount', ri.total_amount,
                    'paid_amount', ri.paid_amount,
                    'balance_amount', ri.balance_amount,
                    'updated_at', ri.updated_at
                ) AS invoice
            FROM rent_payment_allocations AS rpa
            INNER JOIN rent_invoices AS ri
                ON ri.id = rpa.invoice_id
            WHERE rpa.payment_id = $1
            ORDER BY rpa.created_at ASC, rpa.id ASC
            `,
            [currentPayment.id]
        );

        await client.query("COMMIT");

        const context = contextResult.rows[0];

        return {
            payment: {
                ...reversedPaymentResult.rows[0],
                reversed_by:
                    context.reversed_by,
                allocations:
                    allocationsResult.rows
            },
            owner: context.owner,
            tenant: context.tenant
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};


/**
 * Record and allocate a completed rent payment.
 *
 * Administrator:
 * - Can record a payment for any eligible invoice.
 *
 * Regular owner user:
 * - Must have an active owner_users relationship.
 * - Must have can_manage_finances = TRUE.
 *
 * Tenant users:
 * - Cannot record payments.
 */
const recordRentPayment = async ({
    invoicePublicId,
    paymentData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Defensively validate values that may
         * arrive through a non-HTTP internal call.
         */
        const normalizedAmount =
            String(
                paymentData.amount
            ).trim();

        if (
            !/^\d{1,12}(\.\d{1,2})?$/.test(
                normalizedAmount
            ) ||
            Number(normalizedAmount) <= 0
        ) {
            await client.query("ROLLBACK");

            return {
                invalidAmount: true
            };
        }

        const paymentMethod =
            typeof paymentData
                .payment_method === "string"
                ? paymentData
                    .payment_method.trim()
                : "";

        if (
            !supportedPaymentMethods.includes(
                paymentMethod
            )
        ) {
            await client.query("ROLLBACK");

            return {
                invalidPaymentMethod: true
            };
        }

        const transactionReference =
            typeof paymentData
                .transaction_reference ===
                "string" &&
            paymentData
                .transaction_reference
                .trim().length > 0
                ? paymentData
                    .transaction_reference
                    .trim()
                : null;

        if (
            referencedPaymentMethods.includes(
                paymentMethod
            ) &&
            !transactionReference
        ) {
            await client.query("ROLLBACK");

            return {
                invalidTransactionReference:
                    true
            };
        }

        if (
            transactionReference &&
            transactionReference.length > 150
        ) {
            await client.query("ROLLBACK");

            return {
                invalidTransactionReference:
                    true
            };
        }

        const paidAt =
            typeof paymentData.paid_at ===
                "string"
                ? paymentData.paid_at.trim()
                : "";

        const paidAtTime =
            new Date(paidAt).getTime();

        if (
            paidAt.length === 0 ||
            !Number.isFinite(paidAtTime) ||
            paidAtTime > Date.now()
        ) {
            await client.query("ROLLBACK");

            return {
                invalidPaidAt: true
            };
        }

        const notes =
            typeof paymentData.notes ===
                "string" &&
            paymentData.notes.trim().length > 0
                ? paymentData.notes.trim()
                : null;

        if (notes && notes.length > 1000) {
            await client.query("ROLLBACK");

            return {
                invalidNotes: true
            };
        }

        /*
         * 2. Find and lock the target invoice.
         *
         * PostgreSQL performs financial and time
         * comparisons to avoid JavaScript decimal
         * and timestamp inconsistencies.
         */
        const invoiceResult =
            await client.query(
                `
                SELECT
                    ri.id,
                    ri.public_id,
                    ri.invoice_number,
                    ri.owner_id,
                    ri.tenant_id,
                    ri.status,
                    ri.issue_date::text
                        AS issue_date,
                    ri.due_date::text
                        AS due_date,
                    ri.currency_code,
                    ri.total_amount,
                    ri.paid_amount,
                    ri.balance_amount,
                    ri.issued_at,
                    ($2::numeric <=
                        ri.balance_amount)
                        AS amount_within_balance,
                    ($3::timestamptz >=
                        ri.issued_at)
                        AS paid_at_after_issue,
                    ($3::timestamptz <=
                        CURRENT_TIMESTAMP)
                        AS paid_at_not_future
                FROM rent_invoices AS ri
                WHERE ri.public_id = $1
                LIMIT 1
                FOR UPDATE
                `,
                [
                    invoicePublicId,
                    normalizedAmount,
                    paidAt
                ]
            );

        if (invoiceResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                invoiceNotFound: true
            };
        }

        const currentInvoice =
            invoiceResult.rows[0];

        /*
         * 3. Confirm authorization before
         * exposing invoice lifecycle or balance.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT
                        id,
                        relationship_role,
                        can_manage_finances
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        currentInvoice.owner_id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0 ||
                requesterResult.rows[0]
                    .can_manage_finances !== true
            ) {
                await client.query("ROLLBACK");

                return {
                    forbidden: true
                };
            }
        }

        /*
         * 4. Confirm invoice lifecycle eligibility.
         */
        const eligibleInvoiceStatuses = [
            "issued",
            "partially_paid",
            "overdue"
        ];

        if (
            !eligibleInvoiceStatuses.includes(
                currentInvoice.status
            ) ||
            Number(
                currentInvoice.balance_amount
            ) <= 0
        ) {
            await client.query("ROLLBACK");

            return {
                invoiceNotEligible: true
            };
        }

        if (
            currentInvoice
                .amount_within_balance !== true
        ) {
            await client.query("ROLLBACK");

            return {
                overpayment: true
            };
        }

        if (
            currentInvoice
                .paid_at_after_issue !== true ||
            currentInvoice
                .paid_at_not_future !== true
        ) {
            await client.query("ROLLBACK");

            return {
                invalidPaidAt: true
            };
        }

        /*
         * 5. Lock and validate the invoice owner.
         */
        const ownerResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    owner_type,
                    display_name,
                    status
                FROM owners
                WHERE id = $1
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    currentInvoice.owner_id
                ]
            );

        if (ownerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                relationshipConflict: true
            };
        }

        const owner = ownerResult.rows[0];

        /*
         * 6. Lock and validate the invoice tenant.
         */
        const tenantResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    tenant_type,
                    display_name,
                    status
                FROM tenants
                WHERE id = $1
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    currentInvoice.tenant_id
                ]
            );

        if (tenantResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                relationshipConflict: true
            };
        }

        const tenant = tenantResult.rows[0];

        /*
         * 7. Generate collision-resistant payment,
         * receipt and allocation identifiers.
         */
        const identifierYear =
            new Date().getUTCFullYear();

        const paymentPublicId =
            `payment_${nanoid(24)}`;

        const paymentNumber =
            `PAY-${identifierYear}-${nanoid(10)
                .toUpperCase()}`;

        const receiptNumber =
            `RCT-${identifierYear}-${nanoid(10)
                .toUpperCase()}`;

        const allocationPublicId =
            `payment_allocation_${nanoid(24)}`;

        /*
         * 8. Insert the completed payment.
         */
        const paymentResult =
            await client.query(
                `
                INSERT INTO rent_payments (
                    public_id,
                    payment_number,
                    receipt_number,
                    owner_id,
                    tenant_id,
                    amount,
                    currency_code,
                    payment_method,
                    transaction_reference,
                    paid_at,
                    status,
                    notes,
                    created_by
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
                    $10,
                    'completed',
                    $11,
                    $12
                )
                RETURNING
                    id,
                    public_id,
                    payment_number,
                    receipt_number,
                    amount,
                    currency_code,
                    payment_method,
                    transaction_reference,
                    paid_at,
                    status,
                    notes,
                    reversed_at,
                    reversal_reason,
                    created_at,
                    updated_at
                `,
                [
                    paymentPublicId,
                    paymentNumber,
                    receiptNumber,
                    owner.id,
                    tenant.id,
                    normalizedAmount,
                    currentInvoice.currency_code,
                    paymentMethod,
                    transactionReference,
                    paidAt,
                    notes,
                    authenticatedUser.id
                ]
            );

        const payment =
            paymentResult.rows[0];

        /*
         * 9. Allocate the complete payment amount
         * to the selected invoice.
         *
         * The allocation trigger synchronizes the
         * invoice paid amount, balance and status.
         */
        const allocationResult =
            await client.query(
                `
                INSERT INTO rent_payment_allocations (
                    public_id,
                    payment_id,
                    invoice_id,
                    allocated_amount
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4
                )
                RETURNING
                    public_id,
                    allocated_amount,
                    created_at
                `,
                [
                    allocationPublicId,
                    payment.id,
                    currentInvoice.id,
                    normalizedAmount
                ]
            );

        /*
         * 10. Execute every deferred database
         * integrity check before committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        /*
         * 11. Retrieve the synchronized invoice.
         */
        const updatedInvoiceResult =
            await client.query(
                `
                SELECT
                    public_id,
                    invoice_number,
                    status,
                    issue_date,
                    due_date,
                    currency_code,
                    total_amount,
                    paid_amount,
                    balance_amount,
                    updated_at
                FROM rent_invoices
                WHERE id = $1
                LIMIT 1
                `,
                [
                    currentInvoice.id
                ]
            );

        await client.query("COMMIT");

        /*
         * Do not expose internal database IDs.
         */
        delete payment.id;
        delete owner.id;
        delete tenant.id;

        return {
            payment: {
                ...payment,
                allocation:
                    allocationResult.rows[0]
            },
            invoice:
                updatedInvoiceResult.rows[0],
            owner,
            tenant
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    getPayments,
    getSinglePayment,
    reverseRentPayment,
    recordRentPayment
};

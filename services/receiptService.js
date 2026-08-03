const pool = require("../config/db");

const {
    verifyReceiptVerificationToken
} = require(
    "./receiptVerificationService"
);

const findReceiptReference = async receiptNumber => {
    const result = await pool.query(
        `
        SELECT
            id,
            owner_id,
            tenant_id
        FROM rent_payments
        WHERE lower(btrim(receipt_number)) =
            lower(btrim($1))
        LIMIT 1
        `,
        [receiptNumber]
    );

    return result.rows[0] || null;
};

const fetchReceiptByPaymentId = async paymentId => {
    const result = await pool.query(
        `
        SELECT
            rp.receipt_number,
            CASE
                WHEN rp.status = 'reversed'
                    THEN 'reversed'
                ELSE 'valid'
            END AS receipt_status,
            rp.created_at AS issued_at,
            jsonb_build_object(
                'public_id', rp.public_id,
                'payment_number', rp.payment_number,
                'amount', rp.amount,
                'currency_code', rp.currency_code,
                'payment_method', rp.payment_method,
                'transaction_reference', rp.transaction_reference,
                'paid_at', rp.paid_at,
                'status', rp.status,
                'notes', rp.notes,
                'created_at', rp.created_at,
                'updated_at', rp.updated_at
            ) AS payment,
            jsonb_build_object(
                'public_id', o.public_id,
                'owner_type', o.owner_type,
                'display_name', o.display_name,
                'status', o.status
            ) AS payee,
            jsonb_build_object(
                'public_id', t.public_id,
                'tenant_type', t.tenant_type,
                'display_name', t.display_name,
                'status', t.status
            ) AS payer,
            jsonb_build_object(
                'public_id', cb.public_id,
                'role', cb.role
            ) AS received_by,
            CASE
                WHEN rp.status <> 'reversed' THEN NULL
                ELSE jsonb_build_object(
                    'reversed_at', rp.reversed_at,
                    'reversal_reason', rp.reversal_reason,
                    'reversed_by', jsonb_build_object(
                        'public_id', rb.public_id,
                        'role', rb.role
                    )
                )
            END AS reversal,
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
        [paymentId]
    );

    return result.rows[0] || null;
};

/**
 * Retrieve a receipt for an authenticated user.
 */
const getReceipt = async ({
    receiptNumber,
    authenticatedUser
}) => {
    const reference = await findReceiptReference(
        receiptNumber
    );

    if (!reference) {
        return {
            receiptNotFound: true
        };
    }

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
                ) AS can_view_receipt
            `,
            [
                reference.owner_id,
                reference.tenant_id,
                authenticatedUser.id
            ]
        );

        if (
            accessResult.rows[0]
                .can_view_receipt !== true
        ) {
            return {
                forbidden: true
            };
        }
    }

    const receipt = await fetchReceiptByPaymentId(
        reference.id
    );

    if (!receipt) {
        return {
            receiptNotFound: true
        };
    }

    return {
        receipt
    };
};

/**
 * Retrieve a receipt through its signed QR URL.
 * No user session is required after signature validation.
 */
const getVerifiedReceipt = async ({
    receiptNumber,
    verificationToken
}) => {
    const tokenIsValid =
        verifyReceiptVerificationToken({
            receiptNumber,
            verificationToken
        });

    if (!tokenIsValid) {
        return {
            invalidVerificationToken: true
        };
    }

    const reference = await findReceiptReference(
        receiptNumber
    );

    if (!reference) {
        return {
            receiptNotFound: true
        };
    }

    const receipt = await fetchReceiptByPaymentId(
        reference.id
    );

    if (!receipt) {
        return {
            receiptNotFound: true
        };
    }

    return {
        receipt
    };
};

module.exports = {
    getReceipt,
    getVerifiedReceipt
};

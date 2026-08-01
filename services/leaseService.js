const {
    nanoid
} = require("nanoid");

const pool = require("../config/db");

/**
 * Create a new draft lease.
 *
 * Administrator:
 * - Can create a lease for any valid active owner.
 *
 * Regular user:
 * - Must have an active owner_users relationship.
 * - Must have can_manage_properties = TRUE.
 * - Must have can_manage_finances = TRUE.
 */
const createDraftLease = async ({
    leaseData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        /*
         * 1. Find and lock the active owner.
         */
        const ownerResult = await client.query(
            `
            SELECT
                id,
                public_id,
                owner_type,
                display_name,
                status
            FROM owners
            WHERE public_id = $1
              AND status = 'active'
              AND deleted_at IS NULL
            LIMIT 1
            FOR UPDATE
            `,
            [
                leaseData.owner_public_id
            ]
        );

        if (ownerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                ownerNotFound: true
            };
        }

        const owner = ownerResult.rows[0];

        /*
         * 2. Check regular-user authorization.
         */
        if (authenticatedUser.role !== "admin") {
            const requesterResult =
                await client.query(
                    `
                    SELECT
                        id,
                        can_manage_properties,
                        can_manage_finances
                    FROM owner_users
                    WHERE owner_id = $1
                      AND user_id = $2
                      AND revoked_at IS NULL
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        owner.id,
                        authenticatedUser.id
                    ]
                );

            if (
                requesterResult.rows.length === 0 ||
                requesterResult.rows[0]
                    .can_manage_properties !== true ||
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
         * 3. Find and lock the active property.
         */
        const propertyResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    property_name,
                    property_code,
                    operational_status
                FROM properties
                WHERE public_id = $1
                  AND operational_status = 'active'
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    leaseData.property_public_id
                ]
            );

        if (propertyResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                propertyNotFound: true
            };
        }

        const property =
            propertyResult.rows[0];

        /*
         * 4. Confirm that the owner currently owns
         * the selected property.
         */
        const propertyOwnerResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    ownership_type,
                    ownership_percentage,
                    effective_from,
                    effective_to
                FROM property_owners
                WHERE property_id = $1
                  AND owner_id = $2
                  AND effective_from <= $3::date
                  AND effective_to IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    property.id,
                    owner.id,
                    leaseData.start_date
                ]
            );

        if (
            propertyOwnerResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                ownershipConflict: true
            };
        }

        /*
         * 5. Find and lock the selected unit.
         *
         * Draft creation does not require available
         * status because a draft does not bind a unit.
         */
        const unitResult = await client.query(
            `
            SELECT
                id,
                public_id,
                property_id,
                unit_code,
                unit_name,
                operational_status
            FROM units
            WHERE public_id = $1
              AND deleted_at IS NULL
            LIMIT 1
            FOR UPDATE
            `,
            [
                leaseData.unit_public_id
            ]
        );

        if (unitResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                unitNotFound: true
            };
        }

        const unit = unitResult.rows[0];

        if (unit.property_id !== property.id) {
            await client.query("ROLLBACK");

            return {
                unitPropertyConflict: true
            };
        }

        /*
         * 6. Find and lock the active tenant.
         */
        const tenantResult = await client.query(
            `
            SELECT
                id,
                public_id,
                tenant_type,
                display_name,
                status
            FROM tenants
            WHERE public_id = $1
              AND status = 'active'
              AND deleted_at IS NULL
            LIMIT 1
            FOR UPDATE
            `,
            [
                leaseData.tenant_public_id
            ]
        );

        if (tenantResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                tenantNotFound: true
            };
        }

        const tenant = tenantResult.rows[0];

        /*
         * 7. Confirm the active owner–tenant
         * business relationship.
         */
        const ownerTenantResult =
            await client.query(
                `
                SELECT
                    id,
                    public_id,
                    relationship_status,
                    is_primary_owner_relationship
                FROM owner_tenants
                WHERE owner_id = $1
                  AND tenant_id = $2
                  AND relationship_status = 'active'
                  AND ended_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [
                    owner.id,
                    tenant.id
                ]
            );

        if (
            ownerTenantResult.rows.length === 0
        ) {
            await client.query("ROLLBACK");

            return {
                tenantRelationshipConflict: true
            };
        }

        /*
         * 8. Prepare contract defaults.
         */
        const currencyCode =
            leaseData.currency_code || "TZS";

        const billingFrequency =
            leaseData.billing_frequency ||
            "monthly";

        const paymentDueDay =
            leaseData.payment_due_day ?? 1;

        const gracePeriodDays =
            leaseData.grace_period_days ?? 0;

        const securityDepositAmount =
            leaseData.security_deposit_amount ?? 0;

        const lateFeeType =
            leaseData.late_fee_type || "none";

        const lateFeeValue =
            leaseData.late_fee_value ?? 0;

        const notes =
            typeof leaseData.notes === "string" &&
            leaseData.notes.length > 0
                ? leaseData.notes
                : null;

        /*
         * 9. Service-level defensive validation.
         */
        if (
            leaseData.end_date <=
            leaseData.start_date
        ) {
            await client.query("ROLLBACK");

            return {
                invalidDateRange: true
            };
        }

        if (
            typeof leaseData.rent_amount !==
                "number" ||
            !Number.isFinite(
                leaseData.rent_amount
            ) ||
            leaseData.rent_amount <= 0
        ) {
            await client.query("ROLLBACK");

            return {
                invalidFinancialTerms: true
            };
        }

        if (
            lateFeeType === "none" &&
            lateFeeValue !== 0
        ) {
            await client.query("ROLLBACK");

            return {
                invalidFinancialTerms: true
            };
        }

        if (
            (
                lateFeeType === "fixed" ||
                lateFeeType === "percentage"
            ) &&
            lateFeeValue <= 0
        ) {
            await client.query("ROLLBACK");

            return {
                invalidFinancialTerms: true
            };
        }

        if (
            lateFeeType === "percentage" &&
            lateFeeValue > 100
        ) {
            await client.query("ROLLBACK");

            return {
                invalidFinancialTerms: true
            };
        }

        /*
         * 10. Generate public identifiers.
         *
         * Random lease numbers avoid a concurrent
         * MAX()+1 numbering race.
         */
        const leasePublicId =
            `lease_${nanoid(24)}`;

        const leaseNumber =
            `LSE-${new Date().getUTCFullYear()}-${nanoid(10).toUpperCase()}`;

        /*
         * 11. Insert the draft lease.
         */
        const leaseResult = await client.query(
            `
            INSERT INTO leases (
                public_id,
                lease_number,
                owner_id,
                property_id,
                unit_id,
                tenant_id,
                status,
                start_date,
                end_date,
                currency_code,
                rent_amount,
                billing_frequency,
                payment_due_day,
                grace_period_days,
                security_deposit_amount,
                late_fee_type,
                late_fee_value,
                notes,
                created_by
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, 'draft', $7, $8,
                $9, $10, $11, $12,
                $13, $14, $15, $16,
                $17, $18
            )
            RETURNING
                public_id,
                lease_number,
                status,
                start_date,
                end_date,
                currency_code,
                rent_amount,
                billing_frequency,
                payment_due_day,
                grace_period_days,
                security_deposit_amount,
                late_fee_type,
                late_fee_value,
                notes,
                created_at,
                updated_at
            `,
            [
                leasePublicId,
                leaseNumber,
                owner.id,
                property.id,
                unit.id,
                tenant.id,
                leaseData.start_date,
                leaseData.end_date,
                currencyCode,
                leaseData.rent_amount,
                billingFrequency,
                paymentDueDay,
                gracePeriodDays,
                securityDepositAmount,
                lateFeeType,
                lateFeeValue,
                notes,
                authenticatedUser.id
            ]
        );

        /*
         * 12. Execute deferred integrity checks
         * before committing.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        /*
         * Do not expose internal database IDs.
         */
        delete owner.id;
        delete property.id;
        delete unit.id;
        delete unit.property_id;
        delete tenant.id;

        return {
            forbidden: false,
            lease: leaseResult.rows[0],
            owner,
            property,
            unit,
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
    createDraftLease
};
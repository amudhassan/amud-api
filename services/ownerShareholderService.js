const { nanoid } = require("nanoid");
const pool = require("../config/db");

/**
 * Retrieve active shareholders of a company or partnership.
 *
 * Admin:
 * - Can view shareholders of any active company/partnership.
 *
 * Regular user:
 * - Must have an active owner_users relationship.
 * - Must have can_manage_finances = true.
 */
const getOwnerShareholders = async ({
    companyPublicId,
    authenticatedUser
}) => {
    const accessValues = [companyPublicId];

    let accessJoin = "";

    let requesterFields = `
        NULL::VARCHAR AS requester_relationship_role,
        NULL::BOOLEAN AS requester_can_manage_finances
    `;

    if (authenticatedUser.role !== "admin") {
        accessValues.push(authenticatedUser.id);

        accessJoin = `
            INNER JOIN owner_users AS requester_link
                ON requester_link.owner_id = company.id
               AND requester_link.user_id = $2
               AND requester_link.revoked_at IS NULL
               AND requester_link.can_manage_finances = TRUE
        `;

        requesterFields = `
            requester_link.relationship_role
                AS requester_relationship_role,

            requester_link.can_manage_finances
                AS requester_can_manage_finances
        `;
    }

    const companyResult = await pool.query(
        `
        SELECT
            company.id,
            company.public_id,
            company.owner_type,
            company.display_name,
            company.registration_number,
            company.tax_identification_number,
            company.country,
            company.status,

            ${requesterFields}

        FROM owners AS company

        ${accessJoin}

        WHERE company.public_id = $1
          AND company.deleted_at IS NULL

        LIMIT 1
        `,
        accessValues
    );

    /*
     * Kwa regular user, null inaweza pia kumaanisha
     * hana financial authorization.
     */
    if (companyResult.rows.length === 0) {
        return null;
    }

    const company = companyResult.rows[0];

    if (
        ![
            "company",
            "partnership"
        ].includes(company.owner_type)
    ) {
        return {
            invalidOwnerType: true,
            company
        };
    }

    const shareholdersResult = await pool.query(
        `
        SELECT
            os.public_id AS share_public_id,

            shareholder.public_id
                AS shareholder_public_id,

            shareholder.owner_type
                AS shareholder_owner_type,

            shareholder.display_name
                AS shareholder_name,

            shareholder.registration_number,
            shareholder.tax_identification_number,
            shareholder.email,
            shareholder.phone_number,
            shareholder.country,
            shareholder.status,

            os.share_percentage,
            os.shareholder_type,
            os.is_active,
            os.effective_from,
            os.effective_to,
            os.created_at,
            os.updated_at

        FROM owner_shareholders AS os

        INNER JOIN owners AS shareholder
            ON shareholder.id =
                os.shareholder_owner_id

        WHERE os.company_owner_id = $1
          AND os.is_active = TRUE
          AND os.effective_to IS NULL
          AND shareholder.deleted_at IS NULL

        ORDER BY
            os.share_percentage DESC,
            os.created_at ASC
        `,
        [company.id]
    );

    const totalActiveShares =
        shareholdersResult.rows.reduce(
            (total, shareholder) =>
                total +
                Number(
                    shareholder.share_percentage
                ),
            0
        );

    const remainingShares =
        Math.max(
            0,
            Number(
                (100 - totalActiveShares).toFixed(4)
            )
        );

    delete company.id;
    delete company.requester_relationship_role;
    delete company.requester_can_manage_finances;

    return {
        invalidOwnerType: false,

        company,

        summary: {
            active_shareholder_count:
                shareholdersResult.rows.length,

            total_active_shares:
                Number(
                    totalActiveShares.toFixed(4)
                ),

            remaining_shares:
                remainingShares,

            ownership_complete:
                Number(
                    totalActiveShares.toFixed(4)
                ) === 100
        },

        shareholders:
            shareholdersResult.rows
    };
};

const addOwnerShareholder = async ({
    companyPublicId,
    shareholderData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const accessValues = [companyPublicId];

        let accessJoin = "";

        /*
         * Regular user lazima awe na active relationship,
         * finance permission na role inayoruhusiwa.
         */
        if (authenticatedUser.role !== "admin") {
            accessValues.push(authenticatedUser.id);

            accessJoin = `
                INNER JOIN owner_users AS requester_link
                    ON requester_link.owner_id = company.id
                   AND requester_link.user_id = $2
                   AND requester_link.revoked_at IS NULL
                   AND requester_link.can_manage_finances = TRUE
                   AND requester_link.relationship_role IN (
                       'owner',
                       'representative',
                       'manager',
                       'accountant'
                   )
            `;
        }

        /*
         * Lock ya company row inafanya shareholder operations
         * zote za company hii zifanyike kwa mpangilio salama.
         */
        const companyResult = await client.query(
            `
            SELECT
                company.id,
                company.public_id,
                company.owner_type,
                company.display_name,
                company.registration_number,
                company.tax_identification_number,
                company.country,
                company.status
            FROM owners AS company

            ${accessJoin}

            WHERE company.public_id = $1
              AND company.deleted_at IS NULL

            LIMIT 1
            FOR UPDATE OF company
            `,
            accessValues
        );

        if (companyResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return null;
        }

        const company = companyResult.rows[0];

        if (
            ![
                "company",
                "partnership"
            ].includes(company.owner_type)
        ) {
            await client.query("ROLLBACK");

            return {
                invalidCompanyType: true
            };
        }

        if (company.status !== "active") {
            await client.query("ROLLBACK");

            return {
                inactiveCompany: true
            };
        }

        /*
         * Shareholder mwenyewe ni record nyingine ya owners.
         */
        const shareholderResult = await client.query(
            `
            SELECT
                id,
                public_id,
                owner_type,
                display_name,
                registration_number,
                tax_identification_number,
                email,
                phone_number,
                country,
                status
            FROM owners
            WHERE public_id = $1
              AND deleted_at IS NULL
              AND status = 'active'
            LIMIT 1
            FOR UPDATE
            `,
            [shareholderData.shareholder_public_id]
        );

        if (shareholderResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return {
                shareholderNotFound: true
            };
        }

        const shareholder =
            shareholderResult.rows[0];

        if (company.id === shareholder.id) {
            await client.query("ROLLBACK");

            return {
                selfShareholding: true
            };
        }

        const shareholderType =
            shareholderData.shareholder_type ||
            "ordinary";

        /*
         * Zuia active relationship inayojirudia.
         */
        const duplicateResult = await client.query(
            `
            SELECT public_id
            FROM owner_shareholders
            WHERE company_owner_id = $1
              AND shareholder_owner_id = $2
              AND shareholder_type = $3
              AND is_active = TRUE
              AND effective_to IS NULL
            LIMIT 1
            `,
            [
                company.id,
                shareholder.id,
                shareholderType
            ]
        );

        if (duplicateResult.rows.length > 0) {
            await client.query("ROLLBACK");

            return {
                duplicateShareholding: true
            };
        }

        /*
         * Kagua current total na proposed total.
         */
        const totalResult = await client.query(
            `
            SELECT
                COALESCE(
                    SUM(share_percentage),
                    0
                )::NUMERIC(12,4)
                    AS current_total,

                (
                    COALESCE(
                        SUM(share_percentage),
                        0
                    ) + $2::NUMERIC
                )::NUMERIC(12,4)
                    AS proposed_total

            FROM owner_shareholders

            WHERE company_owner_id = $1
              AND is_active = TRUE
              AND effective_to IS NULL
            `,
            [
                company.id,
                shareholderData.share_percentage
            ]
        );

        const currentTotal = Number(
            totalResult.rows[0].current_total
        );

        const proposedTotal = Number(
            totalResult.rows[0].proposed_total
        );

        if (proposedTotal > 100) {
            await client.query("ROLLBACK");

            return {
                shareLimitExceeded: true,
                current_total: currentTotal,
                requested_share:
                    Number(
                        shareholderData.share_percentage
                    ),
                proposed_total: proposedTotal,
                remaining_shares:
                    Number(
                        (100 - currentTotal).toFixed(4)
                    )
            };
        }

        const sharePublicId =
            `share_${nanoid(24)}`;

        const insertResult = await client.query(
            `
            INSERT INTO owner_shareholders (
                public_id,
                company_owner_id,
                shareholder_owner_id,
                share_percentage,
                shareholder_type,
                is_active,
                effective_from,
                created_by
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                TRUE,
                COALESCE($6::DATE, CURRENT_DATE),
                $7
            )
            RETURNING
                public_id AS share_public_id,
                share_percentage,
                shareholder_type,
                is_active,
                effective_from,
                effective_to,
                created_at,
                updated_at
            `,
            [
                sharePublicId,
                company.id,
                shareholder.id,
                shareholderData.share_percentage,
                shareholderType,
                shareholderData.effective_from || null,
                authenticatedUser.id
            ]
        );

        const summaryResult = await client.query(
            `
            SELECT
                COUNT(*)::INTEGER
                    AS active_shareholder_count,

                COALESCE(
                    SUM(share_percentage),
                    0
                )::NUMERIC(12,4)
                    AS total_active_shares

            FROM owner_shareholders

            WHERE company_owner_id = $1
              AND is_active = TRUE
              AND effective_to IS NULL
            `,
            [company.id]
        );

        await client.query("COMMIT");

        const totalActiveShares = Number(
            summaryResult.rows[0]
                .total_active_shares
        );

        const shareholding =
            insertResult.rows[0];

        shareholding.share_percentage =
            Number(
                shareholding.share_percentage
            );
            delete company.id;
        delete shareholder.id;

        return {
            company,

            shareholder,

            shareholding,

            summary: {
                active_shareholder_count:
                    summaryResult.rows[0]
                        .active_shareholder_count,

                total_active_shares:
                    totalActiveShares,

                remaining_shares:
                    Number(
                        (
                            100 -
                            totalActiveShares
                        ).toFixed(4)
                    ),

                ownership_complete:
                    totalActiveShares === 100
            }
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
module.exports = {
    getOwnerShareholders,
    addOwnerShareholder
};
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

module.exports = {
    getOwnerShareholders
};
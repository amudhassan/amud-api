const { nanoid } = require("nanoid");

// Tumia pool import ile ile inayotumiwa ndani ya authService.js
const pool = require("../config/db");

const createOwner = async ({
    ownerData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const ownerPublicId = `owner_${nanoid(24)}`;

        const ownerResult = await client.query(
            `
            INSERT INTO owners (
                public_id,
                owner_type,
                display_name,
                registration_number,
                tax_identification_number,
                email,
                phone_number,
                alternative_phone,
                address,
                city,
                region,
                country,
                created_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13
            )
            RETURNING
                id,
                public_id,
                owner_type,
                display_name,
                registration_number,
                tax_identification_number,
                email,
                phone_number,
                alternative_phone,
                address,
                city,
                region,
                country,
                status,
                created_at,
                updated_at
            `,
            [
                ownerPublicId,
                ownerData.owner_type,
                ownerData.display_name.trim(),
                ownerData.registration_number?.trim() || null,
                ownerData.tax_identification_number?.trim() || null,
                ownerData.email?.trim().toLowerCase() || null,
                ownerData.phone_number?.trim() || null,
                ownerData.alternative_phone?.trim() || null,
                ownerData.address?.trim() || null,
                ownerData.city?.trim() || null,
                ownerData.region?.trim() || null,
                ownerData.country.trim(),
                authenticatedUser.id
            ]
        );

        const owner = ownerResult.rows[0];

        let ownerUserLink = null;

        /*
         * Regular user anayesajili owner ataunganishwa naye moja kwa moja.
         * Admin anaweza kusajili owner kwa niaba ya mtu mwingine bila
         * kujifanya representative wa owner huyo.
         */
        if (authenticatedUser.role !== "admin") {
            const ownerUserPublicId = `owner_user_${nanoid(24)}`;

            const ownerUserResult = await client.query(
                `
                INSERT INTO owner_users (
                    public_id,
                    owner_id,
                    user_id,
                    relationship_role,
                    is_primary,
                    can_manage_properties,
                    can_manage_finances
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING
                    public_id,
                    relationship_role,
                    is_primary,
                    can_manage_properties,
                    can_manage_finances,
                    created_at
                `,
                [
                    ownerUserPublicId,
                    owner.id,
                    authenticatedUser.id,
                    "owner",
                    true,
                    true,
                    true
                ]
            );

            ownerUserLink = ownerUserResult.rows[0];
        }

        await client.query("COMMIT");

        delete owner.id;

        return {
            owner,
            owner_user_link: ownerUserLink
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    createOwner
};
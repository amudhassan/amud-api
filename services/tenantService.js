const { nanoid } = require("nanoid");
const pool = require("../config/db");

const createTenant = async ({
    ownerPublicId,
    tenantData,
    authenticatedUser
}) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const ownerValues = [
            ownerPublicId
        ];

        let accessCondition = "";

        /*
         * Admin anaweza kutengeneza tenant kwa
         * owner yeyote aliye active.
         *
         * Regular user lazima:
         * 1. Awe na active owner_users relationship.
         * 2. Awe na can_manage_properties = TRUE.
         * 3. Awe owner, representative au manager.
         */
        if (authenticatedUser.role !== "admin") {
            ownerValues.push(
                authenticatedUser.id
            );

            accessCondition = `
                AND EXISTS (
                    SELECT 1

                    FROM owner_users AS user_access

                    WHERE user_access.owner_id = o.id
                      AND user_access.user_id = $2
                      AND user_access.revoked_at IS NULL
                      AND user_access.can_manage_properties = TRUE
                      AND user_access.relationship_role IN (
                          'owner',
                          'representative',
                          'manager'
                      )
                )
            `;
        }

        /*
         * Validate na lock active owner.
         *
         * Lock inalinda transaction dhidi ya owner
         * kubadilishwa au kufutwa wakati tenant
         * na relationship vinatengenezwa.
         */
        const ownerResult = await client.query(
            `
            SELECT
                o.id,
                o.public_id,
                o.owner_type,
                o.display_name,
                o.status,
                o.created_at,
                o.updated_at

            FROM owners AS o

            WHERE o.public_id = $1
              AND o.status = 'active'
              AND o.deleted_at IS NULL

              ${accessCondition}

            LIMIT 1

            FOR UPDATE OF o
            `,
            ownerValues
        );

        /*
         * Kwa regular user, null inaweza kumaanisha:
         * - owner hayupo,
         * - owner si active,
         * - owner amefutwa,
         * - user hana relationship inayoruhusiwa,
         * - user hana can_manage_properties.
         *
         * Tunatumia response moja ili kuzuia
         * owner-data enumeration.
         */
        if (ownerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return null;
        }

        const owner = ownerResult.rows[0];

        const tenantPublicId =
            `tenant_${nanoid(24)}`;

        /*
         * Tenant status haichukuliwi kutoka request.
         * Tenant mpya anaanza prospective automatically.
         */
        const createdTenantResult =
            await client.query(
                `
                INSERT INTO tenants (
                    public_id,
                    tenant_type,
                    display_name,
                    national_id,
                    passport_number,
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
                    $11,
                    $12,
                    $13,
                    $14,
                    'prospective',
                    $15
                )
                RETURNING
                    id,
                    public_id,
                    tenant_type,
                    display_name,
                    national_id,
                    passport_number,
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
                    updated_at,
                    deleted_at
                `,
                [
                    tenantPublicId,
                    tenantData.tenant_type,
                    tenantData.display_name,
                    tenantData.national_id ?? null,
                    tenantData.passport_number ?? null,
                    tenantData.registration_number ?? null,
                    tenantData
                        .tax_identification_number ??
                        null,
                    tenantData.email ?? null,
                    tenantData.phone_number ?? null,
                    tenantData.alternative_phone ?? null,
                    tenantData.address ?? null,
                    tenantData.city ?? null,
                    tenantData.region ?? null,
                    tenantData.country ?? "Tanzania",
                    authenticatedUser.id
                ]
            );

        const tenant =
            createdTenantResult.rows[0];

        const relationshipPublicId =
            `owner_tenant_${nanoid(24)}`;

        /*
         * First owner relationship:
         * - active
         * - primary
         * - current, hivyo ended_at ni NULL
         */
        const relationshipResult =
            await client.query(
                `
                INSERT INTO owner_tenants (
                    public_id,
                    owner_id,
                    tenant_id,
                    relationship_status,
                    is_primary_owner_relationship,
                    notes,
                    created_by,
                    ended_at
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    'active',
                    TRUE,
                    $4,
                    $5,
                    NULL
                )
                RETURNING
                    public_id,
                    relationship_status,
                    is_primary_owner_relationship,
                    notes,
                    created_at,
                    updated_at,
                    ended_at
                `,
                [
                    relationshipPublicId,
                    owner.id,
                    tenant.id,
                    tenantData.notes ?? null,
                    authenticatedUser.id
                ]
            );

        /*
         * Lazimisha deferred integrity triggers
         * zikaguliwe kabla ya COMMIT.
         */
        await client.query(
            "SET CONSTRAINTS ALL IMMEDIATE"
        );

        await client.query("COMMIT");

        delete tenant.id;
        delete owner.id;

        return {
            owner,

            tenant,

            owner_relationship:
                relationshipResult.rows[0],

            creation_summary: {
                initial_tenant_status:
                    tenant.status,

                relationship_status:
                    relationshipResult
                        .rows[0]
                        .relationship_status,

                is_primary_owner_relationship:
                    relationshipResult
                        .rows[0]
                        .is_primary_owner_relationship
            }
        };
    } catch (error) {
        await client.query("ROLLBACK");

        /*
         * PostgreSQL unique violation.
         *
         * Tunatambua identifier iliyojirudia kwa
         * kutumia jina la unique index.
         */
        if (error.code === "23505") {
            const duplicateFields = {
                uq_tenants_current_national_id:
                    "national_id",

                uq_tenants_current_passport_number:
                    "passport_number",

                uq_tenants_current_registration_number:
                    "registration_number",

                uq_tenants_current_tax_identification_number:
                    "tax_identification_number"
            };

            const duplicateField =
                duplicateFields[error.constraint];

            if (duplicateField) {
                return {
                    duplicateIdentifier: true,
                    duplicateField
                };
            }
        }

        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    createTenant
};
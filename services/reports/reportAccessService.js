const pool = require("../../config/db");

const REPORT_PERMISSION_MODES = Object.freeze({
    EITHER: "either",
    PROPERTY: "property",
    FINANCIAL: "financial",
    BOTH: "both",
    MAINTENANCE: "maintenance",
    MANAGEMENT: "management"
});

const buildPermissionCondition = ({
    alias = "ou",
    permissionMode =
        REPORT_PERMISSION_MODES.EITHER
}) => {
    if (
        permissionMode ===
        REPORT_PERMISSION_MODES.PROPERTY
    ) {
        return `${alias}.can_manage_properties = TRUE`;
    }

    if (
        permissionMode ===
        REPORT_PERMISSION_MODES.FINANCIAL
    ) {
        return `${alias}.can_manage_finances = TRUE`;
    }

    if (
        permissionMode ===
        REPORT_PERMISSION_MODES.BOTH
    ) {
        return `(
            ${alias}.can_manage_properties = TRUE
            AND ${alias}.can_manage_finances = TRUE
        )`;
    }

    if (
        permissionMode ===
        REPORT_PERMISSION_MODES.MAINTENANCE
    ) {
        return `${alias}.can_view_maintenance_requests = TRUE`;
    }

    if (
        permissionMode ===
        REPORT_PERMISSION_MODES.MANAGEMENT
    ) {
        return `(
            ${alias}.can_manage_properties = TRUE
            OR ${alias}.can_manage_finances = TRUE
            OR ${alias}.can_view_maintenance_requests = TRUE
        )`;
    }

    return `(
        ${alias}.can_manage_properties = TRUE
        OR ${alias}.can_manage_finances = TRUE
    )`;
};

const resolveReportScope = async ({
    authenticatedUser,
    ownerPublicId = null,
    propertyPublicId = null,
    permissionMode =
        REPORT_PERMISSION_MODES.EITHER
}) => {
    const isAdmin =
        authenticatedUser.role === "admin";

    let ownerIds = null;
    let selectedOwner = null;
    let selectedPermissions = null;

    if (isAdmin) {
        if (ownerPublicId) {
            const ownerResult = await pool.query(
                `
                SELECT
                    id,
                    public_id,
                    owner_type,
                    display_name,
                    status,
                    deleted_at
                FROM owners
                WHERE public_id = $1
                LIMIT 1
                `,
                [ownerPublicId]
            );

            if (ownerResult.rows.length === 0) {
                return {
                    ownerNotFound: true
                };
            }

            const row = ownerResult.rows[0];

            ownerIds = [row.id];
            selectedOwner = {
                public_id: row.public_id,
                owner_type: row.owner_type,
                display_name: row.display_name,
                status: row.status,
                is_deleted:
                    row.deleted_at !== null
            };

            selectedPermissions = {
                can_manage_properties: true,
                can_manage_finances: true,
                can_view_maintenance_requests: true
            };
        }
    } else {
        const permissionCondition =
            buildPermissionCondition({
                alias: "ou",
                permissionMode
            });

        const values = [authenticatedUser.id];
        let ownerFilter = "";

        if (ownerPublicId) {
            values.push(ownerPublicId);
            ownerFilter = `AND o.public_id = $2`;
        }

        const ownerResult = await pool.query(
            `
            SELECT
                o.id,
                o.public_id,
                o.owner_type,
                o.display_name,
                o.status,
                ou.can_manage_properties,
                ou.can_manage_finances,
                ou.can_view_maintenance_requests
            FROM owner_users AS ou
            INNER JOIN owners AS o
                ON o.id = ou.owner_id
            WHERE ou.user_id = $1
              AND ou.revoked_at IS NULL
              AND o.deleted_at IS NULL
              AND ${permissionCondition}
              ${ownerFilter}
            ORDER BY o.id
            `,
            values
        );

        if (ownerResult.rows.length === 0) {
            if (ownerPublicId) {
                return {
                    ownerNotFound: true
                };
            }

            return {
                forbidden: true
            };
        }

        ownerIds = ownerResult.rows.map(
            row => row.id
        );

        if (ownerPublicId) {
            const row = ownerResult.rows[0];

            selectedOwner = {
                public_id: row.public_id,
                owner_type: row.owner_type,
                display_name: row.display_name,
                status: row.status,
                is_deleted: false
            };

            selectedPermissions = {
                can_manage_properties:
                    row.can_manage_properties === true,
                can_manage_finances:
                    row.can_manage_finances === true,
                can_view_maintenance_requests:
                    row.can_view_maintenance_requests === true
            };
        }
    }

    let selectedProperty = null;

    if (propertyPublicId) {
        const propertyValues = [
            propertyPublicId
        ];

        let propertyAccessCondition = "";

        if (ownerIds !== null) {
            propertyValues.push(ownerIds);

            propertyAccessCondition = `
                AND EXISTS (
                    SELECT 1
                    FROM property_owners AS po
                    WHERE po.property_id = p.id
                      AND po.owner_id = ANY(
                          $2::BIGINT[]
                      )
                      AND po.effective_to IS NULL
                )
            `;
        }

        const propertyResult = await pool.query(
            `
            SELECT
                p.id,
                p.public_id,
                p.property_code,
                p.property_name,
                p.property_type,
                p.usage_category,
                p.operational_status,
                p.deleted_at
            FROM properties AS p
            WHERE p.public_id = $1
              ${propertyAccessCondition}
            LIMIT 1
            `,
            propertyValues
        );

        if (propertyResult.rows.length === 0) {
            return {
                propertyNotFound: true
            };
        }

        const property =
            propertyResult.rows[0];

        if (ownerPublicId) {
            const ownerRelationshipValues = [
                property.id
            ];

            if (ownerIds === null) {
                const ownerLookup = await pool.query(
                    `
                    SELECT id
                    FROM owners
                    WHERE public_id = $1
                    LIMIT 1
                    `,
                    [ownerPublicId]
                );

                if (ownerLookup.rows.length === 0) {
                    return {
                        ownerNotFound: true
                    };
                }

                ownerRelationshipValues.push(
                    ownerLookup.rows[0].id
                );
            } else {
                ownerRelationshipValues.push(
                    ownerIds[0]
                );
            }

            const relationshipResult =
                await pool.query(
                    `
                    SELECT 1
                    FROM property_owners
                    WHERE property_id = $1
                      AND owner_id = $2
                      AND effective_to IS NULL
                    LIMIT 1
                    `,
                    ownerRelationshipValues
                );

            if (
                relationshipResult.rows.length === 0
            ) {
                return {
                    propertyNotFound: true
                };
            }
        }

        selectedProperty = {
            public_id: property.public_id,
            property_code:
                property.property_code,
            property_name:
                property.property_name,
            property_type:
                property.property_type,
            usage_category:
                property.usage_category,
            operational_status:
                property.operational_status,
            is_deleted:
                property.deleted_at !== null
        };
    }

    return {
        forbidden: false,
        access_type:
            isAdmin ? "admin" : "owner_user",
        permission_mode: permissionMode,
        owner_ids: ownerIds,
        selected_owner: selectedOwner,
        selected_property: selectedProperty,
        selected_permissions:
            selectedPermissions
    };
};

module.exports = {
    REPORT_PERMISSION_MODES,
    buildPermissionCondition,
    resolveReportScope
};

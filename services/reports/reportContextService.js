const {
    REPORT_PERMISSION_MODES,
    resolveReportScope
} = require(
    "./reportAccessService"
);

const getReportContext = async ({
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
            REPORT_PERMISSION_MODES.EITHER
    });

    if (
        scope.forbidden ||
        scope.ownerNotFound ||
        scope.propertyNotFound
    ) {
        return scope;
    }

    const ownerScopeType =
        scope.owner_ids === null
            ? "all"
            : (
                scope.selected_owner
                    ? "selected"
                    : "accessible"
            );

    return {
        forbidden: false,
        context: {
            access_type: scope.access_type,
            permission_mode:
                scope.permission_mode,
            owner_scope: ownerScopeType,
            accessible_owner_count:
                scope.owner_ids === null
                    ? null
                    : scope.owner_ids.length,
            selected_owner:
                scope.selected_owner,
            selected_property:
                scope.selected_property,
            selected_permissions:
                scope.selected_permissions,
            filters: {
                date_from:
                    filters.date_from || null,
                date_to:
                    filters.date_to || null,
                currency_code:
                    filters.currency_code || null
            },
            supported_periods: [
                "daily",
                "weekly",
                "monthly",
                "quarterly",
                "yearly"
            ]
        }
    };
};

module.exports = {
    getReportContext
};

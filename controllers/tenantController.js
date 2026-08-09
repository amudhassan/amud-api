const asyncHandler = require(
    "../utils/asyncHandler"
);

const AppError = require(
    "../utils/AppError"
);

const {
    getTenants,
    getDeletedTenants,
    getSingleTenant,
    updateTenant,
    softDeleteTenant,
    restoreTenant,
    createTenant,
    endOwnerTenantRelationship
} = require(
    "../services/tenantService"
);

/*
 * GET /api/tenants
 */
const getTenantsController = asyncHandler(
    async (req, res, next) => {
        const {
            owner_public_id,
            search,
            tenant_type,
            status,
            relationship_status,
            page,
            limit
        } = req.query;

        const result = await getTenants({
            ownerPublicId:
                owner_public_id,

            filters: {
                search,
                tenant_type,
                status,
                relationship_status,
                page,
                limit
            },

            authenticatedUser:
                req.user
        });

        /*
         * Owner anaweza kuwa:
         * - hayupo,
         * - soft-deleted,
         * - inaccessible kwa regular user.
         *
         * Response moja inalinda owner-based
         * data isolation.
         */
        if (!result) {
            return next(
                new AppError(
                    "Owner not found.",
                    404
                )
            );
        }

        return res.status(200).json({
            success: true,

            message:
                "Tenants retrieved successfully.",

            data: result
        });
    }
);

/*
 * GET /api/tenants/deleted
 */
const getDeletedTenantsController =
    asyncHandler(
        async (req, res, next) => {
            const {
                owner_public_id,
                search,
                tenant_type,
                page,
                limit
            } = req.query;

            const result =
                await getDeletedTenants({
                    ownerPublicId:
                        owner_public_id,

                    filters: {
                        search,
                        tenant_type,
                        page,
                        limit
                    },

                    authenticatedUser:
                        req.user
                });

            /*
             * Missing, inactive, deleted or inaccessible
             * owner is intentionally hidden behind 404.
             */
            if (!result) {
                return next(
                    new AppError(
                        "Owner not found.",
                        404
                    )
                );
            }

            return res.status(200).json({
                success: true,

                message:
                    "Deleted tenants retrieved successfully.",

                count:
                    result.tenants.length,

                data: result
            });
        }
    );

/*
 * GET /api/tenants/:tenant_public_id
 */
const getSingleTenantController =
    asyncHandler(
        async (req, res, next) => {
            const {
                tenant_public_id
            } = req.params;

            const {
                owner_public_id
            } = req.query;

            const result =
                await getSingleTenant({
                    ownerPublicId:
                        owner_public_id,

                    tenantPublicId:
                        tenant_public_id,

                    authenticatedUser:
                        req.user
                });

            /*
             * Owner hayupo, amefutwa au regular
             * user hana access kwake.
             */
            if (!result) {
                return next(
                    new AppError(
                        "Owner not found.",
                        404
                    )
                );
            }

            /*
             * Tenant hayupo, amefutwa,
             * hana current relationship na owner,
             * au relationship yake imeisha.
             */
            if (result.tenantNotFound) {
                return next(
                    new AppError(
                        "Tenant not found.",
                        404
                    )
                );
            }

            return res.status(200).json({
                success: true,

                message:
                    "Tenant retrieved successfully.",

                data: result
            });
        }
    );
    /*
 * PATCH /api/tenants/:tenant_public_id
 */
const updateTenantController =
    asyncHandler(
        async (req, res, next) => {
            const {
                tenant_public_id
            } = req.params;

            const {
                owner_public_id
            } = req.query;

            const result =
                await updateTenant({
                    ownerPublicId:
                        owner_public_id,

                    tenantPublicId:
                        tenant_public_id,

                    tenantData:
                        req.body,

                    authenticatedUser:
                        req.user
                });

            /*
             * Owner hayupo, si active,
             * amefutwa au regular user
             * hana management permission.
             */
            if (!result) {
                return next(
                    new AppError(
                        "Owner not found.",
                        404
                    )
                );
            }

            /*
             * Tenant hayupo, amefutwa,
             * relationship si active au regular
             * user hatumii primary owner.
             */
            if (result.tenantNotFound) {
                return next(
                    new AppError(
                        "Tenant not found.",
                        404
                    )
                );
            }

            /*
             * Defense-in-depth.
             * Validator pia inalinda condition hii.
             */
            if (result.noFieldsSupplied) {
                return next(
                    new AppError(
                        "At least one tenant field must be supplied.",
                        400
                    )
                );
            }

            /*
             * Duplicate legal identifiers.
             */
            if (result.duplicateIdentifier) {
                const duplicateMessages = {
                    national_id:
                        "A current tenant with this national ID already exists.",

                    passport_number:
                        "A current tenant with this passport number already exists.",

                    registration_number:
                        "A current tenant with this registration number already exists.",

                    tax_identification_number:
                        "A current tenant with this tax identification number already exists."
                };

                const message =
                    duplicateMessages[
                        result.duplicateField
                    ] ||
                    "A tenant with the supplied identifier already exists.";

                return next(
                    new AppError(
                        message,
                        409
                    )
                );
            }

            return res.status(200).json({
                success: true,

                message:
                    "Tenant updated successfully.",

                data: result
            });
        }
    );
    /*
 * DELETE /api/tenants/:tenant_public_id
 */
const softDeleteTenantController =
    asyncHandler(
        async (req, res, next) => {
            const {
                tenant_public_id
            } = req.params;

            const {
                owner_public_id
            } = req.query;

            const result =
                await softDeleteTenant({
                    ownerPublicId:
                        owner_public_id,

                    tenantPublicId:
                        tenant_public_id,

                    authenticatedUser:
                        req.user
                });

            /*
             * Owner hayupo, si active,
             * amefutwa au regular user hana
             * management permission.
             */
            if (!result) {
                return next(
                    new AppError(
                        "Owner not found.",
                        404
                    )
                );
            }

            /*
             * Tenant hayupo, tayari amefutwa
             * au selected owner hajawahi kuwa
             * na relationship naye.
             */
            if (result.tenantNotFound) {
                return next(
                    new AppError(
                        "Tenant not found.",
                        404
                    )
                );
            }

            /*
             * Integrity rule:
             * tenant hawezi kufutwa akiwa bado
             * na current owner relationship.
             */
            if (
                result.currentRelationshipExists
            ) {
                return next(
                    new AppError(
                        "Tenant cannot be deleted while a current owner relationship exists.",
                        409,
                        {
                            current_relationship_count:
                                result
                                    .currentRelationshipCount
                        }
                    )
                );
            }
            /*
 * Active tenant portal users must be
 * revoked before tenant deletion.
 */
if (result.activeTenantUsersExist) {
    return next(
        new AppError(
            "Tenant cannot be deleted while active tenant users exist.",
            409,
            {
                active_tenant_user_count:
                    result
                        .activeTenantUserCount
            }
        )
    );
}
            return res.status(200).json({
                success: true,

                message:
                    "Tenant deleted successfully.",

                data: result
            });
        }
    );
    /*
 * PATCH /api/tenants/:tenant_public_id/restore
 */
const restoreTenantController =
    asyncHandler(
        async (req, res, next) => {
            const {
                tenant_public_id
            } = req.params;

            const {
                owner_public_id
            } = req.query;

            const result =
                await restoreTenant({
                    ownerPublicId:
                        owner_public_id,

                    tenantPublicId:
                        tenant_public_id,

                    authenticatedUser:
                        req.user
                });

            /*
             * Owner hayupo, si active,
             * amefutwa au regular user hana
             * management permission.
             */
            if (!result) {
                return next(
                    new AppError(
                        "Owner not found.",
                        404
                    )
                );
            }

            /*
             * Tenant hayupo, hajafutwa,
             * au selected owner hajawahi kuwa
             * na relationship naye.
             */
            if (result.tenantNotFound) {
                return next(
                    new AppError(
                        "Tenant not found.",
                        404
                    )
                );
            }

            /*
             * Restore recreates a fresh current owner
             * relationship. A concurrent/current relationship
             * would make that unsafe.
             */
            if (
                result.currentRelationshipExists
            ) {
                return next(
                    new AppError(
                        "Tenant cannot be restored because a current owner relationship already exists.",
                        409
                    )
                );
            }

            /*
             * Identifier ya soft-deleted tenant
             * inaweza kuwa imetumiwa na current
             * tenant mwingine.
             */
            if (result.duplicateIdentifier) {
                const duplicateMessages = {
                    national_id:
                        "Tenant cannot be restored because a current tenant with this national ID already exists.",

                    passport_number:
                        "Tenant cannot be restored because a current tenant with this passport number already exists.",

                    registration_number:
                        "Tenant cannot be restored because a current tenant with this registration number already exists.",

                    tax_identification_number:
                        "Tenant cannot be restored because a current tenant with this tax identification number already exists."
                };

                const message =
                    duplicateMessages[
                        result.duplicateField
                    ] ||
                    "Tenant cannot be restored because one of its identifiers is already in use.";

                return next(
                    new AppError(
                        message,
                        409
                    )
                );
            }

            return res.status(200).json({
                success: true,

                message:
                    "Tenant restored successfully.",

                data: result
            });
        }
    );
/*
 * POST /api/tenants
 */
const createTenantController = asyncHandler(
    async (req, res, next) => {
        const {
            owner_public_id,
            ...tenantData
        } = req.body;

        const result = await createTenant({
            ownerPublicId:
                owner_public_id,

            tenantData,

            authenticatedUser:
                req.user
        });

        if (!result) {
            return next(
                new AppError(
                    "Owner not found.",
                    404
                )
            );
        }

        if (result.duplicateIdentifier) {
            const duplicateMessages = {
                national_id:
                    "A current tenant with this national ID already exists.",

                passport_number:
                    "A current tenant with this passport number already exists.",

                registration_number:
                    "A current tenant with this registration number already exists.",

                tax_identification_number:
                    "A current tenant with this tax identification number already exists."
            };

            const message =
                duplicateMessages[
                    result.duplicateField
                ] ||
                "A tenant with the supplied identifier already exists.";

            return next(
                new AppError(
                    message,
                    409
                )
            );
        }

        return res.status(201).json({
            success: true,

            message:
                "Tenant created successfully.",

            data: result
        });
    }
);


/*
 * PATCH /api/tenants/:tenant_public_id/relationship/end
 */
const endOwnerTenantRelationshipController =
    asyncHandler(
        async (req, res, next) => {
            const {
                tenant_public_id
            } = req.params;

            const {
                owner_public_id
            } = req.query;

            try {
                const result =
                    await endOwnerTenantRelationship({
                        ownerPublicId:
                            owner_public_id,

                        tenantPublicId:
                            tenant_public_id,

                        authenticatedUser:
                            req.user
                    });

                /*
                 * Missing, inactive or inaccessible owner.
                 */
                if (!result) {
                    return next(
                        new AppError(
                            "Owner not found.",
                            404
                        )
                    );
                }

                /*
                 * Tenant has no current active/blocked
                 * relationship with the selected owner.
                 */
                if (
                    result.relationshipNotFound
                ) {
                    return next(
                        new AppError(
                            "Current owner-tenant relationship not found.",
                            404
                        )
                    );
                }

                return res.status(200).json({
                    success: true,

                    message:
                        "Owner-tenant relationship ended successfully.",

                    data: result
                });
            } catch (error) {
                /*
                 * The existing deferred lease-integrity
                 * trigger rejects ending a relationship that
                 * is still required by a draft, scheduled or
                 * active lease.
                 */
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "Owner-tenant relationship cannot be ended while a draft, scheduled or active lease depends on it.",
                            409
                        )
                    );
                }

                return next(error);
            }
        }
    );

module.exports = {
    getTenantsController,
    getDeletedTenantsController,
    getSingleTenantController,
    updateTenantController,
    softDeleteTenantController,
    restoreTenantController,
    createTenantController,
    endOwnerTenantRelationshipController
};
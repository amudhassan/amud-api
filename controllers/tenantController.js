const asyncHandler = require(
    "../utils/asyncHandler"
);

const AppError = require(
    "../utils/AppError"
);

const {
    getTenants,
    getSingleTenant,
    updateTenant,
    createTenant
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

module.exports = {
    getTenantsController,
    getSingleTenantController,
    updateTenantController,
    createTenantController
};
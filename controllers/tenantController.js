const asyncHandler = require(
    "../utils/asyncHandler"
);

const AppError = require(
    "../utils/AppError"
);

const {
    createTenant
} = require(
    "../services/tenantService"
);

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

        /*
         * Owner anaweza kuwa:
         * - hayupo,
         * - inactive,
         * - soft-deleted,
         * - inaccessible kwa regular user,
         * - user hana management permission.
         *
         * Tunatumia message moja ili kulinda
         * owner-based data isolation.
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
         * Duplicate tenant legal identifiers.
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

        return res.status(201).json({
            success: true,

            message:
                "Tenant created successfully.",

            data: result
        });
    }
);

module.exports = {
    createTenantController
};
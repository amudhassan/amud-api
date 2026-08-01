const asyncHandler = require(
    "../utils/asyncHandler"
);

const AppError = require(
    "../utils/AppError"
);

const {
    createDraftLease
} = require(
    "../services/leaseService"
);

/*
 * POST /api/leases
 */
const createDraftLeaseController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await createDraftLease({
                        leaseData: req.body,
                        authenticatedUser:
                            req.user
                    });

                if (result.ownerNotFound) {
                    return next(
                        new AppError(
                            "Active owner not found.",
                            404
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to create leases for this owner.",
                            403
                        )
                    );
                }

                if (
                    result.propertyNotFound
                ) {
                    return next(
                        new AppError(
                            "Active property not found.",
                            404
                        )
                    );
                }

                if (
                    result.ownershipConflict
                ) {
                    return next(
                        new AppError(
                            "The selected owner does not currently own the selected property.",
                            409
                        )
                    );
                }

                if (result.unitNotFound) {
                    return next(
                        new AppError(
                            "Unit not found.",
                            404
                        )
                    );
                }

                if (
                    result.unitPropertyConflict
                ) {
                    return next(
                        new AppError(
                            "The selected unit does not belong to the selected property.",
                            409
                        )
                    );
                }

                if (result.tenantNotFound) {
                    return next(
                        new AppError(
                            "Active tenant not found.",
                            404
                        )
                    );
                }

                if (
                    result
                        .tenantRelationshipConflict
                ) {
                    return next(
                        new AppError(
                            "The selected tenant does not have an active relationship with the owner.",
                            409
                        )
                    );
                }

                if (result.invalidDateRange) {
                    return next(
                        new AppError(
                            "Lease end date must be after the start date.",
                            422
                        )
                    );
                }

                if (
                    result
                        .invalidFinancialTerms
                ) {
                    return next(
                        new AppError(
                            "The supplied lease financial terms are invalid.",
                            422
                        )
                    );
                }

                return res
                    .status(201)
                    .json({
                        success: true,
                        message:
                            "Draft lease created successfully.",
                        data: {
                            lease:
                                result.lease,
                            owner:
                                result.owner,
                            property:
                                result.property,
                            unit:
                                result.unit,
                            tenant:
                                result.tenant
                        }
                    });
            } catch (error) {
                /*
                 * Unique public ID or lease-number
                 * conflict.
                 */
                if (error.code === "23505") {
                    return next(
                        new AppError(
                            "The generated lease identifier conflicts with an existing lease. Please try again.",
                            409
                        )
                    );
                }

                /*
                 * Database CHECK constraint
                 * violation.
                 */
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The supplied lease violates a business rule.",
                            422
                        )
                    );
                }

                /*
                 * Foreign-key integrity failure.
                 */
                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The lease references a record that is no longer available.",
                            409
                        )
                    );
                }

                /*
                 * Deferred exclusion constraint.
                 *
                 * Draft leases should not normally
                 * reach this condition, but this
                 * protects against database-state
                 * conflicts.
                 */
                if (error.code === "23P01") {
                    return next(
                        new AppError(
                            "The selected unit has a conflicting binding lease for the supplied dates.",
                            409
                        )
                    );
                }

                /*
                 * Business integrity trigger error.
                 */
                if (error.code === "P0001") {
                    return next(
                        new AppError(
                            error.message ||
                                "The lease violates a business integrity rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );

module.exports = {
    createDraftLeaseController
};
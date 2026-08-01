const asyncHandler = require(
    "../utils/asyncHandler"
);

const AppError = require(
    "../utils/AppError"
);

const {
    createDraftLease,
    getLeases,
    getSingleLease,
    updateDraftLease,
    scheduleLease,
    activateLease,
    cancelLease,
    terminateLease,
    expireLease,
    renewLease
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
/*
 * GET /api/leases
 */
const getLeasesController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getLeases({
                    filters: req.query,
                    authenticatedUser:
                        req.user
                });

            if (result.forbidden) {
                return next(
                    new AppError(
                        "You do not have permission to view leases.",
                        403
                    )
                );
            }

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Leases retrieved successfully.",
                    count:
                        result.leases.length,
                    pagination:
                        result.pagination,
                    data: {
                        leases:
                            result.leases
                    }
                });
        }
    );
    /*
 * GET /api/leases/:lease_public_id
 */
const getSingleLeaseController =
    asyncHandler(
        async (req, res, next) => {
            const lease =
                await getSingleLease({
                    leasePublicId:
                        req.params
                            .lease_public_id,

                    authenticatedUser:
                        req.user
                });

            /*
             * Missing and inaccessible leases use
             * the same response for security.
             */
            if (!lease) {
                return next(
                    new AppError(
                        "Lease not found.",
                        404
                    )
                );
            }

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Lease retrieved successfully.",
                    data: {
                        lease
                    }
                });
        }
    );
    /*
 * PATCH /api/leases/:lease_public_id
 */
const updateDraftLeaseController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await updateDraftLease({
                        leasePublicId:
                            req.params
                                .lease_public_id,

                        leaseData:
                            req.body,

                        authenticatedUser:
                            req.user
                    });

                if (
                    result.leaseNotFound
                ) {
                    return next(
                        new AppError(
                            "Lease not found.",
                            404
                        )
                    );
                }

                if (result.notDraft) {
                    return next(
                        new AppError(
                            "Only draft leases can be updated.",
                            409
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to update this lease.",
                            403
                        )
                    );
                }

                if (
                    result.ownerNotFound
                ) {
                    return next(
                        new AppError(
                            "The lease owner is not active.",
                            409
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
                            "The lease owner does not currently own the selected property.",
                            409
                        )
                    );
                }

                if (
                    result.unitNotFound
                ) {
                    return next(
                        new AppError(
                            "Unit not found.",
                            404
                        )
                    );
                }

                if (
                    result
                        .unitPropertyConflict
                ) {
                    return next(
                        new AppError(
                            "The selected unit does not belong to the selected property.",
                            409
                        )
                    );
                }

                if (
                    result.tenantNotFound
                ) {
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
                            "The selected tenant does not have an active relationship with the lease owner.",
                            409
                        )
                    );
                }

                if (
                    result.invalidDateRange
                ) {
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

                if (result.noChanges) {
                    return next(
                        new AppError(
                            "No lease changes were detected.",
                            400
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Draft lease updated successfully.",
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
                if (error.code === "23505") {
                    return next(
                        new AppError(
                            "The updated lease conflicts with an existing unique lease record.",
                            409
                        )
                    );
                }

                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The updated lease violates a business rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The updated lease references a record that is no longer available.",
                            409
                        )
                    );
                }

                if (error.code === "23P01") {
                    return next(
                        new AppError(
                            "The selected unit has a conflicting binding lease for the supplied dates.",
                            409
                        )
                    );
                }

                if (error.code === "P0001") {
                    return next(
                        new AppError(
                            error.message ||
                                "The updated lease violates a business integrity rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );
    /*
 * PATCH /api/leases/:lease_public_id/schedule
 */
const scheduleLeaseController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await scheduleLease({
                        leasePublicId:
                            req.params
                                .lease_public_id,

                        scheduleData:
                            req.body || {},

                        authenticatedUser:
                            req.user
                    });

                if (result.leaseNotFound) {
                    return next(
                        new AppError(
                            "Lease not found.",
                            404
                        )
                    );
                }

                if (result.notDraft) {
                    return next(
                        new AppError(
                            "Only draft leases can be scheduled.",
                            409
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to schedule this lease.",
                            403
                        )
                    );
                }

                if (result.ownerNotFound) {
                    return next(
                        new AppError(
                            "The lease owner is not active.",
                            409
                        )
                    );
                }

                if (result.propertyNotFound) {
                    return next(
                        new AppError(
                            "The lease property is not active.",
                            409
                        )
                    );
                }

                if (
                    result.ownershipConflict
                ) {
                    return next(
                        new AppError(
                            "The lease owner does not currently own the selected property.",
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
                            "The selected unit does not belong to the lease property.",
                            409
                        )
                    );
                }

                if (
                    result.unitNotEligible
                ) {
                    return next(
                        new AppError(
                            "The selected unit is not eligible for lease scheduling.",
                            409
                        )
                    );
                }

                if (result.tenantNotFound) {
                    return next(
                        new AppError(
                            "The lease tenant is not active.",
                            409
                        )
                    );
                }

                if (
                    result
                        .tenantRelationshipConflict
                ) {
                    return next(
                        new AppError(
                            "The lease tenant does not have an active relationship with the lease owner.",
                            409
                        )
                    );
                }

                if (
                    result.signatureRequired
                ) {
                    return next(
                        new AppError(
                            "Lease must be signed before it can be scheduled.",
                            409
                        )
                    );
                }

                if (
                    result.futureSignature
                ) {
                    return next(
                        new AppError(
                            "Lease signature timestamp cannot be in the future.",
                            422
                        )
                    );
                }

                if (result.pastStartDate) {
                    return next(
                        new AppError(
                            "A lease with a past start date cannot be scheduled.",
                            409
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Lease scheduled successfully.",
                        data: {
                            lease:
                                result.lease,
                            unit:
                                result.unit
                        }
                    });
            } catch (error) {
                if (error.code === "23P01") {
                    return next(
                        new AppError(
                            "The selected unit already has a conflicting scheduled or active lease for the supplied dates.",
                            409
                        )
                    );
                }

                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The scheduled lease violates a business rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The lease references a record that is no longer available.",
                            409
                        )
                    );
                }

                if (error.code === "P0001") {
                    return next(
                        new AppError(
                            error.message ||
                                "The lease violates a scheduling integrity rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );
    /*
 * PATCH /api/leases/:lease_public_id/activate
 */
const activateLeaseController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await activateLease({
                        leasePublicId:
                            req.params
                                .lease_public_id,

                        authenticatedUser:
                            req.user
                    });

                const errors = [
                    [
                        result.leaseNotFound,
                        "Lease not found.",
                        404
                    ],
                    [
                        result.notScheduled,
                        "Only scheduled leases can be activated.",
                        409
                    ],
                    [
                        result.forbidden,
                        "You are not authorized to activate this lease.",
                        403
                    ],
                    [
                        result.ownerNotFound,
                        "The lease owner is not active.",
                        409
                    ],
                    [
                        result.propertyNotFound,
                        "The lease property is not active.",
                        409
                    ],
                    [
                        result.ownershipConflict,
                        "The lease owner does not currently own the selected property.",
                        409
                    ],
                    [
                        result.unitNotFound,
                        "Unit not found.",
                        404
                    ],
                    [
                        result.unitPropertyConflict,
                        "The selected unit does not belong to the lease property.",
                        409
                    ],
                    [
                        result.unitNotEligible,
                        "The selected unit is not eligible for lease activation.",
                        409
                    ],
                    [
                        result.tenantNotFound,
                        "The lease tenant is not active.",
                        409
                    ],
                    [
                        result
                            .tenantRelationshipConflict,
                        "The lease tenant does not have an active relationship with the lease owner.",
                        409
                    ],
                    [
                        result.incompleteScheduling,
                        "The lease scheduling record is incomplete.",
                        409
                    ],
                    [
                        result.startDateNotReached,
                        "The lease start date has not been reached.",
                        409
                    ],
                    [
                        result.leasePeriodEnded,
                        "The lease period has already ended and cannot be activated.",
                        409
                    ]
                ];

                const controlledError =
                    errors.find(
                        item => item[0]
                    );

                if (controlledError) {
                    return next(
                        new AppError(
                            controlledError[1],
                            controlledError[2]
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Lease activated successfully.",
                        data: {
                            lease:
                                result.lease,
                            unit:
                                result.unit
                        }
                    });
            } catch (error) {
                if (error.code === "23P01") {
                    return next(
                        new AppError(
                            "The selected unit has a conflicting scheduled or active lease for the supplied dates.",
                            409
                        )
                    );
                }

                if (
                    error.code === "23514" ||
                    error.code === "P0001"
                ) {
                    return next(
                        new AppError(
                            "The lease violates an activation integrity rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The lease references a record that is no longer available.",
                            409
                        )
                    );
                }

                return next(error);
            }
        }
    );
    /*
 * PATCH /api/leases/:lease_public_id/cancel
 */
const cancelLeaseController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await cancelLease({
                        leasePublicId:
                            req.params
                                .lease_public_id,

                        cancellationReason:
                            req.body
                                .cancellation_reason,

                        authenticatedUser:
                            req.user
                    });

                if (result.leaseNotFound) {
                    return next(
                        new AppError(
                            "Lease not found.",
                            404
                        )
                    );
                }

                if (result.notCancellable) {
                    return next(
                        new AppError(
                            "Only draft or scheduled leases can be cancelled.",
                            409
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to cancel this lease.",
                            403
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Lease cancelled successfully.",
                        data: {
                            lease:
                                result.lease,
                            unit:
                                result.unit
                        }
                    });
            } catch (error) {
                if (
                    error.code === "23514" ||
                    error.code === "P0001"
                ) {
                    return next(
                        new AppError(
                            "The lease violates a cancellation integrity rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The lease references a record that is no longer available.",
                            409
                        )
                    );
                }

                return next(error);
            }
        }
    );
    /*
 * PATCH /api/leases/:lease_public_id/terminate
 */
const terminateLeaseController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await terminateLease({
                        leasePublicId:
                            req.params
                                .lease_public_id,

                        terminationReason:
                            req.body
                                .termination_reason,

                        authenticatedUser:
                            req.user
                    });

                if (result.leaseNotFound) {
                    return next(
                        new AppError(
                            "Lease not found.",
                            404
                        )
                    );
                }

                if (result.notActive) {
                    return next(
                        new AppError(
                            "Only active leases can be terminated.",
                            409
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to terminate this lease.",
                            403
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Lease terminated successfully.",
                        data: {
                            lease:
                                result.lease,
                            unit:
                                result.unit
                        }
                    });
            } catch (error) {
                if (
                    error.code === "23514" ||
                    error.code === "P0001"
                ) {
                    return next(
                        new AppError(
                            "The lease violates a termination integrity rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The lease references a record that is no longer available.",
                            409
                        )
                    );
                }

                return next(error);
            }
        }
    );
    /*
 * PATCH /api/leases/:lease_public_id/expire
 */
const expireLeaseController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await expireLease({
                        leasePublicId:
                            req.params
                                .lease_public_id,

                        authenticatedUser:
                            req.user
                    });

                if (result.leaseNotFound) {
                    return next(
                        new AppError(
                            "Lease not found.",
                            404
                        )
                    );
                }

                if (result.notActive) {
                    return next(
                        new AppError(
                            "Only active leases can be expired.",
                            409
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to expire this lease.",
                            403
                        )
                    );
                }

                if (
                    result.endDateNotPassed
                ) {
                    return next(
                        new AppError(
                            "The lease end date has not passed.",
                            409
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Lease expired successfully.",
                        data: {
                            lease:
                                result.lease,
                            unit:
                                result.unit
                        }
                    });
            } catch (error) {
                if (
                    error.code === "23514" ||
                    error.code === "P0001"
                ) {
                    return next(
                        new AppError(
                            "The lease violates an expiry integrity rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The lease references a record that is no longer available.",
                            409
                        )
                    );
                }

                return next(error);
            }
        }
    );
    const renewLeaseController = asyncHandler(
    async (req, res, next) => {
        try {
            const result = await renewLease({
                sourceLeasePublicId:
                    req.params.lease_public_id,

                renewalData:
                    req.body,

                authenticatedUser:
                    req.user
            });

            if (result.sourceLeaseNotFound) {
                return next(
                    new AppError(
                        "Source lease not found.",
                        404
                    )
                );
            }

            if (result.sourceNotRenewable) {
                return next(
                    new AppError(
                        "Only active or expired leases can be renewed.",
                        409
                    )
                );
            }

            if (result.forbidden) {
                return next(
                    new AppError(
                        "You are not authorized to renew this lease.",
                        403
                    )
                );
            }

            if (result.ownerNotFound) {
                return next(
                    new AppError(
                        "Active owner not found.",
                        404
                    )
                );
            }

            if (result.propertyNotFound) {
                return next(
                    new AppError(
                        "Active property not found.",
                        404
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

            if (result.tenantNotFound) {
                return next(
                    new AppError(
                        "Active tenant not found.",
                        404
                    )
                );
            }

            if (result.unitPropertyConflict) {
                return next(
                    new AppError(
                        "The selected unit does not belong to the lease property.",
                        409
                    )
                );
            }

            if (result.currentRenewalExists) {
                return next(
                    new AppError(
                        "This lease already has a current renewal.",
                        409
                    )
                );
            }

            if (result.invalidRenewalStart) {
                return next(
                    new AppError(
                        "Renewal start date must be after the source lease end date.",
                        409
                    )
                );
            }

            if (result.invalidRenewalDates) {
                return next(
                    new AppError(
                        "Renewal end date must be after the renewal start date.",
                        422
                    )
                );
            }

            if (result.ownershipConflict) {
                return next(
                    new AppError(
                        "The owner does not have an effective ownership relationship with the property on the renewal start date.",
                        409
                    )
                );
            }

            if (
                result.tenantRelationshipConflict
            ) {
                return next(
                    new AppError(
                        "The owner and tenant do not have an active relationship.",
                        409
                    )
                );
            }

            if (result.invalidFinancialTerms) {
                return next(
                    new AppError(
                        result.reason ||
                            "The supplied renewal financial terms are invalid.",
                        422
                    )
                );
            }

            return res.status(201).json({
                success: true,
                message:
                    "Lease renewal draft created successfully.",
                data: result
            });
        } catch (error) {
            /*
             * Existing non-cancelled renewal or
             * generated identifier collision.
             */
            if (error.code === "23505") {
    const isRenewalConflict =
        typeof error.constraint === "string" &&
        error.constraint
            .toLowerCase()
            .includes("renew");

    return next(
        new AppError(
            isRenewalConflict
                ? "This lease already has a current renewal."
                : "The generated lease identifier conflicts with an existing lease. Please try again.",
            409
        )
    );
}

            /*
             * Exclusion constraint conflict.
             */
            if (error.code === "23P01") {
                return next(
                    new AppError(
                        "The selected unit has a conflicting scheduled or active lease for the supplied dates.",
                        409
                    )
                );
            }

            /*
             * Database CHECK constraint.
             */
            if (error.code === "23514") {
                return next(
                    new AppError(
                        "The supplied renewal violates a lease business rule.",
                        422
                    )
                );
            }

            /*
             * Foreign-key integrity conflict.
             */
            if (error.code === "23503") {
                return next(
                    new AppError(
                        "The renewal references an invalid related record.",
                        409
                    )
                );
            }

            /*
             * Controlled exception raised by a
             * lease integrity trigger.
             */
            if (error.code === "P0001") {
                return next(
                    new AppError(
                        error.message ||
                            "The renewal violates a lease integrity rule.",
                        422
                    )
                );
            }

            return next(error);
        }
    }
);
module.exports = {
    createDraftLeaseController,
    getLeasesController,
    getSingleLeaseController,
    updateDraftLeaseController,
    scheduleLeaseController,
    activateLeaseController,
    cancelLeaseController,
    terminateLeaseController,
    expireLeaseController,
    renewLeaseController
};
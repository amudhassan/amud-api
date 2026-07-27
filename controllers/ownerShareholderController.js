const asyncHandler =
    require("../utils/asyncHandler");

const AppError =
    require("../utils/AppError");

const {
    getOwnerShareholders,
    addOwnerShareholder,
    updateOwnerShareholder
} = require(
    "../services/ownerShareholderService"
);

const getOwnerShareholdersController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getOwnerShareholders({
                    companyPublicId:
                        req.params.company_public_id,

                    authenticatedUser:
                        req.user
                });

            if (!result) {
                return next(
                    new AppError(
                        "Company owner not found.",
                        404
                    )
                );
            }

            if (result.invalidOwnerType) {
                return next(
                    new AppError(
                        "Shareholders can only be managed for company or partnership owners.",
                        422
                    )
                );
            }

            return res.status(200).json({
                success: true,

                message:
                    "Owner shareholders retrieved successfully.",

                count:
                    result.shareholders.length,

                data: {
                    company:
                        result.company,

                    summary:
                        result.summary,

                    shareholders:
                        result.shareholders
                }
            });
        }
    );

    const addOwnerShareholderController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await addOwnerShareholder({
                        companyPublicId:
                            req.params
                                .company_public_id,

                        shareholderData:
                            req.body,

                        authenticatedUser:
                            req.user
                    });

                if (!result) {
                    return next(
                        new AppError(
                            "Company owner not found.",
                            404
                        )
                    );
                }

                if (result.invalidCompanyType) {
                    return next(
                        new AppError(
                            "Shareholders can only be added to company or partnership owners.",
                            422
                        )
                    );
                }

                if (result.inactiveCompany) {
                    return next(
                        new AppError(
                            "Shareholders cannot be added while the company owner is inactive.",
                            409
                        )
                    );
                }

                if (result.shareholderNotFound) {
                    return next(
                        new AppError(
                            "Active shareholder owner not found.",
                            404
                        )
                    );
                }

                if (result.selfShareholding) {
                    return next(
                        new AppError(
                            "A company cannot be registered as its own shareholder.",
                            422
                        )
                    );
                }

                if (
                    result.duplicateShareholding
                ) {
                    return next(
                        new AppError(
                            "This shareholder already has an active shareholding of the supplied type.",
                            409
                        )
                    );
                }

                if (
                    result.shareLimitExceeded
                ) {
                    return next(
                        new AppError(
                            `The requested share percentage would exceed 100%. Current total: ${result.current_total}%. Remaining shares: ${result.remaining_shares}%.`,
                            422
                        )
                    );
                }

                return res.status(201).json({
                    success: true,

                    message:
                        "Shareholder added successfully.",

                    data: result
                });
            } catch (error) {
                if (error.code === "23505") {
                    return next(
                        new AppError(
                            "The shareholder relationship conflicts with an existing active shareholding.",
                            409
                        )
                    );
                }

                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The supplied shareholding violates a business rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );
    
    const updateOwnerShareholderController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await updateOwnerShareholder({
                        companyPublicId:
                            req.params
                                .company_public_id,

                        sharePublicId:
                            req.params
                                .share_public_id,

                        shareholdingData:
                            req.body,

                        authenticatedUser:
                            req.user
                    });

                if (!result) {
                    return next(
                        new AppError(
                            "Company owner not found.",
                            404
                        )
                    );
                }

                if (result.invalidCompanyType) {
                    return next(
                        new AppError(
                            "Shareholdings can only be managed for company or partnership owners.",
                            422
                        )
                    );
                }

                if (result.inactiveCompany) {
                    return next(
                        new AppError(
                            "Shareholdings cannot be updated while the company owner is inactive.",
                            409
                        )
                    );
                }

                if (
                    result.shareholdingNotFound
                ) {
                    return next(
                        new AppError(
                            "Active shareholding not found.",
                            404
                        )
                    );
                }

                if (
                    result.duplicateShareholding
                ) {
                    return next(
                        new AppError(
                            "The updated shareholder type conflicts with another active shareholding.",
                            409
                        )
                    );
                }

                if (
                    result.shareLimitExceeded
                ) {
                    return next(
                        new AppError(
                            `The requested share percentage would exceed 100%. Proposed total: ${result.proposed_total}%. Maximum available for this shareholding: ${result.available_for_this_share}%.`,
                            422
                        )
                    );
                }

                if (result.noChanges) {
                    return next(
                        new AppError(
                            "No valid shareholding fields were supplied.",
                            400
                        )
                    );
                }

                return res.status(200).json({
                    success: true,

                    message:
                        "Shareholding updated successfully.",

                    data: result
                });
            } catch (error) {
                if (error.code === "23505") {
                    return next(
                        new AppError(
                            "The updated shareholding conflicts with an existing active shareholding.",
                            409
                        )
                    );
                }

                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The updated shareholding violates a business rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );

module.exports = {
    getOwnerShareholdersController,
    addOwnerShareholderController,
    updateOwnerShareholderController
};
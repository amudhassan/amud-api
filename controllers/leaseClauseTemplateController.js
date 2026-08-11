const asyncHandler = require(
    "../utils/asyncHandler"
);

const AppError = require(
    "../utils/AppError"
);

const {
    getLeaseClauseTemplates,
    createLeaseClauseTemplate,
    getSingleLeaseClauseTemplate,
    updateLeaseClauseTemplate,
    deleteLeaseClauseTemplate,
    createLeaseClauseTemplateItem,
    updateLeaseClauseTemplateItem,
    deleteLeaseClauseTemplateItem,
    applyLeaseClauseTemplate
} = require(
    "../services/leaseClauseTemplateService"
);

const sendIntegrityError = (
    error,
    next
) => {
    if (
        error.code === "23514" ||
        error.code === "P0001"
    ) {
        return next(
            new AppError(
                error.message ||
                    "The lease clause template violates a business integrity rule.",
                422
            )
        );
    }

    if (
        error.code === "23503"
    ) {
        return next(
            new AppError(
                "The lease clause template references a related record that is no longer available.",
                409
            )
        );
    }

    if (
        error.code === "23505"
    ) {
        return next(
            new AppError(
                "A non-deleted template with this name already exists for the owner.",
                409
            )
        );
    }

    return next(error);
};

/*
 * GET /api/lease-clause-templates
 */
const getLeaseClauseTemplatesController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getLeaseClauseTemplates({
                    filters: req.query,
                    authenticatedUser:
                        req.user
                });

            if (
                result.ownerNotFound
            ) {
                return next(
                    new AppError(
                        "Owner not found.",
                        404
                    )
                );
            }

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Lease clause templates retrieved successfully.",
                    count:
                        result.templates
                            .length,
                    data: result
                });
        }
    );

/*
 * POST /api/lease-clause-templates
 */
const createLeaseClauseTemplateController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await createLeaseClauseTemplate({
                        templateData:
                            req.body,
                        authenticatedUser:
                            req.user
                    });

                if (
                    result.ownerNotFound
                ) {
                    return next(
                        new AppError(
                            "Owner not found.",
                            404
                        )
                    );
                }

                return res
                    .status(201)
                    .json({
                        success: true,
                        message:
                            "Lease clause template created successfully.",
                        data: result
                    });
            } catch (error) {
                return sendIntegrityError(
                    error,
                    next
                );
            }
        }
    );

/*
 * GET /api/lease-clause-templates/:template_public_id
 */
const getSingleLeaseClauseTemplateController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getSingleLeaseClauseTemplate({
                    templatePublicId:
                        req.params
                            .template_public_id,
                    authenticatedUser:
                        req.user
                });

            if (
                result.templateNotFound
            ) {
                return next(
                    new AppError(
                        "Lease clause template not found.",
                        404
                    )
                );
            }

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Lease clause template retrieved successfully.",
                    data: result
                });
        }
    );

/*
 * PATCH /api/lease-clause-templates/:template_public_id
 */
const updateLeaseClauseTemplateController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await updateLeaseClauseTemplate({
                        templatePublicId:
                            req.params
                                .template_public_id,
                        templateData:
                            req.body,
                        authenticatedUser:
                            req.user
                    });

                if (
                    result.templateNotFound
                ) {
                    return next(
                        new AppError(
                            "Lease clause template not found.",
                            404
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Lease clause template updated successfully.",
                        data: result
                    });
            } catch (error) {
                return sendIntegrityError(
                    error,
                    next
                );
            }
        }
    );

/*
 * DELETE /api/lease-clause-templates/:template_public_id
 */
const deleteLeaseClauseTemplateController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await deleteLeaseClauseTemplate({
                        templatePublicId:
                            req.params
                                .template_public_id,
                        authenticatedUser:
                            req.user
                    });

                if (
                    result.templateNotFound
                ) {
                    return next(
                        new AppError(
                            "Lease clause template not found.",
                            404
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Lease clause template removed successfully.",
                        data: result
                    });
            } catch (error) {
                return sendIntegrityError(
                    error,
                    next
                );
            }
        }
    );

/*
 * POST
 * /api/lease-clause-templates/:template_public_id/items
 */
const createLeaseClauseTemplateItemController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await createLeaseClauseTemplateItem({
                        templatePublicId:
                            req.params
                                .template_public_id,
                        itemData:
                            req.body,
                        authenticatedUser:
                            req.user
                    });

                if (
                    result.templateNotFound
                ) {
                    return next(
                        new AppError(
                            "Lease clause template not found.",
                            404
                        )
                    );
                }

                return res
                    .status(201)
                    .json({
                        success: true,
                        message:
                            "Lease clause template item created successfully.",
                        data: result
                    });
            } catch (error) {
                return sendIntegrityError(
                    error,
                    next
                );
            }
        }
    );

/*
 * PATCH
 * /api/lease-clause-templates/:template_public_id/items/:item_public_id
 */
const updateLeaseClauseTemplateItemController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await updateLeaseClauseTemplateItem({
                        templatePublicId:
                            req.params
                                .template_public_id,
                        itemPublicId:
                            req.params
                                .item_public_id,
                        itemData:
                            req.body,
                        authenticatedUser:
                            req.user
                    });

                if (
                    result.templateNotFound
                ) {
                    return next(
                        new AppError(
                            "Lease clause template not found.",
                            404
                        )
                    );
                }

                if (
                    result.itemNotFound
                ) {
                    return next(
                        new AppError(
                            "Lease clause template item not found.",
                            404
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Lease clause template item updated successfully.",
                        data: result
                    });
            } catch (error) {
                return sendIntegrityError(
                    error,
                    next
                );
            }
        }
    );

/*
 * DELETE
 * /api/lease-clause-templates/:template_public_id/items/:item_public_id
 */
const deleteLeaseClauseTemplateItemController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await deleteLeaseClauseTemplateItem({
                        templatePublicId:
                            req.params
                                .template_public_id,
                        itemPublicId:
                            req.params
                                .item_public_id,
                        authenticatedUser:
                            req.user
                    });

                if (
                    result.templateNotFound
                ) {
                    return next(
                        new AppError(
                            "Lease clause template not found.",
                            404
                        )
                    );
                }

                if (
                    result.itemNotFound
                ) {
                    return next(
                        new AppError(
                            "Lease clause template item not found.",
                            404
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Lease clause template item removed successfully.",
                        data: result
                    });
            } catch (error) {
                return sendIntegrityError(
                    error,
                    next
                );
            }
        }
    );

/*
 * POST /api/leases/:lease_public_id/apply-clause-template
 */
const applyLeaseClauseTemplateController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await applyLeaseClauseTemplate({
                        leasePublicId:
                            req.params
                                .lease_public_id,
                        templatePublicId:
                            req.body
                                .template_public_id,
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

                if (
                    result.notDraft
                ) {
                    return next(
                        new AppError(
                            "A clause template can only be applied while the lease is in draft status.",
                            409
                        )
                    );
                }

                if (
                    result.templateNotFound
                ) {
                    return next(
                        new AppError(
                            "Lease clause template not found for this lease owner.",
                            404
                        )
                    );
                }

                if (
                    result.templateInactive
                ) {
                    return next(
                        new AppError(
                            "Inactive lease clause templates cannot be applied.",
                            409
                        )
                    );
                }

                if (
                    result.templateEmpty
                ) {
                    return next(
                        new AppError(
                            "The selected lease clause template does not contain any active items.",
                            409
                        )
                    );
                }

                if (
                    result.leaseHasClauses
                ) {
                    return next(
                        new AppError(
                            "The draft lease already contains active clauses. Remove them before applying a template.",
                            409
                        )
                    );
                }

                return res
                    .status(201)
                    .json({
                        success: true,
                        message:
                            "Lease clause template applied successfully.",
                        data: result
                    });
            } catch (error) {
                return sendIntegrityError(
                    error,
                    next
                );
            }
        }
    );

module.exports = {
    getLeaseClauseTemplatesController,
    createLeaseClauseTemplateController,
    getSingleLeaseClauseTemplateController,
    updateLeaseClauseTemplateController,
    deleteLeaseClauseTemplateController,
    createLeaseClauseTemplateItemController,
    updateLeaseClauseTemplateItemController,
    deleteLeaseClauseTemplateItemController,
    applyLeaseClauseTemplateController
};

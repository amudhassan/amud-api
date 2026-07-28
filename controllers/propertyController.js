const asyncHandler =
    require("../utils/asyncHandler");
const AppError = 
    require("../utils/AppError");

const {
    getProperties,
    createProperty,
    getSingleProperty,
    updateProperty,
    softDeleteProperty
} = require("../services/propertyService");
const { createEmailVerificationToken } = require("../services/authService");

const getPropertiesController =
    asyncHandler(
        async (req, res) => {
            const result =
                await getProperties({
                    filters: req.query,
                    authenticatedUser: req.user
                });

            return res.status(200).json({
                success: true,

                message:
                    "Properties retrieved successfully.",

                count:
                    result.properties.length,

                pagination:
                    result.pagination,

                data: {
                    properties:
                        result.properties
                }
            });
        }
    );
const createPropertyController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await createProperty({
                        propertyData: req.body,
                        authenticatedUser:
                            req.user
                    });

                if (
                    result.ownersUnavailable
                ) {
                    return next(
                        new AppError(
                            "One or more active property owners were not found or cannot be managed by this user.",
                            404
                        )
                    );
                }

                if (
                    result
                        .ownershipLimitExceeded
                ) {
                    return next(
                        new AppError(
                            `Total property ownership cannot exceed 100%. Supplied total: ${result.total_ownership}%.`,
                            422
                        )
                    );
                }

                if (
                    result
                        .multiplePrimaryContacts
                ) {
                    return next(
                        new AppError(
                            "A property cannot have more than one primary owner contact.",
                            422
                        )
                    );
                }

                return res.status(201).json({
                    success: true,

                    message:
                        "Property created successfully.",

                    data: result
                });
            } catch (error) {
                if (error.code === "23505") {
                    return next(
                        new AppError(
                            "The property or ownership relationship conflicts with an existing record.",
                            409
                        )
                    );
                }

                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The supplied property ownership violates a business rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "A referenced owner or user record was not found.",
                            404
                        )
                    );
                }

                return next(error);
            }
        }
    );
    const getSinglePropertyController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getSingleProperty({
                    propertyPublicId:
                        req.params
                            .property_public_id,

                    authenticatedUser:
                        req.user
                });

            if (!result) {
                return next(
                    new AppError(
                        "Property not found.",
                        404
                    )
                );
            }

            return res.status(200).json({
                success: true,

                message:
                    "Property retrieved successfully.",

                data: result
            });
        }
    );
    const updatePropertyController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await updateProperty({
                        propertyPublicId:
                            req.params
                                .property_public_id,

                        propertyData:
                            req.body,

                        authenticatedUser:
                            req.user
                    });

                if (!result) {
                    return next(
                        new AppError(
                            "Property not found.",
                            404
                        )
                    );
                }

                if (result.noChanges) {
                    return next(
                        new AppError(
                            "No valid property fields were supplied.",
                            400
                        )
                    );
                }

                return res.status(200).json({
                    success: true,

                    message:
                        "Property updated successfully.",

                    data: result
                });
            } catch (error) {
                if (error.code === "23505") {
                    return next(
                        new AppError(
                            "The updated property conflicts with an existing record.",
                            409
                        )
                    );
                }

                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The updated property violates a business rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );
    const softDeletePropertyController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await softDeleteProperty({
                        propertyPublicId:
                            req.params
                                .property_public_id,

                        authenticatedUser:
                            req.user
                    });

                if (!result) {
                    return next(
                        new AppError(
                            "Property not found.",
                            404
                        )
                    );
                }

                return res.status(200).json({
                    success: true,

                    message:
                        "Property deleted successfully.",

                    data: result
                });
            } catch (error) {
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "Deleting this property would violate a business rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );
module.exports = {
    getPropertiesController,
    createPropertyController,
    getSinglePropertyController,
    updatePropertyController,
    softDeletePropertyController
};
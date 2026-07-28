const asyncHandler =
    require("../utils/asyncHandler");
const AppError = 
    require("../utils/AppError");

const {
    getProperties,
    createProperty,
    getSingleProperty,
    updateProperty,
    softDeleteProperty,
    restoreProperty,
    getPropertyOwners,
    replacePropertyOwnership,
    activateProperty
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
    const restorePropertyController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await restoreProperty({
                        propertyPublicId:
                            req.params
                                .property_public_id,

                        authenticatedUser:
                            req.user
                    });

                if (!result) {
                    return next(
                        new AppError(
                            "Deleted property not found.",
                            404
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "Only administrators can restore deleted properties.",
                            403
                        )
                    );
                }

                return res.status(200).json({
                    success: true,

                    message:
                        "Property restored successfully.",

                    data: result
                });
            } catch (error) {
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "Restoring this property would violate a business rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );
    const getPropertyOwnersController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getPropertyOwners({
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
                    "Property owners retrieved successfully.",

                count:
                    result.ownerships.length,

                data: result
            });
        }
    );
    const replacePropertyOwnershipController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await replacePropertyOwnership({
                        propertyPublicId:
                            req.params
                                .property_public_id,

                        ownershipData:
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

                if (
                    result.ownershipLimitExceeded
                ) {
                    return next(
                        new AppError(
                            `Total property ownership cannot exceed 100%. Supplied total: ${result.total_ownership}%.`,
                            422
                        )
                    );
                }

                if (
                    result.multiplePrimaryContacts
                ) {
                    return next(
                        new AppError(
                            "A property cannot have more than one primary owner contact.",
                            422
                        )
                    );
                }

                if (
                    result
                        .activePropertyRequiresCompleteOwnership
                ) {
                    return next(
                        new AppError(
                            `An active property must retain exactly 100% ownership. Supplied total: ${result.supplied_total}%.`,
                            422
                        )
                    );
                }

                if (
                    result
                        .futureDatedCurrentOwnership
                ) {
                    return next(
                        new AppError(
                            "Property ownership cannot be replaced while a current ownership record has a future effective date.",
                            409
                        )
                    );
                }

                if (result.ownersUnavailable) {
                    return next(
                        new AppError(
                            "One or more active owners were not found or cannot be managed by this user.",
                            404
                        )
                    );
                }

                return res.status(200).json({
                    success: true,

                    message:
                        "Property ownership replaced successfully.",

                    data: result
                });
            } catch (error) {
                if (error.code === "23505") {
                    return next(
                        new AppError(
                            "The replacement ownership conflicts with an existing active ownership record.",
                            409
                        )
                    );
                }

                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The replacement ownership violates a property ownership business rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "A referenced property or owner record was not found.",
                            404
                        )
                    );
                }

                return next(error);
            }
        }
    );
    const activatePropertyController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await activateProperty({
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

                if (result.alreadyActive) {
                    return next(
                        new AppError(
                            "Property is already active.",
                            409
                        )
                    );
                }

                if (result.soldProperty) {
                    return next(
                        new AppError(
                            "A sold property cannot be activated.",
                            409
                        )
                    );
                }

                if (result.ownershipMissing) {
                    return next(
                        new AppError(
                            "Property cannot be activated without an active owner.",
                            422
                        )
                    );
                }

                if (
                    result.futureDatedOwnership
                ) {
                    return next(
                        new AppError(
                            "Property cannot be activated while an ownership record has a future effective date.",
                            409
                        )
                    );
                }

                if (result.ownersUnavailable) {
                    return next(
                        new AppError(
                            "Property cannot be activated because one or more owners are inactive or deleted.",
                            409
                        )
                    );
                }

                if (
                    result.incompleteOwnership
                ) {
                    return next(
                        new AppError(
                            `Property activation requires exactly 100% active ownership. Current total: ${result.total_active_ownership}%. Remaining: ${result.remaining_ownership}%.`,
                            422
                        )
                    );
                }

                if (
                    result.invalidPrimaryContact
                ) {
                    return next(
                        new AppError(
                            `Property activation requires exactly one primary owner contact. Current count: ${result.primary_contact_count}.`,
                            422
                        )
                    );
                }

                return res.status(200).json({
                    success: true,

                    message:
                        "Property activated successfully.",

                    data: result
                });
            } catch (error) {
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "Activating this property would violate an ownership integrity rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "A referenced property or owner record was not found.",
                            404
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
    softDeletePropertyController,
    restorePropertyController,
    getPropertyOwnersController,
    replacePropertyOwnershipController,
    activatePropertyController
};
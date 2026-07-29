const asyncHandler = require(
    "../utils/asyncHandler"
);

const AppError = require(
    "../utils/AppError"
);

const {
    getPropertyUnits,
    createUnit,
    getSingleUnit,
    updateUnit,
    activateUnit,
    markUnitMaintenance,
    softDeleteUnit,
    restoreUnit
} = require("../services/unitService");

const getPropertyUnitsController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getPropertyUnits({
                    propertyPublicId:
                        req.params
                            .property_public_id,

                    filters: {
                        search:
                            req.query.search,

                        unit_type:
                            req.query.unit_type,

                        operational_status:
                            req.query
                                .operational_status,

                        floor_number:
                            req.query.floor_number,

                        bedrooms:
                            req.query.bedrooms,

                        bathrooms:
                            req.query.bathrooms,

                        page:
                            req.query.page,

                        limit:
                            req.query.limit
                    },

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
                    "Property units retrieved successfully.",

                count:
                    result.units.length,

                data: result
            });
        }
    );
const createUnitController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await createUnit({
                        propertyPublicId:
                            req.params
                                .property_public_id,

                        unitData:
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

                if (result.soldProperty) {
                    return next(
                        new AppError(
                            "A sold property cannot receive new units.",
                            409
                        )
                    );
                }

                if (
                    result.singleUnitLimitReached
                ) {
                    return next(
                        new AppError(
                            "This single-unit property already contains a current unit.",
                            409
                        )
                    );
                }

                return res.status(201).json({
                    success: true,

                    message:
                        "Unit created successfully.",

                    data: result
                });
            } catch (error) {
                if (error.code === "23505") {
                    return next(
                        new AppError(
                            "A unit with this code already exists in the property.",
                            409
                        )
                    );
                }

                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The unit violates a property or unit integrity rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "A referenced property or user record was not found.",
                            404
                        )
                    );
                }

                return next(error);
            }
        }
    );
    const getSingleUnitController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getSingleUnit({
                    unitPublicId:
                        req.params.unit_public_id,

                    authenticatedUser:
                        req.user
                });

            if (!result) {
                return next(
                    new AppError(
                        "Unit not found.",
                        404
                    )
                );
            }

            return res.status(200).json({
                success: true,

                message:
                    "Unit retrieved successfully.",

                data: result
            });
        }
    );
    const updateUnitController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await updateUnit({
                        unitPublicId:
                            req.params
                                .unit_public_id,

                        unitData:
                            req.body,

                        authenticatedUser:
                            req.user
                    });

                if (!result) {
                    return next(
                        new AppError(
                            "Unit not found.",
                            404
                        )
                    );
                }

                if (result.soldProperty) {
                    return next(
                        new AppError(
                            "A unit belonging to a sold property cannot be updated.",
                            409
                        )
                    );
                }

                if (result.areaPairMismatch) {
                    return next(
                        new AppError(
                            "area_size and area_unit must either both have values or both be null.",
                            422
                        )
                    );
                }

                return res.status(200).json({
                    success: true,

                    message:
                        "Unit updated successfully.",

                    data: result
                });
            } catch (error) {
                if (error.code === "23505") {
                    return next(
                        new AppError(
                            "A unit with this code already exists in the property.",
                            409
                        )
                    );
                }

                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The unit update violates a property or unit integrity rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "A referenced property or user record was not found.",
                            404
                        )
                    );
                }

                return next(error);
            }
        }
    );
    const activateUnitController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await activateUnit({
                        unitPublicId:
                            req.params
                                .unit_public_id,

                        authenticatedUser:
                            req.user
                    });

                if (!result) {
                    return next(
                        new AppError(
                            "Unit not found.",
                            404
                        )
                    );
                }

                if (result.soldProperty) {
                    return next(
                        new AppError(
                            "A unit belonging to a sold property cannot be activated.",
                            409
                        )
                    );
                }

                if (result.inactiveProperty) {
                    return next(
                        new AppError(
                            "The parent property must be active before this unit can be activated.",
                            409
                        )
                    );
                }

                if (
                    result.invalidCurrentStatus
                ) {
                    return next(
                        new AppError(
                            `A unit with status '${result.current_status}' cannot be activated directly.`,
                            409
                        )
                    );
                }

                if (result.alreadyAvailable) {
                    return res.status(200).json({
                        success: true,

                        message:
                            "Unit is already available.",

                        data: result
                    });
                }

                return res.status(200).json({
                    success: true,

                    message:
                        "Unit activated successfully.",

                    data: result
                });
            } catch (error) {
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The unit cannot be activated because it violates a property or unit integrity rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "A referenced unit, property or user record was not found.",
                            404
                        )
                    );
                }

                return next(error);
            }
        }
    );
    const markUnitMaintenanceController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await markUnitMaintenance({
                        unitPublicId:
                            req.params
                                .unit_public_id,

                        authenticatedUser:
                            req.user
                    });

                if (!result) {
                    return next(
                        new AppError(
                            "Unit not found.",
                            404
                        )
                    );
                }

                if (result.soldProperty) {
                    return next(
                        new AppError(
                            "A unit belonging to a sold property cannot be placed under maintenance.",
                            409
                        )
                    );
                }

                if (
                    result.invalidCurrentStatus
                ) {
                    return next(
                        new AppError(
                            `A unit with status '${result.current_status}' cannot be placed under maintenance directly.`,
                            409
                        )
                    );
                }

                if (
                    result.alreadyMaintenance
                ) {
                    return res.status(200).json({
                        success: true,

                        message:
                            "Unit is already under maintenance.",

                        data: result
                    });
                }

                return res.status(200).json({
                    success: true,

                    message:
                        "Unit placed under maintenance successfully.",

                    data: result
                });
            } catch (error) {
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The maintenance status change violates a property or unit integrity rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "A referenced unit, property or user record was not found.",
                            404
                        )
                    );
                }

                return next(error);
            }
        }
    );
    const softDeleteUnitController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await softDeleteUnit({
                        unitPublicId:
                            req.params
                                .unit_public_id,

                        authenticatedUser:
                            req.user
                    });

                if (!result) {
                    return next(
                        new AppError(
                            "Unit not found.",
                            404
                        )
                    );
                }

                if (result.soldProperty) {
                    return next(
                        new AppError(
                            "A unit belonging to a sold property cannot be deleted.",
                            409
                        )
                    );
                }

                if (result.protectedStatus) {
                    return next(
                        new AppError(
                            `A unit with status '${result.current_status}' cannot be deleted directly.`,
                            409
                        )
                    );
                }

                return res.status(200).json({
                    success: true,

                    message:
                        "Unit deleted successfully.",

                    data: result
                });
            } catch (error) {
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The unit cannot be deleted because it violates a property or unit integrity rule.",
                            422
                        )
                    );
                }

                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "A referenced unit, property or user record was not found.",
                            404
                        )
                    );
                }

                return next(error);
            }
        }
    );
    const restoreUnitController = asyncHandler(
    async (req, res, next) => {
        try {
            const result = await restoreUnit({
                unitPublicId:
                    req.params.unit_public_id,

                authenticatedUser:
                    req.user
            });

            if (!result) {
                return next(
                    new AppError(
                        "Unit not found.",
                        404
                    )
                );
            }

            if (result.propertyDeleted) {
                return next(
                    new AppError(
                        "This unit cannot be restored because its parent property has been deleted.",
                        409
                    )
                );
            }

            if (result.propertySold) {
                return next(
                    new AppError(
                        "A unit cannot be restored under a sold property.",
                        409
                    )
                );
            }

            if (result.singleUnitConflict) {
                return next(
                    new AppError(
                        "This single-unit property already has a current unit. Remove the existing unit before restoring this one.",
                        409
                    )
                );
            }

            if (result.duplicateUnitCode) {
                return next(
                    new AppError(
                        "This unit cannot be restored because its unit code is already being used by another current unit in the property.",
                        409
                    )
                );
            }

            return res.status(200).json({
                success: true,

                message: result.alreadyRestored
                    ? "Unit is already restored."
                    : "Unit restored successfully.",

                data: {
                    already_restored:
                        result.alreadyRestored,

                    property:
                        result.property,

                    unit:
                        result.unit
                }
            });
        } catch (error) {
            if (error.code === "23505") {
                return next(
                    new AppError(
                        "The unit could not be restored because its identifying information conflicts with another current unit.",
                        409
                    )
                );
            }

            if (error.code === "23514") {
                return next(
                    new AppError(
                        "Restoring this unit would violate a unit business rule.",
                        422
                    )
                );
            }

            return next(error);
        }
    }
);
module.exports = {
    getPropertyUnitsController,
    createUnitController,
    getSingleUnitController,
    updateUnitController,
    activateUnitController,
    markUnitMaintenanceController,
    softDeleteUnitController,
    restoreUnitController
};
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
    updateUnit
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
module.exports = {
    getPropertyUnitsController,
    createUnitController,
    getSingleUnitController,
    updateUnitController
};
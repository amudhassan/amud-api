const asyncHandler = require(
    "../utils/asyncHandler"
);

const AppError = require(
    "../utils/AppError"
);

const {
    getPropertyUnits
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

module.exports = {
    getPropertyUnitsController
};
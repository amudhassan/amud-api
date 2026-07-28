const asyncHandler =
    require("../utils/asyncHandler");

const {
    getProperties
} = require("../services/propertyService");

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

module.exports = {
    getPropertiesController
};
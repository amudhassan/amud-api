const errorHandler = (err, req, res, next) => {

    console.error(err);

    const statusCode = err.statusCode || 500;

    return res.status(statusCode).json({
        success: false,
        statusCode,
        message: err.message || "Internal server error",
        errors: err.errors || null
    });

};

module.exports = errorHandler;
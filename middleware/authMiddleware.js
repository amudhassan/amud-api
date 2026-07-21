const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: "Access denied. No token provided."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        console.log("TOKEN RECEIVED:", token);

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );
        console.log("DECODED IN MIDDLEWARE:", decoded);

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(403).json({
            success: false,
            message: "Invalid or expired token."
        });

    }

};

const authorizeRoles = (...roles) => {

    return (req, res, next) => {
        

        if (!roles.includes(req.user.role)) {

            return res.status(403).json({
                success: false,
                message: "Access denied"
            });

        }

        next();

    };

};

module.exports ={
    authMiddleware,
    authorizeRoles

};
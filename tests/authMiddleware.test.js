require("dotenv").config();

const jwt = require("jsonwebtoken");
const {
    authMiddleware,
    authorizeRoles
} = require("../middleware/authMiddleware");

describe("Auth Middleware", () => {

    test("Should return 401 if no token is provided", () => {

        const req = {
            headers: {}
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        const next = jest.fn();

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);

        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Access denied. No token provided."
        });

        expect(next).not.toHaveBeenCalled();

    });

    test("Should call next() when token is valid", () => {

    const user = {
        public_id: "123456",
        email: "test@example.com",
        role: "admin"
    };

    const token = jwt.sign(
        user,
        process.env.JWT_SECRET
    );

    const req = {
        headers: {
            authorization: `Bearer ${token}`
        }
    };

    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
    };

    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(req.user.public_id).toBe(user.public_id);
    expect(req.user.email).toBe(user.email);
    expect(req.user.role).toBe(user.role);

    expect(next).toHaveBeenCalled();

    expect(res.status).not.toHaveBeenCalled();

});

test("Should return 403 if token is invalid", () => {

    const req = {
        headers: {
            authorization: "Bearer invalidtoken"
        }
    };

    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
    };

    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);

    expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid or expired token."
    });

    expect(next).not.toHaveBeenCalled();

});

test("Should allow user with correct role", () => {

    const req = {
        user: {
            role: "admin"
        }
    };

    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
    };

    const next = jest.fn();

    const middleware = authorizeRoles("admin");

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();

    expect(res.status).not.toHaveBeenCalled();

});

test("Should deny user with incorrect role", () => {

    const req = {
        user: {
            role: "user"
        }
    };

    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
    };

    const next = jest.fn();

    const middleware = authorizeRoles("admin");

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);

    expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Access denied"
    });

    expect(next).not.toHaveBeenCalled();

});

});
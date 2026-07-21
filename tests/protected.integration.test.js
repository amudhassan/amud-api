const request = require("supertest");
const app = require("../app");

describe("Protected Routes", () => {

    test("Should access profile with valid token", async () => {

        const email = `protected${Date.now()}@test.com`;

        // Register
        await request(app)
            .post("/api/auth/register")
            .send({
                full_name: "Protected User",
                email,
                password: "Password123!",
                role: "user"
            });

        // Login
        const login = await request(app)
            .post("/api/auth/login")
            .send({
                email,
                password: "Password123!"
            });

        const token = login.body.accessToken;

        // Access protected route
        const res = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

    });

    test("Should reject invalid token", async () => {

        const res = await request(app)
            .get("/api/auth/profile")
            .set("Authorization", "Bearer invalidtoken");

        expect(res.statusCode).toBe(403);

    });

});
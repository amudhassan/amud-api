const request = require("supertest");
const app = require("../app");

describe("Login API", () => {

    test("Should login an existing user", async () => {

        const email = `login${Date.now()}@test.com`;

        // Register user kwanza
        await request(app)
            .post("/api/auth/register")
            .send({
                full_name: "Login Test User",
                email,
                password: "Password123!",
                role: "user"
            });

        // Login
        const res = await request(app)
            .post("/api/auth/login")
            .send({
                email,
                password: "Password123!"
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body).toHaveProperty("accessToken");
        expect(res.body).toHaveProperty("refreshToken");

    });

});
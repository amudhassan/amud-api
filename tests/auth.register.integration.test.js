const request = require("supertest");
const app = require("../app");

describe("Register API", () => {

    test("Should register a new user", async () => {

        const res = await request(app)
            .post("/api/auth/register")
            .send({
                full_name: "Integration Test User",
                email: `user${Date.now()}@test.com`,
                password: "Password123!",
                role: "user"
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.user).toHaveProperty("public_id");
        expect(res.body.user.email).toContain("@test.com");

    });

});
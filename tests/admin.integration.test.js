const request = require("supertest");
const app = require("../app");

describe("Admin Authorization", () => {

    test("Should deny access to normal user", async () => {

        const email = `user${Date.now()}@test.com`;

        await request(app)
            .post("/api/auth/register")
            .send({
                full_name: "Normal User",
                email,
                password: "Password123!",
                role: "user"
            });

        const login = await request(app)
            .post("/api/auth/login")
            .send({
                email,
                password: "Password123!"
            });

        const token = login.body.accessToken;

        const res = await request(app)
            .get("/api/users")
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(403);

    });

});
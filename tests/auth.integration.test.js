const request = require("supertest");
const app = require("../app");

describe("Authentication Integration Tests", () => {

    test("GET /test should return server working", async () => {

        const res = await request(app)
            .get("/test");

        expect(res.statusCode).toBe(200);

        expect(res.body.success).toBe(true);

        expect(res.body.message).toBe("Server is working");

    });

});
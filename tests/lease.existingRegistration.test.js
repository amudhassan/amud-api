jest.mock("../config/db", () => ({ connect: jest.fn() }));
const pool = require("../config/db");
const { scheduleLease } = require("../services/leaseService");
const {
    evaluateLeaseRegistration,
} = require("../services/leaseRegistrationPolicy");

const reason =
    "Tenant moved in before the agreement was entered into the system.";
const basePolicy = {
    startDate: "2026-10-03",
    endDate: "2027-01-03",
    currentDate: "2026-10-14",
    role: "admin",
    registrationRequested: true,
    reason,
};

describe("existing tenancy registration policy", () => {
    test.each(["user", "owner", undefined])(
        "requires admin, even with an explanation (%s)",
        (role) => {
            expect(evaluateLeaseRegistration({ ...basePolicy, role })).toEqual({
                existingTenancyForbidden: true,
            });
        },
    );
    test.each(["", "short", " ".repeat(15), "x".repeat(1001)])(
        "requires a meaningful bounded reason",
        (invalid) => {
            expect(
                evaluateLeaseRegistration({ ...basePolicy, reason: invalid }),
            ).toEqual({ existingTenancyReasonRequired: true });
        },
    );
    test.each([
        { startDate: "2026-10-14" },
        { startDate: "2026-10-15" },
        { endDate: "2026-10-13" },
    ])("rejects non-existing or ended tenancy dates %j", (overrides) => {
        expect(
            evaluateLeaseRegistration({ ...basePolicy, ...overrides }),
        ).toEqual({ existingTenancyDateInvalid: true });
    });
    test("ordinary scheduling still rejects past dates", () => {
        expect(
            evaluateLeaseRegistration({
                ...basePolicy,
                registrationRequested: undefined,
                reason: undefined,
            }),
        ).toEqual({ pastStartDate: true });
    });
    test("ordinary future scheduling remains available", () => {
        expect(
            evaluateLeaseRegistration({
                ...basePolicy,
                startDate: "2026-10-20",
                registrationRequested: undefined,
                reason: undefined,
            }),
        ).toEqual({ registrationNote: null });
    });
    test("does not treat string true as authorization", () => {
        expect(
            evaluateLeaseRegistration({
                ...basePolicy,
                registrationRequested: "true",
            }),
        ).toEqual({ existingTenancyInvalidRequest: true });
    });
    test("handles pg DATE objects using calendar dates, not UTC conversion", () => {
        const result = evaluateLeaseRegistration({
            ...basePolicy,
            startDate: new Date(2026, 9, 3),
            endDate: new Date(2027, 0, 3),
            currentDate: new Date(2026, 9, 14),
        });
        expect(result.registrationNote).toContain(
            "original start date 2026-10-03",
        );
        expect(result.registrationNote).toContain("on 2026-10-14");
    });
});

function mockClient({
    unitStatus = "available",
    constraintError,
    status = "draft",
    endDate = "2027-01-03",
} = {}) {
    const lease = {
        id: 1,
        public_id: "lease_test",
        lease_number: "TEST",
        owner_id: 2,
        property_id: 3,
        unit_id: 4,
        tenant_id: 5,
        status,
        start_date: new Date(2026, 9, 3),
        end_date: new Date(`${endDate}T00:00:00`),
        signed_at: new Date("2026-10-02T08:00:00Z"),
    };
    const client = {
        release: jest.fn(),
        query: jest.fn(async (sql, values) => {
            const text = sql.replace(/\s+/g, " ").trim();
            if (["BEGIN", "COMMIT", "ROLLBACK"].includes(text))
                return { rows: [] };
            if (text === "SET CONSTRAINTS ALL IMMEDIATE") {
                if (constraintError) throw constraintError;
                return { rows: [] };
            }
            if (text.includes("FROM leases")) return { rows: [lease] };
            if (text.includes("FROM owners"))
                return {
                    rows: [
                        { id: 2, public_id: "owner_test", status: "active" },
                    ],
                };
            if (text.includes("FROM owner_users"))
                return { rows: [{ id: 99 }] };
            if (text.includes("FROM property_owners"))
                return { rows: [{ id: 99 }] };
            if (text.includes("FROM properties"))
                return {
                    rows: [
                        {
                            id: 3,
                            public_id: "property_test",
                            operational_status: "active",
                        },
                    ],
                };
            if (text.includes("FROM units"))
                return {
                    rows: [
                        {
                            id: 4,
                            property_id: 3,
                            public_id: "unit_test",
                            operational_status: unitStatus,
                        },
                    ],
                };
            if (text.includes("FROM tenants"))
                return {
                    rows: [
                        { id: 5, public_id: "tenant_test", status: "active" },
                    ],
                };
            if (text.includes("FROM owner_tenants"))
                return { rows: [{ id: 99 }] };
            if (text.includes("CURRENT_DATE"))
                return {
                    rows: [
                        {
                            current_date: new Date(2026, 9, 14),
                            current_time: new Date("2026-10-14T08:00:00Z"),
                        },
                    ],
                };
            if (text.startsWith("UPDATE leases"))
                return { rows: [{ ...lease, status: "scheduled" }] };
            if (text.startsWith("UPDATE units"))
                return { rows: [{ operational_status: "reserved" }] };
            throw Error(`Unexpected query: ${text}`);
        }),
    };
    pool.connect.mockResolvedValue(client);
    return client;
}
const register = (overrides) =>
    scheduleLease({
        leasePublicId: "lease_test",
        authenticatedUser: { id: 10, role: "admin" },
        scheduleData: {
            register_existing_tenancy: true,
            registration_reason: reason,
        },
        ...overrides,
    });
const writes = (client) =>
    client.query.mock.calls.filter(([sql]) =>
        /^\s*(UPDATE|INSERT|DELETE)\b/.test(sql),
    );

describe("scheduling existing tenancy transaction", () => {
    test("keeps original dates, parameterizes audit reason, checks deferred constraints and commits", async () => {
        const client = mockClient();
        const result = await register();
        expect(result.lease.status).toBe("scheduled");
        const [sql, values] = writes(client)[0];
        expect(sql).not.toMatch(/start_date\s*=/);
        expect(sql).toContain("scheduled_at =");
        expect(values[1]).toBe(10);
        expect(values[3]).toContain(reason);
        expect(sql).not.toContain(reason);
        expect(client.query.mock.calls.map(([q]) => q.trim())).toContain(
            "SET CONSTRAINTS ALL IMMEDIATE",
        );
        expect(client.query).toHaveBeenCalledWith("COMMIT");
        expect(client.release).toHaveBeenCalled();
        expect(
            client.query.mock.calls.some(([q]) =>
                /rent_invoices|rent_payments/.test(q),
            ),
        ).toBe(false);
    });
    test("rejects non-admin before any writes", async () => {
        const client = mockClient();
        expect(
            await register({ authenticatedUser: { id: 10, role: "user" } }),
        ).toEqual({ existingTenancyForbidden: true });
        expect(writes(client)).toHaveLength(0);
        expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    });
    test("ordinary requests still reject past start dates before any writes", async () => {
        const client = mockClient();
        expect(await register({ scheduleData: {} })).toEqual({
            pastStartDate: true,
        });
        expect(writes(client)).toHaveLength(0);
    });
    test("retains maintenance eligibility guard", async () => {
        const client = mockClient({ unitStatus: "maintenance" });
        expect(await register()).toEqual({ unitNotEligible: true });
        expect(writes(client)).toHaveLength(0);
    });
    test("a repeated registration of a scheduled lease does not write again", async () => {
        const client = mockClient({ status: "scheduled" });
        expect(await register()).toEqual({ notDraft: true });
        expect(writes(client)).toHaveLength(0);
    });
    test("constraint failure rolls back instead of committing partial lease/unit changes", async () => {
        const error = Object.assign(new Error("conflicting lease"), {
            code: "23P01",
        });
        const client = mockClient({ constraintError: error });
        await expect(register()).rejects.toBe(error);
        expect(client.query).toHaveBeenCalledWith("ROLLBACK");
        expect(client.query).not.toHaveBeenCalledWith("COMMIT");
        expect(client.release).toHaveBeenCalled();
    });
});

const { scheduleLeaseValidator } = require("../validators/leaseValidator");
const { validationResult } = require("express-validator");
const validate = async (body) => {
    const req = { params: { lease_public_id: "lease_test" }, query: {}, body };
    for (const chain of scheduleLeaseValidator) await chain.run(req);
    return validationResult(req);
};
describe("existing tenancy request validation", () => {
    test("accepts explicit boolean and reason", async () => {
        expect(
            (
                await validate({
                    register_existing_tenancy: true,
                    registration_reason: reason,
                })
            ).isEmpty(),
        ).toBe(true);
    });
    test.each([
        { register_existing_tenancy: "true", registration_reason: reason },
        { register_existing_tenancy: true },
        { registration_reason: reason },
        { register_existing_tenancy: true, registration_reason: "short" },
        { unexpected: true },
    ])("rejects malformed request %j", async (body) => {
        expect((await validate(body)).isEmpty()).toBe(false);
    });
    test("preserves ordinary empty scheduling request", async () => {
        expect((await validate({})).isEmpty()).toBe(true);
    });
});

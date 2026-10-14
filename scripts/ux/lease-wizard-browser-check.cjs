// Run against a local Vite server; all API calls are intercepted with fixtures.
// Requires Playwright and Chromium. No production requests or credentials.
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const requireRuntime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? createRequire(
          `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/package.json`,
      )
    : require;
const { chromium } = requireRuntime("playwright");
const owner = {
    public_id: "OWN-TEST",
    display_name: "Test Owner",
    owner_type: "individual",
    status: "active",
};
const tenant = {
    public_id: "TEN-TEST",
    display_name: "Test Tenant",
    tenant_type: "individual",
    status: "active",
    owner_relationship: { relationship_status: "active" },
};
const property = {
    public_id: "PRP-TEST",
    property_name: "Test Property",
    property_code: "TEST",
    operational_status: "active",
};
const unit = {
    public_id: "UNT-TEST",
    unit_name: "Room 5",
    unit_code: "5",
    operational_status: "available",
};
(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        for (const viewport of [
            { width: 1440, height: 1000 },
            { width: 390, height: 844 },
        ]) {
            const page = await browser.newPage({ viewport });
            const errors = [];
            let posts = 0;
            let posted;
            page.on("pageerror", (error) => errors.push(error.message));
            await page.addInitScript(() =>
                localStorage.setItem("access_token", "local-fixture-token"),
            );
            await page.route("**/api/**", async (route) => {
                const req = route.request();
                const url = new URL(req.url());
                const path = url.pathname.replace("/api", "");
                let body = { data: {} };
                if (req.method() === "OPTIONS")
                    return route.fulfill({
                        status: 204,
                        headers: {
                            "access-control-allow-origin": "*",
                            "access-control-allow-headers": "*",
                            "access-control-allow-methods": "*",
                        },
                    });
                if (path === "/auth/profile")
                    body = {
                        user: {
                            public_id: "USR-TEST",
                            display_name: "Test Accountant",
                            role: "admin",
                        },
                    };
                else if (path === "/owners") body = { data: [owner] };
                else if (path === "/properties")
                    body = { data: { properties: [property] } };
                else if (path === "/properties/PRP-TEST/units")
                    body = { data: { units: [unit] } };
                else if (path === "/tenants" && req.method() === "POST")
                    body = {
                        data: {
                            tenant: {
                                ...tenant,
                                public_id: "TEN-NEW",
                                display_name: "New Tenant",
                            },
                        },
                    };
                else if (path === "/tenants")
                    body = { data: { tenants: [tenant] } };
                else if (path === "/leases" && req.method() === "POST") {
                    posts++;
                    posted = req.postDataJSON();
                    body = {
                        data: {
                            lease: {
                                ...posted,
                                public_id: "LSE-TEST",
                                lease_number: "TEST-LEASE",
                                status: "draft",
                            },
                            owner,
                        },
                    };
                } else if (path === "/leases")
                    body = {
                        data: {
                            leases: [],
                            pagination: {
                                page: 1,
                                total_pages: 1,
                                total_records: 0,
                            },
                        },
                    };
                else if (path.endsWith("/clauses"))
                    body = { data: { clauses: [] } };
                else if (path.includes("template"))
                    body = { data: { templates: [] } };
                await route.fulfill({
                    json: body,
                    headers: { "access-control-allow-origin": "*" },
                });
            });
            await page.goto(
                process.env.UX_TEST_URL || "http://127.0.0.1:5173/leases",
            );
            await page
                .getByRole("button", { name: "Add Lease", exact: true })
                .click();
            await page
                .getByRole("button", { name: "Continue", exact: true })
                .click();
            await page
                .getByRole("alert")
                .filter({ hasText: "Select an owner and tenant" })
                .waitFor();
            await page.locator("#lease_owner").selectOption(owner.public_id);
            await page.locator("#lease_tenant").selectOption(tenant.public_id);
            await page.getByRole("button", { name: "Add new tenant" }).click();
            assert.equal(
                await page.getByRole("dialog", { includeHidden: true }).count(),
                2,
            ); // underlying dialog remains mounted but hidden
            assert.equal(
                await page
                    .getByRole("dialog")
                    .filter({ visible: true })
                    .count(),
                1,
            );
            await page
                .getByRole("button", {
                    name: "Close add tenant dialog",
                    exact: true,
                })
                .click();
            await page
                .getByRole("button", { name: "Continue", exact: true })
                .click();
            await page
                .getByRole("button", { name: "Continue", exact: true })
                .click();
            await page
                .getByRole("alert")
                .filter({ hasText: "Select a property and room" })
                .waitFor();
            await page
                .locator("#lease_property")
                .selectOption(property.public_id);
            await page.locator("#lease_unit").selectOption(unit.public_id);
            await page
                .getByRole("button", { name: "Continue", exact: true })
                .click();
            await page.locator("#lease_start_date").fill("2026-10-20");
            await page.locator("#lease_end_date").fill("2026-10-19");
            await page.locator("#lease_rent_amount").fill("200000");
            await page
                .getByRole("button", { name: "Review lease", exact: true })
                .click();
            await page
                .getByRole("alert")
                .filter({ hasText: "end date must be after" })
                .waitFor();
            await page.locator("#lease_end_date").fill("2027-01-20");
            await page
                .getByRole("button", { name: "Review lease", exact: true })
                .click();
            assert.equal(posts, 0, "review must not create a lease");
            const save = page.getByRole("button", {
                name: "Save and review contract terms",
            });
            assert.equal(await save.isDisabled(), true);
            await page
                .getByRole("button", { name: "Back", exact: true })
                .click();
            assert.equal(
                await page.locator("#lease_rent_amount").inputValue(),
                "200000",
            );
            await page
                .getByRole("button", { name: "Review lease", exact: true })
                .click();
            await page
                .getByRole("checkbox", { name: "I have checked" })
                .check();
            await page.screenshot({
                path: `/tmp/lease-review-${viewport.width}.png`,
                fullPage: true,
            });
            assert.equal(
                await page.evaluate(
                    () => document.documentElement.scrollWidth > innerWidth,
                ),
                false,
                "page should not overflow",
            );
            await save.click();
            await page
                .getByRole("heading", {
                    name: "Terms & Conditions",
                    exact: true,
                })
                .waitFor();
            assert.equal(posts, 1);
            assert.equal(posted.rent_amount, 200000);
            assert.equal(posted.tenant_public_id, "TEN-TEST");
            assert.deepEqual(errors, []);
            console.log(
                `PASS ${viewport.width}px: selection validation, isolated tenant modal, date validation, review gate, Back retention, single create, contract handoff, no page errors`,
            );
            await page.close();
        }
    } finally {
        await browser.close();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

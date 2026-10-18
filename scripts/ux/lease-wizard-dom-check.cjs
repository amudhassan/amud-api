// npm install --prefix /tmp/lease-wizard-check jsdom esbuild @testing-library/react @testing-library/user-event
// UX_TEST_DEPS=/tmp/lease-wizard-check node scripts/ux/lease-wizard-dom-check.cjs
// Tests actual React components with a mock API. No production requests.
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { createRequire } = require("node:module");
const deps = process.env.UX_TEST_DEPS;
if (!deps)
    throw Error(
        "Set UX_TEST_DEPS to an isolated directory containing the test dependencies.",
    );
const depRequire = createRequire(path.resolve(deps, "package.json"));
const { JSDOM } = depRequire("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
});
Object.assign(global, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    MutationObserver: dom.window.MutationObserver,
});
Object.defineProperty(global, "navigator", {
    value: dom.window.navigator,
    configurable: true,
});
dom.window.HTMLElement.prototype.scrollTo = function () {};
const React = depRequire("react");
const { render, screen, waitFor, cleanup } = depRequire(
    "@testing-library/react",
);
const user = depRequire("@testing-library/user-event").default.setup();
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
    const work = fs.mkdtempSync(path.join(path.resolve(deps), "lease-ui-"));
    try {
        fs.writeFileSync(
            path.join(work, "api.js"),
            "export default globalThis.__leaseTestApi;",
        );
        await depRequire("esbuild").build({
            entryPoints: [
                path.resolve("frontend/src/pages/leases/CreateLeaseModal.jsx"),
            ],
            bundle: true,
            platform: "node",
            format: "cjs",
            jsx: "automatic",
            outfile: path.join(work, "modal.cjs"),
            external: ["react", "react/*"],
            plugins: [
                {
                    name: "mock-api",
                    setup(build) {
                        build.onResolve({ filter: /apiClient$/ }, () => ({
                            path: path.join(work, "api.js"),
                        }));
                    },
                },
            ],
        });
        let posts = [];
        let created = [];
        global.__leaseTestApi = {
            get: async (url) => {
                if (url === "/owners") return { data: { data: [owner] } };
                if (url === "/properties")
                    return { data: { data: { properties: [property] } } };
                if (url.includes("/units"))
                    return { data: { data: { units: [unit] } } };
                if (url === "/tenants")
                    return { data: { data: { tenants: [tenant] } } };
                throw Error(`Unexpected GET ${url}`);
            },
            post: async (url, payload) => {
                posts.push({ url, payload });
                if (url === "/tenants")
                    return {
                        data: {
                            data: {
                                tenant: {
                                    ...tenant,
                                    public_id: "TEN-NEW",
                                    display_name: payload.display_name,
                                },
                            },
                        },
                    };
                if (url === "/leases")
                    return {
                        data: {
                            data: {
                                lease: {
                                    ...payload,
                                    public_id: "LSE-TEST",
                                    status: "draft",
                                },
                            },
                        },
                    };
                throw Error(`Unexpected POST ${url}`);
            },
        };
        const Modal = require(path.join(work, "modal.cjs")).default;
        const view = render(
            React.createElement(Modal, {
                open: true,
                onClose: () => {},
                onCreated: (data) => created.push(data),
            }),
        );
        await waitFor(() =>
            assert.equal(
                screen.getByRole("button", { name: "Continue" }).disabled,
                false,
            ),
        );
        await user.click(screen.getByRole("button", { name: "Continue" }));
        assert.match(
            screen.getByRole("alert").textContent,
            /Select an owner and tenant/,
        );
        await user.selectOptions(
            document.querySelector("#lease_owner"),
            owner.public_id,
        );
        await waitFor(() =>
            assert.equal(
                document.querySelector("#lease_tenant").disabled,
                false,
            ),
        );
        await user.click(
            screen.getByRole("button", { name: "Add new tenant" }),
        );
        assert.equal(
            screen.getAllByRole("dialog").length,
            1,
            "only tenant modal should be accessible",
        );
        await user.type(screen.getByLabelText(/Display Name/), "New Tenant");
        await user.click(
            screen.getByRole("button", { name: "Add Tenant", exact: true }),
        );
        await waitFor(() =>
            assert.equal(
                document.querySelector("#lease_tenant").value,
                "TEN-NEW",
            ),
        );
        await user.click(screen.getByRole("button", { name: "Continue" }));
        await user.click(screen.getByRole("button", { name: "Continue" }));
        assert.match(
            screen.getByRole("alert").textContent,
            /Select a property and room/,
        );
        await user.selectOptions(
            document.querySelector("#lease_property"),
            property.public_id,
        );
        await waitFor(() =>
            assert.equal(document.querySelector("#lease_unit").disabled, false),
        );
        await user.selectOptions(
            document.querySelector("#lease_unit"),
            unit.public_id,
        );
        await user.click(screen.getByRole("button", { name: "Continue" }));
        await user.type(
            document.querySelector("#lease_start_date"),
            "2026-10-20",
        );
        await user.type(
            document.querySelector("#lease_end_date"),
            "2026-10-19",
        );
        await user.type(document.querySelector("#lease_rent_amount"), "200000");
        await user.click(screen.getByRole("button", { name: "Review lease" }));
        assert.match(
            screen.getByRole("alert").textContent,
            /end date must be after/,
        );
        await user.clear(document.querySelector("#lease_end_date"));
        await user.type(
            document.querySelector("#lease_end_date"),
            "2027-01-20",
        );
        await user.click(screen.getByRole("button", { name: "Review lease" }));
        assert.equal(posts.filter((x) => x.url === "/leases").length, 0);
        assert.equal(
            screen.getByRole("button", {
                name: "Save and review contract terms",
            }).disabled,
            true,
        );
        assert.match(
            screen.getByRole("region", { name: "Lease summary" }).textContent,
            /New Tenant/,
        );
        await user.click(screen.getByRole("button", { name: "Back" }));
        assert.equal(
            document.querySelector("#lease_rent_amount").value,
            "200000",
        );
        await user.click(screen.getByRole("button", { name: "Review lease" }));
        await user.click(
            screen.getByRole("checkbox", { name: /I have checked/ }),
        );
        await user.click(
            screen.getByRole("button", {
                name: "Save and review contract terms",
            }),
        );
        await waitFor(() => assert.equal(created.length, 1));
        const leasePost = posts.find((x) => x.url === "/leases");
        assert.equal(leasePost.payload.tenant_public_id, "TEN-NEW");
        assert.equal(leasePost.payload.rent_amount, 200000);
        assert.equal(leasePost.payload.start_date, "2026-10-20");
        view.rerender(
            React.createElement(Modal, {
                open: false,
                onClose: () => {},
                onCreated: () => {},
            }),
        );
        view.rerender(
            React.createElement(Modal, {
                open: true,
                onClose: () => {},
                onCreated: () => {},
            }),
        );
        await waitFor(() => assert.ok(screen.getByText(/Step 1 of 4/)));
        assert.equal(document.querySelector("#lease_owner").value, "");
        cleanup();
        const buildComponent = async (file, name) => {
            await depRequire("esbuild").build({
                entryPoints: [path.resolve(file)],
                bundle: true,
                platform: "node",
                format: "cjs",
                jsx: "automatic",
                outfile: path.join(work, `${name}.cjs`),
                external: ["react", "react/*"],
                plugins: [
                    {
                        name: "mock-api",
                        setup(build) {
                            build.onResolve({ filter: /apiClient$/ }, () => ({
                                path: path.join(work, "api.js"),
                            }));
                        },
                    },
                ],
            });
            return require(path.join(work, `${name}.cjs`)).default;
        };
        const invoice = {
            public_id: "INV-TEST",
            invoice_number: "TEST-INVOICE",
            status: "issued",
            currency_code: "TZS",
            due_date: "2026-10-20",
            financial_summary: {
                balance_amount: "200000",
                total_amount: "200000",
                paid_amount: "0",
            },
            owner,
            tenant,
            lease: { public_id: "LSE-TEST", lease_number: "TEST-LEASE" },
            items: [],
        };
        const gets = [];
        const setApi = () => {
            global.__leaseTestApi = {
                get: async (url) => {
                    gets.push(url);
                    if (url === "/invoices/INV-TEST")
                        return { data: { data: { invoice } } };
                    if (url === "/leases/LSE-TEST")
                        return {
                            data: {
                                data: {
                                    lease: {
                                        public_id: "LSE-TEST",
                                        lease_number: "TEST-LEASE",
                                        status: "active",
                                        financial_terms: {
                                            currency_code: "TZS",
                                        },
                                    },
                                },
                            },
                        };
                    if (url === "/receipts/RCPT-TEST")
                        return {
                            data: {
                                data: {
                                    receipt: {
                                        receipt_number: "RCPT-TEST",
                                        status: "completed",
                                        currency_code: "TZS",
                                        amount: "200000",
                                    },
                                },
                            },
                        };
                    throw Error(`Unexpected GET ${url}`);
                },
                post: async (url, payload) => {
                    posts.push({ url, payload });
                    assert.equal(url, "/invoices/INV-TEST/payments");
                    invoice.status = "paid";
                    invoice.financial_summary.balance_amount = "0";
                    return {
                        data: {
                            success: true,
                            data: { payment: { receipt_number: "RCPT-TEST" } },
                        },
                    };
                },
            };
        };
        setApi();
        const InvoiceCreate = await buildComponent(
            "frontend/src/pages/invoices/CreateInvoiceModal.jsx",
            "invoice-create",
        );
        render(
            React.createElement(InvoiceCreate, {
                open: true,
                initialLeasePublicId: "LSE-TEST",
                onClose: () => {},
                onCreated: () => {},
            }),
        );
        await waitFor(() =>
            assert.ok(
                document.querySelector('select option[value="LSE-TEST"]'),
            ),
        );
        assert.equal(
            document.querySelector("#invoice_currency_code").value,
            "TZS",
        );
        assert.ok(
            gets.every((url) => url === "/leases/LSE-TEST"),
            "target billing must not silently select another lease",
        );
        cleanup();
        gets.length = 0;
        const InvoiceDetail = await buildComponent(
            "frontend/src/pages/invoices/InvoiceDetailModal.jsx",
            "invoice-detail",
        );
        render(
            React.createElement(InvoiceDetail, {
                open: true,
                invoicePublicId: "INV-TEST",
                onClose: () => {},
            }),
        );
        await user.click(
            await screen.findByRole("button", {
                name: "Record payment",
                exact: true,
            }),
        );
        await waitFor(() =>
            assert.equal(
                screen.getByRole("button", {
                    name: "Record Payment",
                    exact: true,
                }).disabled,
                false,
            ),
        );
        assert.equal(
            screen.getAllByRole("dialog").length,
            1,
            "invoice dialog must be hidden during payment",
        );
        assert.ok(gets.every((url) => url === "/invoices/INV-TEST"));
        await user.click(
            screen.getByRole("button", { name: "Record Payment", exact: true }),
        );
        await waitFor(() => assert.ok(gets.includes("/receipts/RCPT-TEST")));
        assert.equal(
            posts.filter((x) => x.url === "/invoices/INV-TEST/payments").length,
            1,
        );
        cleanup();
        gets.length = 0;
        setApi();
        const Payment = await buildComponent(
            "frontend/src/pages/payments/RecordPaymentModal.jsx",
            "payment",
        );
        render(
            React.createElement(Payment, {
                open: true,
                initialInvoicePublicId: "INV-TEST",
                onClose: () => {},
                onRecorded: () => {},
            }),
        );
        await waitFor(() =>
            assert.ok(screen.getByText(/This invoice is not payable/)),
        );
        assert.equal(
            screen.getByRole("button", { name: "Record Payment", exact: true })
                .disabled,
            true,
        );
        assert.deepEqual(
            gets,
            ["/invoices/INV-TEST"],
            "a paid target must not fall back to another payable invoice",
        );
        cleanup();
        let schedulePayload;
        global.__leaseTestApi = {
            get: async () => ({
                data: {
                    data: {
                        lease: {
                            public_id: "lease_test",
                            lease_number: "TEST",
                            status: "draft",
                            start_date: "2026-10-03",
                            end_date: "2027-01-03",
                            owner,
                            tenant,
                            property,
                            unit,
                            lifecycle: { signed_at: "2026-10-02T08:00:00Z" },
                        },
                    },
                },
            }),
            patch: async (url, payload) => {
                schedulePayload = payload;
                return {
                    data: {
                        data: {
                            lease: {
                                public_id: "lease_test",
                                status: "scheduled",
                            },
                        },
                    },
                };
            },
        };
        const Schedule = await buildComponent(
            "frontend/src/pages/leases/ScheduleLeaseModal.jsx",
            "schedule",
        );
        let scheduled = false;
        render(
            React.createElement(Schedule, {
                open: true,
                lease: { public_id: "lease_test", lease_number: "TEST" },
                allowExistingRegistration: true,
                onClose: () => {},
                onScheduled: () => {
                    scheduled = true;
                },
            }),
        );
        await screen.findByLabelText(/The tenant already moved in/);
        await user.click(screen.getByLabelText(/The tenant already moved in/));
        await user.type(
            screen.getByLabelText("Reason for recording this tenancy now"),
            "Tenant moved in before data entry.",
        );
        await user.click(
            screen.getByRole("button", {
                name: "Confirm Signed Agreement",
                exact: true,
            }),
        );
        await waitFor(() => assert.equal(scheduled, true));
        assert.equal(schedulePayload.register_existing_tenancy, true);
        assert.equal(
            schedulePayload.registration_reason,
            "Tenant moved in before data entry.",
        );
        cleanup();
        render(
            React.createElement(Schedule, {
                open: true,
                lease: { public_id: "lease_test", lease_number: "TEST" },
                onClose: () => {},
                onScheduled: () => {},
            }),
        );
        await screen.findByText("Test Tenant");
        assert.equal(
            screen.queryByLabelText(/The tenant already moved in/),
            null,
        );
        cleanup();
        global.__leaseTestApi = {
            get: async (url) => {
                return {
                    data: {
                        data: url.includes("templates")
                            ? { templates: [] }
                            : { clauses: [] },
                    },
                };
            },
        };
        const Clauses = await buildComponent(
            "frontend/src/pages/leases/LeaseClausesModal.jsx",
            "clauses",
        );
        let continued = false;
        render(
            React.createElement(Clauses, {
                open: true,
                lease: {
                    public_id: "lease_test",
                    lease_number: "TEST",
                    status: "draft",
                    owner,
                },
                onClose: () => {},
                onContinue: () => {
                    continued = true;
                },
            }),
        );
        const next = screen.getByRole("button", {
            name: "Continue to signed agreement",
        });
        await waitFor(() => assert.equal(next.disabled, false));
        await user.type(
            document.querySelector('input[maxlength="200"]') ||
                screen.getByLabelText(/Title/),
            "Unsaved clause",
        );
        assert.equal(
            next.disabled,
            true,
            "unsaved clause must not be silently discarded",
        );
        await user.click(
            screen.getByRole("button", { name: "Clear", exact: true }),
        );
        await user.click(next);
        assert.equal(continued, true);
        console.log(
            "PASS: unsaved contract clause guard; explicit admin registration payload and hidden non-admin option; targeted lease billing; invoice-to-payment-to-receipt handoff; paid invoice rejection with no fallback; selection validation; inline tenant creation/selection; single accessible dialog; date validation; no POST on review; explicit review gate; Back retains values; correct lease payload; reopening resets wizard.",
        );
    } finally {
        cleanup();
        fs.rmSync(work, { recursive: true, force: true });
    }
})().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});

# Accountant tenancy, invoice and payment workflow

## Problem and scope

Accountants previously had to infer a sequence from lifecycle names, icon-only actions and separate pages. A newly entered tenancy with a past start date could not be confirmed using ordinary scheduling.

Frontend and backend use amudhassan/amud-api. Render deploys commits to main automatically; this implementation remains on ux/lease-accountant-guidance in draft PR #1.

## Implemented behavior

1. Add Tenant & Lease is a four-step wizard: owner/tenant, property/room, rent/dates, and review. Required values are checked before moving on. Back preserves input. Saving requires explicit review confirmation. Optional deposit, grace period, late fees and notes are disclosed separately.
2. The wizard can open the existing tenant creation form for the selected owner and select the newly created tenant. Only the active dialog remains accessible. Creating a tenant is a separate persistent operation; cancelling the lease does not remove that tenant, as the interface explains.
3. Saving opens contract terms. A Continue to signed agreement action proceeds to confirmation. It is disabled while a clause is being edited or requests are in progress, preventing silently discarded clause text.
4. Confirmation and tenancy start remain explicit actions with clear text buttons. The Next lease step card provides the subsequent action and can be dismissed. It is cleared if the same lease is cancelled, terminated or expired.
5. An administrator may explicitly register an existing current tenancy when its start date is before the database's current date and its end date has not passed. A 10–1000 character reason is required. The original dates remain unchanged; the current registration date and reason are appended to lease notes, and scheduled_at/scheduled_by retain their existing current-time audit behavior. Contract notes become immutable after scheduling under the existing database trigger. Ordinary requests still reject past dates. Non-admin users cannot use this exception. A scheduled lease must still be explicitly started via the existing activation checks.
6. Prepare invoice opens the existing invoice form with the exact lease fetched from the protected detail endpoint. Accountants still choose the billing period and due date. Stale requests cannot replace a newer lease selection. No automatic historical charge is introduced.
7. The created invoice opens its detail form for items, review and issuance. Payable invoice details expose Record payment. The payment form loads only that specific invoice; a paid, ineligible or inaccessible target cannot silently fall back to another invoice. A successful payment opens its receipt. Existing payment methods, amount/date validation and receipt PDF actions are reused.

## Financial and integrity controls

No migrations are required. No automatic invoice or payment is added by lease registration, confirmation or activation. Historical invoices and payments must be reviewed before new charges are entered.

Existing lease relationship locks, owner/property/tenant eligibility, maintenance status checks, deferred lease overlap constraints and unit status transitions remain in effect. Registration uses the same scheduling transaction and forces deferred constraints before commit. Failure rolls back; a repeated request for an already scheduled lease does not change it again. Registration reason is an SQL parameter, not interpolated into SQL.

Invoice period eligibility and overlapping non-void invoice protection remain enforced by the existing service and database constraints. Existing backend permissions still govern financial writes, irrespective of which UI buttons are displayed.

## Verification performed

- Frontend production build passed (existing large bundle warning).
- Targeted lint passed for wizard, lease list, confirmation, invoice creation/detail and payment files. The terms modal retains three pre-existing lint warnings.
- 27 backend tests passed: policy, request validation and scheduling service behavior with a mocked database client. Also passed with Asia/Kolkata timezone.
- React DOM tests passed against actual components with a mock API: step validation, inline tenant creation/selection, one accessible modal, date rejection, no create on Review, review checkbox gate, Back retention, correct request payload, reopen reset, exact lease billing and currency normalization, invoice/payment/receipt handoff, paid-target rejection without fallback, admin registration payload, non-admin option hidden, and unsaved-clause continuation guard.
- JavaScript syntax and diff whitespace checks passed.
- No production database, tenant, lease, invoice, payment, environment variable or deployment was changed.

Commands:

    npm test -- --runTestsByPath tests/lease.existingRegistration.test.js
    npm --prefix frontend run build

For isolated DOM tests:

    npm install --prefix /tmp/lease-wizard-check jsdom esbuild @testing-library/react @testing-library/user-event
    UX_TEST_DEPS=/tmp/lease-wizard-check node scripts/ux/lease-wizard-dom-check.cjs

The Playwright browser check passed with local API fixtures at 1440×1000 and 390×844. It verifies wizard validation, tenant dialog isolation, review confirmation, retained input, one create request, contract handoff, viewport coverage and visible Save controls. Screenshots were inspected. The test now avoids intercepting Vite's `/src/api/apiClient.js` module as an API request. `UX_CHROMIUM_EXECUTABLE` optionally selects an installed Chromium binary.

Browser QA found that the page entrance animation retained a transform after completion, making fixed dialogs position against the page content instead of the viewport. Page and section entrance animations now release their transforms after completion. Regression checks verify dialog coverage and the Save button bounds on both viewport sizes.

Local browser command (start Vite separately with `VITE_API_BASE_URL=http://127.0.0.1:5173/api`):

    UX_CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/ux/lease-wizard-browser-check.cjs

## Remaining release checks

### Database and API acceptance results

`scripts/ux/lease-database-check.cjs` now runs 27 acceptance checks on a fresh, in-memory PostgreSQL engine (PGlite 0.5.10, reporting PostgreSQL 18.6) with `btree_gist`. All 41 repository migrations execute unchanged. The fixture uses `database/schema.sql` plus the legacy `users.deleted_at` and `users.profile_image_url` columns referenced by current code but absent from that baseline; this is not proof of production schema parity. No production connection or credentials are used. The test injects its isolated database adapter before importing services, never loads `config/db.js`, and closes the engine on success or failure.

Verified: ordinary past-date rejection; admin-only existing tenancy registration; original dates/notes and current registration actor/date; immutable confirmed notes; activation and occupied unit state; lease overlap rejection with rollback; no automatic billing; invoice creation/items/issuance; invoice overlap rejection at the service and database exclusion-constraint levels; partial payment totals; receipt ownership/access; and receipt PDF generation.

The same run exercises the real Express routers, validators, authentication middleware, controllers and services through Supertest: unauthenticated access rejection, staff registration rejection, admin registration/activation, invoice creation and issue, overlapping invoice rejection, partial payment and exact response shapes used by the UI, receipt JSON/PDF, full settlement, overpayment rejection, paid-invoice payment rejection, and absence of extra allocations after rejected requests.

Reproduce with isolated dependencies (no application dependency changes):

    npm install --prefix /tmp/lease-pglite-check @electric-sql/pglite@0.5.10
    UX_PGLITE_DEPS=/tmp/lease-pglite-check node scripts/ux/lease-database-check.cjs

PGlite runs one database session. Native PostgreSQL process startup is unavailable in this environment because it only maps UID 0 and cannot run the server as a non-root user. These checks do not verify concurrent requests, native `pg` connection/type behavior, production schema parity or deployed configuration.

### Browser connected to the real API

`scripts/ux/lease-live-api-browser-check.cjs` now passes the full workflow through a local Vite frontend, actual Express routers/auth/validators/controllers/services and the disposable PostgreSQL engine. API responses are not mocked. External network requests are blocked. The test covers desktop 1440×1000 in America/New_York and mobile 390×844 in Africa/Dar_es_Salaam: tenant/room selection, past-date agreement creation, signed confirmation with admin reason, activation, targeted invoice, rent item, issuance, partial payment, receipt and actual PDF download. Database joins confirm the exact lease/invoice/payment/receipt and remaining balance. A deliberately pre-issue payment time is rejected in the form before the valid default time succeeds.

This exposed and fixed two integration issues:

- Lease and invoice list/detail calendar fields are now selected as SQL text (`YYYY-MM-DD`), preserving calendar dates across JSON serialization. Lease date displays parse date-only values as local calendar dates. This prevents a timezone shift from making a due-today invoice appear overdue and disabling issuance. Audit timestamps still represent instants.
- The payment form preserves milliseconds in its default timestamp and reads issuance time from the nested invoice audit response. Immediate payments no longer become earlier than invoice issuance merely because the form truncated seconds; manual pre-issue dates remain rejected.

The single-session adapter serializes whole transactions when browser background reads overlap. This is test infrastructure, not evidence of native PostgreSQL concurrency behavior.

    UX_PGLITE_DEPS=/tmp/lease-pglite-check UX_CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/ux/lease-live-api-browser-check.cjs

Outside the provided runtime, install Playwright in an isolated directory and set `UX_BROWSER_DEPS` to that directory. Vite comes from the frontend's installed dependencies.

### Native PostgreSQL and staging handoff

Render inventory was read on 2026-10-15 in the confirmed My Workspace. Only the production real-estate frontend/backend and shared PostgreSQL 18 database were present; preview generation was off and no staging/preview was listed. No Render resource was created or changed.

The database script now also supports `UX_NATIVE_DATABASE_URL` for a **new, empty, local PostgreSQL 18 database**. It refuses non-loopback hosts, database names outside `lease_acceptance_*`, URL query parameters and databases with existing user objects. It does not use normal application DB environment variables. Native mode uses `pg` connections, finite statement/lock timeouts and additional parallel registration, invoice and payment checks. It creates only synthetic fixtures; it does not drop databases. Create a new database per run, keep authentication local, and remove that test database separately when finished.

Example connection shape, using locally configured authentication rather than posting credentials:

    UX_NATIVE_DATABASE_URL=postgresql://TEST_USER@127.0.0.1:5433/lease_acceptance_RUN_ID node scripts/ux/lease-database-check.cjs

The same variable can be used with the real-API browser script. Native process startup remains blocked by this environment's UID mapping. The first owner-run native attempt exposed a test-only BIGINT assertion mismatch, corrected by selecting the audit actor as text and checking each audit field separately. Application authorization and database constraints were not changed by that correction.

**Native acceptance completed on 2026-10-15:** the owner executed the corrected script on Windows PostgreSQL 18.4 at 127.0.0.1:5433 against the new empty `lease_acceptance_20261015_r2` database. The supplied terminal screenshot shows all 41 repository migrations applied, all 30 PASS checks, and return to the CMD prompt without an error. This is an owner-executed run verified from its screenshot, not a database connection made from the agent environment.

Native concurrency results: competing tenancy registrations leave exactly one scheduled lease and roll the other back; competing invoice requests create one invoice; competing payments cannot exceed the outstanding balance. All preceding audit, permissions, invoice/payment/receipt/PDF and real API checks also completed. The original partially populated test database remains separate; neither test database was removed. No production deployment or database change was made.

Before merging/deploying, have the accountant review the flow, confirm compatibility with the production schema/configuration, and review the admin-only registration policy with the owner. Browser-to-API testing was completed with PGlite; native API/concurrency testing was completed separately on Windows. A combined native-browser run has not been claimed. Historical invoices and payment import, simplified navigation beyond this flow and general localization remain separate work.

### Local accountant review launcher

`scripts/ux/lease-accountant-preview.cjs` opens the existing synthetic native acceptance database without rerunning migrations or resetting records. It reuses the adapter's loopback/database-name safeguards and verifies the exact synthetic admin/property identity before starting. The launcher supplies six REVIEW rooms once, aligns the fixture tables' ID sequences for real create forms, and serves the frontend/API on loopback addresses only. It does not start production jobs or contact Render.

With backend/frontend dependencies installed, provide the existing local acceptance database via `UX_NATIVE_DATABASE_URL`, then run:

    node scripts/ux/lease-accountant-preview.cjs

The terminal prints a local `/__preview` link for the synthetic admin and a `?role=staff` link for the synthetic staff account. These are local test-session entry points, not application login changes. Session/receipt secrets are generated for the preview process. Vite env-file loading is disabled and API traffic is proxied to the local server. Keep the terminal open; Ctrl+C closes both servers and the database pool. The same database can be reopened without a reset; sample records and review changes remain there. Receipts use a process-specific QR secret, so a previous preview session's QR link need not remain valid after restart.

Local smoke checks on PGlite passed admin/staff browser entry, real API tenant creation with fixture ID sequence alignment, and restart without duplicate REVIEW rooms. Owner-machine launcher execution/accountant acceptance are pending.

Review tasks: select/add a tenant; choose a REVIEW room; enter rent and dates; confirm the review/contract/signature; use admin registration with a reason for an existing tenancy; start the tenancy; prepare a period-specific invoice, add its rent item and issue it; record a partial payment and download its receipt PDF. Check the remaining balance and assess whether each next action is understandable. Staff must not see the admin-only existing-tenancy registration option. Review data stays in the acceptance database.

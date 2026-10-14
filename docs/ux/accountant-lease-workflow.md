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

The optional Playwright browser check requires a local Vite server and installed Chromium. Browser installation failed in this environment, so browser screenshots and visual layout results are not claimed.

## Remaining release checks

Before merging/deploying, exercise this branch against a disposable database with the project's existing migrations. Confirm registration/activation timestamps, immutable notes, overlapping tenancy rejection and invoice overlap rejection using real PostgreSQL. Verify the guided flow with actual API response shapes and roles. Run desktop and mobile browser QA, including focus, modal layout, signing, invoice items/issuance, partial payment and receipt PDF. Review the admin-only registration policy with the owner. Historical invoices and payment import, simplified navigation beyond this flow and general localization remain separate work.

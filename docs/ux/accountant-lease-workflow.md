# Accountant lease workflow

## Verified current behavior

Frontend and backend use amudhassan/amud-api main. Render automatically deploys commits to main. The frontend root is frontend. UI improvements should be reviewed on a separate branch.

Creation saves a draft and opens contract terms. Scheduling requires a signature, validates related records and conflicts, and rejects a past start date using database time. Activation requires a scheduled lease with scheduling audit fields, checks dates and conflicts, and marks the room occupied. Therefore a newly entered existing tenancy cannot follow the current scheduling path.

## Implemented first improvement

Lease creation explains what saving actually does. Confirmation and tenancy start use visible text buttons. Status labels describe the work remaining. Dialogs explain the user action rather than backend internals. The past-start-date error distinguishes an incorrect future-tenancy date from an existing tenancy that needs administrator assistance. No tenancy-start support is implied for that unsupported case.

## Remaining implementation

1. Provide one guided entry flow: select or add tenant, choose room, enter dates/rent/payment period, review terms and signature, review summary, save.
2. Distinguish planned tenancy from existing tenancy explicitly. An existing tenancy must retain its true start date. Add a separately authorized, transactional backend operation with an audit reason; do not bypass the existing scheduling guard in the browser.
3. Reuse owner/tenant eligibility, room-maintenance locks and overlap checks. Lock affected records and handle simultaneous submissions. Reject expired agreements for current occupancy.
4. Define billing behavior before enabling the existing-tenancy operation: first invoice period, historical invoices, already-paid amounts, prevention of duplicate invoices and receipt handling. Preserve activation and actor audit fields with truthful timestamps.
5. After a successful save/start, expose record payment and receipt actions using the existing invoice/payment APIs and finance permissions.
6. Reduce accountant navigation only after checking current role permissions; hiding UI does not replace backend authorization.

## Validation

Frontend production build passed. Frontend lint completed with warnings in other files; changed files had no reported warnings. Diff whitespace check passed. No live tenant, lease, payment, database or environment changes were made. Authenticated browser workflow and mobile-width visual validation remain pending.

## Acceptance cases for the integrated flow

Future agreement: save and confirm without starting early. Current tenancy: starts only in its valid period. Existing tenancy: retains original dates and records historical billing exactly once. Conflicting room, maintenance lock, ineligible tenant, missing signature, expired dates and unauthorized actor: rejected without partial writes. Retried submission: no duplicate agreement/invoice/payment. Payment: receipt only after successful recording, with role-appropriate finance visibility.

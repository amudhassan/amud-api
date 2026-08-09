OWNERS PHASE 6A — DELETED OWNERS BACKEND SUPPORT (CRLF-SAFE FIX)

Purpose
-------
Adds admin-only:
GET /api/owners/deleted

This package fixes the earlier patcher's Windows CRLF/LF exact-marker issue.
The patcher now normalizes line endings while editing, preserves each target
file's original line-ending style, uses formatting-tolerant require/export
patching, runs Node syntax checks, and restores original files if a write/check
fails.

Install
-------
1. Extract this ZIP into the backend project root:
   C:\Users\AMUD\amud-api

2. From CMD in that project root run:

   node scripts\patchOwnersDeletedSupport.js

Expected:
   Owners deleted-list backend support installed successfully.
   Syntax checks passed for ownerService.js, ownerController.js and ownerRoutes.js.

3. Run:

   node scripts\checkOwnersDeletedSupport.js

Expected:
   Owners deleted-list backend support check passed.

4. Restart the backend server.

Local API test
--------------
Use an ADMIN Bearer token:

GET {{base_url}}/api/owners/deleted?search=Frontend%20Owner%20Test%20Edited&page=1&limit=20

Expected:
- HTTP 200
- success: true
- Frontend Owner Test Edited in data
- status: inactive
- deleted_at contains a timestamp

Security / lifecycle notes
--------------------------
- Deleted-owner inventory is admin-only.
- Existing PATCH /api/owners/:public_id/restore remains admin-only.
- Restore returns the owner to inactive status.
- Historical revoked owner-user links are preserved and are not automatically reactivated.
- Existing owner routes and business rules are retained.

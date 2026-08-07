REPORTS & DASHBOARD MODULE - MASTER PACKAGE (BATCHES A-F)
=========================================================

This package contains the complete Reports & Dashboard backend module.

BATCH A
- Shared reporting access/context.
- Migration 034.
- GET /api/reports/context.

BATCH B
- Financial summary, revenue, outstanding and collections.
- Migration 035.

BATCH C
- Occupancy, leases and expiring leases.
- Migration 036.

BATCH D
- Maintenance summary, performance and costs.
- Migration 037.
- Maintenance reporting requires can_view_maintenance_requests for owner users.

BATCH E
- Management dashboard and recent important activity.
- Migration 038.
- Dashboard exposes only the sections the authenticated owner user is authorized to see.

BATCH F
- CSV/PDF exports.
- Immutable export audit.
- Migration 039.
- PDF uses the existing pdfkit dependency already used by the receipt module.

IMPORTANT
- app.js only needs the reportRoutes integration created in Batch A:
  app.use("/api/reports", reportRoutes);
- No additional server.js worker is required.
- Reports are read-only over transactional business data.
- report_exports stores export audit metadata only.
- Reversed payments are not counted as financial collections/revenue.
- Currency totals remain separated by currency code.

LOCAL EXECUTION ORDER
1. Extract this package into project root and allow report files to overwrite prior Batch A/B versions.
2. Run migration 035.
3. Run verification reports_batch_b_verification.sql.
4. Run migration 036.
5. Run verification reports_batch_c_verification.sql.
6. Run migration 037.
7. Run verification reports_batch_d_verification.sql.
8. Run migration 038.
9. Run verification reports_batch_e_verification.sql.
10. Run migration 039.
11. Run verification reports_batch_f_verification.sql.
12. Run reports_all_batches_verification.sql.
13. Run:
    node scripts/checkReportsAllBatches.js
14. Restart server.
15. Run API smoke tests from ENDPOINT_MATRIX.txt.
16. Only after all local tests pass: Git commit, push, Render migrations, production verification and final production smoke tests.

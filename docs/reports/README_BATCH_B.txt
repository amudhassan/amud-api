REPORTS & DASHBOARD - BATCH B
FINANCIAL REPORTS

Endpoints:
GET /api/reports/financial/summary
GET /api/reports/financial/revenue
GET /api/reports/financial/outstanding
GET /api/reports/financial/collections

All endpoints:
- require authentication;
- use the shared Batch A reporting access layer;
- require can_manage_finances for regular owner users;
- deny tenant-only management-report access;
- support owner/property/date/currency filters;
- keep currency totals separated;
- exclude reversed payments from collected revenue;
- do not expose internal database IDs.

Revenue and collection reports support:
period=daily|weekly|monthly|quarterly|yearly

Outstanding report supports:
limit=1..100 (default 20)

Migration:
database/migrations/20260807_035_add_financial_reporting_indexes.sql

Verification:
database/verification/reports_batch_b_verification.sql

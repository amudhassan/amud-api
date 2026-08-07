REPORTS & DASHBOARD - BATCH A
Reporting Foundation & Shared Access Layer

PURPOSE
- Establish one reusable authorization layer for all management reports.
- Preserve owner isolation and delegated permissions.
- Add read-path indexes without duplicating transactional business data.
- Provide a small /api/reports/context endpoint for local verification.

PERMISSION MODES EXPORTED BY reportAccessService.js
- either: can_manage_properties OR can_manage_finances
- property: can_manage_properties
- financial: can_manage_finances
- both: both permissions required

IMPORTANT SECURITY RULES
- Admin can resolve global reporting scope.
- Regular users must have a current owner_users relationship.
- Inaccessible requested owners return Owner not found.
- Inaccessible requested properties return Property not found.
- Tenant-only accounts do not receive management-report access.
- Internal numeric IDs are never exposed by the context endpoint.

DATABASE MIGRATION
20260807_034_add_reporting_foundation_indexes.sql

The migration creates indexes only. It does not create report snapshots, materialized business totals or duplicated source records.

ENDPOINT
GET /api/reports/context

NEXT BATCH
Batch B - Financial Reports.

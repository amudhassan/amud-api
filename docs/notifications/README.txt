NOTIFICATIONS BATCH E
Maintenance Event Processing & Notification Integration

PURPOSE
- Consume maintenance_events as a transactional outbox.
- Register every source event idempotently.
- Resolve administrators, eligible owner users, eligible tenant users,
  the assigned internal technician and the original reporter.
- Respect notification preferences, category switches, minimum priority,
  digest frequency, quiet hours and timezone.
- Create in-app notifications without exposing external-vendor contact data.
- Retry failed events with exponential backoff and terminal dead-letter handling.
- Preserve an immutable recipient-decision audit.

FILES
- database/migrations/20260807_033_add_maintenance_notification_processing.sql
- database/verification/notifications_batch_e_verification.sql
- database/testing/notifications_batch_e_create_test_event.sql
- database/testing/notifications_batch_e_result_check.sql
- services/notifications/maintenanceEventTemplateService.js
- services/notifications/maintenanceEventProcessorService.js
- workers/notificationMaintenanceWorker.js
- scripts/processMaintenanceNotifications.js
- scripts/checkNotificationBatchE.js
- APP_INTEGRATION.txt
- ENVIRONMENT_VARIABLES.txt
- LOCAL_TEST_PLAN.txt

IMPORTANT
The worker is disabled by default. Complete local one-off processing tests before
enabling the recurring worker in server startup.

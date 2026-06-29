DELETE FROM "system_scheduled_jobs"
WHERE "job_key" IN ('backup-googledrive.tick', 'backup-googledrive.reaper');
--> statement-breakpoint
DELETE FROM "notification_settings"
WHERE "type" = 'backup_googledrive';
--> statement-breakpoint
DELETE FROM "notification_notifications"
WHERE "type" = 'backup_googledrive';
--> statement-breakpoint
ALTER TABLE "notification_settings"
  ALTER COLUMN "type" TYPE text USING "type"::text;
--> statement-breakpoint
ALTER TABLE "notification_notifications"
  ALTER COLUMN "type" TYPE text USING "type"::text;
--> statement-breakpoint
DROP TYPE IF EXISTS "notification_type";
--> statement-breakpoint
CREATE TYPE "notification_type" AS ENUM(
  'comment',
  'like',
  'follow',
  'mention',
  'system',
  'announcement'
);
--> statement-breakpoint
ALTER TABLE "notification_settings"
  ALTER COLUMN "type" TYPE "notification_type" USING "type"::"notification_type";
--> statement-breakpoint
ALTER TABLE "notification_notifications"
  ALTER COLUMN "type" TYPE "notification_type" USING "type"::"notification_type";
--> statement-breakpoint
DROP TABLE IF EXISTS "backup_googledrive_run_claims" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "backup_googledrive_runs" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "backup_googledrive_project_config" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "backup_googledrive_oauth_nonces" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "backup_googledrive_user_settings" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "backup_googledrive_credentials" CASCADE;

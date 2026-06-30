-- PB-NOTI-EMAIL-SEND-001 (BBR-661) — transactional send idempotency.
-- EXTEND of the base email-log capability. Adds a nullable idempotency key so a
-- caller-supplied key dedupes transactional sends at the DB level. The partial
-- unique index ignores legacy NULL rows, so existing send paths are unaffected.
-- Idempotent + hand-authored (same approach as 0046/0052/0054) to avoid sweeping
-- unrelated base-snapshot drift.

ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(200);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_email_logs_idempotency_key" ON "email_logs" USING btree ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;

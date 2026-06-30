-- PB-COMM-MODERATOR-API-001 (BBR-593) — moderator invite/permission lifecycle.
-- EXTEND community_moderators with an appointment status so every moderator
-- action carries a durable invite-state record (pending/active/declined/revoked)
-- alongside the existing community_mod_logs audit trail.
-- Hand-authored idempotent (same approach as 0046/0052/0054) to avoid sweeping
-- unrelated base-snapshot drift. Existing rows backfill to 'active'.

DO $$ BEGIN
	CREATE TYPE "public"."community_moderator_status" AS ENUM('pending', 'active', 'declined', 'revoked');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "community_moderators" ADD COLUMN IF NOT EXISTS "status" "community_moderator_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "community_moderators" ADD COLUMN IF NOT EXISTS "responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "community_moderators" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_moderators_status" ON "community_moderators" USING btree ("status");

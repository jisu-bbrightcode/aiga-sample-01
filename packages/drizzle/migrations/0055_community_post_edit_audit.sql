-- PB-COMM-POST-API-UPDATE-001 (BBR-597) — post edit revision trail.
-- Adds author/moderator edit-tracking columns to community_posts so an edit
-- leaves a durable revision marker (mirrors the existing is_edited/edited_at
-- pair on community_comments). Moderator edits additionally append to
-- community_mod_logs (no schema change needed there).
-- Idempotent, hand-authored (same approach as 0046/0052/0054).

ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "is_edited" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "last_edited_by" text;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_last_edited_by_users_id_fk" FOREIGN KEY ("last_edited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

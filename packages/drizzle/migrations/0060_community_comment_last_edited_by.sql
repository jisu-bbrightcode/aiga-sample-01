-- PB-COMM-COMMENT-API-UPDATE-001 (BBR-601) — comment edit audit.
-- EXTEND community_comments with last_edited_by so every edit records the
-- acting principal (the author themselves or a moderator). Pairs with the
-- existing is_edited/edited_at flags and the community_mod_logs audit trail
-- written on moderator edits.
-- Hand-authored idempotent (same approach as 0046/0052/0054/0058) to avoid
-- sweeping unrelated base-snapshot drift. Existing rows backfill to NULL.

ALTER TABLE "community_comments" ADD COLUMN IF NOT EXISTS "last_edited_by" text;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_last_edited_by_users_id_fk" FOREIGN KEY ("last_edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

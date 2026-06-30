-- PB-COMM-HIDE-API-CREATE-001 (BBR-617) — community content hide.
-- Per-viewer content hide (user-level mute). Distinct from admin global hide
-- (community_posts.status='hidden' / community_comments.is_hidden) which is
-- already modeled. This table records "hide this post/comment for THIS viewer
-- only" so list/detail/comment/reaction paths can exclude it per viewer.
-- Hand-authored, idempotent (repo convention; drizzle snapshots stop at 0043).

DO $$ BEGIN
  CREATE TYPE "community_hidden_target_type" AS ENUM ('post', 'comment');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "community_hidden_content" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" text NOT NULL,
  "target_type" "community_hidden_target_type" NOT NULL,
  "target_id" uuid NOT NULL,
  "reason" text
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "community_hidden_content"
    ADD CONSTRAINT "community_hidden_content_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "community_hidden_content_unique"
  ON "community_hidden_content" ("user_id", "target_type", "target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hidden_content_user"
  ON "community_hidden_content" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hidden_content_target"
  ON "community_hidden_content" ("target_type", "target_id");

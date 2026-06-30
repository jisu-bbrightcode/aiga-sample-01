-- PB-COMM-POLL-API-001 (BBR-605) — community poll vote tracking.
-- EXTENDs the community capability: per-user, per-option poll vote rows.
-- One row = (post, user, option) one ballot. Aggregate counts stay cached in
-- "community_posts"."poll_data". The unique(post_id,user_id,option_id) index
-- blocks duplicate votes on the same option at the DB level (AC#1).
-- Idempotent, hand-authored (same approach as 0046/0052/0054) to avoid sweeping
-- unrelated base-snapshot drift.

CREATE TABLE IF NOT EXISTS "community_poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"option_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "community_poll_votes" ADD CONSTRAINT "community_poll_votes_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "community_poll_votes" ADD CONSTRAINT "community_poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_poll_votes_unique" ON "community_poll_votes" USING btree ("post_id","user_id","option_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_poll_votes_post" ON "community_poll_votes" USING btree ("post_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_poll_votes_post_user" ON "community_poll_votes" USING btree ("post_id","user_id");

-- PB-COMM-DATA-001 (BBR-586) — community moderation policy delta.
-- EXTEND over the product-builder-base community capability: adds the
-- per-user vs global content hide / filter models required by AC#3
-- ("작성자 차단, 콘텐츠 숨김, 필터 결과가 사용자별/전역 정책으로 구분된다").
-- Idempotent, hand-authored to match the repo's migration pattern (0044+)
-- and avoid sweeping unrelated base-snapshot drift.
-- Tables: community_hidden_contents, community_content_filters,
--         community_filter_matches.

DO $$ BEGIN
  CREATE TYPE "public"."community_policy_scope" AS ENUM('user', 'global');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."community_hidden_content_target_type" AS ENUM('post', 'comment');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."community_content_filter_match_type" AS ENUM('keyword', 'regex', 'domain');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."community_content_filter_action" AS ENUM('hide', 'flag', 'review');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."community_content_filter_target_type" AS ENUM('post', 'comment');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "community_hidden_contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"target_type" "community_hidden_content_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"community_id" uuid,
	"reason" text
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "community_content_filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scope" "community_policy_scope" NOT NULL,
	"owner_id" text,
	"community_id" uuid,
	"match_type" "community_content_filter_match_type" DEFAULT 'keyword' NOT NULL,
	"pattern" text NOT NULL,
	"applies_to" "community_content_filter_target_type"[] DEFAULT '{"post","comment"}' NOT NULL,
	"action" "community_content_filter_action" DEFAULT 'hide' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "community_filter_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"filter_id" uuid NOT NULL,
	"scope" "community_policy_scope" NOT NULL,
	"affected_user_id" text,
	"target_type" "community_content_filter_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"action" "community_content_filter_action" NOT NULL,
	"matched_excerpt" text,
	"matched_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "community_hidden_contents" ADD CONSTRAINT "community_hidden_contents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "community_hidden_contents" ADD CONSTRAINT "community_hidden_contents_community_id_community_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community_communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "community_content_filters" ADD CONSTRAINT "community_content_filters_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "community_content_filters" ADD CONSTRAINT "community_content_filters_community_id_community_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community_communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "community_content_filters" ADD CONSTRAINT "community_content_filters_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "community_filter_matches" ADD CONSTRAINT "community_filter_matches_filter_id_community_content_filters_id_fk" FOREIGN KEY ("filter_id") REFERENCES "public"."community_content_filters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "community_filter_matches" ADD CONSTRAINT "community_filter_matches_affected_user_id_users_id_fk" FOREIGN KEY ("affected_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "community_hidden_contents_unique" ON "community_hidden_contents" USING btree ("user_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hidden_contents_user" ON "community_hidden_contents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hidden_contents_target" ON "community_hidden_contents" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hidden_contents_user_community" ON "community_hidden_contents" USING btree ("user_id","community_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_content_filters_scope" ON "community_content_filters" USING btree ("scope");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_content_filters_owner" ON "community_content_filters" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_content_filters_community" ON "community_content_filters" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_filter_matches_filter" ON "community_filter_matches" USING btree ("filter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_filter_matches_scope" ON "community_filter_matches" USING btree ("scope");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_filter_matches_affected_user" ON "community_filter_matches" USING btree ("affected_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_filter_matches_target" ON "community_filter_matches" USING btree ("target_type","target_id");

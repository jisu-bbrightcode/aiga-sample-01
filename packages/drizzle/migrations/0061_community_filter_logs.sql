-- PB-COMM-FILTER-API-001 (BBR-619) — community policy filter audit + review queue.
-- Records every automated content-filter action (금칙어/URL/첨부/moderation) so that
-- filter actions and the moderator review result are auditable (AC#2). Pending
-- `hidden_for_review` rows form the manual review queue that keeps policy-violation
-- candidates out of the public feed until reviewed (AC#1).
-- Hand-authored idempotent (same approach as 0046/0052/0054/0058).

DO $$ BEGIN
	CREATE TYPE "public"."community_filter_rule_type" AS ENUM('keyword', 'link', 'attachment', 'moderation');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."community_filter_action" AS ENUM('blocked', 'hidden_for_review');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."community_filter_review_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."community_filter_target_type" AS ENUM('post', 'comment');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_filter_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"community_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"target_type" "community_filter_target_type",
	"target_id" uuid,
	"rule_type" "community_filter_rule_type" NOT NULL,
	"action" "community_filter_action" NOT NULL,
	"matched_terms" text[] DEFAULT '{}',
	"reason" text,
	"review_status" "community_filter_review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text
);--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "community_filter_logs" ADD CONSTRAINT "community_filter_logs_community_id_community_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community_communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "community_filter_logs" ADD CONSTRAINT "community_filter_logs_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "community_filter_logs" ADD CONSTRAINT "community_filter_logs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_filter_logs_community" ON "community_filter_logs" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_filter_logs_community_review" ON "community_filter_logs" USING btree ("community_id","review_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_filter_logs_queue" ON "community_filter_logs" USING btree ("community_id","action","review_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_filter_logs_target" ON "community_filter_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_filter_logs_author" ON "community_filter_logs" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_filter_logs_created" ON "community_filter_logs" USING btree ("created_at");

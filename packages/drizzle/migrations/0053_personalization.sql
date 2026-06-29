-- PB-FEAT-002 (BBR-732) — FR-002 개인화: 저장/관심/검색 히스토리.
-- Idempotent, hand-authored to match the repo's migration pattern and avoid
-- sweeping unrelated base-snapshot drift.
-- Tables: saved_item, interest, search_history.
-- Owner-scoped: every row requires a logged-in user_id (NOT NULL); the login
-- gate also lives in the API/screen layer.

DO $$ BEGIN
  CREATE TYPE "public"."personalization_target_type" AS ENUM('doctor', 'hospital');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "saved_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" text NOT NULL,
  "target_type" "personalization_target_type" NOT NULL,
  "target_id" uuid NOT NULL,
  "memo" text,
  "tags" text[]
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "interest" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "target_type" "personalization_target_type" NOT NULL,
  "target_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "search_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "query" varchar(500) NOT NULL,
  "filters" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "saved_item" ADD CONSTRAINT "saved_item_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "interest" ADD CONSTRAINT "interest_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- Indexes ------------------------------------------------------------------
-- 중복 저장 방지 — one save per (user, resource)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_saved_item_owner_target" ON "saved_item" ("user_id","target_type","target_id");--> statement-breakpoint
-- 사용자별 저장 목록 최근순 (also serves user_id lookups)
CREATE INDEX IF NOT EXISTS "idx_saved_item_user_created" ON "saved_item" ("user_id","created_at");--> statement-breakpoint
-- 중복 관심 방지 — one interest per (user, resource)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_interest_owner_target" ON "interest" ("user_id","target_type","target_id");--> statement-breakpoint
-- 사용자별 관심 목록 최근순 (also serves user_id lookups)
CREATE INDEX IF NOT EXISTS "idx_interest_user_created" ON "interest" ("user_id","created_at");--> statement-breakpoint
-- 사용자별 검색 히스토리 최근순 (also serves user_id lookups)
CREATE INDEX IF NOT EXISTS "idx_search_history_user_created" ON "search_history" ("user_id","created_at");

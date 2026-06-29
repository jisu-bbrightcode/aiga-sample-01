-- PB-DATA-FR001-001 (BBR-520) — FR-001 사용자: grade (등급) + daily usage quota.
-- Idempotent, hand-authored to match the repo's migration style and avoid
-- sweeping unrelated base-snapshot drift.
-- Tables: user_grade_definitions, user_grades, user_daily_usage.
-- Identity (social login) and RBAC roles are REUSED from core; not re-created here.

DO $$ BEGIN
  CREATE TYPE "public"."user_grade_source" AS ENUM('signup', 'identity_verified', 'manual', 'system');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_grade_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "name" varchar(100) NOT NULL,
  "slug" varchar(60) NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "daily_usage_limit" integer,
  "is_system" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_grades" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" text NOT NULL,
  "grade_id" uuid NOT NULL,
  "source" "user_grade_source" DEFAULT 'signup' NOT NULL,
  "determined_by" text,
  "note" text,
  "determined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_daily_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" text NOT NULL,
  "usage_date" date NOT NULL,
  "action" text NOT NULL,
  "used_count" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint

-- Foreign keys -------------------------------------------------------------
DO $$ BEGIN
 ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_grade_id_user_grade_definitions_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."user_grade_definitions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_grades" ADD CONSTRAINT "user_grades_determined_by_profiles_id_fk" FOREIGN KEY ("determined_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_daily_usage" ADD CONSTRAINT "user_daily_usage_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- Indexes ------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_grade_definitions_slug" ON "user_grade_definitions" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_grade_definitions_active_order" ON "user_grade_definitions" ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_grades_user" ON "user_grades" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_grades_grade" ON "user_grades" ("grade_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_grades_expires_at" ON "user_grades" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_daily_usage_user_date_action" ON "user_daily_usage" ("user_id","usage_date","action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_daily_usage_date" ON "user_daily_usage" ("usage_date");

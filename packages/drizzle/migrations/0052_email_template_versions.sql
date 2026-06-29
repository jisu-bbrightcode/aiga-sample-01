-- PB-NOTI-EMAIL-DATA-001 (BBR-655) — email template/version registry.
-- EXTEND of the base email_logs capability. Idempotent, hand-authored to avoid
-- sweeping unrelated base-snapshot drift (same approach as 0046).
-- Adds: email_template_category / email_template_version_status enums,
--       email_templates, email_template_versions tables,
--       email_logs.template_key + email_logs.template_version_id (additive).

DO $$ BEGIN
  CREATE TYPE "public"."email_template_category" AS ENUM('auth', 'password', 'transactional', 'marketing');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."email_template_version_status" AS ENUM('draft', 'published', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "key" varchar(120) NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" text,
  "category" "email_template_category" DEFAULT 'transactional' NOT NULL,
  "current_version_id" uuid,
  "is_active" boolean DEFAULT true NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "email_template_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "template_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "subject" text NOT NULL,
  "variable_schema" jsonb,
  "body_source" text,
  "status" "email_template_version_status" DEFAULT 'draft' NOT NULL,
  "changelog" text,
  "created_by" text,
  "published_at" timestamp with time zone
);--> statement-breakpoint

-- email_logs delta (additive; existing rows keep NULL)
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "template_key" varchar(120);--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "template_version_id" uuid;--> statement-breakpoint

-- Unique key per template + unique (template, version)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_email_templates_key" ON "email_templates" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_templates_category" ON "email_templates" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_email_template_versions_template_version" ON "email_template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_template_versions_template" ON "email_template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_template_versions_status" ON "email_template_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_logs_template_key" ON "email_logs" USING btree ("template_key","created_at");--> statement-breakpoint

-- Foreign keys (added after tables exist to avoid templates <-> versions cycle)
DO $$ BEGIN
  ALTER TABLE "email_template_versions"
    ADD CONSTRAINT "fk_email_template_versions_template"
    FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "email_template_versions"
    ADD CONSTRAINT "fk_email_template_versions_created_by"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "email_templates"
    ADD CONSTRAINT "fk_email_templates_current_version"
    FOREIGN KEY ("current_version_id") REFERENCES "public"."email_template_versions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "email_logs"
    ADD CONSTRAINT "fk_email_logs_template_version"
    FOREIGN KEY ("template_version_id") REFERENCES "public"."email_template_versions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- PB-FILE-DATA-001 (BBR-547) — file metadata / permission data model.
-- EXTEND of base file-upload (Vercel Blob) capability. Idempotent,
-- hand-authored to match the repo convention (avoid base-snapshot drift).
-- Table: file_assets. Enums: file_source, file_visibility, file_status,
--        file_scan_status, file_review_status.

DO $$ BEGIN
  CREATE TYPE "public"."file_source" AS ENUM('user', 'admin', 'system');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."file_visibility" AS ENUM('public', 'private');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."file_status" AS ENUM('pending', 'ready', 'failed', 'deleted');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."file_scan_status" AS ENUM('pending', 'clean', 'infected', 'error', 'skipped');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."file_review_status" AS ENUM('not_required', 'pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "file_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "owner_user_id" text,
  "source" "file_source" DEFAULT 'user' NOT NULL,
  "target_type" varchar(64),
  "target_id" varchar(255),
  "blob_url" text NOT NULL,
  "pathname" text NOT NULL,
  "download_url" text,
  "original_name" text NOT NULL,
  "visibility" "file_visibility" DEFAULT 'private' NOT NULL,
  "status" "file_status" DEFAULT 'pending' NOT NULL,
  "content_type" varchar(255),
  "size" integer,
  "checksum" varchar(128),
  "checksum_algorithm" varchar(16),
  "declared_content_type" varchar(255),
  "declared_size" integer,
  "scan_status" "file_scan_status" DEFAULT 'pending' NOT NULL,
  "scanned_at" timestamp with time zone,
  "review_status" "file_review_status" DEFAULT 'not_required' NOT NULL,
  "completed_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "deleted_by" text
);--> statement-breakpoint

-- Foreign keys -------------------------------------------------------------
DO $$ BEGIN
 ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- Indexes ------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "uq_file_assets_pathname" ON "file_assets" ("pathname");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_assets_owner" ON "file_assets" ("owner_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_assets_target" ON "file_assets" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_assets_visibility_status" ON "file_assets" ("visibility","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_assets_status_expires" ON "file_assets" ("status","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_assets_scan_status" ON "file_assets" ("scan_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_assets_review_status" ON "file_assets" ("review_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_assets_created_at" ON "file_assets" ("created_at");

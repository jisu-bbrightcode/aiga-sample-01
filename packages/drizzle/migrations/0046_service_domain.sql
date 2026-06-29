-- PB-DATA-001 (BBR-519) — AIGA service domain: 의사/병원 큐레이션 core hub.
-- Idempotent, hand-authored to avoid sweeping unrelated base-snapshot drift.
-- Tables: service_specialties, service_regions, service_hospitals,
--         service_doctors, service_doctor_specialties, service_doctor_hospitals.

DO $$ BEGIN
  CREATE TYPE "public"."service_publish_status" AS ENUM('draft', 'published', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_specialties" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "name" varchar(100) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_regions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "name" varchar(100) NOT NULL,
  "slug" varchar(120) NOT NULL,
  "parent_id" uuid,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_hospitals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "name" varchar(200) NOT NULL,
  "slug" varchar(200) NOT NULL,
  "summary" text,
  "description" text,
  "region_id" uuid,
  "address_line" varchar(300),
  "phone" varchar(40),
  "website_url" text,
  "photo_url" text,
  "rating_avg" double precision DEFAULT 0 NOT NULL,
  "review_count" integer DEFAULT 0 NOT NULL,
  "is_featured" boolean DEFAULT false NOT NULL,
  "status" "service_publish_status" DEFAULT 'draft' NOT NULL,
  "business_registration_no" varchar(32),
  "internal_notes" text,
  "source_url" text,
  "published_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_doctors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "name" varchar(120) NOT NULL,
  "slug" varchar(160) NOT NULL,
  "title" varchar(120),
  "primary_specialty_id" uuid,
  "primary_hospital_id" uuid,
  "region_id" uuid,
  "short_bio" text,
  "biography" text,
  "photo_url" text,
  "years_experience" integer,
  "rating_avg" double precision DEFAULT 0 NOT NULL,
  "review_count" integer DEFAULT 0 NOT NULL,
  "is_featured" boolean DEFAULT false NOT NULL,
  "featured_rank" integer,
  "status" "service_publish_status" DEFAULT 'draft' NOT NULL,
  "license_number" varchar(64),
  "license_verified_at" timestamp with time zone,
  "internal_notes" text,
  "source_url" text,
  "published_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_doctor_specialties" (
  "doctor_id" uuid NOT NULL,
  "specialty_id" uuid NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "service_doctor_specialties_doctor_id_specialty_id_pk" PRIMARY KEY("doctor_id","specialty_id")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_doctor_hospitals" (
  "doctor_id" uuid NOT NULL,
  "hospital_id" uuid NOT NULL,
  "role" varchar(80),
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "service_doctor_hospitals_doctor_id_hospital_id_pk" PRIMARY KEY("doctor_id","hospital_id")
);--> statement-breakpoint

-- Foreign keys -------------------------------------------------------------
DO $$ BEGIN
 ALTER TABLE "service_regions" ADD CONSTRAINT "service_regions_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."service_regions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_hospitals" ADD CONSTRAINT "service_hospitals_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."service_regions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_hospitals" ADD CONSTRAINT "service_hospitals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_hospitals" ADD CONSTRAINT "service_hospitals_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_doctors" ADD CONSTRAINT "service_doctors_primary_specialty_id_fk" FOREIGN KEY ("primary_specialty_id") REFERENCES "public"."service_specialties"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_doctors" ADD CONSTRAINT "service_doctors_primary_hospital_id_fk" FOREIGN KEY ("primary_hospital_id") REFERENCES "public"."service_hospitals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_doctors" ADD CONSTRAINT "service_doctors_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."service_regions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_doctors" ADD CONSTRAINT "service_doctors_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_doctors" ADD CONSTRAINT "service_doctors_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_doctor_specialties" ADD CONSTRAINT "service_doctor_specialties_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."service_doctors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_doctor_specialties" ADD CONSTRAINT "service_doctor_specialties_specialty_id_fk" FOREIGN KEY ("specialty_id") REFERENCES "public"."service_specialties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_doctor_hospitals" ADD CONSTRAINT "service_doctor_hospitals_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."service_doctors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_doctor_hospitals" ADD CONSTRAINT "service_doctor_hospitals_hospital_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."service_hospitals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- Indexes ------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "uq_service_specialties_slug" ON "service_specialties" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_specialties_active_order" ON "service_specialties" ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_service_regions_slug" ON "service_regions" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_regions_parent_order" ON "service_regions" ("parent_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_regions_active" ON "service_regions" ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_service_hospitals_slug" ON "service_hospitals" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_hospitals_status_region" ON "service_hospitals" ("status","region_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_hospitals_status_featured" ON "service_hospitals" ("status","is_featured");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_hospitals_name" ON "service_hospitals" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_hospitals_updated_at" ON "service_hospitals" ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_service_doctors_slug" ON "service_doctors" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_doctors_status_specialty" ON "service_doctors" ("status","primary_specialty_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_doctors_status_region" ON "service_doctors" ("status","region_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_doctors_hospital" ON "service_doctors" ("primary_hospital_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_doctors_status_featured_rank" ON "service_doctors" ("status","is_featured","featured_rank");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_doctors_name" ON "service_doctors" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_doctors_updated_at" ON "service_doctors" ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doctor_specialties_specialty" ON "service_doctor_specialties" ("specialty_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doctor_hospitals_hospital" ON "service_doctor_hospitals" ("hospital_id");

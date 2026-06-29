-- PB-FEAT-004 (BBR-522) — FR-004 명의 큐레이션: editorial collection layer over
-- the PB-DATA-001 doctor hub. Idempotent, hand-authored to match the repo style
-- (CREATE TYPE … EXCEPTION WHEN duplicate_object, CREATE TABLE/INDEX IF NOT
-- EXISTS, ADD CONSTRAINT in DO guards). Depends on 0046_service_domain.
-- Renumbered to 0049: siblings FR-001 user_grade (0047) and FR-003 service_search
-- (0048) merged first; this DDL is order-safe (idempotent, only depends on 0046)
-- so the index bump is mechanical.
-- Tables: service_doctor_collections, service_doctor_collection_items.

DO $$ BEGIN
  CREATE TYPE "public"."service_collection_kind" AS ENUM('editorial', 'specialty', 'region');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_doctor_collections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "name" varchar(160) NOT NULL,
  "slug" varchar(180) NOT NULL,
  "subtitle" varchar(240),
  "description" text,
  "hero_image_url" text,
  "kind" "service_collection_kind" DEFAULT 'editorial' NOT NULL,
  "specialty_id" uuid,
  "region_id" uuid,
  "is_featured" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "status" "service_publish_status" DEFAULT 'draft' NOT NULL,
  "internal_notes" text,
  "source_url" text,
  "published_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_doctor_collection_items" (
  "collection_id" uuid NOT NULL,
  "doctor_id" uuid NOT NULL,
  "rank" integer DEFAULT 0 NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "service_doctor_collection_items_collection_id_doctor_id_pk" PRIMARY KEY("collection_id","doctor_id")
);--> statement-breakpoint

-- Foreign keys -------------------------------------------------------------
DO $$ BEGIN
 ALTER TABLE "service_doctor_collections" ADD CONSTRAINT "service_doctor_collections_specialty_id_fk" FOREIGN KEY ("specialty_id") REFERENCES "public"."service_specialties"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_doctor_collections" ADD CONSTRAINT "service_doctor_collections_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."service_regions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_doctor_collections" ADD CONSTRAINT "service_doctor_collections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_doctor_collections" ADD CONSTRAINT "service_doctor_collections_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_doctor_collection_items" ADD CONSTRAINT "service_doctor_collection_items_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."service_doctor_collections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_doctor_collection_items" ADD CONSTRAINT "service_doctor_collection_items_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."service_doctors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- Indexes ------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "uq_service_doctor_collections_slug" ON "service_doctor_collections" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_doctor_collections_status_featured_sort" ON "service_doctor_collections" ("status","is_featured","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_doctor_collections_status_kind" ON "service_doctor_collections" ("status","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_doctor_collections_specialty" ON "service_doctor_collections" ("specialty_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_doctor_collections_updated_at" ON "service_doctor_collections" ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doctor_collection_items_collection_rank" ON "service_doctor_collection_items" ("collection_id","rank");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doctor_collection_items_doctor" ON "service_doctor_collection_items" ("doctor_id");

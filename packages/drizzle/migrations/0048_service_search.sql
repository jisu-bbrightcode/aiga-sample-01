-- PB-DATA-FR003 (BBR-521) — AIGA 통합검색: unified search over the service domain.
-- Idempotent, hand-authored (matches the 0046 style) to avoid drizzle-kit
-- snapshot drift. Builds on 0046_service_domain (의사/병원 큐레이션 hub).
-- Tables: service_search_documents (unified projection w/ generated tsvector),
--         service_search_synonyms, service_search_queries.
--
-- NOTE: renumbered 0047→0048 on rebase (sibling 0047_user_grade merged first).
-- Tables are independent and the SQL is idempotent, so ordering is unaffected.

-- pg_trgm powers substring / typo-tolerant autocomplete on titles (Korean has
-- no bundled FTS dictionary, so the tsvector uses the 'simple' config).
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."service_search_entity_type" AS ENUM('doctor', 'hospital', 'specialty', 'region');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_search_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "entity_type" "service_search_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "title" varchar(200) NOT NULL,
  "subtitle" varchar(300),
  "slug" varchar(200) NOT NULL,
  "photo_url" text,
  "region_id" uuid,
  "specialty_id" uuid,
  "rating_avg" double precision DEFAULT 0 NOT NULL,
  "body" text,
  "keywords" text,
  "weight" integer DEFAULT 0 NOT NULL,
  "is_published" boolean DEFAULT true NOT NULL,
  "source_updated_at" timestamp with time zone,
  "search_vector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("subtitle", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("keywords", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("body", '')), 'C')
  ) STORED
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_search_synonyms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "term" varchar(100) NOT NULL,
  "expansions" text[] DEFAULT '{}' NOT NULL,
  "specialty_id" uuid,
  "is_active" boolean DEFAULT true NOT NULL,
  "notes" text
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_search_queries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "raw_query" varchar(300) NOT NULL,
  "normalized_query" varchar(300) NOT NULL,
  "user_id" text,
  "entity_type" "service_search_entity_type",
  "region_id" uuid,
  "specialty_id" uuid,
  "result_count" integer DEFAULT 0 NOT NULL,
  "clicked_entity_type" "service_search_entity_type",
  "clicked_entity_id" uuid
);--> statement-breakpoint

-- Foreign keys -------------------------------------------------------------
DO $$ BEGIN
 ALTER TABLE "service_search_queries" ADD CONSTRAINT "service_search_queries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- Indexes ------------------------------------------------------------------
-- service_search_documents
CREATE UNIQUE INDEX IF NOT EXISTS "uq_service_search_documents_entity" ON "service_search_documents" ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_search_documents_pub_type" ON "service_search_documents" ("is_published","entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_search_documents_region" ON "service_search_documents" ("region_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_search_documents_specialty" ON "service_search_documents" ("specialty_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_search_documents_pub_weight" ON "service_search_documents" ("is_published","weight");--> statement-breakpoint
-- full-text ranking (weighted tsvector) + substring/typo autocomplete on title
CREATE INDEX IF NOT EXISTS "idx_service_search_documents_vector" ON "service_search_documents" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_search_documents_title_trgm" ON "service_search_documents" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
-- service_search_synonyms
CREATE UNIQUE INDEX IF NOT EXISTS "uq_service_search_synonyms_term" ON "service_search_synonyms" ("term");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_search_synonyms_active" ON "service_search_synonyms" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_search_synonyms_expansions" ON "service_search_synonyms" USING gin ("expansions");--> statement-breakpoint
-- service_search_queries
CREATE INDEX IF NOT EXISTS "idx_service_search_queries_norm_created" ON "service_search_queries" ("normalized_query","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_search_queries_user_created" ON "service_search_queries" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_search_queries_result_count" ON "service_search_queries" ("result_count");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_search_queries_created" ON "service_search_queries" ("created_at");

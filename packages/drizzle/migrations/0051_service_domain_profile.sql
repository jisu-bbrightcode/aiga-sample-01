-- FR-005 의사 프로필 (BBR-523) + FR-006 병원 상세 (REUSE→FR-005).
-- EXTENDs the PB-DATA-001 (0046) service-domain core hub with profile-detail
-- and hospital-detail tables. Idempotent, hand-authored to match 0046 style.
-- Tables: service_doctor_credentials, service_hospital_specialties,
--         service_hospital_hours.

DO $$ BEGIN
  CREATE TYPE "public"."service_doctor_credential_kind" AS ENUM('education', 'career', 'certification', 'award');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_doctor_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "doctor_id" uuid NOT NULL,
  "kind" "service_doctor_credential_kind" NOT NULL,
  "title" varchar(200) NOT NULL,
  "organization" varchar(200),
  "start_year" integer,
  "end_year" integer,
  "display_period" varchar(80),
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_visible" boolean DEFAULT true NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_hospital_specialties" (
  "hospital_id" uuid NOT NULL,
  "specialty_id" uuid NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "service_hospital_specialties_hospital_id_specialty_id_pk" PRIMARY KEY("hospital_id","specialty_id")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "service_hospital_hours" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "hospital_id" uuid NOT NULL,
  "day_of_week" integer NOT NULL,
  "opens_at" varchar(5),
  "closes_at" varchar(5),
  "is_closed" boolean DEFAULT false NOT NULL,
  "note" varchar(120)
);--> statement-breakpoint

-- Foreign keys -------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE "service_doctor_credentials"
    ADD CONSTRAINT "service_doctor_credentials_doctor_id_service_doctors_id_fk"
    FOREIGN KEY ("doctor_id") REFERENCES "public"."service_doctors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "service_hospital_specialties"
    ADD CONSTRAINT "service_hospital_specialties_hospital_id_service_hospitals_id_fk"
    FOREIGN KEY ("hospital_id") REFERENCES "public"."service_hospitals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "service_hospital_specialties"
    ADD CONSTRAINT "service_hospital_specialties_specialty_id_service_specialties_id_fk"
    FOREIGN KEY ("specialty_id") REFERENCES "public"."service_specialties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "service_hospital_hours"
    ADD CONSTRAINT "service_hospital_hours_hospital_id_service_hospitals_id_fk"
    FOREIGN KEY ("hospital_id") REFERENCES "public"."service_hospitals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Indexes ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_doctor_credentials_doctor_kind_order" ON "service_doctor_credentials" ("doctor_id","kind","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doctor_credentials_doctor_visible" ON "service_doctor_credentials" ("doctor_id","is_visible");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hospital_specialties_hospital_order" ON "service_hospital_specialties" ("hospital_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hospital_specialties_specialty" ON "service_hospital_specialties" ("specialty_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_hospital_hours_hospital_day" ON "service_hospital_hours" ("hospital_id","day_of_week");

CREATE TYPE "public"."fenm_analysis_attempt_status" AS ENUM('pending', 'succeeded', 'validation_failed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."fenm_analysis_job_status" AS ENUM('candidate', 'pending', 'ready', 'validation_failed', 'failed', 'accepted', 'ignored', 'superseded', 'stale');--> statement-breakpoint
CREATE TABLE "fenm_analysis_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"status" "fenm_analysis_attempt_status" DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"model_id" text,
	"model_version" text,
	"prompt_version" text,
	"schema_version" text DEFAULT 'fenm-1' NOT NULL,
	"request" jsonb NOT NULL,
	"response" jsonb,
	"error" jsonb,
	"latency_ms" integer,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fenm_analysis_attempts_attempt_no_check" CHECK ("fenm_analysis_attempts"."attempt_no" >= 1),
	CONSTRAINT "fenm_analysis_attempts_latency_ms_check" CHECK ("fenm_analysis_attempts"."latency_ms" IS NULL OR "fenm_analysis_attempts"."latency_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "fenm_analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text,
	"project_id" uuid,
	"story_id" text,
	"scene_id" text,
	"scope" text NOT NULL,
	"status" "fenm_analysis_job_status" DEFAULT 'candidate' NOT NULL,
	"source_locale" text NOT NULL,
	"output_reason_locale" text NOT NULL,
	"source_content_hash" text NOT NULL,
	"context_hash" text NOT NULL,
	"input_contract_version" text DEFAULT 'fenm-input-001' NOT NULL,
	"schema_version" text DEFAULT 'fenm-1' NOT NULL,
	"input" jsonb NOT NULL,
	"analysis_output" jsonb,
	"analysis_suggestion" jsonb,
	"validation_errors" jsonb,
	"error_code" text,
	"error_message" text,
	"accepted_at" timestamp with time zone,
	"ignored_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fenm_analysis_attempts" ADD CONSTRAINT "fenm_analysis_attempts_job_id_fenm_analysis_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."fenm_analysis_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenm_analysis_jobs" ADD CONSTRAINT "fenm_analysis_jobs_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fenm_analysis_attempts_job_idx" ON "fenm_analysis_attempts" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "fenm_analysis_jobs_project_status_idx" ON "fenm_analysis_jobs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "fenm_analysis_jobs_scene_scope_idx" ON "fenm_analysis_jobs" USING btree ("scene_id","scope");--> statement-breakpoint
CREATE INDEX "fenm_analysis_jobs_source_context_hash_idx" ON "fenm_analysis_jobs" USING btree ("source_content_hash","context_hash");
CREATE TYPE "public"."illustration_status" AS ENUM('active', 'removed', 'under_review');--> statement-breakpoint
CREATE TYPE "public"."illustration_reference_owner_type" AS ENUM('project_style', 'character');--> statement-breakpoint
CREATE TYPE "public"."illustration_request_status" AS ENUM('queued', 'processing', 'completed', 'failed', 'safety_blocked', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."generation_attempt_status" AS ENUM('pending', 'generated', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."illustration_variant_source" AS ENUM('manual', 'auto', 'edited');--> statement-breakpoint
CREATE TYPE "public"."illustration_variant_status" AS ENUM('pending', 'generated', 'failed');--> statement-breakpoint
CREATE TYPE "public"."moderation_log_action" AS ENUM('allowed', 'blocked', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."moderation_log_source" AS ENUM('input', 'output', 'ref_image', 'scene_brief');--> statement-breakpoint
CREATE TYPE "public"."usage_event_kind" AS ENUM('image_generation', 'llm_call');--> statement-breakpoint
CREATE TABLE "illustration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"current_request_id" uuid,
	"selected_variant_id" uuid,
	"width" integer,
	"height" integer,
	"aspect_ratio" numeric,
	"locale" text NOT NULL,
	"status" "illustration_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "illustration_project_style_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"prompt_prefix" text NOT NULL,
	"prompt_prefix_validated_at" timestamp with time zone,
	"is_active" boolean DEFAULT false NOT NULL,
	"locale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "illustration_character" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "illustration_reference_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "illustration_reference_owner_type" NOT NULL,
	"owner_id" uuid NOT NULL,
	"blob_url" text NOT NULL,
	"blob_key" text NOT NULL,
	"mime" text NOT NULL,
	"width" integer,
	"height" integer,
	"role" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"mime_validated" boolean DEFAULT false NOT NULL,
	"exif_stripped" boolean DEFAULT false NOT NULL,
	"nsfw_score" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "illustration_reference_image_sort_order_check" CHECK ("illustration_reference_image"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "illustration_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"illustration_id" uuid,
	"project_id" uuid NOT NULL,
	"requested_by" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"scene_text" text NOT NULL,
	"scene_brief" jsonb,
	"scene_brief_version" integer DEFAULT 1 NOT NULL,
	"user_prompt" text,
	"variant_count" integer DEFAULT 1 NOT NULL,
	"requested_locale" text NOT NULL,
	"prompt_prefix_snapshot" text,
	"style_ref_keys" text[],
	"character_refs_snapshot" jsonb,
	"provider" text,
	"model" text,
	"model_version" text,
	"status" "illustration_request_status" DEFAULT 'queued' NOT NULL,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "illustration_request_variant_count_check" CHECK ("illustration_request"."variant_count" >= 1 AND "illustration_request"."variant_count" <= 4)
);
--> statement-breakpoint
CREATE TABLE "illustration_request_character" (
	"request_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	CONSTRAINT "illustration_request_character_request_id_character_id_pk" PRIMARY KEY("request_id","character_id")
);
--> statement-breakpoint
CREATE TABLE "generation_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"variant_index" integer NOT NULL,
	"attempt_no" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"model_version" text,
	"provider_request_id" text,
	"status" "generation_attempt_status" DEFAULT 'pending' NOT NULL,
	"finish_reason" text,
	"latency_ms" integer,
	"billable_units" integer,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "generation_attempt_attempt_no_check" CHECK ("generation_attempt"."attempt_no" >= 1 AND "generation_attempt"."attempt_no" <= 10),
	CONSTRAINT "generation_attempt_variant_index_check" CHECK ("generation_attempt"."variant_index" >= 0),
	CONSTRAINT "generation_attempt_billable_units_check" CHECK ("generation_attempt"."billable_units" IS NULL OR "generation_attempt"."billable_units" >= 0),
	CONSTRAINT "generation_attempt_latency_ms_check" CHECK ("generation_attempt"."latency_ms" IS NULL OR "generation_attempt"."latency_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "illustration_variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"illustration_id" uuid,
	"index" integer NOT NULL,
	"parent_variant_id" uuid,
	"status" "illustration_variant_status" DEFAULT 'pending' NOT NULL,
	"blob_url" text,
	"blob_key" text,
	"blob_temp_key" text,
	"mime" text,
	"width" integer,
	"height" integer,
	"seed" text,
	"model_params" jsonb,
	"provider" text,
	"model" text,
	"model_version" text,
	"selected" boolean DEFAULT false NOT NULL,
	"frozen" boolean DEFAULT false NOT NULL,
	"caption" text,
	"caption_source" "illustration_variant_source",
	"alt_text" text,
	"alt_source" "illustration_variant_source",
	"edited_by" text,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "illustration_variant_index_check" CHECK ("illustration_variant"."index" >= 0)
);
--> statement-breakpoint
CREATE TABLE "illustration_moderation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"variant_id" uuid,
	"reference_image_id" uuid,
	"source" "moderation_log_source" NOT NULL,
	"provider_raw_code" text,
	"provider_raw_message" text,
	"classifier_score" numeric,
	"action" "moderation_log_action" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_log_xor_check" CHECK ((
        (CASE WHEN "illustration_moderation_log"."request_id" IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN "illustration_moderation_log"."variant_id" IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN "illustration_moderation_log"."reference_image_id" IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1)
);
--> statement-breakpoint
CREATE TABLE "illustration_usage_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"kind" "usage_event_kind" NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"request_id" uuid,
	"variant_id" uuid,
	"attempt_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"model_version" text,
	"units" integer NOT NULL,
	"cost_estimate_usd" numeric(10, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "illustration_usage_event_units_check" CHECK ("illustration_usage_event"."units" >= 0)
);
--> statement-breakpoint
CREATE TABLE "illustration_rate_limit_counter" (
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"image_calls_in_window" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "illustration_rate_limit_counter_user_id_project_id_window_start_pk" PRIMARY KEY("user_id","project_id","window_start"),
	CONSTRAINT "illustration_rate_limit_counter_image_calls_check" CHECK ("illustration_rate_limit_counter"."image_calls_in_window" >= 0)
);
--> statement-breakpoint
ALTER TABLE "illustration" ADD CONSTRAINT "illustration_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration" ADD CONSTRAINT "illustration_current_request_id_illustration_request_id_fk" FOREIGN KEY ("current_request_id") REFERENCES "public"."illustration_request"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration" ADD CONSTRAINT "illustration_selected_variant_id_illustration_variant_id_fk" FOREIGN KEY ("selected_variant_id") REFERENCES "public"."illustration_variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_project_style_profile" ADD CONSTRAINT "illustration_project_style_profile_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_character" ADD CONSTRAINT "illustration_character_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_request" ADD CONSTRAINT "illustration_request_illustration_id_illustration_id_fk" FOREIGN KEY ("illustration_id") REFERENCES "public"."illustration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_request" ADD CONSTRAINT "illustration_request_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_request" ADD CONSTRAINT "illustration_request_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_request_character" ADD CONSTRAINT "illustration_request_character_request_id_illustration_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."illustration_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_request_character" ADD CONSTRAINT "illustration_request_character_character_id_illustration_character_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."illustration_character"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_attempt" ADD CONSTRAINT "generation_attempt_request_id_illustration_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."illustration_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_variant" ADD CONSTRAINT "illustration_variant_request_id_illustration_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."illustration_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_variant" ADD CONSTRAINT "illustration_variant_attempt_id_generation_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."generation_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_variant" ADD CONSTRAINT "illustration_variant_illustration_id_illustration_id_fk" FOREIGN KEY ("illustration_id") REFERENCES "public"."illustration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_variant" ADD CONSTRAINT "illustration_variant_parent_variant_id_illustration_variant_id_fk" FOREIGN KEY ("parent_variant_id") REFERENCES "public"."illustration_variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_variant" ADD CONSTRAINT "illustration_variant_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_variant" ADD CONSTRAINT "illustration_variant_attempt_request_fk" FOREIGN KEY ("attempt_id","request_id") REFERENCES "public"."generation_attempt"("id","request_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_moderation_log" ADD CONSTRAINT "illustration_moderation_log_request_id_illustration_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."illustration_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_moderation_log" ADD CONSTRAINT "illustration_moderation_log_variant_id_illustration_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."illustration_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_moderation_log" ADD CONSTRAINT "illustration_moderation_log_reference_image_id_illustration_reference_image_id_fk" FOREIGN KEY ("reference_image_id") REFERENCES "public"."illustration_reference_image"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_usage_event" ADD CONSTRAINT "illustration_usage_event_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_usage_event" ADD CONSTRAINT "illustration_usage_event_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_usage_event" ADD CONSTRAINT "illustration_usage_event_request_id_illustration_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."illustration_request"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_usage_event" ADD CONSTRAINT "illustration_usage_event_variant_id_illustration_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."illustration_variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_usage_event" ADD CONSTRAINT "illustration_usage_event_attempt_id_generation_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."generation_attempt"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_rate_limit_counter" ADD CONSTRAINT "illustration_rate_limit_counter_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration_rate_limit_counter" ADD CONSTRAINT "illustration_rate_limit_counter_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "illustration_project_style_active_uniq" ON "illustration_project_style_profile" USING btree ("project_id") WHERE "illustration_project_style_profile"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "illustration_request_idempotency_key_uniq" ON "illustration_request" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "illustration_request_illustration_id_id_uniq" ON "illustration_request" USING btree ("illustration_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_attempt_idempotency_key_uniq" ON "generation_attempt" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_attempt_request_variant_attempt_uniq" ON "generation_attempt" USING btree ("request_id","variant_index","attempt_no");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_attempt_id_request_uniq" ON "generation_attempt" USING btree ("id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "illustration_variant_request_index_uniq" ON "illustration_variant" USING btree ("request_id","index");--> statement-breakpoint
CREATE UNIQUE INDEX "illustration_variant_selected_uniq" ON "illustration_variant" USING btree ("illustration_id") WHERE "illustration_variant"."selected" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "illustration_variant_illustration_id_id_uniq" ON "illustration_variant" USING btree ("illustration_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "illustration_usage_event_idempotency_key_uniq" ON "illustration_usage_event" USING btree ("idempotency_key");
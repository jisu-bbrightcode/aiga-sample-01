CREATE TYPE "public"."video_lecture_entitlement" AS ENUM('none', 'login', 'purchase', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."video_lecture_event_type" AS ENUM('upload_created', 'webhook_processing', 'webhook_ready', 'webhook_failed', 'metadata_updated', 'archive_requested', 'delete_requested', 'playback_issued', 'progress_updated');--> statement-breakpoint
CREATE TYPE "public"."video_lecture_provider" AS ENUM('cloudflare_stream');--> statement-breakpoint
CREATE TYPE "public"."video_lecture_status" AS ENUM('pending', 'uploading', 'processing', 'ready', 'failed', 'archived', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."video_lecture_visibility" AS ENUM('public', 'preview', 'protected', 'private');--> statement-breakpoint
CREATE TABLE "video_admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"asset_id" uuid,
	"actor_id" text,
	"action" text NOT NULL,
	"result" text NOT NULL,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "video_asset_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"asset_id" uuid,
	"provider_asset_id" text NOT NULL,
	"event_type" "video_lecture_event_type" NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text
);
--> statement-breakpoint
CREATE TABLE "video_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lesson_id" uuid,
	"provider" "video_lecture_provider" DEFAULT 'cloudflare_stream' NOT NULL,
	"provider_asset_id" text NOT NULL,
	"playback_uid" text,
	"upload_method" text NOT NULL,
	"upload_url" text,
	"upload_expires_at" timestamp with time zone,
	"status" "video_lecture_status" DEFAULT 'pending' NOT NULL,
	"ready_to_stream" boolean DEFAULT false NOT NULL,
	"duration_seconds" integer,
	"thumbnail_url" text,
	"captions_state" text DEFAULT 'none' NOT NULL,
	"visibility" "video_lecture_visibility" DEFAULT 'protected' NOT NULL,
	"entitlement_requirement" "video_lecture_entitlement" DEFAULT 'purchase' NOT NULL,
	"require_signed_urls" boolean DEFAULT true NOT NULL,
	"uploaded_by_id" text,
	"processing_error_code" text,
	"processing_error_message" text,
	"provider_payload" jsonb,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "video_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"thumbnail_url" text,
	"visibility" "video_lecture_visibility" DEFAULT 'public' NOT NULL,
	"entitlement_requirement" "video_lecture_entitlement" DEFAULT 'none' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_entitlement_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"course_id" uuid,
	"lesson_id" uuid,
	"requirement" "video_lecture_entitlement" DEFAULT 'purchase' NOT NULL,
	"external_product_id" text,
	"external_plan_id" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer,
	"thumbnail_url" text,
	"visibility" "video_lecture_visibility" DEFAULT 'protected' NOT NULL,
	"entitlement_requirement" "video_lecture_entitlement" DEFAULT 'purchase' NOT NULL,
	"free_preview_seconds" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_playback_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"asset_id" uuid NOT NULL,
	"lesson_id" uuid,
	"user_id" text,
	"policy" "video_lecture_entitlement" DEFAULT 'login' NOT NULL,
	"token_expires_at" timestamp with time zone,
	"issued_token_hash" text
);
--> statement-breakpoint
CREATE TABLE "video_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"watched_seconds" integer DEFAULT 0 NOT NULL,
	"total_seconds" integer DEFAULT 0 NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"last_position_seconds" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"watched_segments" jsonb
);
--> statement-breakpoint
ALTER TABLE "character_actors" ALTER COLUMN "model_provider" SET DEFAULT 'gateway';--> statement-breakpoint
ALTER TABLE "character_actors" ALTER COLUMN "model_name" SET DEFAULT 'openai/gpt-4o-mini';--> statement-breakpoint
ALTER TABLE "video_admin_actions" ADD CONSTRAINT "video_admin_actions_asset_id_video_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."video_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_admin_actions" ADD CONSTRAINT "video_admin_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_asset_events" ADD CONSTRAINT "video_asset_events_asset_id_video_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."video_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_asset_events" ADD CONSTRAINT "video_asset_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_lesson_id_video_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."video_lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_entitlement_rules" ADD CONSTRAINT "video_entitlement_rules_course_id_video_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."video_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_entitlement_rules" ADD CONSTRAINT "video_entitlement_rules_lesson_id_video_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."video_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_lessons" ADD CONSTRAINT "video_lessons_course_id_video_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."video_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_playback_sessions" ADD CONSTRAINT "video_playback_sessions_asset_id_video_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."video_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_playback_sessions" ADD CONSTRAINT "video_playback_sessions_lesson_id_video_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."video_lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_playback_sessions" ADD CONSTRAINT "video_playback_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_lesson_id_video_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."video_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "video_asset_events_idempotency_unique" ON "video_asset_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "video_assets_provider_asset_unique" ON "video_assets" USING btree ("provider","provider_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_courses_slug_unique" ON "video_courses" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "video_progress_lesson_user_unique" ON "video_progress" USING btree ("lesson_id","user_id");

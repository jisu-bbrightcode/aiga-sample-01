CREATE TYPE "public"."character_actor_status" AS ENUM('not_enabled', 'preparing', 'ready', 'failed', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."character_chat_message_role" AS ENUM('user', 'assistant', 'system', 'tool');--> statement-breakpoint
CREATE TYPE "public"."character_chat_message_status" AS ENUM('pending', 'streaming', 'completed', 'failed', 'interrupted');--> statement-breakpoint
CREATE TABLE "character_actor_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"actor_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"persona_summary" text,
	"speech_style" text,
	"background_summary" text,
	"relation_summary" text,
	"world_context_summary" text,
	"tool_scope" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"safety_rules" text,
	"model_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "character_actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"project_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"created_by_user_id" text NOT NULL,
	"status" character_actor_status DEFAULT 'not_enabled' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"display_name" varchar(200),
	"model_provider" varchar(50) DEFAULT 'anthropic' NOT NULL,
	"model_name" varchar(100) DEFAULT 'claude-3-5-haiku-20241022' NOT NULL,
	"allowed_context_scope" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"safety_rules" text,
	"tool_scope" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"snapshot_version" uuid,
	"source_updated_at" timestamp with time zone,
	"greeting_message_id" uuid,
	"disabled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "character_chat_list_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"hidden_at" timestamp with time zone,
	"pinned_at" timestamp with time zone,
	"last_opened_thread_id" uuid
);
--> statement-breakpoint
CREATE TABLE "character_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" character_chat_message_role NOT NULL,
	"status" character_chat_message_status DEFAULT 'pending' NOT NULL,
	"content" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"token_usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider_request_id" varchar(200),
	"model_provider" varchar(50),
	"model_name" varchar(100),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "character_chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"project_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(300),
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "character_actor_snapshots" ADD CONSTRAINT "character_actor_snapshots_actor_id_character_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."character_actors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_actor_snapshots" ADD CONSTRAINT "character_actor_snapshots_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_actor_snapshots" ADD CONSTRAINT "character_actor_snapshots_character_id_story_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."story_characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_actors" ADD CONSTRAINT "character_actors_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_actors" ADD CONSTRAINT "character_actors_character_id_story_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."story_characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_actors" ADD CONSTRAINT "character_actors_created_by_user_id_profiles_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_chat_list_preferences" ADD CONSTRAINT "character_chat_list_preferences_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_chat_list_preferences" ADD CONSTRAINT "character_chat_list_preferences_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_chat_list_preferences" ADD CONSTRAINT "character_chat_list_preferences_actor_id_character_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."character_actors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_chat_messages" ADD CONSTRAINT "character_chat_messages_thread_id_character_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."character_chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_chat_threads" ADD CONSTRAINT "character_chat_threads_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_chat_threads" ADD CONSTRAINT "character_chat_threads_character_id_story_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."story_characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_chat_threads" ADD CONSTRAINT "character_chat_threads_actor_id_character_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."character_actors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_chat_threads" ADD CONSTRAINT "character_chat_threads_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;

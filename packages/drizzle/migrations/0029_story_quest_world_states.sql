-- 2026-05-11 — CRPG Quest Authoring MVP world state foundation.
--
-- World State is the user-facing state variable layer for later quest
-- conditions, objective progress, journal state, and playtest runtime checks.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'story_quest_world_state_value_kind'
  ) THEN
    CREATE TYPE "story_quest_world_state_value_kind" AS ENUM (
      'boolean',
      'number',
      'text',
      'option'
    );
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_quest_world_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "project_id" uuid NOT NULL,
  "owner_id" text NOT NULL,
  "name" varchar(200) NOT NULL,
  "key" varchar(160) NOT NULL,
  "description" text,
  "value_kind" "story_quest_world_state_value_kind" NOT NULL,
  "initial_value" jsonb NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "story_quest_world_states_project_id_project_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "story_quest_world_states_owner_id_profiles_id_fk"
    FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id")
    ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "story_quest_world_states_project_key_active_uniq"
  ON "story_quest_world_states" ("project_id", "key")
  WHERE "is_deleted" = false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_quest_world_state_options" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "world_state_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "label" varchar(120) NOT NULL,
  "value" varchar(160) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "story_quest_world_state_options_world_state_id_story_quest_world_states_id_fk"
    FOREIGN KEY ("world_state_id") REFERENCES "public"."story_quest_world_states"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "story_quest_world_state_options_project_id_project_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id")
    ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "story_quest_world_state_options_state_value_active_uniq"
  ON "story_quest_world_state_options" ("world_state_id", "value")
  WHERE "is_deleted" = false;

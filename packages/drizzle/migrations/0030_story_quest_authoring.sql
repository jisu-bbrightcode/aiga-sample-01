-- 2026-05-11 — CRPG Quest, Objective, and Journal authoring rows.
--
-- These rows are kept outside the story graph blob so Quest authoring can be
-- searched, restored, linked, and later compiled into playtest state.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'story_quest_type') THEN
    CREATE TYPE "story_quest_type" AS ENUM ('main', 'side', 'companion', 'faction', 'custom');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'story_quest_design_status') THEN
    CREATE TYPE "story_quest_design_status" AS ENUM ('draft', 'review', 'ready');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'story_quest_priority') THEN
    CREATE TYPE "story_quest_priority" AS ENUM ('low', 'normal', 'high');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'story_quest_activation_mode') THEN
    CREATE TYPE "story_quest_activation_mode" AS ENUM ('manual', 'condition');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'story_quest_completion_mode') THEN
    CREATE TYPE "story_quest_completion_mode" AS ENUM (
      'allObjectives',
      'specificObjective',
      'manual'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'story_quest_objective_initial_state') THEN
    CREATE TYPE "story_quest_objective_initial_state" AS ENUM ('hidden', 'active');
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_quests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "project_id" uuid NOT NULL,
  "owner_id" text NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "body" jsonb,
  "design_status" "story_quest_design_status" DEFAULT 'draft' NOT NULL,
  "quest_type" "story_quest_type" DEFAULT 'side' NOT NULL,
  "priority" "story_quest_priority" DEFAULT 'normal' NOT NULL,
  "activation_mode" "story_quest_activation_mode" DEFAULT 'manual' NOT NULL,
  "start_condition" jsonb,
  "completion_mode" "story_quest_completion_mode" DEFAULT 'allObjectives' NOT NULL,
  "completion_objective_id" uuid,
  "sort_order" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "story_quests_project_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "story_quests_owner_fk"
    FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id")
    ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_objectives" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "project_id" uuid NOT NULL,
  "quest_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "initial_state" "story_quest_objective_initial_state" DEFAULT 'active' NOT NULL,
  "reveal_condition" jsonb,
  "complete_condition" jsonb,
  "fail_condition" jsonb,
  CONSTRAINT "story_objectives_project_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "story_objectives_quest_fk"
    FOREIGN KEY ("quest_id") REFERENCES "public"."story_quests"("id")
    ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_journal_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "project_id" uuid NOT NULL,
  "quest_id" uuid NOT NULL,
  "objective_id" uuid,
  "title" text,
  "body" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "reveal_condition" jsonb,
  CONSTRAINT "story_journal_entries_project_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "story_journal_entries_quest_fk"
    FOREIGN KEY ("quest_id") REFERENCES "public"."story_quests"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "story_journal_entries_objective_fk"
    FOREIGN KEY ("objective_id") REFERENCES "public"."story_objectives"("id")
    ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_quests_project_active_idx"
  ON "story_quests" ("project_id", "owner_id")
  WHERE "is_deleted" = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_objectives_quest_active_idx"
  ON "story_objectives" ("quest_id", "sort_order")
  WHERE "is_deleted" = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_journal_entries_quest_active_idx"
  ON "story_journal_entries" ("quest_id", "sort_order")
  WHERE "is_deleted" = false;

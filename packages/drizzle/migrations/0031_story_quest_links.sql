-- 2026-05-11 — Quest/Objectives can be linked to Story Canvas scene/document nodes.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'story_quest_link_target_type') THEN
    CREATE TYPE "story_quest_link_target_type" AS ENUM ('scene', 'document');
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_quest_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "project_id" uuid NOT NULL,
  "owner_id" text NOT NULL,
  "quest_id" uuid NOT NULL,
  "objective_id" uuid,
  "target_node_id" text NOT NULL,
  "target_node_type" "story_quest_link_target_type" DEFAULT 'scene' NOT NULL,
  "label" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "story_quest_links_project_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "story_quest_links_owner_fk"
    FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "story_quest_links_quest_fk"
    FOREIGN KEY ("quest_id") REFERENCES "public"."story_quests"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "story_quest_links_objective_fk"
    FOREIGN KEY ("objective_id") REFERENCES "public"."story_objectives"("id")
    ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_quest_links_project_active_idx"
  ON "story_quest_links" ("project_id", "owner_id")
  WHERE "is_deleted" = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_quest_links_quest_active_idx"
  ON "story_quest_links" ("quest_id", "sort_order")
  WHERE "is_deleted" = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_quest_links_target_active_idx"
  ON "story_quest_links" ("project_id", "target_node_id")
  WHERE "is_deleted" = false;

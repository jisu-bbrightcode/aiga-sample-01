-- 2026-05-04 — project-scope story_entity_tags.
--
-- Electric authenticated shape proxy requires every synced story table to be
-- project-filterable. story_entity_tags used to infer scope through tag_id,
-- which prevented secure per-project Electric shapes. Backfill from story_tags
-- first, then enforce NOT NULL + project FK.

ALTER TABLE "story_entity_tags" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint
UPDATE "story_entity_tags" et
SET "project_id" = t."project_id"
FROM "story_tags" t
WHERE et."tag_id" = t."id"
  AND et."project_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "story_entity_tags" ALTER COLUMN "project_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "story_entity_tags"
  ADD CONSTRAINT "story_entity_tags_project_id_project_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id")
  ON DELETE cascade ON UPDATE no action;

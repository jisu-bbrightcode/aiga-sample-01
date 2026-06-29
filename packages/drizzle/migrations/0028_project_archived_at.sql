-- Project archive timestamp
--
-- `deleted_at` remains reserved for soft-delete semantics. Project archive
-- state is tracked separately so archive and permanent deletion can be wired
-- as distinct product actions.

ALTER TABLE "project_projects" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "project_projects"
SET "archived_at" = COALESCE("archived_at", "deleted_at")
WHERE "status" = 'archived'
   OR ("is_deleted" = true AND "deleted_at" IS NOT NULL);
--> statement-breakpoint
UPDATE "project_projects"
SET
  "status" = 'archived',
  "is_deleted" = false,
  "deleted_at" = NULL
WHERE "archived_at" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_projects_org_owner_active_idx"
  ON "project_projects" ("organization_id", "owner_id")
  WHERE "is_deleted" = false AND "archived_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_projects_org_owner_archived_idx"
  ON "project_projects" ("organization_id", "owner_id")
  WHERE "is_deleted" = false AND "archived_at" IS NOT NULL;

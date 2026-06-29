-- Project workspace scope
--
-- Project rows previously only carried owner_id, so the same owner saw every
-- project in every active workspace. New writes persist organization_id from
-- the active Better Auth session; reads filter by that same active workspace.
--
-- cover_image catch-up: 0026_project_cover_image.sql exists as a manual SQL
-- file but is not present in the Drizzle journal in some checkouts. Keep this
-- idempotent so deploy migrators converge before project queries select it.

ALTER TABLE "project_projects" ADD COLUMN IF NOT EXISTS "cover_image" text;
--> statement-breakpoint
ALTER TABLE "project_projects" ADD COLUMN IF NOT EXISTS "organization_id" text;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "project_projects" ADD CONSTRAINT "project_projects_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id")
    REFERENCES "public"."organizations"("id")
    ON DELETE cascade
    ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
UPDATE "project_projects" p
SET "organization_id" = owner_org."organization_id"
FROM (
  SELECT DISTINCT ON ("user_id")
    "user_id",
    "organization_id"
  FROM "members"
  ORDER BY "user_id", "created_at" ASC, "organization_id" ASC
) owner_org
WHERE p."organization_id" IS NULL
  AND p."owner_id" = owner_org."user_id";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_projects_org_owner_idx"
  ON "project_projects" ("organization_id", "owner_id")
  WHERE "is_deleted" = false;

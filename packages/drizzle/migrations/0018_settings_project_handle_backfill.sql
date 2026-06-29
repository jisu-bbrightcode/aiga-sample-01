-- Settings redesign Phase 4 follow-up (Codex P1 B6)
-- Backfill project_projects.handle for existing rows so the read-only URL
-- `product-builder.app/{org}/{handle}` resolves to a stable slug + 6-char id suffix
-- and is never NULL after this migration.
--
-- The formula:
--   slug = LEFT(slugified(name), 32)  (lowercase, [^a-z0-9] → '-', trimmed)
--   suffix = first 6 chars of id::text
--   handle = slug || '-' || suffix
--
-- Adds a partial unique index on (owner_id, handle) so two projects from the
-- same owner can't collide.

UPDATE "project_projects"
SET "handle" = (
  LEFT(
    regexp_replace(
      regexp_replace(LOWER("name"), '[^a-z0-9]+', '-', 'g'),
      '^-+|-+$', '', 'g'
    ),
    32
  )
  || '-' || SUBSTRING("id"::text FROM 1 FOR 6)
)
WHERE "handle" IS NULL OR "handle" = '';

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_projects_owner_handle_idx"
  ON "project_projects" ("owner_id", "handle")
  WHERE "is_deleted" = false;

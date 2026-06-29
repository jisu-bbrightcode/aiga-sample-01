-- Project list redesign — per-project cover artwork.
-- text column (no length cap) so it can hold either a path
-- ("/patterns/pattern-04.jpg") or a data: URL (base64 for direct upload).
ALTER TABLE "project_projects" ADD COLUMN "cover_image" text;

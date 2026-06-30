-- PB-FILE-API-UPDATE-001 (BBR-552) — editable file presentation metadata.
-- EXTEND of file_assets (0050): adds the two editable metadata columns the
-- metadata-update API (PATCH /files/:id) needs and that had no home yet —
-- accessibility alt text and display sort order. Both are pure presentation
-- metadata, never the binary. Idempotent, hand-authored (repo convention).

ALTER TABLE "file_assets" ADD COLUMN IF NOT EXISTS "alt_text" text;--> statement-breakpoint
ALTER TABLE "file_assets" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;

-- 2026-05-04 — split draft management description from authored body.
--
-- description is a management-facing summary/explanation for content
-- organization. body remains the authored StoryDoc/text payload.

ALTER TABLE "story_drafts" ADD COLUMN IF NOT EXISTS "description" text;

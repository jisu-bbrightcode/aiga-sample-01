ALTER TABLE "story_characters"
  ADD COLUMN IF NOT EXISTS "roles" jsonb NOT NULL DEFAULT '[]'::jsonb;

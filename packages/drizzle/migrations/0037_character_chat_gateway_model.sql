ALTER TABLE "character_actors"
  ALTER COLUMN "model_provider" SET DEFAULT 'gateway',
  ALTER COLUMN "model_name" SET DEFAULT 'openai/gpt-4o-mini';

UPDATE "character_actors"
SET
  "model_provider" = 'gateway',
  "model_name" = 'openai/gpt-4o-mini',
  "updated_at" = NOW()
WHERE
  "deleted_at" IS NULL
  AND (
    ("model_provider" = 'anthropic' AND "model_name" = 'claude-3-5-haiku-20241022')
    OR ("model_provider" = 'openai' AND "model_name" = 'gpt-4o-mini')
  );

UPDATE "character_actor_snapshots"
SET
  "model_config" = '{"provider":"gateway","model":"openai/gpt-4o-mini"}'::jsonb,
  "updated_at" = NOW()
WHERE
  "deleted_at" IS NULL
  AND (
    "model_config" = '{"provider":"anthropic","model":"claude-3-5-haiku-20241022"}'::jsonb
    OR "model_config" = '{"provider":"openai","model":"gpt-4o-mini"}'::jsonb
  );

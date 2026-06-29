-- Drop legacy illustration generation runtime tables from Product Builder.
DROP TABLE IF EXISTS "illustration_usage_event" CASCADE;
DROP TABLE IF EXISTS "illustration_rate_limit_counter" CASCADE;
DROP TABLE IF EXISTS "illustration_moderation_log" CASCADE;
DROP TABLE IF EXISTS "illustration_variant" CASCADE;
DROP TABLE IF EXISTS "generation_attempt" CASCADE;
DROP TABLE IF EXISTS "illustration_request_character" CASCADE;
DROP TABLE IF EXISTS "illustration_request" CASCADE;
DROP TABLE IF EXISTS "illustration_reference_image" CASCADE;
DROP TABLE IF EXISTS "illustration_character" CASCADE;
DROP TABLE IF EXISTS "illustration_project_style_profile" CASCADE;
DROP TABLE IF EXISTS "illustration" CASCADE;

DROP TYPE IF EXISTS "illustration_variant_status" CASCADE;
DROP TYPE IF EXISTS "illustration_variant_source" CASCADE;
DROP TYPE IF EXISTS "illustration_request_status" CASCADE;
DROP TYPE IF EXISTS "illustration_reference_owner_type" CASCADE;
DROP TYPE IF EXISTS "illustration_status" CASCADE;

CREATE TYPE "public"."project_ai_mode" AS ENUM('ai_powered', 'ai_safety');--> statement-breakpoint
ALTER TABLE "project_projects" ADD COLUMN "ai_mode" "project_ai_mode" DEFAULT 'ai_safety' NOT NULL;
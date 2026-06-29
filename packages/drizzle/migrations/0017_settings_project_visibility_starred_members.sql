-- Settings redesign Phase 4
-- Adds project handle / visibility, project_starred, project_members,
-- story_tags.description.

CREATE TYPE "public"."project_visibility" AS ENUM('private', 'org', 'public');
--> statement-breakpoint
ALTER TABLE "project_projects" ADD COLUMN "handle" varchar(64);
--> statement-breakpoint
ALTER TABLE "project_projects" ADD COLUMN "visibility" "project_visibility" DEFAULT 'private' NOT NULL;
--> statement-breakpoint
ALTER TABLE "story_tags" ADD COLUMN "description" text;
--> statement-breakpoint
CREATE TABLE "project_starred" (
  "user_id" text NOT NULL,
  "project_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "project_starred_user_id_project_id_pk" PRIMARY KEY("user_id","project_id"),
  CONSTRAINT "project_starred_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "project_starred_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "project_members" (
  "project_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "role" varchar(32) DEFAULT 'member' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "project_members_project_id_user_id_pk" PRIMARY KEY("project_id","user_id"),
  CONSTRAINT "project_members_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "project_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action
);

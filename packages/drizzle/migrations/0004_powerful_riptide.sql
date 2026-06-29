CREATE TABLE "sync_changelog" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"table_name" varchar(100) NOT NULL,
	"row_id" uuid NOT NULL,
	"operation" varchar(10) NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by" varchar(255),
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "sync_cursors" (
	"project_id" uuid NOT NULL,
	"device_id" varchar(100) NOT NULL,
	"last_seq" bigint DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_cursors_project_id_device_id_pk" PRIMARY KEY("project_id","device_id")
);
--> statement-breakpoint
ALTER TABLE "sync_changelog" ADD CONSTRAINT "sync_changelog_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_changelog" ADD CONSTRAINT "sync_changelog_changed_by_profiles_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_cursors" ADD CONSTRAINT "sync_cursors_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade ON UPDATE no action;
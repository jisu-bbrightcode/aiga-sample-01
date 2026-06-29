ALTER TYPE "public"."auth_provider" ADD VALUE IF NOT EXISTS 'linkedin';--> statement-breakpoint
CREATE TABLE "story_graph_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(300) DEFAULT '스토리' NOT NULL,
	"story" jsonb DEFAULT '{"version":"1.0.0","metadata":{"title":"스토리"},"nodes":[],"edges":[]}'::jsonb NOT NULL,
	"owner_id" text NOT NULL,
	CONSTRAINT "story_graph_documents_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
ALTER TABLE "story_canvas_edges" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "story_canvas_nodes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "story_canvas_edges" CASCADE;--> statement-breakpoint
DROP TABLE "story_canvas_nodes" CASCADE;--> statement-breakpoint
ALTER TABLE "sync_changelog" ALTER COLUMN "changed_by" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "story_graph_documents" ADD CONSTRAINT "story_graph_documents_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_graph_documents" ADD CONSTRAINT "story_graph_documents_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."story_canvas_node_type";

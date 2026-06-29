CREATE TYPE "public"."story_canvas_node_type" AS ENUM('scene', 'choice', 'dialogue', 'condition', 'branch', 'ending');--> statement-breakpoint
CREATE TABLE "story_canvas_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"project_id" uuid NOT NULL,
	"source_node_id" uuid NOT NULL,
	"target_node_id" uuid NOT NULL,
	"type" varchar(50) DEFAULT 'default' NOT NULL,
	"label" varchar(200),
	"owner_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_canvas_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "story_canvas_node_type" DEFAULT 'scene' NOT NULL,
	"label" varchar(200) NOT NULL,
	"position_x" real DEFAULT 0 NOT NULL,
	"position_y" real DEFAULT 0 NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb,
	"z_index" integer DEFAULT 0 NOT NULL,
	"owner_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_canvas_edges" ADD CONSTRAINT "story_canvas_edges_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_canvas_edges" ADD CONSTRAINT "story_canvas_edges_source_node_id_story_canvas_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."story_canvas_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_canvas_edges" ADD CONSTRAINT "story_canvas_edges_target_node_id_story_canvas_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."story_canvas_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_canvas_edges" ADD CONSTRAINT "story_canvas_edges_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_canvas_nodes" ADD CONSTRAINT "story_canvas_nodes_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_canvas_nodes" ADD CONSTRAINT "story_canvas_nodes_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
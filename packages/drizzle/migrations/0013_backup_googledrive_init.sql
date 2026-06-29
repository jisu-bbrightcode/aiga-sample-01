ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'backup_googledrive';--> statement-breakpoint
CREATE TABLE "backup_googledrive_credentials" (
	"user_id" text PRIMARY KEY NOT NULL,
	"google_account_email" text NOT NULL,
	"access_token_ct" text NOT NULL,
	"access_token_iv" text NOT NULL,
	"access_token_tag" text NOT NULL,
	"refresh_token_ct" text NOT NULL,
	"refresh_token_iv" text NOT NULL,
	"refresh_token_tag" text NOT NULL,
	"cipher_key_version" integer NOT NULL,
	"cipher_aad" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"scope" text NOT NULL,
	"drive_root_folder_id" text,
	"connected_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"last_error_code" text,
	"last_error_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "backup_googledrive_user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"auto_enable_new_projects" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_googledrive_project_config" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"interval_sec" integer DEFAULT 86400 NOT NULL,
	"drive_project_folder_id" text,
	"last_run_at" timestamp with time zone,
	"last_run_status" text,
	"last_error_code" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"recent_failures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failure_notified_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_googledrive_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" uuid,
	"user_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"trigger" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"drive_file_id" text,
	"drive_file_name" text,
	"bytes" integer,
	"error_code" text,
	"error_message_redacted" text
);
--> statement-breakpoint
CREATE TABLE "backup_googledrive_oauth_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "backup_googledrive_run_claims" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"claim_token" text NOT NULL,
	"claimed_run_id" text,
	"claimed_at" timestamp with time zone,
	"claimed_by" text,
	"lease_expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "backup_googledrive_credentials" ADD CONSTRAINT "backup_googledrive_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_googledrive_user_settings" ADD CONSTRAINT "backup_googledrive_user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_googledrive_project_config" ADD CONSTRAINT "backup_googledrive_project_config_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_googledrive_project_config" ADD CONSTRAINT "backup_googledrive_project_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_googledrive_runs" ADD CONSTRAINT "backup_googledrive_runs_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_googledrive_runs" ADD CONSTRAINT "backup_googledrive_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_googledrive_oauth_nonces" ADD CONSTRAINT "backup_googledrive_oauth_nonces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_googledrive_run_claims" ADD CONSTRAINT "backup_googledrive_run_claims_project_id_backup_googledrive_project_config_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."backup_googledrive_project_config"("project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_backup_gd_project_config_next_run_at" ON "backup_googledrive_project_config" USING btree ("next_run_at") WHERE "backup_googledrive_project_config"."enabled" = true;--> statement-breakpoint
CREATE INDEX "idx_backup_gd_project_config_user_id" ON "backup_googledrive_project_config" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_backup_gd_runs_project_dedupe" ON "backup_googledrive_runs" USING btree ("project_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "idx_backup_gd_runs_project_started_at" ON "backup_googledrive_runs" USING btree ("project_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_backup_gd_runs_user_started_at" ON "backup_googledrive_runs" USING btree ("user_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_backup_gd_oauth_nonces_expires_at" ON "backup_googledrive_oauth_nonces" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_backup_gd_run_claims_lease_expires_at" ON "backup_googledrive_run_claims" USING btree ("lease_expires_at") WHERE "backup_googledrive_run_claims"."claimed_run_id" IS NOT NULL;
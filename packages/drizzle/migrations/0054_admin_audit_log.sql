-- PB-ADMIN-001 (BBR-676) — general admin audit log foundation.
-- NEW core table for the admin shell / RBAC capability. Append-only trail of
-- privileged admin mutations not covered by a domain-specific audit log.
-- Idempotent, hand-authored (same approach as 0046/0052) to avoid sweeping
-- unrelated base-snapshot drift.

CREATE TABLE IF NOT EXISTS "admin_audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"payload_before" jsonb,
	"payload_after" jsonb,
	"ip_address" text,
	"user_agent" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_log_actor_created_idx" ON "admin_audit_log" USING btree ("actor_user_id","created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_log_target_idx" ON "admin_audit_log" USING btree ("target_type","target_id");

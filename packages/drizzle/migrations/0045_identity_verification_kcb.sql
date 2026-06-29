CREATE TYPE "public"."identity_verification_provider" AS ENUM('kcb');--> statement-breakpoint
CREATE TYPE "public"."identity_verification_mode" AS ENUM('standard', 'custom');--> statement-breakpoint
CREATE TYPE "public"."identity_verification_request_status" AS ENUM('created', 'redirected', 'verified', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity_verification_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"client_ip" text,
	"provider" "identity_verification_provider" DEFAULT 'kcb' NOT NULL,
	"mode" "identity_verification_mode" DEFAULT 'standard' NOT NULL,
	"target_action" text NOT NULL,
	"status" "identity_verification_request_status" DEFAULT 'created' NOT NULL,
	"module_token_hash" text,
	"state_hash" text NOT NULL,
	"nonce_hash" text NOT NULL,
	"provider_transaction_id" text,
	"result_code" text,
	"failure_code" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"user_id" text,
	"provider" "identity_verification_provider" DEFAULT 'kcb' NOT NULL,
	"ci_hash" text,
	"di_hash" text,
	"name_masked" text,
	"phone_masked" text,
	"birth_year" text,
	"verified_at" timestamp with time zone NOT NULL,
	"retained_until" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_verification_requests" ADD CONSTRAINT "identity_verification_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."identity_verification_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_verification_requests_user_created_idx" ON "identity_verification_requests" ("user_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_verification_requests_ip_created_idx" ON "identity_verification_requests" ("client_ip","created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_verification_requests_status_expires_idx" ON "identity_verification_requests" ("status","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_verification_requests_module_token_idx" ON "identity_verification_requests" ("module_token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_verification_requests_provider_tx_idx" ON "identity_verification_requests" ("provider_transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_verifications_user_verified_idx" ON "identity_verifications" ("user_id","verified_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_verifications_ci_hash_idx" ON "identity_verifications" ("ci_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_verifications_request_idx" ON "identity_verifications" ("request_id");

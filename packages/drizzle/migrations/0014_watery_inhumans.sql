CREATE TYPE "public"."payment_recharge_history_status" AS ENUM('pending', 'paid', 'failed', 'cancelled', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."payment_recharge_history_trigger" AS ENUM('threshold', 'manual');--> statement-breakpoint
CREATE TYPE "public"."payment_usage_ledger_reason" AS ENUM('ai_usage', 'auto_recharge', 'manual_topup', 'refund_reverse');--> statement-breakpoint
CREATE TYPE "public"."payment_usage_ledger_ref_type" AS ENUM('usage_claim', 'polar_order', 'manual_admin');--> statement-breakpoint
CREATE TYPE "public"."payment_usage_reserve_ref_type" AS ENUM('ai_call');--> statement-breakpoint
CREATE TYPE "public"."payment_usage_reserve_status" AS ENUM('reserved', 'claimed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "payment_extra_usage_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"monthly_limit_cents" integer DEFAULT 0 NOT NULL,
	"auto_recharge_enabled" boolean DEFAULT false NOT NULL,
	"auto_recharge_threshold_cents" integer DEFAULT 500 NOT NULL,
	"auto_recharge_package_id" uuid,
	"monthly_recharge_cap_count" integer DEFAULT 5,
	"monthly_recharge_cap_cents" integer,
	CONSTRAINT "payment_extra_usage_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "payment_recharge_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"trigger_reason" "payment_recharge_history_trigger" NOT NULL,
	"package_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"polar_order_id" text,
	"status" "payment_recharge_history_status" DEFAULT 'pending' NOT NULL,
	"attempted_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"timeout_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_usage_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" text NOT NULL,
	"delta_cents" integer NOT NULL,
	"balance_after_cents" integer NOT NULL,
	"reason" "payment_usage_ledger_reason" NOT NULL,
	"ref_type" "payment_usage_ledger_ref_type" NOT NULL,
	"ref_id" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "payment_usage_reserves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" text NOT NULL,
	"estimate_cents" integer NOT NULL,
	"status" "payment_usage_reserve_status" DEFAULT 'reserved' NOT NULL,
	"ref_type" "payment_usage_reserve_ref_type" NOT NULL,
	"ref_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_actual_cents" integer,
	"claimed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payment_subscriptions" ADD COLUMN "cached_paid_balance_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_subscriptions" ADD COLUMN "cached_balance_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_extra_usage_settings" ADD CONSTRAINT "payment_extra_usage_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_extra_usage_settings" ADD CONSTRAINT "payment_extra_usage_settings_auto_recharge_package_id_payment_top_up_packages_id_fk" FOREIGN KEY ("auto_recharge_package_id") REFERENCES "public"."payment_top_up_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_recharge_history" ADD CONSTRAINT "payment_recharge_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_recharge_history" ADD CONSTRAINT "payment_recharge_history_package_id_payment_top_up_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."payment_top_up_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_usage_ledger" ADD CONSTRAINT "payment_usage_ledger_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_usage_reserves" ADD CONSTRAINT "payment_usage_reserves_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_recharge_history_idempotency_idx" ON "payment_recharge_history" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_recharge_history_period_idx" ON "payment_recharge_history" USING btree ("organization_id","period_start");--> statement-breakpoint
CREATE INDEX "payment_recharge_history_pending_idx" ON "payment_recharge_history" USING btree ("organization_id") WHERE "payment_recharge_history"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "payment_usage_ledger_ref_idx" ON "payment_usage_ledger" USING btree ("organization_id","ref_type","ref_id");--> statement-breakpoint
CREATE INDEX "payment_usage_ledger_org_period_idx" ON "payment_usage_ledger" USING btree ("organization_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_usage_reserves_active_ref_idx" ON "payment_usage_reserves" USING btree ("organization_id","ref_type","ref_id") WHERE "payment_usage_reserves"."status" = 'reserved';--> statement-breakpoint
CREATE INDEX "payment_usage_reserves_expiry_idx" ON "payment_usage_reserves" USING btree ("status","expires_at");
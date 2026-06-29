CREATE TYPE "public"."payment_coupon_applies_to" AS ENUM('subscription', 'top_up', 'both');--> statement-breakpoint
CREATE TYPE "public"."payment_coupon_duration" AS ENUM('once', 'repeating', 'forever');--> statement-breakpoint
CREATE TYPE "public"."payment_coupon_type" AS ENUM('percent', 'amount');--> statement-breakpoint
CREATE TYPE "public"."payment_credit_ledger_reason" AS ENUM('subscription_grant', 'top_up', 'spend', 'admin_grant', 'admin_revoke', 'refund_reverse', 'expire');--> statement-breakpoint
CREATE TYPE "public"."payment_credit_ledger_ref_type" AS ENUM('subscription', 'order', 'spend_event', 'admin_action');--> statement-breakpoint
CREATE TYPE "public"."payment_order_status" AS ENUM('paid', 'refunded', 'partially_refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_plan_cycle" AS ENUM('lifetime', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."payment_subscription_event_result" AS ENUM('ok', 'deferred', 'error');--> statement-breakpoint
CREATE TYPE "public"."payment_subscription_status" AS ENUM('trialing', 'active', 'past_due', 'grace', 'canceled');--> statement-breakpoint
CREATE TABLE "payment_audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"target_org_id" text NOT NULL,
	"target_subscription_id" uuid,
	"target_user_id" text,
	"payload_before" jsonb,
	"payload_after" jsonb,
	"ip_address" text,
	"user_agent" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"subscription_id" uuid,
	"order_id" uuid,
	"polar_event_ref" text,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"polar_discount_id" text,
	"code" text NOT NULL,
	"type" "payment_coupon_type" NOT NULL,
	"percent_off" integer,
	"amount_off_cents" integer,
	"duration" "payment_coupon_duration" NOT NULL,
	"duration_in_months" integer,
	"applies_to" "payment_coupon_applies_to" NOT NULL,
	"max_redemptions" integer,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_admin_id" text,
	CONSTRAINT "payment_coupons_polar_discount_id_unique" UNIQUE("polar_discount_id"),
	CONSTRAINT "payment_coupons_code_unique" UNIQUE("code"),
	CONSTRAINT "payment_coupons_type_value_invariant" CHECK (("payment_coupons"."type" = 'percent' AND "payment_coupons"."percent_off" IS NOT NULL AND "payment_coupons"."percent_off" BETWEEN 1 AND 100 AND "payment_coupons"."amount_off_cents" IS NULL)
       OR ("payment_coupons"."type" = 'amount' AND "payment_coupons"."amount_off_cents" IS NOT NULL AND "payment_coupons"."amount_off_cents" > 0 AND "payment_coupons"."percent_off" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "payment_credit_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" "payment_credit_ledger_reason" NOT NULL,
	"ref_type" "payment_credit_ledger_ref_type",
	"ref_id" text,
	"balance_after" integer NOT NULL,
	"spend_meta" jsonb,
	"actor_user_id" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"polar_customer_id" text NOT NULL,
	"default_payment_method_brand" text,
	"default_payment_method_last4" text,
	CONSTRAINT "payment_customers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "payment_customers_polar_customer_id_unique" UNIQUE("polar_customer_id")
);
--> statement-breakpoint
CREATE TABLE "payment_model_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model_key" text NOT NULL,
	"display_name" text NOT NULL,
	"input_weight_per_1k_tokens" numeric(10, 4) NOT NULL,
	"output_weight_per_1k_tokens" numeric(10, 4) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "payment_model_pricing_model_key_unique" UNIQUE("model_key")
);
--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"polar_order_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"package_id" uuid,
	"subscription_id" uuid,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "payment_order_status" NOT NULL,
	"refunded_amount_cents" integer DEFAULT 0 NOT NULL,
	"invoice_url" text,
	CONSTRAINT "payment_orders_polar_order_id_unique" UNIQUE("polar_order_id"),
	CONSTRAINT "payment_orders_target_invariant" CHECK ("payment_orders"."package_id" IS NOT NULL OR "payment_orders"."subscription_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "payment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"polar_product_id" text,
	"polar_price_id" text,
	"slug" text NOT NULL,
	"cycle" "payment_plan_cycle" NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"included_credits_per_cycle" integer DEFAULT 0 NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "payment_plans_polar_product_id_unique" UNIQUE("polar_product_id"),
	CONSTRAINT "payment_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payment_subscription_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"polar_event_id" text NOT NULL,
	"subscription_id" uuid,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"result" "payment_subscription_event_result",
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	CONSTRAINT "payment_subscription_events_polar_event_id_unique" UNIQUE("polar_event_id")
);
--> statement-breakpoint
CREATE TABLE "payment_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"polar_subscription_id" text,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "payment_subscription_status" NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"past_due_since" timestamp with time zone,
	"grace_ends_at" timestamp with time zone,
	"data_purge_at" timestamp with time zone,
	CONSTRAINT "payment_subscriptions_polar_subscription_id_unique" UNIQUE("polar_subscription_id"),
	CONSTRAINT "payment_subs_grace_invariant" CHECK ("payment_subscriptions"."status" <> 'grace' OR ("payment_subscriptions"."grace_ends_at" IS NOT NULL AND "payment_subscriptions"."past_due_since" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "payment_top_up_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"polar_product_id" text NOT NULL,
	"polar_price_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"credits" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "payment_top_up_packages_polar_product_id_unique" UNIQUE("polar_product_id"),
	CONSTRAINT "payment_top_up_packages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "active_organization_id" text;--> statement-breakpoint
ALTER TABLE "payment_audit_log" ADD CONSTRAINT "payment_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_audit_log" ADD CONSTRAINT "payment_audit_log_target_org_id_organizations_id_fk" FOREIGN KEY ("target_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_audit_log" ADD CONSTRAINT "payment_audit_log_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_coupon_redemptions" ADD CONSTRAINT "payment_coupon_redemptions_coupon_id_payment_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."payment_coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_coupon_redemptions" ADD CONSTRAINT "payment_coupon_redemptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_coupon_redemptions" ADD CONSTRAINT "payment_coupon_redemptions_subscription_id_payment_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."payment_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_coupon_redemptions" ADD CONSTRAINT "payment_coupon_redemptions_order_id_payment_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."payment_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_coupons" ADD CONSTRAINT "payment_coupons_created_by_admin_id_users_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_credit_ledger" ADD CONSTRAINT "payment_credit_ledger_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_credit_ledger" ADD CONSTRAINT "payment_credit_ledger_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_customers" ADD CONSTRAINT "payment_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_package_id_payment_top_up_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."payment_top_up_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_subscription_id_payment_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."payment_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_subscription_events" ADD CONSTRAINT "payment_subscription_events_subscription_id_payment_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."payment_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_subscriptions" ADD CONSTRAINT "payment_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_subscriptions" ADD CONSTRAINT "payment_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_subscriptions" ADD CONSTRAINT "payment_subscriptions_plan_id_payment_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_audit_log_actor_created_idx" ON "payment_audit_log" USING btree ("actor_user_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "payment_audit_log_target_org_created_idx" ON "payment_audit_log" USING btree ("target_org_id","created_at" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "payment_coupon_redemptions_uniq" ON "payment_coupon_redemptions" USING btree ("coupon_id","organization_id","subscription_id","order_id");--> statement-breakpoint
CREATE INDEX "payment_credit_ledger_org_created_idx" ON "payment_credit_ledger" USING btree ("organization_id","created_at" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "payment_credit_ledger_org_ref_uniq" ON "payment_credit_ledger" USING btree ("organization_id","ref_type","ref_id") WHERE "payment_credit_ledger"."ref_type" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_credit_ledger_org_idem_uniq" ON "payment_credit_ledger" USING btree ("organization_id","idempotency_key") WHERE "payment_credit_ledger"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payment_sub_events_sub_received_idx" ON "payment_subscription_events" USING btree ("subscription_id","received_at" DESC);--> statement-breakpoint
CREATE INDEX "payment_sub_events_deferred_idx" ON "payment_subscription_events" USING btree ("result","next_retry_at") WHERE "payment_subscription_events"."result" = 'deferred';--> statement-breakpoint
CREATE INDEX "payment_subs_org_status_idx" ON "payment_subscriptions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "payment_subs_status_grace_idx" ON "payment_subscriptions" USING btree ("status","grace_ends_at");
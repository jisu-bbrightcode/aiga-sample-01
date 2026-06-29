CREATE TABLE "payment_pending_plan_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"target_plan_id" uuid NOT NULL,
	"apply_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"reason" text
);
--> statement-breakpoint
ALTER TABLE "payment_pending_plan_changes" ADD CONSTRAINT "payment_pending_plan_changes_subscription_id_payment_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."payment_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_pending_plan_changes" ADD CONSTRAINT "payment_pending_plan_changes_target_plan_id_payment_plans_id_fk" FOREIGN KEY ("target_plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_pending_plan_changes_status_apply_idx" ON "payment_pending_plan_changes" USING btree ("status","apply_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_pending_plan_changes_active_idx" ON "payment_pending_plan_changes" USING btree ("subscription_id") WHERE "payment_pending_plan_changes"."status" = 'pending';
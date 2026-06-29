ALTER TABLE "payment_audit_log" ALTER COLUMN "target_org_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_subscriptions" ALTER COLUMN "current_period_start" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_subscriptions" ALTER COLUMN "current_period_end" SET NOT NULL;
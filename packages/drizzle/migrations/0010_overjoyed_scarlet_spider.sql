CREATE TYPE "public"."payment_pending_plan_change_status" AS ENUM('pending', 'applied', 'canceled');--> statement-breakpoint
DROP INDEX "payment_pending_plan_changes_status_apply_idx";--> statement-breakpoint
DROP INDEX "payment_pending_plan_changes_active_idx";--> statement-breakpoint
ALTER TABLE "payment_pending_plan_changes" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "payment_pending_plan_changes" ALTER COLUMN "status" SET DATA TYPE "public"."payment_pending_plan_change_status" USING "status"::"public"."payment_pending_plan_change_status";--> statement-breakpoint
ALTER TABLE "payment_pending_plan_changes" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."payment_pending_plan_change_status";--> statement-breakpoint
CREATE INDEX "payment_pending_plan_changes_status_apply_idx" ON "payment_pending_plan_changes" USING btree ("status","apply_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_pending_plan_changes_active_idx" ON "payment_pending_plan_changes" USING btree ("subscription_id") WHERE "payment_pending_plan_changes"."status" = 'pending';
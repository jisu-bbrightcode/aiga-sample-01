import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { baseColumns } from "@repo/drizzle/schema";
import { paymentPlans } from "./plans";
import { paymentSubscriptions } from "./subscriptions";

/**
 * Pending plan change status.
 *  - pending: 적용 대기 (apply_at 도달 전)
 *  - applied: cycle_end 에 cron 이 적용 완료
 *  - canceled: 사용자가 새 changePlan 호출로 덮어쓰기 / 명시적 취소
 */
export const paymentPendingPlanChangeStatusEnum = pgEnum(
  "payment_pending_plan_change_status",
  ["pending", "applied", "canceled"],
);

/**
 * Payment Pending Plan Changes — 다운그레이드 deferred apply 큐.
 *
 * 사용자가 더 싼 plan 으로 변경 시 즉시 처리하지 않고 cycle_end 에 적용.
 * payment_pending_plan_change.cron 이 매시간 status='pending' AND apply_at <= now()
 * 픽업 → polar.updateSubscription(proration_behavior='next_period') → status='applied'.
 *
 * INV: 한 subscription 에 동시에 1건만 pending (uniqueIndex WHERE status='pending').
 *      두 번째 changePlan 호출이 들어오면 service 가 기존을 'canceled' 마크 후 새 row insert.
 */
export const paymentPendingPlanChanges = pgTable(
  "payment_pending_plan_changes",
  {
    ...baseColumns(),

    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => paymentSubscriptions.id, { onDelete: "cascade" }),
    targetPlanId: uuid("target_plan_id")
      .notNull()
      .references(() => paymentPlans.id),

    applyAt: timestamp("apply_at", { withTimezone: true }).notNull(),
    status: paymentPendingPlanChangeStatusEnum("status").notNull().default("pending"),

    appliedAt: timestamp("applied_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    reason: text("reason"),
  },
  (t) => [
    index("payment_pending_plan_changes_status_apply_idx").on(t.status, t.applyAt),
    uniqueIndex("payment_pending_plan_changes_active_idx")
      .on(t.subscriptionId)
      .where(sql`${t.status} = 'pending'`),
  ],
);

export type PaymentPendingPlanChange = typeof paymentPendingPlanChanges.$inferSelect;
export type NewPaymentPendingPlanChange = typeof paymentPendingPlanChanges.$inferInsert;

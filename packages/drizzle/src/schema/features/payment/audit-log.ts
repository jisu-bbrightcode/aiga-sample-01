import { sql } from "drizzle-orm";
import { bigserial, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "@repo/drizzle/schema";

/**
 * Payment Audit Log (admin Customer Ops).
 *
 * Append-only. Every admin mutation in the payment domain (refund,
 * grant_credits, cancel_sub, ...) records a row here via @AuditLog().
 *
 * Retained 7 years on user deletion (PII masked).
 */
export const paymentAuditLog = pgTable(
  "payment_audit_log",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),

    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id),
    /**
     * Known action values (enforced at service layer, not DB enum):
     *
     * Plan change (PR #62):
     *   change_plan_v2 | schedule_downgrade | cancel_at_period_end |
     *   cancel_with_refund | uncancel | apply_pending_change | cancel_pending_change
     *
     * Credit / extra usage (T1):
     *   auto_recharge_triggered | auto_recharge_failed | auto_recharge_timeout |
     *   extra_usage_settings_updated | usage_limit_reached | usage_reserve_expired
     */
    action: text("action").notNull(),

    targetOrgId: text("target_org_id").references(() => organization.id),
    targetSubscriptionId: uuid("target_subscription_id"),
    targetUserId: text("target_user_id").references(() => user.id),

    payloadBefore: jsonb("payload_before"),
    payloadAfter: jsonb("payload_after"),

    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    reason: text("reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payment_audit_log_actor_created_idx").on(
      table.actorUserId,
      sql`${table.createdAt} DESC`,
    ),
    index("payment_audit_log_target_org_created_idx").on(
      table.targetOrgId,
      sql`${table.createdAt} DESC`,
    ),
  ],
);

export type PaymentAuditLogRow = typeof paymentAuditLog.$inferSelect;
export type NewPaymentAuditLogRow = typeof paymentAuditLog.$inferInsert;

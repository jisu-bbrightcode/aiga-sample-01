import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { baseColumns, organization } from "@repo/drizzle/schema";
import { paymentTopUpPackages } from "./top-up-packages";

/**
 * Payment Recharge History (auto-recharge audit log).
 *
 * Records every auto-recharge attempt with idempotency.
 * Webhook (order.paid) transitions status: pending → paid.
 * Cron sweeps: pending older than timeout_at → timeout.
 *
 * INV: (organization_id, idempotency_key) UNIQUE — prevents double-charge.
 * Partial idx ON status='pending' for cron efficiency.
 */
export const paymentRechargeHistoryStatusEnum = pgEnum("payment_recharge_history_status", [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "timeout",
]);

export const paymentRechargeHistoryTriggerEnum = pgEnum("payment_recharge_history_trigger", [
  "threshold",
  "manual",
]);

export const paymentRechargeHistory = pgTable(
  "payment_recharge_history",
  {
    ...baseColumns(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    triggerReason: paymentRechargeHistoryTriggerEnum("trigger_reason").notNull(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => paymentTopUpPackages.id),
    amountCents: integer("amount_cents").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    polarOrderId: text("polar_order_id"),
    status: paymentRechargeHistoryStatusEnum("status").notNull().default("pending"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    timeoutAt: timestamp("timeout_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("payment_recharge_history_idempotency_idx").on(
      t.organizationId,
      t.idempotencyKey,
    ),
    index("payment_recharge_history_period_idx").on(t.organizationId, t.periodStart),
    index("payment_recharge_history_pending_idx")
      .on(t.organizationId)
      .where(sql`${t.status} = 'pending'`),
  ],
);

export type PaymentRechargeHistoryRow = typeof paymentRechargeHistory.$inferSelect;
export type NewPaymentRechargeHistoryRow = typeof paymentRechargeHistory.$inferInsert;

import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { baseColumns, organization } from "@repo/drizzle/schema";

/**
 * Payment Usage Ledger (append-only, event-sourced).
 *
 * Tracks paid AI token usage in cents.
 * Balance = SUM(delta_cents) WHERE organization_id = X.
 * `balance_after_cents` is a per-row cache enforced inside a FOR UPDATE
 * transaction at the service layer.
 *
 * INV (test): SUM(delta_cents) per org === last balance_after_cents.
 * Idempotency: (organization_id, ref_type, ref_id) UNIQUE.
 */
export const paymentUsageLedgerReasonEnum = pgEnum("payment_usage_ledger_reason", [
  "ai_usage",
  "auto_recharge",
  "manual_topup",
  "refund_reverse",
]);

export const paymentUsageLedgerRefTypeEnum = pgEnum("payment_usage_ledger_ref_type", [
  "usage_claim",
  "polar_order",
  "manual_admin",
]);

export const paymentUsageLedger = pgTable(
  "payment_usage_ledger",
  {
    ...baseColumns(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    deltaCents: integer("delta_cents").notNull(),
    balanceAfterCents: integer("balance_after_cents").notNull(),
    reason: paymentUsageLedgerReasonEnum("reason").notNull(),
    refType: paymentUsageLedgerRefTypeEnum("ref_type").notNull(),
    refId: text("ref_id").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata"),
  },
  (t) => [
    uniqueIndex("payment_usage_ledger_ref_idx").on(t.organizationId, t.refType, t.refId),
    index("payment_usage_ledger_org_period_idx").on(t.organizationId, t.periodStart),
  ],
);

export type PaymentUsageLedgerRow = typeof paymentUsageLedger.$inferSelect;
export type NewPaymentUsageLedgerRow = typeof paymentUsageLedger.$inferInsert;

import { sql } from "drizzle-orm";
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "@repo/drizzle/schema";

/**
 * Credit ledger reason codes.
 */
export const paymentCreditLedgerReasonEnum = pgEnum("payment_credit_ledger_reason", [
  "subscription_grant",
  "top_up",
  "spend",
  "admin_grant",
  "admin_revoke",
  "refund_reverse",
  "expire",
  "plan_change_grant",
  "plan_change_revoke",
]);

/**
 * Source-document type referenced by the ledger row.
 */
export const paymentCreditLedgerRefTypeEnum = pgEnum("payment_credit_ledger_ref_type", [
  "subscription",
  "order",
  "spend_event",
  "admin_action",
  "subscription_event",
]);

/**
 * Credit Ledger (append-only, event-sourced).
 *
 * Balance = SUM(delta) WHERE organization_id = X.
 * `balance_after` is a per-row cache (= prior balance + delta), enforced
 * inside a FOR UPDATE transaction at the service layer.
 *
 * INV-1 (test): balance_after = running sum of delta.
 * INV-5 (test): refund_reverse delta = -(grant - used) using FIFO.
 * INV-6 (service): post-insert balance must remain >= 0.
 *
 * Idempotency: (organization_id, ref_type, ref_id) is UNIQUE when ref_type
 * is set — same source event cannot append twice.
 */
export const paymentCreditLedger = pgTable(
  "payment_credit_ledger",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),

    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    delta: integer("delta").notNull(),
    reason: paymentCreditLedgerReasonEnum("reason").notNull(),

    refType: paymentCreditLedgerRefTypeEnum("ref_type"),
    refId: text("ref_id"),

    balanceAfter: integer("balance_after").notNull(),

    spendMeta: jsonb("spend_meta"),
    actorUserId: text("actor_user_id").references(() => user.id),
    idempotencyKey: text("idempotency_key"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payment_credit_ledger_org_created_idx").on(
      table.organizationId,
      sql`${table.createdAt} DESC`,
    ),
    // dedupe per source event when ref_type/ref_id provided
    uniqueIndex("payment_credit_ledger_org_ref_uniq")
      .on(table.organizationId, table.refType, table.refId)
      .where(sql`${table.refType} IS NOT NULL`),
    // idempotency-key dedupe per org (when caller-supplied)
    uniqueIndex("payment_credit_ledger_org_idem_uniq")
      .on(table.organizationId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
  ],
);

export type PaymentCreditLedgerRow = typeof paymentCreditLedger.$inferSelect;
export type NewPaymentCreditLedgerRow = typeof paymentCreditLedger.$inferInsert;

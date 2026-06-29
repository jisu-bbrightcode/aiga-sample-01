import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { baseColumns, organization } from "@repo/drizzle/schema";

/**
 * Payment Usage Reserves (in-flight AI call reservations).
 *
 * Reserve/Claim/Cancel pattern:
 *  - reserve: before AI call, lock estimated cents
 *  - claim: after AI call, convert to actual usage
 *  - cancel: if AI call fails, release reservation
 *  - expired: cron sweeps stale reserved rows
 *
 * INV: one active (status='reserved') reservation per (org, ref_type, ref_id)
 *      enforced via partial unique index.
 */
export const paymentUsageReserveStatusEnum = pgEnum("payment_usage_reserve_status", [
  "reserved",
  "claimed",
  "cancelled",
  "expired",
]);

export const paymentUsageReserveRefTypeEnum = pgEnum("payment_usage_reserve_ref_type", [
  "ai_call",
]);

export const paymentUsageReserves = pgTable(
  "payment_usage_reserves",
  {
    ...baseColumns(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    estimateCents: integer("estimate_cents").notNull(),
    status: paymentUsageReserveStatusEnum("status").notNull().default("reserved"),
    refType: paymentUsageReserveRefTypeEnum("ref_type").notNull(),
    refId: text("ref_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    claimedActualCents: integer("claimed_actual_cents"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("payment_usage_reserves_active_ref_idx")
      .on(t.organizationId, t.refType, t.refId)
      .where(sql`${t.status} = 'reserved'`),
    index("payment_usage_reserves_expiry_idx").on(t.status, t.expiresAt),
  ],
);

export type PaymentUsageReserveRow = typeof paymentUsageReserves.$inferSelect;
export type NewPaymentUsageReserveRow = typeof paymentUsageReserves.$inferInsert;

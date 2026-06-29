import { sql } from "drizzle-orm";
import { check, integer, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { baseColumns, organization, user } from "@repo/drizzle/schema";
import { paymentSubscriptions } from "./subscriptions";
import { paymentTopUpPackages } from "./top-up-packages";

/**
 * Order status mirror from Polar.
 */
export const paymentOrderStatusEnum = pgEnum("payment_order_status", [
  "paid",
  "refunded",
  "partially_refunded",
  "failed",
]);

/**
 * Orders (Polar order mirror — top-up purchases AND subscription invoices).
 *
 * INV-7 (DB CHECK): each order references either a top-up package OR a subscription.
 */
export const paymentOrders = pgTable(
  "payment_orders",
  {
    ...baseColumns(),

    polarOrderId: text("polar_order_id").notNull().unique(),

    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),

    packageId: uuid("package_id").references(() => paymentTopUpPackages.id),
    subscriptionId: uuid("subscription_id").references(() => paymentSubscriptions.id),

    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),

    status: paymentOrderStatusEnum("status").notNull(),
    refundedAmountCents: integer("refunded_amount_cents").notNull().default(0),

    invoiceUrl: text("invoice_url"),
  },
  (table) => [
    // INV-7: order belongs to a top-up package OR a subscription (not neither)
    check(
      "payment_orders_target_invariant",
      sql`${table.packageId} IS NOT NULL OR ${table.subscriptionId} IS NOT NULL`,
    ),
  ],
);

export type PaymentOrder = typeof paymentOrders.$inferSelect;
export type NewPaymentOrder = typeof paymentOrders.$inferInsert;

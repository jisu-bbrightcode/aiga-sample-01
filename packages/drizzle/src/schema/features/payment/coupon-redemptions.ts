import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { baseColumns, organization } from "@repo/drizzle/schema";
import { paymentCoupons } from "./coupons";
import { paymentOrders } from "./orders";
import { paymentSubscriptions } from "./subscriptions";

/**
 * Coupon Redemptions
 *
 * One row per redemption event. The (coupon, org, subscription, order)
 * combination is unique to prevent double-counting on webhook replay.
 */
export const paymentCouponRedemptions = pgTable(
  "payment_coupon_redemptions",
  {
    ...baseColumns(),

    couponId: uuid("coupon_id")
      .notNull()
      .references(() => paymentCoupons.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => paymentSubscriptions.id),
    orderId: uuid("order_id").references(() => paymentOrders.id),

    polarEventRef: text("polar_event_ref"),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_coupon_redemptions_uniq").on(
      table.couponId,
      table.organizationId,
      table.subscriptionId,
      table.orderId,
    ),
  ],
);

export type PaymentCouponRedemption = typeof paymentCouponRedemptions.$inferSelect;
export type NewPaymentCouponRedemption = typeof paymentCouponRedemptions.$inferInsert;

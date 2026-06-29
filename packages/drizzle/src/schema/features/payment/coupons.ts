import { sql } from "drizzle-orm";
import { boolean, check, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { baseColumns, user } from "@repo/drizzle/schema";

/**
 * Coupon discount type.
 */
export const paymentCouponTypeEnum = pgEnum("payment_coupon_type", ["percent", "amount"]);

/**
 * Coupon duration semantics (mirrors Polar discount duration).
 */
export const paymentCouponDurationEnum = pgEnum("payment_coupon_duration", [
  "once",
  "repeating",
  "forever",
]);

/**
 * Coupon scope (what kind of order the discount applies to).
 */
export const paymentCouponAppliesToEnum = pgEnum("payment_coupon_applies_to", [
  "subscription",
  "top_up",
  "both",
]);

/**
 * Coupons (Polar discount mirror + locally-issued codes).
 *
 * INV-3 (DB CHECK + service):
 *   - type='percent' ⇒ percent_off ∈ [1, 100]
 *   - type='amount' ⇒ amount_off_cents > 0
 *   - redemption_count <= max_redemptions (when not null) — enforced in service.
 */
export const paymentCoupons = pgTable(
  "payment_coupons",
  {
    ...baseColumns(),

    polarDiscountId: text("polar_discount_id").unique(),
    code: text("code").notNull().unique(),

    type: paymentCouponTypeEnum("type").notNull(),
    percentOff: integer("percent_off"),
    amountOffCents: integer("amount_off_cents"),

    duration: paymentCouponDurationEnum("duration").notNull(),
    durationInMonths: integer("duration_in_months"),
    appliesTo: paymentCouponAppliesToEnum("applies_to").notNull(),

    maxRedemptions: integer("max_redemptions"),
    redemptionCount: integer("redemption_count").notNull().default(0),

    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),

    createdByAdminId: text("created_by_admin_id").references(() => user.id),
  },
  (table) => [
    // INV-3 part 1: type/value coherence.
    // NOT NULL guards are explicit so NULL operands cannot make the
    // expression evaluate to UNKNOWN (PostgreSQL CHECK passes UNKNOWN).
    check(
      "payment_coupons_type_value_invariant",
      sql`(${table.type} = 'percent' AND ${table.percentOff} IS NOT NULL AND ${table.percentOff} BETWEEN 1 AND 100 AND ${table.amountOffCents} IS NULL)
       OR (${table.type} = 'amount' AND ${table.amountOffCents} IS NOT NULL AND ${table.amountOffCents} > 0 AND ${table.percentOff} IS NULL)`,
    ),
  ],
);

export type PaymentCoupon = typeof paymentCoupons.$inferSelect;
export type NewPaymentCoupon = typeof paymentCoupons.$inferInsert;

import { boolean, integer, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { baseColumns } from "@repo/drizzle/schema";

/**
 * Plan billing cycle enum.
 * - lifetime: Free plan (no recurring billing)
 * - monthly / yearly: paid recurring plans
 */
export const paymentPlanCycleEnum = pgEnum("payment_plan_cycle", [
  "lifetime",
  "monthly",
  "yearly",
]);

/**
 * Plans (catalog, 5 row seed)
 *
 * One row per Polar product/price pair. Free plan is local-only
 * (no Polar mapping). Yearly plans are billed at monthly × 10.
 */
export const paymentPlans = pgTable("payment_plans", {
  ...baseColumns(),

  polarProductId: text("polar_product_id").unique(),
  polarPriceId: text("polar_price_id"),

  slug: text("slug").notNull().unique(),
  cycle: paymentPlanCycleEnum("cycle").notNull(),
  name: text("name").notNull(),

  priceCents: integer("price_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),

  includedCreditsPerCycle: integer("included_credits_per_cycle").notNull().default(0),
  seats: integer("seats").notNull().default(1),
  trialDays: integer("trial_days").notNull().default(0),

  isActive: boolean("is_active").notNull().default(true),
});

export type PaymentPlan = typeof paymentPlans.$inferSelect;
export type NewPaymentPlan = typeof paymentPlans.$inferInsert;

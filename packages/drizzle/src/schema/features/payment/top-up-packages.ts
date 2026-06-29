import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";
import { baseColumns } from "@repo/drizzle/schema";

/**
 * Top-up Packages (catalog, 3 row seed)
 *
 * One-time credit purchases. Credits never expire.
 */
export const paymentTopUpPackages = pgTable("payment_top_up_packages", {
  ...baseColumns(),

  polarProductId: text("polar_product_id").notNull().unique(),
  polarPriceId: text("polar_price_id").notNull(),

  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),

  credits: integer("credits").notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull().default("USD"),

  isActive: boolean("is_active").notNull().default(true),
});

export type PaymentTopUpPackage = typeof paymentTopUpPackages.$inferSelect;
export type NewPaymentTopUpPackage = typeof paymentTopUpPackages.$inferInsert;

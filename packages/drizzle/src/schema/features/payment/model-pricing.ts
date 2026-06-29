import { boolean, numeric, pgTable, text } from "drizzle-orm/pg-core";
import { baseColumns } from "@repo/drizzle/schema";

/**
 * Model Pricing
 *
 * Per-model credit weights. 1 credit ≈ 1,000 tokens (input or output)
 * weighted by model. Credits charged = ceil(
 *   (input_tokens / 1000) * input_weight + (output_tokens / 1000) * output_weight
 * ).
 */
export const paymentModelPricing = pgTable("payment_model_pricing", {
  ...baseColumns(),

  modelKey: text("model_key").notNull().unique(),
  displayName: text("display_name").notNull(),

  inputWeightPer1kTokens: numeric("input_weight_per_1k_tokens", {
    precision: 10,
    scale: 4,
  }).notNull(),
  outputWeightPer1kTokens: numeric("output_weight_per_1k_tokens", {
    precision: 10,
    scale: 4,
  }).notNull(),

  isActive: boolean("is_active").notNull().default(true),
});

export type PaymentModelPricing = typeof paymentModelPricing.$inferSelect;
export type NewPaymentModelPricing = typeof paymentModelPricing.$inferInsert;

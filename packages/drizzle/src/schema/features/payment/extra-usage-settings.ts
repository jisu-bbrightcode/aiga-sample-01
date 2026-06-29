import { boolean, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { baseColumns, organization } from "@repo/drizzle/schema";
import { paymentTopUpPackages } from "./top-up-packages";

/**
 * Payment Extra Usage Settings (per-org, 1:1 with organizations).
 *
 * Controls Anthropic-pattern extra usage toggle, monthly limit, and
 * auto-recharge configuration.
 *
 * INV: organization_id UNIQUE (enforced via .unique() column constraint).
 */
export const paymentExtraUsageSettings = pgTable("payment_extra_usage_settings", {
  ...baseColumns(),
  organizationId: text("organization_id")
    .notNull()
    .unique()
    .references(() => organization.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  monthlyLimitCents: integer("monthly_limit_cents").notNull().default(0),
  autoRechargeEnabled: boolean("auto_recharge_enabled").notNull().default(false),
  autoRechargeThresholdCents: integer("auto_recharge_threshold_cents").notNull().default(500),
  autoRechargePackageId: uuid("auto_recharge_package_id").references(
    () => paymentTopUpPackages.id,
  ),
  monthlyRechargeCapCount: integer("monthly_recharge_cap_count").default(5),
  monthlyRechargeCapCents: integer("monthly_recharge_cap_cents"),
});

export type PaymentExtraUsageSettingsRow = typeof paymentExtraUsageSettings.$inferSelect;
export type NewPaymentExtraUsageSettingsRow = typeof paymentExtraUsageSettings.$inferInsert;

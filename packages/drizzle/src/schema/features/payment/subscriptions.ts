import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { baseColumns, organization, user } from "@repo/drizzle/schema";
import { paymentPlans } from "./plans";

/**
 * Subscription status.
 *  - trialing: trial period active (Pro 14 days)
 *  - active: paid + current
 *  - past_due: payment failed, before grace
 *  - grace: in 7 day soft-suspend window
 *  - canceled: terminated (at period end or immediate)
 */
export const paymentSubscriptionStatusEnum = pgEnum("payment_subscription_status", [
  "trialing",
  "active",
  "past_due",
  "grace",
  "canceled",
]);

/**
 * Subscriptions (mirror of Polar subscription).
 *
 * Owner = better-auth organization. Free/Pro use a 1-member org,
 * Team uses a 5-member org. Credit balance pool is org-level.
 *
 * INV-2 (DB CHECK): status='grace' implies grace_ends_at and past_due_since are set.
 */
export const paymentSubscriptions = pgTable(
  "payment_subscriptions",
  {
    ...baseColumns(),

    polarSubscriptionId: text("polar_subscription_id").unique(),

    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    planId: uuid("plan_id")
      .notNull()
      .references(() => paymentPlans.id),

    status: paymentSubscriptionStatusEnum("status").notNull(),

    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    trialEnd: timestamp("trial_end", { withTimezone: true }),

    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),

    pastDueSince: timestamp("past_due_since", { withTimezone: true }),
    graceEndsAt: timestamp("grace_ends_at", { withTimezone: true }),
    dataPurgeAt: timestamp("data_purge_at", { withTimezone: true }),

    // cached paid usage balance — updated by AiUsageMeterService after each claim.
    // default=0 ensures v1 rows remain valid without migration data backfill.
    cachedPaidBalanceCents: integer("cached_paid_balance_cents").notNull().default(0),
    cachedBalanceUpdatedAt: timestamp("cached_balance_updated_at", { withTimezone: true }),
  },
  (table) => [
    index("payment_subs_org_status_idx").on(table.organizationId, table.status),
    index("payment_subs_status_grace_idx").on(table.status, table.graceEndsAt),
    // INV-2: grace status requires both grace_ends_at and past_due_since
    check(
      "payment_subs_grace_invariant",
      sql`${table.status} <> 'grace' OR (${table.graceEndsAt} IS NOT NULL AND ${table.pastDueSince} IS NOT NULL)`,
    ),
  ],
);

export type PaymentSubscription = typeof paymentSubscriptions.$inferSelect;
export type NewPaymentSubscription = typeof paymentSubscriptions.$inferInsert;

import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { baseColumns } from "@repo/drizzle/schema";
import { paymentSubscriptions } from "./subscriptions";

/**
 * Webhook delivery result.
 *  - ok: successfully processed
 *  - deferred: queued for retry (e.g. subscription not yet mirrored)
 *  - error: failed permanently (or pending dead-letter classification)
 */
export const paymentSubscriptionEventResultEnum = pgEnum("payment_subscription_event_result", [
  "ok",
  "deferred",
  "error",
]);

/**
 * Subscription Events (idempotent webhook ledger).
 *
 * INV-4 (DB UNIQUE): polar_event_id UNIQUE → exactly-once webhook semantics.
 * Cron polls (result='deferred', next_retry_at <= now()) every 2 minutes,
 * up to retry_count=5 → dead-letter.
 */
export const paymentSubscriptionEvents = pgTable(
  "payment_subscription_events",
  {
    ...baseColumns(),

    polarEventId: text("polar_event_id").notNull().unique(),
    subscriptionId: uuid("subscription_id").references(() => paymentSubscriptions.id, {
      onDelete: "set null",
    }),

    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),

    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),

    result: paymentSubscriptionEventResultEnum("result"),
    errorMessage: text("error_message"),

    retryCount: integer("retry_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  },
  (table) => [
    index("payment_sub_events_sub_received_idx").on(
      table.subscriptionId,
      sql`${table.receivedAt} DESC`,
    ),
    index("payment_sub_events_deferred_idx")
      .on(table.result, table.nextRetryAt)
      .where(sql`${table.result} = 'deferred'`),
  ],
);

export type PaymentSubscriptionEvent = typeof paymentSubscriptionEvents.$inferSelect;
export type NewPaymentSubscriptionEvent = typeof paymentSubscriptionEvents.$inferInsert;

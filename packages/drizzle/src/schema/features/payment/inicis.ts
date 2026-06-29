import { baseColumns, user } from "@repo/drizzle/schema";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const paymentInicisOrderStatusEnum = pgEnum("payment_inicis_order_status", [
  "pending_auth",
  "auth_failed",
  "approved",
  "paid",
  "canceled",
  "partially_refunded",
  "refunded",
  "failed",
]);

export const paymentInicisEventStatusEnum = pgEnum("payment_inicis_event_status", [
  "received",
  "processed",
  "failed",
  "replayed",
]);

export const paymentInicisOrders = pgTable(
  "payment_inicis_orders",
  {
    ...baseColumns(),
    orderId: text("order_id").notNull().unique(),
    userId: text("user_id").references(() => user.id),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("KRW"),
    payMethod: text("pay_method").notNull(),
    goodsName: text("goods_name").notNull(),
    buyerNameMasked: text("buyer_name_masked"),
    buyerEmailMasked: text("buyer_email_masked"),
    tid: text("tid"),
    authTid: text("auth_tid"),
    status: paymentInicisOrderStatusEnum("status").notNull().default("pending_auth"),
    providerResultCode: text("provider_result_code"),
    providerResultMessage: text("provider_result_message"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    refundedAmount: integer("refunded_amount").notNull().default(0),
    rawMasked: jsonb("raw_masked"),
    normalized: jsonb("normalized"),
  },
  (table) => [index("payment_inicis_orders_tid_idx").on(table.tid)],
);

export const paymentInicisEvents = pgTable(
  "payment_inicis_events",
  {
    ...baseColumns(),
    eventType: text("event_type").notNull(),
    status: paymentInicisEventStatusEnum("status").notNull().default("received"),
    orderId: text("order_id"),
    tid: text("tid"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    sourceIp: text("source_ip"),
    providerResultCode: text("provider_result_code"),
    providerResultMessage: text("provider_result_message"),
    rawMasked: jsonb("raw_masked").notNull(),
    normalized: jsonb("normalized"),
    errorCode: text("error_code"),
    replayedFromEventId: text("replayed_from_event_id"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    index("payment_inicis_events_order_idx").on(table.orderId),
    index("payment_inicis_events_tid_idx").on(table.tid),
  ],
);

export type PaymentInicisOrder = typeof paymentInicisOrders.$inferSelect;
export type NewPaymentInicisOrder = typeof paymentInicisOrders.$inferInsert;
export type PaymentInicisEvent = typeof paymentInicisEvents.$inferSelect;
export type NewPaymentInicisEvent = typeof paymentInicisEvents.$inferInsert;

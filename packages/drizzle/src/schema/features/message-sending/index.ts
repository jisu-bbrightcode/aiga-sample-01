import { baseColumns, user } from "@repo/drizzle/schema";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const messageSendingProviderEnum = pgEnum("message_sending_provider", ["solapi"]);

export const messageSendingRequestStatusEnum = pgEnum("message_sending_request_status", [
  "pending",
  "sent",
  "partial",
  "failed",
]);

export const messageSendingMessageStatusEnum = pgEnum("message_sending_message_status", [
  "pending",
  "accepted",
  "sent",
  "delivered",
  "failed",
]);

export const messageSendingEventStatusEnum = pgEnum("message_sending_event_status", [
  "received",
  "processed",
  "ignored",
  "failed",
]);

export const messageSendingRequests = pgTable(
  "message_sending_requests",
  {
    ...baseColumns(),
    provider: messageSendingProviderEnum("provider").notNull().default("solapi"),
    status: messageSendingRequestStatusEnum("status").notNull().default("pending"),
    idempotencyKey: text("idempotency_key"),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    senderPhone: text("sender_phone").notNull(),
    providerGroupId: text("provider_group_id"),
    providerRequestId: text("provider_request_id"),
    totalCount: integer("total_count").notNull().default(0),
    acceptedCount: integer("accepted_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
    providerResponse: jsonb("provider_response"),
  },
  (table) => ({
    idempotencyIdx: uniqueIndex("idx_msg_send_requests_idempotency").on(table.idempotencyKey),
    providerGroupIdx: index("idx_msg_send_requests_group").on(
      table.provider,
      table.providerGroupId,
    ),
    statusIdx: index("idx_msg_send_requests_status").on(table.status, table.createdAt),
  }),
);

export const messageSendingMessages = pgTable(
  "message_sending_messages",
  {
    ...baseColumns(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => messageSendingRequests.id, { onDelete: "cascade" }),
    provider: messageSendingProviderEnum("provider").notNull().default("solapi"),
    status: messageSendingMessageStatusEnum("status").notNull().default("pending"),
    recipientPhone: text("recipient_phone").notNull(),
    senderPhone: text("sender_phone").notNull(),
    messageType: text("message_type"),
    country: text("country").notNull().default("82"),
    subject: text("subject"),
    textPreview: text("text_preview").notNull(),
    providerMessageId: text("provider_message_id"),
    providerGroupId: text("provider_group_id"),
    resultCode: text("result_code"),
    resultMessage: text("result_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    providerPayload: jsonb("provider_payload"),
  },
  (table) => ({
    requestIdx: index("idx_msg_send_messages_request").on(table.requestId),
    providerMessageIdx: index("idx_msg_send_messages_provider_id").on(
      table.provider,
      table.providerMessageId,
    ),
    recipientIdx: index("idx_msg_send_messages_recipient").on(
      table.recipientPhone,
      table.createdAt,
    ),
    statusIdx: index("idx_msg_send_messages_status").on(table.status, table.createdAt),
  }),
);

export const messageSendingProviderEvents = pgTable(
  "message_sending_provider_events",
  {
    ...baseColumns(),
    provider: messageSendingProviderEnum("provider").notNull().default("solapi"),
    eventKey: text("event_key").notNull(),
    eventType: text("event_type").notNull(),
    status: messageSendingEventStatusEnum("status").notNull().default("received"),
    providerMessageId: text("provider_message_id"),
    providerGroupId: text("provider_group_id"),
    resultCode: text("result_code"),
    resultMessage: text("result_message"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    payload: jsonb("payload").notNull(),
  },
  (table) => ({
    eventKeyIdx: uniqueIndex("idx_msg_send_events_event_key").on(table.provider, table.eventKey),
    providerMessageIdx: index("idx_msg_send_events_provider_id").on(
      table.provider,
      table.providerMessageId,
    ),
    eventTypeIdx: index("idx_msg_send_events_type").on(table.eventType, table.createdAt),
  }),
);

export const messageSendingRequestsRelations = relations(
  messageSendingRequests,
  ({ many, one }) => ({
    actor: one(user, {
      fields: [messageSendingRequests.actorId],
      references: [user.id],
    }),
    messages: many(messageSendingMessages),
  }),
);

export const messageSendingMessagesRelations = relations(messageSendingMessages, ({ one }) => ({
  request: one(messageSendingRequests, {
    fields: [messageSendingMessages.requestId],
    references: [messageSendingRequests.id],
  }),
}));

export type MessageSendingRequest = typeof messageSendingRequests.$inferSelect;
export type NewMessageSendingRequest = typeof messageSendingRequests.$inferInsert;
export type MessageSendingMessage = typeof messageSendingMessages.$inferSelect;
export type NewMessageSendingMessage = typeof messageSendingMessages.$inferInsert;
export type MessageSendingProviderEvent = typeof messageSendingProviderEvents.$inferSelect;
export type MessageSendingRequestStatus =
  (typeof messageSendingRequestStatusEnum.enumValues)[number];
export type MessageSendingMessageStatus =
  (typeof messageSendingMessageStatusEnum.enumValues)[number];

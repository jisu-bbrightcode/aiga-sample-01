import { baseColumns, user } from "@repo/drizzle/schema";
import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { emailStatusEnum, emailTemplateEnum } from "./enums";
import { emailTemplateVersions } from "./templates";

/**
 * Email Logs Table (base capability + customer delta)
 *
 * 발송된 모든 이메일의 로그. 수신자, provider message id, 상태, 실패 사유,
 * 재시도 정보를 남긴다 (base). PB-NOTI-EMAIL-DATA-001 추가분(델타): 발송 시점에
 * 사용된 정확한 템플릿 버전을 추적하기 위한 `templateKey` + `templateVersionId`.
 * 두 컬럼은 nullable/additive이므로 기존 발송 경로와 호환된다.
 */
export const emailLogs = pgTable(
  "email_logs",
  {
    ...baseColumns(),

    // 수신자 정보
    recipientEmail: text("recipient_email").notNull(),
    recipientName: text("recipient_name"),
    recipientId: text("recipient_id").references(() => user.id, { onDelete: "set null" }),

    // 이메일 정보
    templateType: emailTemplateEnum("template_type").notNull(),
    subject: text("subject").notNull(),

    // 발송에 사용된 템플릿 버전 추적 (델타)
    templateKey: varchar("template_key", { length: 120 }),
    templateVersionId: uuid("template_version_id").references(() => emailTemplateVersions.id, {
      onDelete: "set null",
    }),

    // 발송 상태
    status: emailStatusEnum("status").notNull().default("pending"),
    providerMessageId: text("provider_message_id"), // Resend message ID
    failureReason: text("failure_reason"),
    retryCount: integer("retry_count").notNull().default(0),

    // 중복 발송 방지 키 (PB-NOTI-EMAIL-SEND-001 델타). caller가 제공한 키로
    // 트랜잭션 발송을 멱등하게 처리한다. nullable/additive 이므로 기존 발송
    // 경로와 호환되며, 부분 unique index 가 NULL 행은 무시한다.
    idempotencyKey: varchar("idempotency_key", { length: 200 }),

    // 시간 추적
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),

    // 메타데이터 (템플릿 변수, 추가 정보)
    metadata: jsonb("metadata"),
  },
  (table) => ({
    recipientEmailIdx: index("idx_email_logs_recipient").on(table.recipientEmail, table.createdAt),
    statusIdx: index("idx_email_logs_status").on(table.status, table.createdAt),
    templateIdx: index("idx_email_logs_template").on(table.templateType, table.createdAt),
    templateKeyIdx: index("idx_email_logs_template_key").on(table.templateKey, table.createdAt),
    idempotencyKeyIdx: uniqueIndex("uq_email_logs_idempotency_key")
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
  }),
);

// Relations
export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  recipient: one(user, {
    fields: [emailLogs.recipientId],
    references: [user.id],
  }),
  templateVersion: one(emailTemplateVersions, {
    fields: [emailLogs.templateVersionId],
    references: [emailTemplateVersions.id],
  }),
}));

// Type Exports
export type EmailLog = typeof emailLogs.$inferSelect;
export type NewEmailLog = typeof emailLogs.$inferInsert;

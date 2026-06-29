import { baseColumns, user } from "@repo/drizzle/schema";
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { emailTemplateCategoryEnum, emailTemplateVersionStatusEnum } from "./enums";

/**
 * Email Templates Table (customer delta — PB-NOTI-EMAIL-DATA-001 / BBR-655)
 *
 * Registry of email templates keyed by a stable, human-readable `key`
 * (e.g. `auth.welcome`). The row holds template-level metadata; the actual
 * content lives in versioned rows (`email_template_versions`). `currentVersionId`
 * points at the published version that should be used for new sends, which is
 * what enables rollback: re-point it at an earlier published/archived version.
 */
export const emailTemplates = pgTable(
  "email_templates",
  {
    ...baseColumns(),

    // 안정적인 템플릿 식별자 (코드/seed에서 참조)
    key: varchar("key", { length: 120 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    category: emailTemplateCategoryEnum("category").notNull().default("transactional"),

    // 현재 발송에 사용할 published 버전 포인터 (롤백 시 재지정).
    // FK는 마이그레이션에서 정의 (templates ↔ versions 순환 참조 회피).
    currentVersionId: uuid("current_version_id"),

    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => ({
    keyUq: uniqueIndex("uq_email_templates_key").on(table.key),
    categoryIdx: index("idx_email_templates_category").on(table.category),
  }),
);

/**
 * Email Template Versions Table (customer delta)
 *
 * Immutable-ish snapshot of a template's content at a given `version`. Keeping
 * every version lets the system roll back and validate which content was used
 * for any send. `variableSchema` records the variables the template expects so
 * renders can be validated before send.
 */
export const emailTemplateVersions = pgTable(
  "email_template_versions",
  {
    ...baseColumns(),

    templateId: uuid("template_id")
      .notNull()
      .references(() => emailTemplates.id, { onDelete: "cascade" }),

    // 템플릿 내 1부터 증가하는 버전 번호
    version: integer("version").notNull(),

    subject: text("subject").notNull(),

    // 템플릿이 기대하는 변수 스키마 (검증용): { name: { type, required, description } }
    variableSchema: jsonb("variable_schema"),

    // React 템플릿은 key로 렌더되므로 body는 선택. DB 저장형 템플릿을 위한 소스.
    bodySource: text("body_source"),

    status: emailTemplateVersionStatusEnum("status").notNull().default("draft"),
    changelog: text("changelog"),

    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => ({
    templateVersionUq: unique("uq_email_template_versions_template_version").on(
      table.templateId,
      table.version,
    ),
    templateIdx: index("idx_email_template_versions_template").on(table.templateId, table.version),
    statusIdx: index("idx_email_template_versions_status").on(table.status),
  }),
);

// Relations
export const emailTemplatesRelations = relations(emailTemplates, ({ one, many }) => ({
  versions: many(emailTemplateVersions),
  currentVersion: one(emailTemplateVersions, {
    fields: [emailTemplates.currentVersionId],
    references: [emailTemplateVersions.id],
  }),
}));

export const emailTemplateVersionsRelations = relations(emailTemplateVersions, ({ one }) => ({
  template: one(emailTemplates, {
    fields: [emailTemplateVersions.templateId],
    references: [emailTemplates.id],
  }),
  author: one(user, {
    fields: [emailTemplateVersions.createdBy],
    references: [user.id],
  }),
}));

// Type Exports
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type EmailTemplateVersion = typeof emailTemplateVersions.$inferSelect;
export type NewEmailTemplateVersion = typeof emailTemplateVersions.$inferInsert;

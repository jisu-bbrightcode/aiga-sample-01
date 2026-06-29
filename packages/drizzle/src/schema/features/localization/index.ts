import { relations } from "drizzle-orm";
import { boolean, integer, jsonb, pgEnum, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { baseColumnsWithSoftDelete } from "../../../utils/columns";
import { projectProjects } from "../project";

// ============================================================================
// Enums
// ============================================================================

export const locTranslationStatusEnum = pgEnum("loc_translation_status", [
  "pending",
  "translated",
  "reviewed",
  "approved",
]);

// ============================================================================
// Types
// ============================================================================

export interface GlossaryTranslation {
  languageCode: string;
  translation: string;
}

// ============================================================================
// Tables
// ============================================================================

export const locLanguages = pgTable("loc_languages", {
  ...baseColumnsWithSoftDelete(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 10 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  isSource: boolean("is_source").notNull().default(false),
  progress: integer("progress").notNull().default(0),
});

export const locTranslations = pgTable("loc_translations", {
  ...baseColumnsWithSoftDelete(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
  languageId: uuid("language_id")
    .notNull()
    .references(() => locLanguages.id, { onDelete: "cascade" }),
  entityId: uuid("entity_id").notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  field: varchar("field", { length: 50 }).notNull(),
  sourceText: text("source_text"),
  translatedText: text("translated_text"),
  status: locTranslationStatusEnum("status").notNull().default("pending"),
});

export const locGlossary = pgTable("loc_glossary", {
  ...baseColumnsWithSoftDelete(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
  term: varchar("term", { length: 200 }).notNull(),
  definition: text("definition"),
  translations: jsonb("translations").$type<GlossaryTranslation[]>().default([]),
});

// ============================================================================
// Relations
// ============================================================================

export const locLanguagesRelations = relations(locLanguages, ({ one }) => ({
  project: one(projectProjects, {
    fields: [locLanguages.projectId],
    references: [projectProjects.id],
  }),
}));

export const locTranslationsRelations = relations(locTranslations, ({ one }) => ({
  project: one(projectProjects, {
    fields: [locTranslations.projectId],
    references: [projectProjects.id],
  }),
  language: one(locLanguages, {
    fields: [locTranslations.languageId],
    references: [locLanguages.id],
  }),
}));

export const locGlossaryRelations = relations(locGlossary, ({ one }) => ({
  project: one(projectProjects, {
    fields: [locGlossary.projectId],
    references: [projectProjects.id],
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type LocLanguage = typeof locLanguages.$inferSelect;
export type NewLocLanguage = typeof locLanguages.$inferInsert;

export type LocTranslation = typeof locTranslations.$inferSelect;
export type NewLocTranslation = typeof locTranslations.$inferInsert;

export type LocGlossaryEntry = typeof locGlossary.$inferSelect;
export type NewLocGlossaryEntry = typeof locGlossary.$inferInsert;

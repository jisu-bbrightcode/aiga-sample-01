import { relations } from "drizzle-orm";
import { integer, jsonb, pgEnum, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { baseColumnsWithSoftDelete } from "../../../utils/columns";
import { profiles } from "../../core/profiles";
import { projectProjects } from "../project";

// ============================================================================
// Enums
// ============================================================================

export const storyEntityTypeEnum = pgEnum("story_entity_type", [
  "world",
  "character",
  "location",
  "faction",
  "codex",
  "draft",
]);

export const storyTranslationStatusEnum = pgEnum("story_translation_status", [
  "draft",
  "review",
  "approved",
]);

// ============================================================================
// Tables — Worldbuilding Entities
// ============================================================================

export const storyWorlds = pgTable("story_worlds", {
  ...baseColumnsWithSoftDelete(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  body: text("body"),
  genre: varchar("genre", { length: 100 }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
});

export const storyCharacters = pgTable("story_characters", {
  ...baseColumnsWithSoftDelete(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  body: text("body"),
  age: varchar("age", { length: 50 }),
  occupation: varchar("occupation", { length: 100 }),
  personality: varchar("personality", { length: 200 }),
  voice: varchar("voice", { length: 200 }),
  roles: jsonb("roles").$type<string[]>().notNull().default([]),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
});

export const storyLocations = pgTable("story_locations", {
  ...baseColumnsWithSoftDelete(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  body: text("body"),
  region: varchar("region", { length: 100 }),
  climate: varchar("climate", { length: 100 }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
});

export const storyFactions = pgTable("story_factions", {
  ...baseColumnsWithSoftDelete(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  body: text("body"),
  goal: text("goal"),
  influence: varchar("influence", { length: 200 }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
});

export const storyCodex = pgTable("story_codex", {
  ...baseColumnsWithSoftDelete(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  body: text("body"),
  category: varchar("category", { length: 100 }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
});

// ============================================================================
// Tables — Drafts
// ============================================================================

export const storyDrafts = pgTable("story_drafts", {
  ...baseColumnsWithSoftDelete(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  body: text("body"),
  sortOrder: integer("sort_order").notNull().default(0),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
});

// ============================================================================
// Tables — Tags & Relations
// ============================================================================

export const storyTags = pgTable("story_tags", {
  ...baseColumnsWithSoftDelete(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }),
  /** Settings redesign Phase 4 — short tag description shown in the
   * project detail tag table (design row "이름 / 설명 / 만든 날짜"). */
  description: text("description"),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
});

export const storyEntityTags = pgTable("story_entity_tags", {
  ...baseColumnsWithSoftDelete(),
  entityId: uuid("entity_id").notNull(),
  entityType: storyEntityTypeEnum("entity_type").notNull(),
  tagId: uuid("tag_id")
    .notNull()
    .references(() => storyTags.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
});

export const storyRelations = pgTable("story_relations", {
  ...baseColumnsWithSoftDelete(),
  sourceId: uuid("source_id").notNull(),
  sourceType: storyEntityTypeEnum("source_type").notNull(),
  targetId: uuid("target_id").notNull(),
  targetType: storyEntityTypeEnum("target_type").notNull(),
  label: varchar("label", { length: 100 }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
});

// ============================================================================
// Tables — Entity Properties (동적 속성)
// ============================================================================

export interface StoryPropertyValue {
  key: string;
  value: string;
}

export const storyEntityProperties = pgTable("story_entity_properties", {
  ...baseColumnsWithSoftDelete(),
  entityId: uuid("entity_id").notNull(),
  entityType: storyEntityTypeEnum("entity_type").notNull(),
  properties: jsonb("properties").$type<StoryPropertyValue[]>().default([]),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
});

// ============================================================================
// Relations
// ============================================================================

export const storyWorldsRelations = relations(storyWorlds, ({ one }) => ({
  project: one(projectProjects, {
    fields: [storyWorlds.projectId],
    references: [projectProjects.id],
  }),
  owner: one(profiles, {
    fields: [storyWorlds.ownerId],
    references: [profiles.id],
  }),
}));

export const storyCharactersRelations = relations(storyCharacters, ({ one }) => ({
  project: one(projectProjects, {
    fields: [storyCharacters.projectId],
    references: [projectProjects.id],
  }),
  owner: one(profiles, {
    fields: [storyCharacters.ownerId],
    references: [profiles.id],
  }),
}));

export const storyLocationsRelations = relations(storyLocations, ({ one }) => ({
  project: one(projectProjects, {
    fields: [storyLocations.projectId],
    references: [projectProjects.id],
  }),
  owner: one(profiles, {
    fields: [storyLocations.ownerId],
    references: [profiles.id],
  }),
}));

export const storyFactionsRelations = relations(storyFactions, ({ one }) => ({
  project: one(projectProjects, {
    fields: [storyFactions.projectId],
    references: [projectProjects.id],
  }),
  owner: one(profiles, {
    fields: [storyFactions.ownerId],
    references: [profiles.id],
  }),
}));

export const storyCodexRelations = relations(storyCodex, ({ one }) => ({
  project: one(projectProjects, {
    fields: [storyCodex.projectId],
    references: [projectProjects.id],
  }),
  owner: one(profiles, {
    fields: [storyCodex.ownerId],
    references: [profiles.id],
  }),
}));

export const storyDraftsRelations = relations(storyDrafts, ({ one }) => ({
  project: one(projectProjects, {
    fields: [storyDrafts.projectId],
    references: [projectProjects.id],
  }),
  owner: one(profiles, {
    fields: [storyDrafts.ownerId],
    references: [profiles.id],
  }),
}));

export const storyTagsRelations = relations(storyTags, ({ one }) => ({
  project: one(projectProjects, {
    fields: [storyTags.projectId],
    references: [projectProjects.id],
  }),
}));

export const storyEntityTagsRelations = relations(storyEntityTags, ({ one }) => ({
  project: one(projectProjects, {
    fields: [storyEntityTags.projectId],
    references: [projectProjects.id],
  }),
  tag: one(storyTags, {
    fields: [storyEntityTags.tagId],
    references: [storyTags.id],
  }),
}));

export const storyRelationsRelations = relations(storyRelations, ({ one }) => ({
  project: one(projectProjects, {
    fields: [storyRelations.projectId],
    references: [projectProjects.id],
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type StoryWorld = typeof storyWorlds.$inferSelect;
export type NewStoryWorld = typeof storyWorlds.$inferInsert;

export type StoryCharacter = typeof storyCharacters.$inferSelect;
export type NewStoryCharacter = typeof storyCharacters.$inferInsert;

export type StoryLocation = typeof storyLocations.$inferSelect;
export type NewStoryLocation = typeof storyLocations.$inferInsert;

export type StoryFaction = typeof storyFactions.$inferSelect;
export type NewStoryFaction = typeof storyFactions.$inferInsert;

export type StoryCodexEntry = typeof storyCodex.$inferSelect;
export type NewStoryCodexEntry = typeof storyCodex.$inferInsert;

export type StoryDraft = typeof storyDrafts.$inferSelect;
export type NewStoryDraft = typeof storyDrafts.$inferInsert;

export type StoryTag = typeof storyTags.$inferSelect;
export type NewStoryTag = typeof storyTags.$inferInsert;

export type StoryEntityTag = typeof storyEntityTags.$inferSelect;
export type StoryRelation = typeof storyRelations.$inferSelect;
export type StoryEntityProperty = typeof storyEntityProperties.$inferSelect;

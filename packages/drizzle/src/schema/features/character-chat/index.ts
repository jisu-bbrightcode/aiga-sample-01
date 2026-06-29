import { relations } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { baseColumnsWithSoftDelete } from "../../../utils/columns";
import { profiles } from "../../core/profiles";
import { projectProjects } from "../project";
import { storyCharacters } from "../story";

// ============================================================================
// Enums
// ============================================================================

export const characterActorStatusEnum = pgEnum("character_actor_status", [
  "not_enabled",
  "preparing",
  "ready",
  "failed",
  "disabled",
]);

export const characterChatMessageRoleEnum = pgEnum("character_chat_message_role", [
  "user",
  "assistant",
  "system",
  "tool",
]);

export const characterChatMessageStatusEnum = pgEnum("character_chat_message_status", [
  "pending",
  "streaming",
  "completed",
  "failed",
  "interrupted",
]);

// ============================================================================
// Actor Tables
// ============================================================================

export const characterActors = pgTable("character_actors", {
  ...baseColumnsWithSoftDelete(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
  characterId: uuid("character_id")
    .notNull()
    .references(() => storyCharacters.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  status: characterActorStatusEnum("status").notNull().default("not_enabled"),
  enabled: boolean("enabled").notNull().default(false),
  displayName: varchar("display_name", { length: 200 }),
  modelProvider: varchar("model_provider", { length: 50 }).notNull().default("gateway"),
  modelName: varchar("model_name", { length: 100 }).notNull().default("openai/gpt-4o-mini"),
  allowedContextScope: jsonb("allowed_context_scope").$type<string[]>().notNull().default([]),
  safetyRules: text("safety_rules"),
  toolScope: jsonb("tool_scope").$type<string[]>().notNull().default([]),
  snapshotVersion: uuid("snapshot_version"),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
  greetingMessageId: uuid("greeting_message_id"),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
});

export const characterActorSnapshots = pgTable("character_actor_snapshots", {
  ...baseColumnsWithSoftDelete(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => characterActors.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
  characterId: uuid("character_id")
    .notNull()
    .references(() => storyCharacters.id, { onDelete: "cascade" }),
  personaSummary: text("persona_summary"),
  speechStyle: text("speech_style"),
  backgroundSummary: text("background_summary"),
  relationSummary: text("relation_summary"),
  worldContextSummary: text("world_context_summary"),
  toolScope: jsonb("tool_scope").$type<string[]>().notNull().default([]),
  safetyRules: text("safety_rules"),
  modelConfig: jsonb("model_config").$type<Record<string, unknown>>().notNull().default({}),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
});

// ============================================================================
// Chat Tables
// ============================================================================

export const characterChatThreads = pgTable("character_chat_threads", {
  ...baseColumnsWithSoftDelete(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
  characterId: uuid("character_id")
    .notNull()
    .references(() => storyCharacters.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => characterActors.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 300 }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const characterChatMessages = pgTable("character_chat_messages", {
  ...baseColumnsWithSoftDelete(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => characterChatThreads.id, { onDelete: "cascade" }),
  role: characterChatMessageRoleEnum("role").notNull(),
  status: characterChatMessageStatusEnum("status").notNull().default("pending"),
  content: text("content"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  tokenUsage: jsonb("token_usage").$type<Record<string, unknown>>().notNull().default({}),
  providerRequestId: varchar("provider_request_id", { length: 200 }),
  modelProvider: varchar("model_provider", { length: 50 }),
  modelName: varchar("model_name", { length: 100 }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const characterChatListPreferences = pgTable("character_chat_list_preferences", {
  ...baseColumnsWithSoftDelete(),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectProjects.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => characterActors.id, { onDelete: "cascade" }),
  hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  pinnedAt: timestamp("pinned_at", { withTimezone: true }),
  lastOpenedThreadId: uuid("last_opened_thread_id"),
});

// ============================================================================
// Relations
// ============================================================================

export const characterActorsRelations = relations(characterActors, ({ one, many }) => ({
  project: one(projectProjects, {
    fields: [characterActors.projectId],
    references: [projectProjects.id],
  }),
  character: one(storyCharacters, {
    fields: [characterActors.characterId],
    references: [storyCharacters.id],
  }),
  createdBy: one(profiles, {
    fields: [characterActors.createdByUserId],
    references: [profiles.id],
  }),
  snapshots: many(characterActorSnapshots),
  threads: many(characterChatThreads),
  listPreferences: many(characterChatListPreferences),
}));

export const characterActorSnapshotsRelations = relations(characterActorSnapshots, ({ one }) => ({
  actor: one(characterActors, {
    fields: [characterActorSnapshots.actorId],
    references: [characterActors.id],
  }),
}));

export const characterChatThreadsRelations = relations(characterChatThreads, ({ one, many }) => ({
  actor: one(characterActors, {
    fields: [characterChatThreads.actorId],
    references: [characterActors.id],
  }),
  messages: many(characterChatMessages),
}));

export const characterChatMessagesRelations = relations(characterChatMessages, ({ one }) => ({
  thread: one(characterChatThreads, {
    fields: [characterChatMessages.threadId],
    references: [characterChatThreads.id],
  }),
}));

export const characterChatListPreferencesRelations = relations(
  characterChatListPreferences,
  ({ one }) => ({
    actor: one(characterActors, {
      fields: [characterChatListPreferences.actorId],
      references: [characterActors.id],
    }),
  }),
);

import { relations } from "drizzle-orm";
import { pgEnum, pgTable, primaryKey, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { baseColumnsWithSoftDelete } from "../../../utils/columns";
import { organizations } from "../../core/better-auth";
import { profiles } from "../../core/profiles";

// ============================================================================
// Enums
// ============================================================================

export const projectStatusEnum = pgEnum("project_status", ["active", "archived", "completed"]);

export const projectAiModeEnum = pgEnum("project_ai_mode", ["ai_powered", "ai_safety"]);

/**
 * Settings redesign Phase 4 — visibility scope shown on project cards.
 * Default `private` so existing rows back-fill safely. Mutations are
 * backlog this phase.
 */
export const projectVisibilityEnum = pgEnum("project_visibility", ["private", "org", "public"]);

// ============================================================================
// Tables
// ============================================================================

export const projectProjects = pgTable("project_projects", {
  ...baseColumnsWithSoftDelete(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  genre: varchar("genre", { length: 100 }),
  template: varchar("template", { length: 100 }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  status: projectStatusEnum("status").notNull().default("active"),
  aiMode: projectAiModeEnum("ai_mode").notNull().default("ai_safety"),
  lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  /** Settings redesign Phase 4: read-only handle (`product-builder.app/{org}/{handle}`). */
  handle: varchar("handle", { length: 64 }),
  /** Settings redesign Phase 4: read-only visibility on cards / detail. */
  visibility: projectVisibilityEnum("visibility").notNull().default("private"),
  /**
   * Project list redesign — cover artwork shown on the card. Either a path
   * to a built-in pattern (e.g. `/patterns/pattern-04.jpg`) or a data: URL
   * for a user upload. Null = use deterministic default pattern derived
   * from the project id.
   */
  coverImage: text("cover_image"),
});

/**
 * Settings redesign Phase 4 — per-user starred / favorite projects.
 * Composite PK = (userId, projectId). Read-only this phase.
 */
export const projectStarred = pgTable(
  "project_starred",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectProjects.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.projectId] })],
);

/**
 * Settings redesign Phase 4 — project member roster (project-level
 * membership, distinct from organization member). Read-only this phase.
 */
export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectProjects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

// ============================================================================
// Relations
// ============================================================================

export const projectProjectsRelations = relations(projectProjects, ({ one }) => ({
  owner: one(profiles, {
    fields: [projectProjects.ownerId],
    references: [profiles.id],
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type ProjectProject = typeof projectProjects.$inferSelect;
export type NewProjectProject = typeof projectProjects.$inferInsert;
export type ProjectStarred = typeof projectStarred.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;

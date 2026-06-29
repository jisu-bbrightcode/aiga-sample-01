/**
 * Comment Feature Schema
 * Polymorphic comment system
 */

import { user } from "@repo/drizzle/schema";
import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Comment target type (Polymorphic)
 */
export const commentTargetType = pgEnum("comment_target_type", [
  "board_post",
  "community_post",
  "blog_post",
  "page",
]);

/**
 * Comment status
 */
export const commentStatus = pgEnum("comment_status", ["visible", "hidden", "deleted"]);

/**
 * Comments table
 */
export const comments = pgTable(
  "comment_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    content: text("content").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetType: commentTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    parentId: uuid("parent_id"),
    depth: integer("depth").notNull().default(0),
    status: commentStatus("status").notNull().default("visible"),
    mentions: jsonb("mentions").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_comment_comments_target").on(table.targetType, table.targetId),
    index("idx_comment_comments_parent").on(table.parentId),
    index("idx_comment_comments_author").on(table.authorId),
  ],
);

export const commentsRelations = relations(comments, ({ one, many }) => ({
  author: one(user, {
    fields: [comments.authorId],
    references: [user.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "parentChild",
  }),
  children: many(comments, {
    relationName: "parentChild",
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

/**
 * Reaction Feature Schema
 * Polymorphic reaction system
 */
import { baseColumns, user } from "@repo/drizzle/schema";
import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Reactions table
 * - Polymorphic reactions (applicable to all content types)
 */
export const reactions = pgTable(
  "reaction_reactions",
  {
    ...baseColumns(),
    targetType: text("target_type").notNull(), // 'board_post' | 'comment' | 'blog_post' | ...
    targetId: uuid("target_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("like"), // 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry'
  },
  (table) => [
    uniqueIndex("reaction_reactions_unique_idx").on(
      table.targetType,
      table.targetId,
      table.userId,
      table.type,
    ),
    index("reaction_reactions_target_idx").on(table.targetType, table.targetId),
    index("reaction_reactions_user_idx").on(table.userId),
  ],
);

// Type exports
export type ReactionRow = typeof reactions.$inferSelect;
export type NewReactionRow = typeof reactions.$inferInsert;

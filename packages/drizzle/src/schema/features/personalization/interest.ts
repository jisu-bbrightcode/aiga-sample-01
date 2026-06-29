import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id } from "../../../utils/columns";
import { users } from "../../core/better-auth";
import { personalizationTargetTypeEnum } from "./enums";

/**
 * 관심 (Interest) — a user's "following"/interest mark on a catalog resource.
 *
 * FR-002 개인화 (BBR-732). Like {@link savedItem} this is owner-scoped
 * (`user_id` NOT NULL) and deduplicated per (user, resource). It is an
 * append-style record with no editable fields, so it carries only `created_at`
 * (no `updated_at`).
 */
export const interest = pgTable(
  "interest",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: personalizationTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // 중복 관심 방지 — one interest per (user, resource)
    uniqueIndex("uq_interest_owner_target").on(t.userId, t.targetType, t.targetId),
    // 사용자별 관심 목록 최근순 (also serves user_id lookups)
    index("idx_interest_user_created").on(t.userId, t.createdAt),
  ],
);

export type Interest = typeof interest.$inferSelect;
export type NewInterest = typeof interest.$inferInsert;

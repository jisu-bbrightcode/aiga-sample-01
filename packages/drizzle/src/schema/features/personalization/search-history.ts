import { index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { id } from "../../../utils/columns";
import { users } from "../../core/better-auth";

/**
 * 검색 히스토리 (Search history) — a user's past searches.
 *
 * FR-002 개인화 (BBR-732). Owner-scoped (`user_id` NOT NULL); unlike saves and
 * interests, repeats are allowed (a user may run the same search many times),
 * so there is no uniqueness constraint. Records are immutable once written, so
 * only `created_at` is tracked.
 *
 * `query` is the raw search term; `filters` is a JSON snapshot of the filter
 * state that was applied (region/specialty/etc.) so the search can be replayed
 * exactly as the user ran it.
 */
export const searchHistory = pgTable(
  "search_history",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Raw search term. Empty string is allowed for filter-only searches. */
    query: varchar("query", { length: 500 }).notNull(),
    /** Snapshot of applied filters (region/specialty/sort/etc.). */
    filters: jsonb("filters"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // 사용자별 최근순 — recency-ordered history per user (also serves user_id lookups)
    index("idx_search_history_user_created").on(t.userId, t.createdAt),
  ],
);

export type SearchHistory = typeof searchHistory.$inferSelect;
export type NewSearchHistory = typeof searchHistory.$inferInsert;

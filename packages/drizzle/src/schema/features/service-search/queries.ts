import { index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { id } from "../../../utils/columns";
import { users } from "../../core/better-auth";
import { serviceSearchEntityTypeEnum } from "./enums";

/**
 * 검색 로그 (Search query log) — FR-003 / BBR-521.
 *
 * Append-only log of executed searches. It is the single source for three
 * derived surfaces, each with a different visibility scope:
 * - public: aggregate 인기 검색어 (top normalizedQuery counts in a time window) —
 *           rows are never exposed individually, only counts.
 * - app:    a signed-in user's own 최근 검색어 (filter userId = self).
 * - admin:  raw log + zero-result report (resultCount = 0) to find catalog gaps.
 *
 * Append-only: no updatedAt / soft-delete (immutable audit rows).
 */
export const serviceSearchQueries = pgTable(
  "service_search_queries",
  {
    id: id(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

    /** Query exactly as typed (for admin display). */
    rawQuery: varchar("raw_query", { length: 300 }).notNull(),
    /** Normalized (lowercased, trimmed, collapsed whitespace) for aggregation. */
    normalizedQuery: varchar("normalized_query", { length: 300 }).notNull(),
    /** Signed-in searcher; null for anonymous public visitors. */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),

    // applied filters (denormalized, no FK)
    entityType: serviceSearchEntityTypeEnum("entity_type"),
    regionId: uuid("region_id"),
    specialtyId: uuid("specialty_id"),

    /** Number of results returned; 0 marks a zero-result query (admin gap report). */
    resultCount: integer("result_count").notNull().default(0),

    // optional click-through (CTR analytics)
    clickedEntityType: serviceSearchEntityTypeEnum("clicked_entity_type"),
    clickedEntityId: uuid("clicked_entity_id"),
  },
  (t) => [
    // public 인기 검색어: group by normalized term over a recent window
    index("idx_service_search_queries_norm_created").on(t.normalizedQuery, t.createdAt),
    // app 최근 검색어: a user's own recent searches, newest first
    index("idx_service_search_queries_user_created").on(t.userId, t.createdAt),
    // admin zero-result report
    index("idx_service_search_queries_result_count").on(t.resultCount),
    // admin time-window scans
    index("idx_service_search_queries_created").on(t.createdAt),
  ],
);

export type ServiceSearchQuery = typeof serviceSearchQueries.$inferSelect;
export type NewServiceSearchQuery = typeof serviceSearchQueries.$inferInsert;

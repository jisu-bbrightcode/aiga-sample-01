import { boolean, index, pgTable, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "../../../utils/columns";

/**
 * 검색 동의어 (Search synonyms) — admin-managed query expansion. FR-003 / BBR-521.
 *
 * Korean medical search has high synonymy (정형외과 ↔ 뼈/관절, 소아과 ↔ 소아청소년과).
 * Admins curate term → expansions here; the search service expands an incoming
 * query and folds matches into the catalog's `keywords` at reindex time so
 * recall improves without changing the source records.
 *
 * Field visibility:
 * - public:     (none directly) — expansions only affect ranking, never shown
 * - admin-only: term, expansions, specialtyId, isActive, notes
 */
export const serviceSearchSynonyms = pgTable(
  "service_search_synonyms",
  {
    ...baseColumns(),

    /** Canonical term, normalized (lowercased, trimmed). Unique. */
    term: varchar("term", { length: 100 }).notNull(),
    /** Alternate terms that should match `term`. */
    expansions: text("expansions").array().notNull().default([]),
    /** Optional scope to a specialty context (denormalized, no FK). */
    specialtyId: uuid("specialty_id"),
    /** Admin toggle: disable without deleting (preserves history). */
    isActive: boolean("is_active").notNull().default(true),
    /** Internal editorial note. Admin-only. */
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("uq_service_search_synonyms_term").on(t.term),
    // admin listing: active synonyms
    index("idx_service_search_synonyms_active").on(t.isActive),
    // NOTE: GIN(expansions) for reverse lookup is created in migration 0047.
  ],
);

export type ServiceSearchSynonym = typeof serviceSearchSynonyms.$inferSelect;
export type NewServiceSearchSynonym = typeof serviceSearchSynonyms.$inferInsert;

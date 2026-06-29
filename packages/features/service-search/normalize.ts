/**
 * 통합검색 query/sort helpers — pure functions (FR-003 / BBR-531).
 *
 * Kept side-effect-free so the normalization + sort rules can be unit-tested
 * without a database or HTTP layer. `normalizeQuery` matches the seed/reindex
 * normalization (lowercase, trim, collapse internal whitespace) so a logged
 * `normalizedQuery` aggregates identically to the seeded demo rows.
 */

/** Sort modes for the unified search list. */
export const SEARCH_SORT_MODES = ["relevance", "rating", "featured"] as const;
export type SearchSortMode = (typeof SEARCH_SORT_MODES)[number];

/**
 * Normalize a raw query for aggregation/logging: lowercased, trimmed, and with
 * runs of internal whitespace collapsed to a single space.
 */
export function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Resolve the effective sort mode.
 *
 * `relevance` only makes sense when there is a text query to rank against; a
 * relevance sort with no `q` falls back to `featured` (editorial weight) so the
 * default browse order is deterministic.
 */
export function resolveSortMode(
  requested: SearchSortMode | undefined,
  hasQuery: boolean,
): SearchSortMode {
  if (requested === "rating") return "rating";
  if (requested === "relevance") return hasQuery ? "relevance" : "featured";
  // default + explicit "featured"
  return hasQuery && requested === undefined ? "relevance" : "featured";
}

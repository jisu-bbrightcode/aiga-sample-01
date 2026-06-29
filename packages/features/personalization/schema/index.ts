/**
 * Personalization schema re-exports (FR-002 / BBR-724).
 *
 * The owner-scoped saved-item / interest / search-history tables live in the
 * drizzle package (PB-FEAT-002 / BBR-732). The feature imports them through
 * this barrel so the rest of the module never reaches into `@repo/drizzle`
 * internals directly.
 */
export {
  type Interest,
  interest,
  type NewInterest,
  type NewSavedItem,
  type NewSearchHistory,
  personalizationTargetTypeEnum,
  type SavedItem,
  type SearchHistory,
  savedItem,
  searchHistory,
} from "@repo/drizzle";

/**
 * AIGA 개인화 (Personalization) — schema barrel.
 *
 * Capability: FR-002 개인화 (저장/관심/검색 히스토리) — PB-FEAT-002 / BBR-732.
 *
 * Three owner-scoped tables: `saved_item` (저장), `interest` (관심),
 * `search_history` (검색 히스토리). All reference the better-auth `users`
 * table; saves/interests point polymorphically at the service-domain catalog
 * (PB-DATA-001) via (target_type, target_id). See
 * doc/data/PB-FEAT-002-personalization-data-model.md for the resource map.
 */
export * from "./enums";
export * from "./saved-item";
export * from "./interest";
export * from "./search-history";

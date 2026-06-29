/**
 * AIGA 통합검색 (Unified search) — schema barrel.
 *
 * Capability: `domain.feature.fr-003.data` (PB-DATA-FR003 / BBR-521).
 * Depends on the PB-DATA-001 service-domain hub: this feature projects that
 * catalog into a single searchable index and adds search-only resources
 * (synonyms, query log). It references the hub by id only (denormalized facet
 * keys, polymorphic entityId) — it never redefines hub tables.
 *
 * See doc/data/PB-DATA-FR003-search-data-model.md for the ERD, the
 * public/admin field-visibility map, and the reindex strategy.
 */

export * from "./documents";
export * from "./enums";
export * from "./queries";
export * from "./synonyms";

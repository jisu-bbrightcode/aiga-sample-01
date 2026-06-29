import { pgEnum } from "drizzle-orm/pg-core";

/**
 * AIGA 통합검색 (FR-003) — shared enums.
 *
 * Capability: `domain.feature.fr-003.data` (PB-DATA-FR003 / BBR-521).
 * Builds on the PB-DATA-001 service-domain hub (의사/병원 큐레이션) by adding a
 * unified search projection over its published catalog rows.
 */

/**
 * The kind of catalog resource a search row points at.
 *
 * `service_search_documents.entityType` and the optional click/filter columns
 * on `service_search_queries` use this. The id stored alongside is a
 * polymorphic reference into the matching service-domain table (resolved in
 * application code), so there is intentionally no FK — the search index is a
 * rebuildable denormalized projection, not a source of truth.
 */
export const serviceSearchEntityTypeEnum = pgEnum("service_search_entity_type", [
  "doctor",
  "hospital",
  "specialty",
  "region",
]);

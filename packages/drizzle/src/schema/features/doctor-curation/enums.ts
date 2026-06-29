import { pgEnum } from "drizzle-orm/pg-core";

/**
 * FR-004 명의 큐레이션 (PB-FEAT-004 / BBR-522) — feature enums.
 *
 * Capability: `domain.feature.fr-004.data`. This feature owns the editorial
 * "명의 찾기" curation layer **on top of** the PB-DATA-001 doctor hub
 * (`service_doctors` / `service_specialties` / `service_regions`). It references
 * those tables by id and does NOT redefine them — see
 * doc/data/PB-FEAT-004-doctor-curation-data-model.md for the ownership boundary.
 *
 * The publish lifecycle reuses `service_publish_status` from the hub (only
 * `published` rows are public); this module only adds the curation-specific
 * vocabulary below.
 */

/**
 * Kind of a 명의 collection (기획전) — drives the public browse facet (필터).
 * - editorial: 테마/기획 collection (e.g. "2026 무릎관절 명의").
 * - specialty: 분야별 명의 — scoped to a `service_specialties` row.
 * - region:    지역별 명의 — scoped to a `service_regions` row.
 */
export const serviceCollectionKindEnum = pgEnum("service_collection_kind", [
  "editorial",
  "specialty",
  "region",
]);

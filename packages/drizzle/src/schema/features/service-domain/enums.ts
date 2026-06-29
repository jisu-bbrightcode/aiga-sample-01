import { pgEnum } from "drizzle-orm/pg-core";

/**
 * AIGA Service Domain — shared enums
 *
 * Capability: `domain.service-schema` (PB-DATA-001, BBR-519).
 * Service type: 의사/병원 큐레이션 (doctor / hospital curation).
 *
 * These enums are the shared vocabulary for the editorial catalog (doctors,
 * hospitals, taxonomy). Per-FR clusters (FR-001 등급, FR-002 개인화, FR-003
 * 통합검색, FR-004 명의 큐레이션) reference these tables/enums but own their
 * own feature-specific enums in their own modules.
 */

/**
 * Editorial lifecycle for catalog records (doctors, hospitals).
 *
 * Public surfaces (apps/site) MUST only expose `published` rows. `draft` and
 * `archived` are admin-only states. This is the primary public/admin status
 * separation required by the acceptance criteria.
 */
export const servicePublishStatusEnum = pgEnum("service_publish_status", [
  "draft",
  "published",
  "archived",
]);

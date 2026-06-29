import { pgEnum } from "drizzle-orm/pg-core";

/**
 * AIGA 개인화 (Personalization) — shared enums.
 *
 * Capability: FR-002 개인화 (저장/관심/검색 히스토리) — PB-FEAT-002 / BBR-732.
 *
 * Personalization records (saved items, interests) point at editorial catalog
 * resources owned by the service domain (PB-DATA-001). The reference is
 * polymorphic (target_type + target_id) rather than a hard FK because a single
 * "save" can target either a doctor or a hospital.
 */

/**
 * Kind of catalog resource a personalization record points at.
 *
 * Mirrors the service-domain hubs (의사/병원 큐레이션). Extend this enum when a
 * new savable resource type is introduced.
 */
export const personalizationTargetTypeEnum = pgEnum("personalization_target_type", [
  "doctor",
  "hospital",
]);

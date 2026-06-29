/**
 * AIGA Service Domain — schema barrel.
 *
 * Capability: `domain.service-schema` (PB-DATA-001 / BBR-519).
 * Service type: 의사/병원 큐레이션 (doctor / hospital curation).
 *
 * This module is the shared catalog hub. Per-FR clusters (FR-001..FR-005)
 * reference these tables and add their own feature-specific schema in their
 * own modules — see doc/data/PB-DATA-001-service-domain-data-model.md for the
 * ownership boundary and the public/private/admin field map.
 */
export * from "./enums";
export * from "./specialties";
export * from "./regions";
export * from "./hospitals";
export * from "./doctors";
export * from "./relations";

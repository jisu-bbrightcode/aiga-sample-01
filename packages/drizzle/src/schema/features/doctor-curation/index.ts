/**
 * FR-004 명의 큐레이션 (PB-FEAT-004 / BBR-522) — schema barrel.
 *
 * Capability: `domain.feature.fr-004.data`. Editorial curation layer over the
 * PB-DATA-001 doctor hub: 명의 컬렉션/기획전 + 수록 의사 links. References the hub
 * tables by id; never redefines them. See
 * doc/data/PB-FEAT-004-doctor-curation-data-model.md.
 */
export * from "./enums";
export * from "./collections";
export * from "./relations";

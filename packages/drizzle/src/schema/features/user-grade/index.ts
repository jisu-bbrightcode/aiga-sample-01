/**
 * FR-001 사용자 — user-grade schema barrel.
 *
 * Capability: `domain.feature.fr-001.data` (PB-DATA-FR001-001 / BBR-520).
 * Feature card "사용자": 소셜 로그인 및 사용자 등급 판정 / 등급별 일일 사용 한도.
 *
 * Owns the NEW grade-determination + per-grade daily-quota tables. Identity
 * (social login, accounts, sessions) and RBAC roles are REUSED from core — see
 * doc/data/PB-DATA-FR001-001-user-data-model.md for the reuse map and the
 * public/private/admin field boundary.
 */

export * from "./daily-usage";
export * from "./enums";
export * from "./grade-definitions";
export * from "./relations";
export * from "./user-grades";

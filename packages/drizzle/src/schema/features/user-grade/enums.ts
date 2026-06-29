import { pgEnum } from "drizzle-orm/pg-core";

/**
 * FR-001 사용자 — grade (등급) enums.
 *
 * Capability: `domain.feature.fr-001.data` (PB-DATA-FR001-001, BBR-520).
 * Feature card "사용자": 소셜 로그인 및 사용자 등급 판정 / 등급별 일일 사용 한도.
 *
 * Identity itself (social login, accounts, sessions) is REUSED from core
 * (better-auth `users`/`sessions`, `profiles.authProvider`). This module owns
 * only the NEW grade-determination + per-grade daily-quota data.
 */

/**
 * 등급 판정 근거 (how a user's current grade was determined).
 *
 * - `signup`            — default grade granted on social-login signup.
 * - `identity_verified` — bumped after KCB 본인확인 passes (FR identity gate).
 * - `manual`            — admin override (see `user_grades.note`, `determinedBy`).
 * - `system`            — automated rule (e.g. activity/payment driven).
 *
 * Admin-only field: surfaces the provenance of a grade, never exposed publicly.
 */
export const userGradeSourceEnum = pgEnum("user_grade_source", [
  "signup",
  "identity_verified",
  "manual",
  "system",
]);

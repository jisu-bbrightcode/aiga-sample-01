import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { baseColumns } from "../../../utils/columns";
import { profiles } from "../../core/profiles";
import { userGradeSourceEnum } from "./enums";
import { userGradeDefinitions } from "./grade-definitions";

/**
 * 사용자 등급 판정 결과 (per-user current grade assignment).
 *
 * Exactly one row per user (unique `user_id`) holding the user's *current*
 * grade and how it was determined. Distinct from RBAC `user_roles` (permission
 * scope); grade is a usage tier driving the daily quota.
 *
 * Field visibility:
 * - app (own user):  gradeId (resolved → grade name/limit for the badge)
 * - private/admin:   source, determinedBy, note, expiresAt
 *
 * `expiresAt` supports temporary upgrades (e.g. a time-boxed verified bump);
 * NULL = no expiry. Expiry handling/downgrade is owned by the app layer.
 */
export const userGrades = pgTable(
  "user_grades",
  {
    ...baseColumns(),

    /** Owner of this grade record. One grade per user. */
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Current grade. Restrict so a referenced grade cannot be deleted. */
    gradeId: uuid("grade_id")
      .notNull()
      .references(() => userGradeDefinitions.id, { onDelete: "restrict" }),

    /** Admin-only: how this grade was determined. */
    source: userGradeSourceEnum("source").notNull().default("signup"),
    /** Admin-only: admin profile id when source = manual. */
    determinedBy: text("determined_by").references(() => profiles.id),
    /** Admin-only: free-form note for manual overrides / audit. */
    note: text("note"),
    /** When the current grade took effect. */
    determinedAt: timestamp("determined_at", { withTimezone: true }).notNull().defaultNow(),
    /** Optional expiry for temporary grades. NULL = permanent. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    // one active grade per user
    uniqueIndex("uq_user_grades_user").on(t.userId),
    // admin filtering by grade
    index("idx_user_grades_grade").on(t.gradeId),
    // expiry sweep for time-boxed grades
    index("idx_user_grades_expires_at").on(t.expiresAt),
  ],
);

export type UserGrade = typeof userGrades.$inferSelect;
export type NewUserGrade = typeof userGrades.$inferInsert;

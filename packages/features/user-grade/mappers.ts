/**
 * FR-001 user-grade response mapper — pure projection function.
 *
 * Builds a brand-new object field-by-field (rather than spreading the row), so
 * a future column added to `user_grades` is excluded from the API output by
 * default. The grade-catalog fields (slug/name/limit) are resolved from the
 * joined `user_grade_definitions` row.
 */
import type { UserGrade, UserGradeDefinition } from "@repo/drizzle/schema";

/** Grade-determination provenance union (from `user_grade_source` enum). */
export type UserGradeSource = UserGrade["source"];

const iso = (value: Date | string | null | undefined): string | null => {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
};

export interface AdminUserGradeView {
  userId: string;
  gradeId: string;
  gradeSlug: string;
  gradeName: string;
  dailyUsageLimit: number | null;
  source: UserGradeSource;
  determinedBy: string | null;
  note: string | null;
  determinedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** A `user_grades` row joined with its `user_grade_definitions` grade. */
export type UserGradeWithDefinition = UserGrade & { grade: UserGradeDefinition };

export function toAdminUserGrade(row: UserGradeWithDefinition): AdminUserGradeView {
  return {
    userId: row.userId,
    gradeId: row.gradeId,
    gradeSlug: row.grade.slug,
    gradeName: row.grade.name,
    dailyUsageLimit: row.grade.dailyUsageLimit,
    source: row.source,
    determinedBy: row.determinedBy,
    note: row.note,
    determinedAt: iso(row.determinedAt),
    expiresAt: iso(row.expiresAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

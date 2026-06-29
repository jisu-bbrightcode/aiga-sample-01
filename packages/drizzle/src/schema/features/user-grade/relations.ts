import { relations } from "drizzle-orm";
import { userGradeDefinitions } from "./grade-definitions";
import { userGrades } from "./user-grades";

/**
 * FR-001 user-grade relations.
 *
 * Kept minimal: links a user's grade record to its grade definition. The
 * user↔profile edge is intentionally left to the app layer (profiles is core
 * and referenced by many features) to avoid cross-feature relational coupling.
 */

export const userGradesRelations = relations(userGrades, ({ one }) => ({
  grade: one(userGradeDefinitions, {
    fields: [userGrades.gradeId],
    references: [userGradeDefinitions.id],
  }),
}));

export const userGradeDefinitionsRelations = relations(userGradeDefinitions, ({ many }) => ({
  users: many(userGrades),
}));

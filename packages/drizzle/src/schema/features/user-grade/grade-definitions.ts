import { boolean, index, integer, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "../../../utils/columns";

/**
 * 사용자 등급 정의 (grade catalog) — admin-managed.
 *
 * The source of truth for which grades exist and what daily usage limit each
 * grade allows. A small, mostly-static reference table seeded with the system
 * grades; admins may add/tune grades and limits without code changes.
 *
 * Field visibility:
 * - public:     name, slug, description, sortOrder (badge / pricing display)
 * - admin-only: dailyUsageLimit (quota config), isSystem, isActive
 *
 * `dailyUsageLimit` semantics: max protected-action uses per UTC day. NULL =
 * unlimited. Enforced against `user_daily_usage` counters for the user's grade.
 */
export const userGradeDefinitions = pgTable(
  "user_grade_definitions",
  {
    ...baseColumns(),

    /** Display name, e.g. "인증 회원". Public. */
    name: varchar("name", { length: 100 }).notNull(),
    /** Stable slug key, e.g. "verified". Public, unique. */
    slug: varchar("slug", { length: 60 }).notNull(),
    /** Short public description of the grade / its perks. */
    description: text("description"),
    /** Display order on public badges and admin lists. */
    sortOrder: integer("sort_order").notNull().default(0),

    /** Admin-only: daily protected-action quota. NULL = unlimited. */
    dailyUsageLimit: integer("daily_usage_limit"),
    /** Admin-only: system grade (cannot be deleted; protects seeded grades). */
    isSystem: boolean("is_system").notNull().default(false),
    /** Admin-only: hide/disable a grade without deleting (preserves refs). */
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    // assignment lookup + uniqueness guard
    uniqueIndex("uq_user_grade_definitions_slug").on(t.slug),
    // listing: active grades in display order
    index("idx_user_grade_definitions_active_order").on(t.isActive, t.sortOrder),
  ],
);

export type UserGradeDefinition = typeof userGradeDefinitions.$inferSelect;
export type NewUserGradeDefinition = typeof userGradeDefinitions.$inferInsert;

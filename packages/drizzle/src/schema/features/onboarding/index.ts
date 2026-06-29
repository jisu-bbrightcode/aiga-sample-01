import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { baseColumns } from "../../../utils/columns";
import { profiles } from "../../core/profiles";

// ============================================================================
// Tables
// ============================================================================

export const onboardingUserOnboarding = pgTable("onboarding_user_onboarding", {
  ...baseColumns(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: "cascade" }),
  currentStep: integer("current_step").notNull().default(1),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ============================================================================
// Relations
// ============================================================================

export const onboardingUserOnboardingRelations = relations(onboardingUserOnboarding, ({ one }) => ({
  user: one(profiles, {
    fields: [onboardingUserOnboarding.userId],
    references: [profiles.id],
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type OnboardingUserOnboarding = typeof onboardingUserOnboarding.$inferSelect;
export type NewOnboardingUserOnboarding = typeof onboardingUserOnboarding.$inferInsert;

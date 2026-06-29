import { date, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { baseColumns } from "../../../utils/columns";
import { profiles } from "../../core/profiles";

/**
 * 일일 사용량 집계 (per-user, per-day, per-action usage counter).
 *
 * Backs the "등급별 일일 사용 한도 적용" requirement: enforcement compares this
 * counter against the user's grade `dailyUsageLimit` for the given UTC day.
 *
 * Distinct from core `rate_limits` (REUSE) — that is an event-row sliding
 * window for abuse prevention; this is a compact per-day aggregate used for
 * quota enforcement and admin/app usage display. One row per
 * (user, day, action); the counter is incremented atomically on each use.
 *
 * All fields are private (app/admin only); none are publicly exposed.
 */
export const userDailyUsage = pgTable(
  "user_daily_usage",
  {
    ...baseColumns(),

    /** User the usage belongs to. */
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Usage day (UTC date), the quota reset boundary. */
    usageDate: date("usage_date").notNull(),
    /** Quota bucket, e.g. "ai_query" / "doctor_search". */
    action: text("action").notNull(),
    /** Uses consumed for this (user, day, action). */
    usedCount: integer("used_count").notNull().default(0),
  },
  (t) => [
    // one counter per user/day/action + the enforcement lookup key
    uniqueIndex("uq_user_daily_usage_user_date_action").on(t.userId, t.usageDate, t.action),
    // retention cleanup of old usage rows
    index("idx_user_daily_usage_date").on(t.usageDate),
  ],
);

export type UserDailyUsage = typeof userDailyUsage.$inferSelect;
export type NewUserDailyUsage = typeof userDailyUsage.$inferInsert;

import { baseColumns, user } from "@repo/drizzle/schema";
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ============================================================================
// Enums
// ============================================================================

/**
 * Notification Type Enum
 */
export const notificationTypeEnum = pgEnum("notification_type", [
  "comment",
  "like",
  "follow",
  "mention",
  "system",
  "announcement",
]);

// ============================================================================
// Tables
// ============================================================================

/**
 * Notifications Table
 */
export const notifications = pgTable(
  "notification_notifications",
  {
    ...baseColumns(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content"),

    data: jsonb("data"),

    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => ({
    userIdIdx: index("idx_notifications_user_id").on(table.userId, table.createdAt),
    typeIdx: index("idx_notifications_type").on(table.type, table.createdAt),
    readAtIdx: index("idx_notifications_read_at").on(table.userId, table.readAt),
  }),
);

/**
 * Notification Settings Table
 */
export const notificationSettings = pgTable(
  "notification_settings",
  {
    ...baseColumns(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    type: notificationTypeEnum("type").notNull(),

    enabled: boolean("enabled").notNull().default(true),

    channels: jsonb("channels").$type<string[]>().default(["inapp"]),
  },
  (table) => ({
    userTypeUniqueIdx: index("idx_notification_settings_user_type").on(table.userId, table.type),
  }),
);

// ============================================================================
// Relations
// ============================================================================

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, {
    fields: [notifications.userId],
    references: [user.id],
  }),
}));

export const notificationSettingsRelations = relations(notificationSettings, ({ one }) => ({
  user: one(user, {
    fields: [notificationSettings.userId],
    references: [user.id],
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationSettingRow = typeof notificationSettings.$inferSelect;
export type NewNotificationSetting = typeof notificationSettings.$inferInsert;
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/**
 * Wire shape for a notification row.
 * Dates are z.string() — Fastify JSON-serializes Drizzle Date objects to ISO strings.
 * notifications table uses baseColumns (id, createdAt, updatedAt) — no soft delete.
 */
export const notificationResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.enum(["comment", "like", "follow", "mention", "system", "announcement"]),
  title: z.string(),
  content: z.string().nullable(),
  data: z.record(z.any()).nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class NotificationResponseDto extends createZodDto(notificationResponseSchema) {}

/** Paginated list response */
export const notificationListResponseSchema = z.object({
  items: z.array(notificationResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

export class NotificationListResponseDto extends createZodDto(notificationListResponseSchema) {}

/** Unread count response */
export const unreadCountResponseSchema = z.object({
  count: z.number(),
});

export class UnreadCountResponseDto extends createZodDto(unreadCountResponseSchema) {}

/** Generic success response */
export const successResponseSchema = z.object({ success: z.boolean() });

export class SuccessResponseDto extends createZodDto(successResponseSchema) {}

/** markAllAsRead response */
export const markAllReadResponseSchema = z.object({
  success: z.boolean(),
  count: z.number(),
});

export class MarkAllReadResponseDto extends createZodDto(markAllReadResponseSchema) {}

/** Notification setting row */
export const notificationSettingResponseSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  type: z.enum(["comment", "like", "follow", "mention", "system", "announcement"]),
  enabled: z.boolean(),
  channels: z.array(z.string()).nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export class NotificationSettingResponseDto extends createZodDto(
  notificationSettingResponseSchema,
) {}

/** Admin broadcast response */
export const broadcastResponseSchema = z.object({
  success: z.boolean(),
  count: z.number(),
});

export class BroadcastResponseDto extends createZodDto(broadcastResponseSchema) {}

/** Admin stats response */
export const notificationStatsResponseSchema = z.object({
  total: z.number(),
  unread: z.number(),
  today: z.number(),
});

export class NotificationStatsResponseDto extends createZodDto(notificationStatsResponseSchema) {}

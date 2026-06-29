import { Injectable, NotFoundException } from "@nestjs/common";
import { type DrizzleDB, InjectDrizzle } from "@repo/drizzle";
import { notificationSettings, notifications, user as userTable } from "@repo/drizzle/schema";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import type { NotificationListResponse, UnreadCountResponse } from "../../common/types";
import type {
  BroadcastInput,
  CreateNotificationInput,
  NotificationQueryInput,
  UpdateSettingsInput,
} from "../dto";

@Injectable()
export class NotificationService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB
  ) {}

  // ========== Notifications (Auth) ==========

  async list(userId: string, input?: NotificationQueryInput): Promise<NotificationListResponse> {
    const { page = 1, limit = 20, unreadOnly = false, type } = input ?? {};
    const offset = (page - 1) * limit;

    const whereConditions: ReturnType<typeof eq>[] = [eq(notifications.userId, userId)];

    if (unreadOnly) {
      whereConditions.push(isNull(notifications.readAt));
    }

    if (type) {
      whereConditions.push(eq(notifications.type, type));
    }

    const whereClause = and(...whereConditions);

    const [items, totalResult] = await Promise.all([
      (this.db as any)
        .select()
        .from(notifications)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(notifications.createdAt)),
      (this.db as any).select({ count: count() }).from(notifications).where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return {
      items,
      total,
      page,
      limit,
      hasMore: offset + items.length < total,
    };
  }

  async getUnreadCount(userId: string): Promise<UnreadCountResponse> {
    const result = await (this.db as any)
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

    return { count: result[0]?.count ?? 0 };
  }

  async markAsRead(userId: string, notificationId: string): Promise<{ success: boolean }> {
    const [notification] = await (this.db as any)
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .limit(1);

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    await (this.db as any)
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, notificationId));

    return { success: true };
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean; count: number }> {
    const countResult = await (this.db as any)
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

    const unreadCount = countResult[0]?.count ?? 0;

    await (this.db as any)
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

    return { success: true, count: unreadCount };
  }

  // ========== Settings (Auth) ==========

  async getSettings(userId: string) {
    const settings = await (this.db as any)
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId));

    const defaultTypes = [
      "comment",
      "like",
      "follow",
      "mention",
      "system",
      "announcement",
    ] as const;
    const settingsMap = new Map(settings.map((s: any) => [s.type, s]));

    return defaultTypes.map((type) => {
      const existing = settingsMap.get(type);
      return (
        existing ?? {
          type,
          enabled: true,
          channels: ["inapp"],
        }
      );
    });
  }

  async updateSettings(userId: string, input: UpdateSettingsInput): Promise<{ success: boolean }> {
    const [existing] = await (this.db as any)
      .select()
      .from(notificationSettings)
      .where(
        and(eq(notificationSettings.userId, userId), eq(notificationSettings.type, input.type)),
      )
      .limit(1);

    if (existing) {
      await (this.db as any)
        .update(notificationSettings)
        .set({
          enabled: input.enabled,
          channels: input.channels ?? existing.channels,
        })
        .where(eq(notificationSettings.id, existing.id));
    } else {
      await (this.db as any).insert(notificationSettings).values({
        userId,
        type: input.type,
        enabled: input.enabled,
        channels: input.channels ?? ["inapp"],
      });
    }

    return { success: true };
  }

  // ========== Internal ==========

  async create(input: CreateNotificationInput) {
    const [setting] = await (this.db as any)
      .select()
      .from(notificationSettings)
      .where(
        and(
          eq(notificationSettings.userId, input.userId),
          eq(notificationSettings.type, input.type),
        ),
      )
      .limit(1);

    if (setting && !setting.enabled) {
      return null;
    }

    const [notification] = await (this.db as any)
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        content: input.content,
        data: input.data,
      })
      .returning();

    return notification;
  }

  // ========== Admin ==========

  async broadcast(input: BroadcastInput): Promise<{ success: boolean; count: number }> {
    let targetUsers: { id: string }[];

    if (input.targetUserIds && input.targetUserIds.length > 0) {
      targetUsers = input.targetUserIds.map((id) => ({ id }));
    } else {
      targetUsers = await (this.db as any).select({ id: userTable.id }).from(userTable);
    }

    const notificationValues = targetUsers.map((u) => ({
      userId: u.id,
      type: "announcement" as const,
      title: input.title,
      content: input.content,
      data: null,
    }));

    if (notificationValues.length > 0) {
      await (this.db as any).insert(notifications).values(notificationValues);
    }

    return { success: true, count: notificationValues.length };
  }

  async getStats() {
    const [totalResult, unreadResult, todayResult] = await Promise.all([
      (this.db as any).select({ count: count() }).from(notifications),
      (this.db as any)
        .select({ count: count() })
        .from(notifications)
        .where(isNull(notifications.readAt)),
      (this.db as any)
        .select({ count: count() })
        .from(notifications)
        .where(sql`${notifications.createdAt} >= CURRENT_DATE`),
    ]);

    return {
      total: totalResult[0]?.count ?? 0,
      unread: unreadResult[0]?.count ?? 0,
      today: todayResult[0]?.count ?? 0,
    };
  }
}

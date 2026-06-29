import { Injectable, Optional } from "@nestjs/common";
import type { CreateNotificationInput } from "../dto";
import type { NotificationGateway, NotificationPayload } from "../gateway/notification.gateway";
import { NotificationService } from "./notification.service";

/**
 * NotificationEmitter
 *
 * Used by other features to send notifications.
 * Handles DB persistence + real-time delivery.
 *
 * @example
 * await this.notificationEmitter.emit({
 *   userId: post.authorId,
 *   type: 'comment',
 *   title: '새 댓글이 달렸습니다',
 *   content: `${commenter.name}님이 댓글을 남겼습니다`,
 *   data: { postId: post.id, commentId: comment.id },
 * });
 */
@Injectable()
export class NotificationEmitterService {
  constructor(
    private readonly notificationService: NotificationService,
    @Optional() private readonly _gateway?: NotificationGateway,
  ) {}

  async emit(input: CreateNotificationInput): Promise<void> {
    const notification = await this.notificationService.create(input);

    if (!notification) {
      return;
    }

    if (this._gateway) {
      const payload: NotificationPayload = {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        data: notification.data,
        createdAt: notification.createdAt,
      };

      this._gateway.sendToUser(input.userId, payload);
    }
  }

  async emitToMany(
    userIds: string[],
    notification: Omit<CreateNotificationInput, "userId">,
  ): Promise<void> {
    await Promise.all(
      userIds.map((userId) =>
        this.emit({
          ...notification,
          userId,
        }),
      ),
    );
  }

  async broadcast(
    title: string,
    content: string,
    targetUserIds?: string[],
  ): Promise<{ count: number }> {
    const result = await this.notificationService.broadcast({
      title,
      content,
      targetUserIds,
    });

    if (this._gateway) {
      const payload: NotificationPayload = {
        id: `broadcast-${Date.now()}`,
        type: "announcement",
        title,
        content,
        createdAt: new Date(),
      };

      if (targetUserIds && targetUserIds.length > 0) {
        this._gateway.sendToUsers(targetUserIds, payload);
      } else {
        this._gateway.broadcast(payload);
      }
    }

    return result;
  }

  isUserOnline(userId: string): boolean {
    return this._gateway?.isUserOnline(userId) ?? false;
  }
}

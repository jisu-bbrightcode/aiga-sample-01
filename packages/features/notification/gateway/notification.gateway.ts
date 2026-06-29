import { Injectable, Logger } from "@nestjs/common";
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  content: string | null;
  data?: unknown;
  createdAt: Date;
}

@WebSocketGateway({
  namespace: "/notifications",
  cors: {
    origin: "*",
    credentials: true,
  },
})
@Injectable()
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server!: Server;

  // userId -> Set<socketId>
  private userSockets = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId || client.handshake.query?.userId;

    if (!userId || typeof userId !== "string") {
      this.logger.warn(`Client ${client.id} connected without userId`);
      return;
    }

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)?.add(client.id);

    client.join(`user:${userId}`);

    this.logger.log(`Client ${client.id} connected for user ${userId}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.auth?.userId || client.handshake.query?.userId;

    if (userId && typeof userId === "string" && this.userSockets.has(userId)) {
      this.userSockets.get(userId)?.delete(client.id);

      if (this.userSockets.get(userId)?.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.logger.log(`Client ${client.id} disconnected`);
  }

  sendToUser(userId: string, notification: NotificationPayload) {
    this.server.to(`user:${userId}`).emit("notification", notification);
    this.logger.debug(`Sent notification to user ${userId}: ${notification.title}`);
  }

  sendToUsers(userIds: string[], notification: NotificationPayload) {
    for (const userId of userIds) {
      this.sendToUser(userId, notification);
    }
  }

  broadcast(notification: NotificationPayload) {
    this.server.emit("notification", notification);
    this.logger.debug(`Broadcast notification: ${notification.title}`);
  }

  isUserOnline(userId: string): boolean {
    return (this.userSockets.get(userId)?.size ?? 0) > 0;
  }

  getOnlineUserCount(): number {
    return this.userSockets.size;
  }

  @SubscribeMessage("markAsRead")
  handleMarkAsRead(client: Socket, payload: { notificationId: string }) {
    const userId = client.handshake.auth?.userId || client.handshake.query?.userId;
    this.logger.debug(`User ${userId} marked notification ${payload.notificationId} as read`);
    if (userId) {
      this.server.to(`user:${userId}`).emit("notificationRead", {
        notificationId: payload.notificationId,
      });
    }
  }
}

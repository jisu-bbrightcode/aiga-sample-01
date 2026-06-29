import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { widgetQueryKeys } from "../../common/query-keys";
import type { NotificationItem } from "../../common/types";

interface NotificationSocketOptions {
  /**
   * 사용자 ID (인증된 사용자)
   */
  userId: string | null;
  /**
   * WebSocket 서버 URL
   * @default window.location.origin
   */
  serverUrl?: string;
  /**
   * 새 알림 수신 시 콜백
   */
  onNotification?: (notification: NotificationItem) => void;
  /**
   * 알림 읽음 동기화 수신 시 콜백
   */
  onNotificationRead?: (notificationId: string) => void;
  /**
   * 연결 상태 변경 시 콜백
   */
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * 실시간 알림 WebSocket Hook
 *
 * @example
 * const { isConnected, markAsReadViaSocket } = useNotificationSocket({
 *   userId: user?.id ?? null,
 *   onNotification: (notification) => {
 *     toast(`새 알림: ${notification.title}`);
 *   },
 * });
 */
export function useNotificationSocket(options: NotificationSocketOptions) {
  const { userId, serverUrl, onNotification, onNotificationRead, onConnectionChange } = options;

  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  const isConnectedRef = useRef(false);

  const markAsReadViaSocket = (notificationId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("markAsRead", { notificationId });
    }
  };

  useEffect(() => {
    if (!userId) {
      return;
    }

    const wsUrl = serverUrl || window.location.origin;

    const socket = io(`${wsUrl}/notifications`, {
      auth: { userId },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      isConnectedRef.current = true;
      onConnectionChange?.(true);
    });

    socket.on("disconnect", () => {
      isConnectedRef.current = false;
      onConnectionChange?.(false);
    });

    socket.on("notification", (notification: NotificationItem) => {
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.notification.listPrefix(),
      });
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.notification.unreadCount(),
      });

      onNotification?.(notification);
    });

    socket.on("notificationRead", ({ notificationId }: { notificationId: string }) => {
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.notification.listPrefix(),
      });
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.notification.unreadCount(),
      });

      onNotificationRead?.(notificationId);
    });

    socket.on("connect_error", (error) => {
      console.error("Notification socket connection error:", error.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      isConnectedRef.current = false;
    };
  }, [userId, serverUrl, onNotification, onNotificationRead, onConnectionChange, queryClient]);

  return { isConnected: isConnectedRef.current, markAsReadViaSocket };
}

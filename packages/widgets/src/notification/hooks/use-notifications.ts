import { useQuery } from "@tanstack/react-query";
import { useWidgetsApi } from "../../common/api-context";
import { widgetQueryKeys } from "../../common/query-keys";
import type { NotificationListFilters } from "../../common/types";

/**
 * 알림 목록 조회 Hook
 */
export function useNotifications(filters: NotificationListFilters = {}) {
  const api = useWidgetsApi();
  const { page = 1, limit = 20, unreadOnly = false, type } = filters;

  return useQuery({
    queryKey: widgetQueryKeys.notification.list({ page, limit, unreadOnly, type }),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/notifications", {
        params: { query: { page, limit, unreadOnly, type } },
      });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * 읽지 않은 알림 수 조회 Hook
 */
export function useUnreadCount() {
  const api = useWidgetsApi();

  return useQuery({
    queryKey: widgetQueryKeys.notification.unreadCount(),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/notifications/unread-count");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
}

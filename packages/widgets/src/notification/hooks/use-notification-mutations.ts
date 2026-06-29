import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWidgetsApi } from "../../common/api-context";
import { widgetQueryKeys } from "../../common/query-keys";

/**
 * 알림 읽음 처리 Hook
 */
export function useMarkAsRead() {
  const api = useWidgetsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const { data, error } = await api.POST("/api/notifications/{id}/read", {
        params: { path: { id: input.id } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.notification.listPrefix(),
      });
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.notification.unreadCount(),
      });
    },
  });
}

/**
 * 전체 읽음 처리 Hook
 */
export function useMarkAllAsRead() {
  const api = useWidgetsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/api/notifications/read-all");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.notification.listPrefix(),
      });
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.notification.unreadCount(),
      });
    },
  });
}

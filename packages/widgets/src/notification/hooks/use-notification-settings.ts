import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWidgetsApi } from "../../common/api-context";
import { widgetQueryKeys } from "../../common/query-keys";
import type { NotificationType } from "../../common/types";

/**
 * 알림 설정 조회 Hook
 */
export function useNotificationSettings() {
  const api = useWidgetsApi();

  return useQuery({
    queryKey: widgetQueryKeys.notification.settings(),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/notifications/settings");
      if (error) throw error;
      return data;
    },
  });
}

/**
 * 알림 설정 업데이트 Hook
 */
export function useUpdateNotificationSettings() {
  const api = useWidgetsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      type: NotificationType;
      enabled: boolean;
      channels?: ("email" | "push" | "inapp")[];
    }) => {
      const { data, error } = await api.PUT("/api/notifications/settings", { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.notification.settings(),
      });
    },
  });
}

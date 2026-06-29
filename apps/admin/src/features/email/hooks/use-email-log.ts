import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api";
import { adminEmailQueryKeys } from "../api";

/**
 * 이메일 로그 상세 조회 Hook
 */
export function useEmailLog(logId: string | undefined) {
  return useQuery({
    queryKey: adminEmailQueryKeys.log(logId || ""),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/admin/email/logs/{logId}", {
        params: { path: { logId: logId || "" } },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!logId,
  });
}

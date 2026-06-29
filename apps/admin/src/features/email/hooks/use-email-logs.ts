import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api";
import { adminEmailQueryKeys } from "../api";
import type { EmailLogsFilters } from "../types";

/**
 * 이메일 로그 목록 조회 Hook
 */
export function useEmailLogs(filters: EmailLogsFilters = {}) {
  const { page = 1, limit = 20, status, templateType, search } = filters;

  return useQuery({
    queryKey: adminEmailQueryKeys.logs({ page, limit, status, templateType, search }),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/admin/email/logs", {
        params: { query: { page, limit, status, templateType, search } },
      });
      if (error) throw error;
      return data;
    },
  });
}

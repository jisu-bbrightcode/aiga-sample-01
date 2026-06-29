import { $api } from "@/lib/api";
import type { EmailLogsFilters } from "../../common/types";

/** REST queryKey base: ["get", "/api/admin/email/logs"] */
export const EMAIL_LOGS_QUERY_KEY = ["get", "/api/admin/email/logs"] as const;

/**
 * 이메일 로그 목록 조회 Hook
 */
export function useEmailLogs(filters: EmailLogsFilters = {}) {
  const { page = 1, limit = 20, status, templateType, search } = filters;

  return $api.useQuery(
    "get",
    "/api/admin/email/logs",
    {
      params: {
        query: {
          page,
          limit,
          ...(status ? { status } : {}),
          ...(templateType ? { templateType } : {}),
          ...(search ? { search } : {}),
        },
      },
    },
    {},
  );
}

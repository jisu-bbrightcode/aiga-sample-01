import { $api } from "@/lib/api";

/**
 * 이메일 로그 상세 조회 Hook
 */
export function useEmailLog(logId: string | undefined) {
  return $api.useQuery(
    "get",
    "/api/admin/email/logs/{logId}",
    { params: { path: { logId: logId ?? "" } } },
    { enabled: !!logId },
  );
}

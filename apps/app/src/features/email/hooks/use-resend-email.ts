import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { EMAIL_LOGS_QUERY_KEY } from "./use-email-logs";

/**
 * 이메일 재발송 Hook
 */
export function useResendEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/admin/email/logs/{logId}/resend"],
    mutationFn: async (logId: string) => {
      const { data, error } = await apiClient.POST("/api/admin/email/logs/{logId}/resend", {
        params: { path: { logId } },
      });
      if (error) throw error;
      return data!;
    },
    onSuccess: () => {
      // 이메일 로그 목록 무효화하여 자동 갱신
      queryClient.invalidateQueries({ queryKey: EMAIL_LOGS_QUERY_KEY });
      // 단건 로그도 무효화 (캐시된 모든 logId에 대해)
      queryClient.invalidateQueries({
        queryKey: ["get", "/api/admin/email/logs/{logId}"],
      });
    },
  });
}

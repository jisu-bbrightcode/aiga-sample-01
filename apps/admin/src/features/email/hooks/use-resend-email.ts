import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api";
import { adminEmailQueryKeys } from "../api";

/**
 * 이메일 재발송 Hook
 */
export function useResendEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { logId: string }) => {
      const { data, error } = await apiClient.POST("/api/admin/email/logs/{logId}/resend", {
        params: { path: { logId: input.logId } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      // 이메일 로그 목록 무효화하여 자동 갱신
      queryClient.invalidateQueries({
        queryKey: adminEmailQueryKeys.logsPrefix(),
      });
      queryClient.invalidateQueries({
        queryKey: adminEmailQueryKeys.log(variables.logId),
      });
    },
  });
}

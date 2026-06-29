import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

const scheduledJobQueryKeys = {
  list: () => ["admin", "scheduled-job", "list"] as const,
  runs: (jobId: string, page: number, limit: number) =>
    ["admin", "scheduled-job", "runs", jobId, page, limit] as const,
};

export type ScheduledJobKey =
  | "credit_monthly_renewal"
  | "marketing_scheduled_publish"
  | "data_cleanup"
  | "analytics_daily_aggregate";

/** 잡 목록 조회 */
export function useScheduledJobs() {
  return useQuery({
    queryKey: scheduledJobQueryKeys.list(),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/admin/scheduled-job");
      if (error) throw error;
      return data;
    },
  });
}

/** 잡 실행 이력 조회 */
export function useJobRuns(jobId: string | null, page = 1, limit = 20) {
  return useQuery({
    queryKey: scheduledJobQueryKeys.runs(jobId ?? "", page, limit),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/admin/scheduled-job/{jobId}/runs", {
        params: { path: { jobId: jobId ?? "" }, query: { page, limit } },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });
}

/** 잡 활성/비활성 토글 */
export function useToggleJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { jobId: string }) => {
      const { data, error } = await apiClient.POST("/api/admin/scheduled-job/{jobId}/toggle", {
        params: { path: { jobId: input.jobId } },
      });
      if (error) throw error;
      if (!data) throw new Error("SCHEDULED_JOB_TOGGLE_EMPTY_RESPONSE");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduledJobQueryKeys.list() });
    },
  });
}

/** 수동 실행 트리거 */
export function useRunJobNow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { jobKey: ScheduledJobKey }) => {
      const { data, error } = await apiClient.POST("/api/admin/scheduled-job/run-now", {
        body: input,
      });
      if (error) throw error;
      if (!data) throw new Error("SCHEDULED_JOB_RUN_EMPTY_RESPONSE");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduledJobQueryKeys.list() });
    },
  });
}

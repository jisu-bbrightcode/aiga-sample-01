import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  paymentKeys,
  triggerManualTopup,
  updateExtraUsageSettings,
  useExtraUsageSettingsQuery,
  useExtraUsageStatsQuery,
} from "../api/payment";

/** 추가 사용량(Extra Usage) 설정 조회 — 없으면 lazy init 자동 생성 */
export function useExtraUsageSettings() {
  return useExtraUsageSettingsQuery();
}

/** 추가 사용량 설정 부분 업데이트 — 성공 시 settings + stats 자동 갱신 */
export function useUpdateExtraUsageSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateExtraUsageSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentKeys.extraUsageSettings,
      });
      queryClient.invalidateQueries({
        queryKey: paymentKeys.extraUsageStats,
      });
    },
  });
}

/** 사용량 통계 조회 — 30초 polling (cached_paid_balance 기반, 서버 부하 낮음) */
export function useUsageStats() {
  return useExtraUsageStatsQuery({ refetchInterval: 30_000 });
}

/** 일회성 추가 사용량 즉시 구매 */
export function useManualTopup() {
  return useMutation({ mutationFn: triggerManualTopup });
}

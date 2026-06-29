import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelSubscription,
  changePlan,
  paymentKeys,
  uncancelSubscription,
  usePlanChangePreviewQuery,
} from "../api/payment";

/** 플랜 즉시/예약 변경 (업그레이드·다운그레이드·결제 주기 변경) */
export function useChangePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: changePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentKeys.mySubscription,
      });
    },
  });
}

/** 변경 전 차액·적용 시점 미리보기 (targetPlanId 없으면 요청 안 함) */
export function usePreviewPlanChange(targetPlanId: string | null) {
  return usePlanChangePreviewQuery(targetPlanId);
}

/** 구독 해지 — mode('at_period_end' | 'with_refund') 와 reason 필수 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentKeys.mySubscription,
      });
    },
  });
}

/** 기간 종료 해지 예약 취소 — 유예 기간 안에 마음이 바뀌었을 때 */
export function useUncancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uncancelSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentKeys.mySubscription,
      });
    },
  });
}

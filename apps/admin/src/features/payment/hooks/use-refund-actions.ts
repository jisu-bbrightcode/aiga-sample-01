import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminPaymentApi, adminPaymentQueryKeys } from "../api";

/**
 * Customer ops mutations:
 *  - refundOrder            (orders / order detail page)
 *  - cancelSubscriptionNow  (subscriber detail)
 *  - releaseSoftSuspend     (subscriber detail)
 *  - extendTrialEnd         (subscriber detail)
 *  - compSubscription       (subscriber detail / power tool)
 *
 * Each invalidates a sensible scope so the UI re-reads after the mutation.
 */
export function useRefundActions(opts: { subscriptionId?: string; orderId?: string } = {}) {
  const queryClient = useQueryClient();

  const invalidateSub = () => {
    if (opts.subscriptionId) {
      queryClient.invalidateQueries({
        queryKey: adminPaymentQueryKeys.subscriber(opts.subscriptionId),
      });
    }
    queryClient.invalidateQueries({ queryKey: adminPaymentQueryKeys.dashboard() });
  };

  const invalidateOrder = () => {
    if (opts.orderId) {
      queryClient.invalidateQueries({
        queryKey: adminPaymentQueryKeys.order(opts.orderId),
      });
    }
    queryClient.invalidateQueries({ queryKey: adminPaymentQueryKeys.dashboard() });
  };

  const refundOrder = useMutation({
    mutationFn: adminPaymentApi.refundOrder,
    onSuccess: invalidateOrder,
  });

  const cancelNow = useMutation({
    mutationFn: adminPaymentApi.cancelSubscriptionNow,
    onSuccess: invalidateSub,
  });

  const releaseSuspend = useMutation({
    mutationFn: adminPaymentApi.releaseSoftSuspend,
    onSuccess: invalidateSub,
  });

  const extendTrial = useMutation({
    mutationFn: adminPaymentApi.extendTrialEnd,
    onSuccess: invalidateSub,
  });

  const compSubscription = useMutation({
    mutationFn: adminPaymentApi.compSubscription,
    onSuccess: invalidateSub,
  });

  return { refundOrder, cancelNow, releaseSuspend, extendTrial, compSubscription };
}

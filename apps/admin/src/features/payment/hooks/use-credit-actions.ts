import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminPaymentApi, adminPaymentQueryKeys } from "../api";

/**
 * grant + revoke credit mutations.
 * Both call out to `creditLedger` server-side; both invalidate subscriber
 * detail so the dashboard reflects the new balance.
 */
export function useCreditActions(subscriptionId?: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    if (subscriptionId) {
      queryClient.invalidateQueries({
        queryKey: adminPaymentQueryKeys.subscriber(subscriptionId),
      });
    }
  };

  const grant = useMutation({
    mutationFn: adminPaymentApi.grantCredits,
    onSuccess: invalidate,
  });

  const revoke = useMutation({
    mutationFn: adminPaymentApi.revokeCredits,
    onSuccess: invalidate,
  });

  return { grant, revoke };
}

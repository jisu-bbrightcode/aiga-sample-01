import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentKeys, reactivateSubscription, useMySubscriptionQuery } from "../api/payment";

/** Active subscription (or null) for the caller's org. */
export function useMySubscription() {
  return useMySubscriptionQuery();
}

/** Re-enable a sub during the grace window. */
export function useReactivateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reactivateSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentKeys.mySubscription,
      });
    },
  });
}

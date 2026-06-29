import { useQuery } from "@tanstack/react-query";
import { adminPaymentApi, adminPaymentQueryKeys } from "../api";

export function useSubscriberDetail(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: adminPaymentQueryKeys.subscriber(subscriptionId ?? ""),
    queryFn: () => adminPaymentApi.subscriber(subscriptionId ?? ""),
    enabled: !!subscriptionId,
  });
}

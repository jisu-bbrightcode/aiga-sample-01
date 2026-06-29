import { useQuery } from "@tanstack/react-query";
import { adminPaymentApi, adminPaymentQueryKeys } from "../api";

export function useOrderDetail(orderId: string | undefined) {
  return useQuery({
    queryKey: adminPaymentQueryKeys.order(orderId ?? ""),
    queryFn: () => adminPaymentApi.order(orderId ?? ""),
    enabled: !!orderId,
  });
}

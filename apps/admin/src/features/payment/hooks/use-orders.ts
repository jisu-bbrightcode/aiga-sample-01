import { useQuery } from "@tanstack/react-query";
import { adminPaymentApi, adminPaymentQueryKeys } from "../api";

export interface UseOrdersInput {
  status?: "paid" | "refunded" | "partially_refunded" | "failed";
  search?: string;
  cursor?: string;
  limit?: number;
}

export function useOrders(input: UseOrdersInput = {}) {
  return useQuery({
    queryKey: adminPaymentQueryKeys.orders(input),
    queryFn: () => adminPaymentApi.orders(input as Record<string, unknown>),
  });
}

import { useQuery } from "@tanstack/react-query";
import { adminPaymentApi, adminPaymentQueryKeys } from "../api";

export interface UseSubscribersInput {
  status?: "trialing" | "active" | "past_due" | "grace" | "canceled";
  planId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export function useSubscribers(input: UseSubscribersInput = {}) {
  return useQuery({
    queryKey: adminPaymentQueryKeys.subscribers(input),
    queryFn: () => adminPaymentApi.subscribers(input as Record<string, unknown>),
  });
}

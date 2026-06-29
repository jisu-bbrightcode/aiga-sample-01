import { useQuery } from "@tanstack/react-query";
import { adminPaymentApi, adminPaymentQueryKeys } from "../api";

export function usePaymentDashboard() {
  return useQuery({
    queryKey: adminPaymentQueryKeys.dashboard(),
    queryFn: adminPaymentApi.dashboard,
  });
}

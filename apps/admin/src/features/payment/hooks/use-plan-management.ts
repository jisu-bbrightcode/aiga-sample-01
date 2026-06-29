import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminPaymentApi, adminPaymentQueryKeys } from "../api";

export function usePlanManagement() {
  const queryClient = useQueryClient();
  const listKey = adminPaymentQueryKeys.plans();

  const list = useQuery({ queryKey: listKey, queryFn: adminPaymentApi.plans });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey });

  const create = useMutation({
    mutationFn: adminPaymentApi.createPlan,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: adminPaymentApi.updatePlan,
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: adminPaymentApi.archivePlan,
    onSuccess: invalidate,
  });

  return { list, create, update, archive };
}

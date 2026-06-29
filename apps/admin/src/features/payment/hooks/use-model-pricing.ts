import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminPaymentApi, adminPaymentQueryKeys } from "../api";

export function useModelPricing() {
  const queryClient = useQueryClient();
  const listKey = adminPaymentQueryKeys.modelPricing();

  const list = useQuery({ queryKey: listKey, queryFn: adminPaymentApi.modelPricing });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey });

  const upsert = useMutation({
    mutationFn: adminPaymentApi.upsertModelPricing,
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: adminPaymentApi.archiveModelPricing,
    onSuccess: invalidate,
  });

  return { list, upsert, archive };
}

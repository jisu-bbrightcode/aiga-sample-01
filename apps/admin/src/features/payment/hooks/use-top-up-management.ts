import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminPaymentApi, adminPaymentQueryKeys } from "../api";

export function useTopUpManagement() {
  const queryClient = useQueryClient();
  const listKey = adminPaymentQueryKeys.topUpPackages();

  const list = useQuery({ queryKey: listKey, queryFn: adminPaymentApi.topUpPackages });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey });

  const create = useMutation({
    mutationFn: adminPaymentApi.createTopUpPackage,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: adminPaymentApi.updateTopUpPackage,
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: adminPaymentApi.archiveTopUpPackage,
    onSuccess: invalidate,
  });

  return { list, create, update, archive };
}

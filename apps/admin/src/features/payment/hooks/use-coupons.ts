import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminPaymentApi, adminPaymentQueryKeys } from "../api";

export interface UseCouponsInput {
  isActive?: boolean;
  cursor?: string;
  limit?: number;
}

export function useCoupons(input: UseCouponsInput = {}) {
  const queryClient = useQueryClient();
  const listKey = adminPaymentQueryKeys.coupons(input);

  const list = useQuery({
    queryKey: listKey,
    queryFn: () => adminPaymentApi.coupons(input as Record<string, unknown>),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: adminPaymentQueryKeys.coupons(),
    });

  const create = useMutation({
    mutationFn: adminPaymentApi.createCoupon,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: adminPaymentApi.updateCoupon,
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: adminPaymentApi.archiveCoupon,
    onSuccess: invalidate,
  });

  return { list, listKey, create, update, archive };
}

export function useCouponRedemptions(couponId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: adminPaymentQueryKeys.couponRedemptions(couponId ?? "", limit),
    queryFn: () => adminPaymentApi.couponRedemptions(couponId ?? "", limit),
    enabled: !!couponId,
  });
}

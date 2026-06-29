import { useQuery } from "@tanstack/react-query";
import { adminPaymentApi, adminPaymentQueryKeys } from "../api";

export interface UseAuditLogInput {
  actorUserId?: string;
  targetOrgId?: string;
  action?: string;
  cursor?: string | number;
  limit?: number;
}

export function useAuditLog(input: UseAuditLogInput = {}) {
  return useQuery({
    queryKey: adminPaymentQueryKeys.auditLog(input),
    queryFn: () => adminPaymentApi.auditLog(input as Record<string, unknown>),
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminDomainQueryKeys, changeDomainResourceStatus } from "../api";
import type { DomainResourceStatus, DomainResourceType } from "../types";

interface StatusVariables {
  type: DomainResourceType;
  id: string;
  status: DomainResourceStatus;
}

/**
 * 도메인 리소스 상태 변경 Mutation Hook (PB-ADMIN-DOMAIN-UPDATE-001 / BBR-681).
 *
 * 상태 변경은 서버에서 허용된 전이만 통과하고 (위반 시 422) 감사 로그에 기록된다.
 * 성공 시 상세 + 목록 + 변경 이력 쿼리를 무효화하고, 오류는 운영자용 한국어
 * 토스트로만 노출한다.
 */
export function useChangeDomainStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ type, id, status }: StatusVariables) =>
      changeDomainResourceStatus(type, id, status),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: adminDomainQueryKeys.detail(result.type, result.id),
      });
      queryClient.invalidateQueries({
        queryKey: adminDomainQueryKeys.history(result.type, result.id),
      });
      queryClient.invalidateQueries({ queryKey: adminDomainQueryKeys.resourcesPrefix() });
      toast.success("상태를 변경했습니다.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "상태를 변경하지 못했습니다.");
    },
  });
}

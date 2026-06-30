import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminDomainQueryKeys,
  type DomainLifecycleAction,
  mutateDomainResourceLifecycle,
} from "../api";
import type { DomainResourceType } from "../types";

interface LifecycleVariables {
  type: DomainResourceType;
  id: string;
}

const SUCCESS_MESSAGE: Record<DomainLifecycleAction, string> = {
  archive: "리소스를 보관했습니다. 공개/앱 노출에서 제외됩니다.",
  restore: "리소스를 복구했습니다. 비공개(초안) 상태입니다.",
};

/**
 * 도메인 리소스(의사/병원) 비활성/archive · 복구 Mutation Hook.
 *
 * 성공 시 상세 + 목록 쿼리를 무효화해 갱신된 상태가 즉시 반영되도록 한다. 오류는
 * 운영자용 한국어 토스트로만 노출하고 원시 기술 메시지는 표시하지 않는다.
 * PB-ADMIN-DOMAIN-DELETE-001 / BBR-682.
 */
export function useDomainResourceLifecycle(action: DomainLifecycleAction) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ type, id }: LifecycleVariables) =>
      mutateDomainResourceLifecycle(action, type, id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: adminDomainQueryKeys.detail(result.type, result.id),
      });
      // Any cached list page may now show a different status → refetch the list.
      queryClient.invalidateQueries({ queryKey: adminDomainQueryKeys.resourcesPrefix() });
      toast.success(SUCCESS_MESSAGE[action]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "작업을 처리하지 못했습니다.");
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminDomainQueryKeys,
  type DoctorUpdateInput,
  type HospitalUpdateInput,
  updateDomainDoctor,
  updateDomainHospital,
} from "../api";
import type { DomainResourceType } from "../types";

type UpdateVariables =
  | { type: "doctor"; id: string; input: DoctorUpdateInput }
  | { type: "hospital"; id: string; input: HospitalUpdateInput };

/**
 * 도메인 리소스(의사/병원) 수정 Mutation Hook (PB-ADMIN-DOMAIN-UPDATE-001 / BBR-681).
 *
 * 성공 시 상세 + 목록 + 변경 이력 쿼리를 무효화한다. 서버에서 수정은 감사 로그에
 * 기록된다. 오류는 운영자용 한국어 토스트로만 노출한다 (원시 메시지 미노출).
 */
export function useUpdateDomainResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: UpdateVariables) =>
      vars.type === "doctor"
        ? updateDomainDoctor(vars.id, vars.input)
        : updateDomainHospital(vars.id, vars.input),
    onSuccess: (_result, vars) => {
      const ref: [DomainResourceType, string] = [vars.type, vars.id];
      queryClient.invalidateQueries({ queryKey: adminDomainQueryKeys.detail(...ref) });
      queryClient.invalidateQueries({ queryKey: adminDomainQueryKeys.history(...ref) });
      queryClient.invalidateQueries({ queryKey: adminDomainQueryKeys.resourcesPrefix() });
    },
  });
}

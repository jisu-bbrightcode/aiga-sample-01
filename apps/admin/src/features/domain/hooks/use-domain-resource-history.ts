import { useQuery } from "@tanstack/react-query";
import { adminDomainQueryKeys, fetchDomainResourceHistory } from "../api";
import type { DomainResourceType } from "../types";

/**
 * 도메인 리소스 변경 이력(감사 로그) 조회 Hook (PB-ADMIN-DOMAIN-UPDATE-001 / BBR-681).
 *
 * `enabled` is gated on both `type` and `id` so the query never fires with a
 * partial route param.
 */
export function useDomainResourceHistory(type?: DomainResourceType, id?: string) {
  return useQuery({
    queryKey: adminDomainQueryKeys.history(type ?? "doctor", id ?? ""),
    queryFn: ({ signal }) => {
      if (!type || !id) {
        throw new Error("리소스 유형과 ID가 필요합니다.");
      }
      return fetchDomainResourceHistory(type, id, signal);
    },
    enabled: Boolean(type) && Boolean(id),
  });
}

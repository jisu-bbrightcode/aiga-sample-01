import { useQuery } from "@tanstack/react-query";
import { adminDomainQueryKeys, fetchDomainResourceDetail } from "../api";
import type { DomainResourceType } from "../types";

/**
 * 도메인 리소스(의사/병원) 상세 조회 Hook.
 *
 * `enabled` is gated on both `type` and `id` so the query never fires with a
 * partial route param. PB-ADMIN-DOMAIN-READ-001 / BBR-679.
 */
export function useDomainResourceDetail(type?: DomainResourceType, id?: string) {
  return useQuery({
    queryKey: adminDomainQueryKeys.detail(type ?? "doctor", id ?? ""),
    queryFn: ({ signal }) => {
      if (!type || !id) {
        throw new Error("리소스 유형과 ID가 필요합니다.");
      }
      return fetchDomainResourceDetail(type, id, signal);
    },
    enabled: Boolean(type) && Boolean(id),
  });
}

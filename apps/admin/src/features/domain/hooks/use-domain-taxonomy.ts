import { useQuery } from "@tanstack/react-query";
import { adminDomainQueryKeys, fetchDomainTaxonomy } from "../api";

/**
 * 진료과·지역 옵션 조회 Hook — used to populate the create form selects.
 *
 * Taxonomy rarely changes, so it is cached generously. PB-ADMIN-DOMAIN-CREATE-001
 * / BBR-680.
 */
export function useDomainTaxonomy() {
  return useQuery({
    queryKey: adminDomainQueryKeys.taxonomy(),
    queryFn: ({ signal }) => fetchDomainTaxonomy(signal),
    staleTime: 5 * 60 * 1000,
  });
}

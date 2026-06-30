import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DOMAIN_ADMIN_DEFAULT_PAGE_SIZE } from "../constants";
import { adminDomainQueryKeys, fetchDomainResources } from "../api";
import type { DomainResourceFilters } from "../types";

/**
 * 도메인 리소스(의사/병원) 목록 조회 Hook.
 *
 * Keeps the previous page visible while the next one loads so pagination /
 * filtering does not flash an empty table.
 */
export function useDomainResources(filters: DomainResourceFilters = {}) {
  const normalized: DomainResourceFilters = {
    ...filters,
    page: filters.page ?? 1,
    limit: filters.limit ?? DOMAIN_ADMIN_DEFAULT_PAGE_SIZE,
  };

  return useQuery({
    queryKey: adminDomainQueryKeys.resources(normalized),
    queryFn: ({ signal }) => fetchDomainResources(normalized, signal),
    placeholderData: keepPreviousData,
  });
}

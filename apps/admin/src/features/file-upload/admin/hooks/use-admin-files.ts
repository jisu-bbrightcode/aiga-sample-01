import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminFilesQueryKeys, fetchAdminFiles } from "../api";
import { FILES_ADMIN_DEFAULT_PAGE_SIZE } from "../constants";
import type { AdminFileFilters } from "../types";

/**
 * 관리자 파일 목록 조회 Hook.
 *
 * Keeps the previous page visible while the next one loads so pagination /
 * filtering does not flash an empty table.
 */
export function useAdminFiles(filters: AdminFileFilters = {}) {
  const normalized: AdminFileFilters = {
    ...filters,
    page: filters.page ?? 1,
    limit: filters.limit ?? FILES_ADMIN_DEFAULT_PAGE_SIZE,
  };

  return useQuery({
    queryKey: adminFilesQueryKeys.list(normalized),
    queryFn: ({ signal }) => fetchAdminFiles(normalized, signal),
    placeholderData: keepPreviousData,
  });
}

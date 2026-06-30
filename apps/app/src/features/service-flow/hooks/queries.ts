/**
 * React Query hooks for the logged-in service flow (PB-WEB-002 / BBR-580).
 *
 * Each personalization hook is `enabled` only when authenticated so the guarded
 * routes never fire a request that is guaranteed to 401. Errors propagate as
 * {@link ServiceFlowError} so the section components can branch the
 * loading / error / 권한 없음 states from a single mapped code.
 */

import { useQuery } from "@tanstack/react-query";
import {
  getFeaturedDoctors,
  getInterests,
  getSavedItems,
  getSearchHistory,
} from "../api/service-flow-api";
import type {
  CursorPage,
  DoctorListPage,
  Interest,
  SavedItem,
  SearchHistoryEntry,
} from "../api/types";

export const serviceFlowKeys = {
  savedItems: ["service-flow", "saved-items"] as const,
  interests: ["service-flow", "interests"] as const,
  searchHistory: ["service-flow", "search-history"] as const,
  exploreDoctors: (q?: string) => ["service-flow", "explore-doctors", q ?? null] as const,
};

/** Don't retry an auth/permission failure — re-fetching cannot fix a 401/403. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    if (status === 401 || status === 403) return false;
  }
  return failureCount < 1;
}

export function useSavedItems(enabled: boolean) {
  return useQuery<CursorPage<SavedItem>>({
    queryKey: serviceFlowKeys.savedItems,
    queryFn: ({ signal }) => getSavedItems({ limit: 20 }, signal),
    enabled,
    retry: shouldRetry,
  });
}

export function useInterests(enabled: boolean) {
  return useQuery<CursorPage<Interest>>({
    queryKey: serviceFlowKeys.interests,
    queryFn: ({ signal }) => getInterests({ limit: 20 }, signal),
    enabled,
    retry: shouldRetry,
  });
}

export function useSearchHistory(enabled: boolean) {
  return useQuery<CursorPage<SearchHistoryEntry>>({
    queryKey: serviceFlowKeys.searchHistory,
    queryFn: ({ signal }) => getSearchHistory({ limit: 20 }, signal),
    enabled,
    retry: shouldRetry,
  });
}

/**
 * Public catalog read — usable logged-out (powers the explore entry).
 * With a keyword `q` it runs a search (검색 히스토리 재실행); otherwise the
 * featured set. The query key includes `q` so each search is cached distinctly.
 */
export function useFeaturedDoctors(q?: string) {
  const keyword = q?.trim() || undefined;
  return useQuery<DoctorListPage>({
    queryKey: serviceFlowKeys.exploreDoctors(keyword),
    queryFn: ({ signal }) => getFeaturedDoctors({ limit: 12, q: keyword }, signal),
    retry: shouldRetry,
  });
}

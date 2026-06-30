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
  getMe,
  getPopularTerms,
  getRecentTerms,
  getSavedItems,
  getSearchHistory,
  searchUnified,
} from "../api/service-flow-api";
import type {
  CursorPage,
  DoctorListPage,
  Interest,
  SavedItem,
  SearchHistoryEntry,
  SelfUser,
} from "../api/types";
import type { PopularTerm, RecentSearch, SearchResult } from "../api/unified-search-types";
import {
  toUnifiedSearchParams,
  toUnifiedSearchUrl,
  type UnifiedSearchFilters,
} from "../lib/unified-search-params";

export const serviceFlowKeys = {
  me: ["service-flow", "me"] as const,
  savedItems: ["service-flow", "saved-items"] as const,
  interests: ["service-flow", "interests"] as const,
  searchHistory: ["service-flow", "search-history"] as const,
  exploreDoctors: (q?: string) => ["service-flow", "explore-doctors", q ?? null] as const,
  unifiedSearch: (filters: UnifiedSearchFilters) =>
    ["service-flow", "unified-search", toUnifiedSearchUrl(filters)] as const,
  popularTerms: ["service-flow", "popular-terms"] as const,
  recentTerms: ["service-flow", "recent-terms"] as const,
};

/** Don't retry an auth/permission failure — re-fetching cannot fix a 401/403. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    if (status === 401 || status === 403) return false;
  }
  return failureCount < 1;
}

export function useMe(enabled: boolean) {
  return useQuery<SelfUser>({
    queryKey: serviceFlowKeys.me,
    queryFn: ({ signal }) => getMe(signal),
    enabled,
    retry: shouldRetry,
  });
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

/* -------------------------------------------------------------------------- */
/* 통합검색 (unified search) — FR-003 / BBR-582                                 */
/* -------------------------------------------------------------------------- */

/**
 * 통합 검색 (공개) — `GET /service/search`. Browsable logged-out. The query key
 * is derived from the normalized filters so each distinct search caches on its
 * own. `keepPreviousData`-style placeholder keeps the prior page visible while a
 * new query loads (no flash to a blank list between keystroke-committed searches).
 */
export function useUnifiedSearch(filters: UnifiedSearchFilters) {
  return useQuery<SearchResult>({
    queryKey: serviceFlowKeys.unifiedSearch(filters),
    queryFn: ({ signal }) => searchUnified(toUnifiedSearchParams(filters), signal),
    placeholderData: (prev) => prev,
    retry: shouldRetry,
  });
}

/** 인기 검색어 (공개 집계) — `GET /service/search/popular`. */
export function usePopularTerms() {
  return useQuery<PopularTerm[]>({
    queryKey: serviceFlowKeys.popularTerms,
    queryFn: ({ signal }) => getPopularTerms({ limit: 10 }, signal),
    retry: shouldRetry,
  });
}

/**
 * 최근 검색어 (로그인 사용자 본인 기록) — `GET /service/search/recent`.
 * `enabled` only when authenticated so a logged-out viewer never fires the
 * guaranteed-401 request; the page renders a 로그인 안내 (권한 없음) branch instead.
 */
export function useRecentTerms(enabled: boolean) {
  return useQuery<RecentSearch[]>({
    queryKey: serviceFlowKeys.recentTerms,
    queryFn: ({ signal }) => getRecentTerms({ limit: 10 }, signal),
    enabled,
    retry: shouldRetry,
  });
}

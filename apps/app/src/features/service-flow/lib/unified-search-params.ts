/**
 * 통합검색 (unified search) 검색·필터·정렬 state — FR-003 / BBR-582.
 *
 * The search lives in the URL so it is shareable and re-runnable (e.g. from a
 * 인기/최근 검색어 chip). This module is the pure boundary between three shapes:
 *
 *  - the untrusted TanStack search object (`useSearch({ strict: false })`),
 *  - the normalized {@link UnifiedSearchFilters} the UI renders, and
 *  - the {@link UnifiedSearchParams} sent to `GET /service/search`.
 *
 * Scope note: the server also accepts `regionId`/`specialtyId` filters, but those
 * need taxonomy lookup lists to render as selectors; the app screen ships the
 * keyword + entity-type + sort controls (no lookup dependency) and defers the
 * id filters. Every UI control maps to a real server query param so the rendered
 * state and the API contract stay consistent (no client-only ordering).
 */

import type { UnifiedSearchParams } from "../api/service-flow-api";
import type { SearchEntityType, SearchSortMode } from "../api/unified-search-types";

/** Entity-type filter options, plus the "all types" sentinel. */
export const SEARCH_ENTITY_TYPES: readonly SearchEntityType[] = [
  "doctor",
  "hospital",
  "specialty",
  "region",
];

/** UI sort options. Each is a real `/service/search` `sort` value. */
export type UnifiedSortKey = Extract<SearchSortMode, "relevance" | "rating">;
export const UNIFIED_SORT_KEYS: readonly UnifiedSortKey[] = ["relevance", "rating"];
export const DEFAULT_UNIFIED_SORT: UnifiedSortKey = "relevance";

/** Normalized filter state driving the controls and the search query. */
export interface UnifiedSearchFilters {
  /** Keyword. */
  q?: string;
  /** Entity-type narrow; undefined = 전체. */
  type?: SearchEntityType;
  /** Always set — defaults to {@link DEFAULT_UNIFIED_SORT}. */
  sort: UnifiedSortKey;
}

/** Raw, untrusted URL search object. Every field is `unknown` on purpose. */
export interface RawUnifiedSearch {
  q?: unknown;
  type?: unknown;
  sort?: unknown;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function asEntityType(value: unknown): SearchEntityType | undefined {
  const candidate = asNonEmptyString(value);
  return SEARCH_ENTITY_TYPES.includes(candidate as SearchEntityType)
    ? (candidate as SearchEntityType)
    : undefined;
}

function asSortKey(value: unknown): UnifiedSortKey {
  const candidate = asNonEmptyString(value);
  return UNIFIED_SORT_KEYS.includes(candidate as UnifiedSortKey)
    ? (candidate as UnifiedSortKey)
    : DEFAULT_UNIFIED_SORT;
}

/** Normalize an untrusted URL search object into render-ready filters. */
export function parseUnifiedSearch(raw: RawUnifiedSearch | undefined): UnifiedSearchFilters {
  return {
    q: asNonEmptyString(raw?.q),
    type: asEntityType(raw?.type),
    sort: asSortKey(raw?.sort),
  };
}

/**
 * Serialize filters back to a URL search object. Empty values and the default
 * sort are omitted so the address bar stays clean and `/search` (no params)
 * round-trips to itself.
 */
export function toUnifiedSearchUrl(filters: UnifiedSearchFilters): RawUnifiedSearch {
  return {
    q: filters.q || undefined,
    type: filters.type || undefined,
    sort: filters.sort === DEFAULT_UNIFIED_SORT ? undefined : filters.sort,
  };
}

/** Map filters to the `GET /service/search` query. */
export function toUnifiedSearchParams(
  filters: UnifiedSearchFilters,
  limit = 20,
): UnifiedSearchParams {
  return {
    q: filters.q,
    type: filters.type,
    sort: filters.sort,
    limit,
  };
}

/** True when a keyword or type narrows the search (drives empty-state copy). */
export function hasActiveSearch(filters: UnifiedSearchFilters): boolean {
  return Boolean(filters.q || filters.type);
}

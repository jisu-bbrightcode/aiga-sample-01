/**
 * Wire shapes for 통합검색 (unified search) — FR-003 / BBR-582.
 *
 * These mirror the public service-search DTOs exactly so the app stays decoupled
 * from the Nest runtime (the OpenAPI codegen client does not yet expose the AIGA
 * `/service/search/*` routes — that regen is a separate follow-up). They are the
 * single source of truth for what the search screen renders.
 *
 * Contracts (public unless noted):
 *  - GET `/service/search`          → {@link SearchResult} (published docs only)
 *  - GET `/service/search/popular`  → {@link PopularTerm}[] (aggregate counts)
 *  - GET `/service/search/recent`   → {@link RecentSearch}[] (AUTH — own history)
 */

/** Search index entity types. Mirrors `service_search_entity_type` server enum. */
export type SearchEntityType = "doctor" | "hospital" | "specialty" | "region";

/** Server sort modes for the unified list (mirrors `SearchQueryDto.sort`). */
export type SearchSortMode = "relevance" | "rating" | "featured";

/** One public search hit. Mirrors `toPublicSearchHit` — no index internals. */
export interface PublicSearchHit {
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  subtitle: string | null;
  slug: string;
  photoUrl: string | null;
  regionId: string | null;
  specialtyId: string | null;
  ratingAvg: number;
}

/** Paginated unified search envelope (`SearchResultDto`). */
export interface SearchResult {
  items: PublicSearchHit[];
  total: number;
  page: number;
  limit: number;
}

/** 인기 검색어 aggregate row (`PopularTermDto`) — counts only, no logs. */
export interface PopularTerm {
  term: string;
  count: number;
}

/** 최근 검색어 row (`RecentSearchDto`) — the signed-in user's own history. */
export interface RecentSearch {
  term: string;
  lastSearchedAt: string;
}

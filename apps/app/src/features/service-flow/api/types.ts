/**
 * Wire shapes for the logged-in service flow (PB-WEB-002 / BBR-580).
 *
 * These mirror the server response DTOs exactly so the app stays decoupled from
 * the Nest runtime (the OpenAPI codegen client does not yet expose the AIGA
 * `/service/*` and personalization routes — that regen is a separate follow-up).
 * They are the single source of truth for what the My Page renders.
 *
 * Contracts:
 *  - Personalization (auth): `@repo/features/personalization` → GET
 *    `/saved-items`, `/interests`, `/search-history`.
 *  - Service catalog (public): `@repo/features/service-domain` → GET
 *    `/service/doctors`.
 */

/** Catalog resource a save/interest points at. Mirrors PersonalizationTargetType. */
export type ServiceTargetType = "doctor" | "hospital";

export interface SavedItem {
  id: string;
  targetType: ServiceTargetType;
  targetId: string;
  /** 사용자가 저장에 남긴 비공개 메모. */
  memo: string | null;
  /** 사용자 지정 태그. */
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface Interest {
  id: string;
  targetType: ServiceTargetType;
  targetId: string;
  createdAt: string;
}

/** Body for `POST /saved-items` (저장 추가). Owner comes from the session. */
export interface CreateSavedItemInput {
  targetType: ServiceTargetType;
  targetId: string;
  memo?: string;
  tags?: string[];
}

/** Body for `POST /interests` (관심 추가). Owner comes from the session. */
export interface CreateInterestInput {
  targetType: ServiceTargetType;
  targetId: string;
}

export interface SearchHistoryEntry {
  id: string;
  /** 검색어 (필터 전용 검색은 빈 문자열). */
  query: string;
  /** 적용된 필터 스냅샷 (지역/진료과/정렬 등). */
  filters: unknown;
  createdAt: string;
}

/** Cursor-paginated list envelope shared by every personalization list route. */
export interface CursorPage<T> {
  items: T[];
  /** null이면 마지막 페이지. */
  nextCursor: string | null;
}

/** Subset of the public doctor DTO the explore cards render. */
export interface PublicDoctor {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  shortBio: string | null;
  photoUrl: string | null;
  ratingAvg: number;
  reviewCount: number;
  isFeatured: boolean;
}

export interface DoctorListPage {
  items: PublicDoctor[];
  total: number;
  page: number;
  limit: number;
}

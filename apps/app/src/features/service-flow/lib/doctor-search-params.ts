/**
 * 명의 찾기 검색·필터·정렬 state (FR-004 / BBR-583).
 *
 * The doctor search lives in the URL so it is shareable and re-runnable from a
 * 검색 히스토리 entry. This module is the pure boundary between three shapes:
 *
 *  - the untrusted TanStack search object (`useSearch({ strict: false })`),
 *  - the normalized {@link DoctorSearchFilters} the UI renders, and
 *  - the {@link DoctorListParams} sent to `GET /service/doctors`.
 *
 * Sorting note: the catalog has no free-form sort param — `featured` is its only
 * ordering lever. So each {@link DoctorSortKey} maps onto a real server query and
 * the UI never fabricates a client-only order (API/UI 상태 일관성).
 */

import type { DoctorListParams } from "../api/types";

/** UI sort options, each backed by a real `/service/doctors` query. */
export type DoctorSortKey = "recommended" | "rating";

export const DOCTOR_SORT_KEYS: readonly DoctorSortKey[] = ["recommended", "rating"];
export const DEFAULT_DOCTOR_SORT: DoctorSortKey = "recommended";

/** Normalized filter state driving the controls and the catalog query. */
export interface DoctorSearchFilters {
  /** Keyword. */
  q?: string;
  /** 진료과 id (uuid). */
  specialtyId?: string;
  /** 지역 id (uuid). */
  regionId?: string;
  /** Always set — defaults to {@link DEFAULT_DOCTOR_SORT}. */
  sort: DoctorSortKey;
}

/** Raw, untrusted URL search object. Every field is `unknown` on purpose. */
export interface RawDoctorSearch {
  q?: unknown;
  specialty?: unknown;
  region?: unknown;
  sort?: unknown;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function asSortKey(value: unknown): DoctorSortKey {
  const candidate = asNonEmptyString(value);
  return DOCTOR_SORT_KEYS.includes(candidate as DoctorSortKey)
    ? (candidate as DoctorSortKey)
    : DEFAULT_DOCTOR_SORT;
}

/** Normalize an untrusted URL search object into render-ready filters. */
export function parseDoctorSearch(raw: RawDoctorSearch | undefined): DoctorSearchFilters {
  return {
    q: asNonEmptyString(raw?.q),
    specialtyId: asNonEmptyString(raw?.specialty),
    regionId: asNonEmptyString(raw?.region),
    sort: asSortKey(raw?.sort),
  };
}

/**
 * Serialize filters back to a URL search object. Empty values and the default
 * sort are omitted so the address bar stays clean and `/explore` (no params)
 * round-trips to itself.
 */
export function toDoctorSearchParams(filters: DoctorSearchFilters): RawDoctorSearch {
  return {
    q: filters.q || undefined,
    specialty: filters.specialtyId || undefined,
    region: filters.regionId || undefined,
    sort: filters.sort === DEFAULT_DOCTOR_SORT ? undefined : filters.sort,
  };
}

/**
 * Map filters to the catalog query. `recommended` requests the featured set
 * (server orders by featuredRank, then rating); `rating` omits `featured` so the
 * server orders by ratingAvg desc.
 */
export function toDoctorListParams(filters: DoctorSearchFilters, limit = 12): DoctorListParams {
  return {
    q: filters.q,
    specialtyId: filters.specialtyId,
    regionId: filters.regionId,
    featured: filters.sort === "recommended" ? true : undefined,
    limit,
  };
}

/** True when a keyword or filter narrows the catalog (drives empty-state copy). */
export function hasActiveSearch(filters: DoctorSearchFilters): boolean {
  return Boolean(filters.q || filters.specialtyId || filters.regionId);
}

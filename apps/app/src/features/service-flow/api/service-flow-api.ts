/**
 * Thin REST readers for the logged-in service flow (PB-WEB-002 / BBR-580).
 *
 * The generated `$api` client does not yet cover the AIGA `/service/*` and
 * personalization routes, so we fetch them directly here — mirroring the
 * decoupled reader pattern in `apps/site/src/lib/service-api.ts`. Authed reads
 * attach the same Bearer/session headers as the rest of the app via
 * {@link getAuthHeaders}; the public catalog read sends none.
 *
 * On a non-OK response we throw a {@link ServiceFlowError} carrying a STABLE
 * error code (never the raw server body) so the UI can map it through
 * `getAppErrorMessage` and branch loading / error / 권한 없음 states. Network
 * failures surface as a generic-coded error too — callers never see raw text.
 */

import { API_URL, getAuthHeaders } from "@/lib/auth-headers";
import type {
  CreateInterestInput,
  CreateSavedItemInput,
  CursorPage,
  DoctorListPage,
  Interest,
  SavedItem,
  SearchHistoryEntry,
} from "./types";
import type {
  PopularTerm,
  RecentSearch,
  SearchEntityType,
  SearchResult,
  SearchSortMode,
} from "./unified-search-types";

/** Stable, user-facing-mappable error codes (see lib/user-facing-error.ts). */
export type ServiceFlowErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "TOO_MANY_REQUESTS"
  | "BAD_REQUEST"
  | "GENERIC";

export class ServiceFlowError extends Error {
  /** Read by `getUserFacingErrorCode` → mapped to an i18n key. */
  readonly code: ServiceFlowErrorCode;
  readonly status: number;

  constructor(code: ServiceFlowErrorCode, status: number) {
    super(code);
    this.name = "ServiceFlowError";
    this.code = code;
    this.status = status;
  }
}

export function statusToErrorCode(status: number): ServiceFlowErrorCode {
  switch (status) {
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 429:
      return "TOO_MANY_REQUESTS";
    case 400:
    case 422:
      return "BAD_REQUEST";
    default:
      return "GENERIC";
  }
}

interface FetchOptions {
  /** Attach the auth headers (Bearer token + session). Default false (public). */
  authed?: boolean;
  signal?: AbortSignal;
  /** HTTP method. Default "GET". */
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  /** JSON request body (serialized + `content-type: application/json`). */
  body?: unknown;
}

async function fetchJson<T>(path: string, options: FetchOptions = {}): Promise<T> {
  if (!API_URL) {
    // No API configured — treat as a transient outage rather than leaking config state.
    throw new ServiceFlowError("GENERIC", 0);
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (options.authed) Object.assign(headers, getAuthHeaders());
  if (options.body !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      credentials: "include",
      signal: options.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    // Network / CORS / abort — never surface raw detail to the UI.
    throw new ServiceFlowError("GENERIC", 0);
  }

  if (!res.ok) {
    throw new ServiceFlowError(statusToErrorCode(res.status), res.status);
  }

  // 204 (해제/DELETE) and other empty bodies have nothing to parse.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                  */
/* -------------------------------------------------------------------------- */

export interface ListParams {
  cursor?: string;
  limit?: number;
}

export function getSavedItems(
  params: ListParams = {},
  signal?: AbortSignal,
): Promise<CursorPage<SavedItem>> {
  return fetchJson<CursorPage<SavedItem>>(`/saved-items${buildQuery({ ...params })}`, {
    authed: true,
    signal,
  });
}

export function getInterests(
  params: ListParams = {},
  signal?: AbortSignal,
): Promise<CursorPage<Interest>> {
  return fetchJson<CursorPage<Interest>>(`/interests${buildQuery({ ...params })}`, {
    authed: true,
    signal,
  });
}

export function getSearchHistory(
  params: ListParams = {},
  signal?: AbortSignal,
): Promise<CursorPage<SearchHistoryEntry>> {
  return fetchJson<CursorPage<SearchHistoryEntry>>(`/search-history${buildQuery({ ...params })}`, {
    authed: true,
    signal,
  });
}

export interface FeaturedDoctorsParams {
  limit?: number;
  /** Keyword search — when set, runs a catalog query instead of the featured set. */
  q?: string;
}

export function getFeaturedDoctors(
  params: FeaturedDoctorsParams = {},
  signal?: AbortSignal,
): Promise<DoctorListPage> {
  const q = params.q?.trim();
  // 검색 히스토리 재실행: a query runs a keyword search; otherwise the featured set.
  const query = q
    ? buildQuery({ q, limit: params.limit ?? 12 })
    : buildQuery({ featured: true, limit: params.limit ?? 12 });
  return fetchJson<DoctorListPage>(`/service/doctors${query}`, { signal });
}

/* -------------------------------------------------------------------------- */
/* Writes (personalization, auth) — BBR-726 / BBR-729                         */
/* -------------------------------------------------------------------------- */

/** 저장 추가 — `POST /saved-items`. Idempotent per (owner, target). */
export function createSavedItem(input: CreateSavedItemInput): Promise<SavedItem> {
  return fetchJson<SavedItem>("/saved-items", { authed: true, method: "POST", body: input });
}

/** 관심 추가 — `POST /interests`. Idempotent per (owner, target). */
export function createInterest(input: CreateInterestInput): Promise<Interest> {
  return fetchJson<Interest>("/interests", { authed: true, method: "POST", body: input });
}

/** 저장 해제 — `DELETE /saved-items/:id`. 204, owner-scoped. */
export function removeSavedItem(id: string): Promise<void> {
  return fetchJson<void>(`/saved-items/${encodeURIComponent(id)}`, {
    authed: true,
    method: "DELETE",
  });
}

/** 관심 해제 — `DELETE /interests/:id`. 204, owner-scoped. */
export function removeInterest(id: string): Promise<void> {
  return fetchJson<void>(`/interests/${encodeURIComponent(id)}`, {
    authed: true,
    method: "DELETE",
  });
}

/* -------------------------------------------------------------------------- */
/* 통합검색 (unified search) readers — FR-003 / BBR-582                         */
/* -------------------------------------------------------------------------- */

/** Query for `GET /service/search`. All fields optional (public, browsable). */
export interface UnifiedSearchParams {
  q?: string;
  type?: SearchEntityType;
  regionId?: string;
  specialtyId?: string;
  sort?: SearchSortMode;
  page?: number;
  limit?: number;
}

/**
 * 통합 검색 (공개) — `GET /service/search`. No auth: the public surface always
 * scopes to published documents server-side. Returns a paginated hit list.
 */
export function searchUnified(
  params: UnifiedSearchParams = {},
  signal?: AbortSignal,
): Promise<SearchResult> {
  return fetchJson<SearchResult>(`/service/search${buildQuery({ ...params })}`, { signal });
}

/** 인기 검색어 (공개 집계) — `GET /service/search/popular`. */
export function getPopularTerms(
  params: { limit?: number; days?: number } = {},
  signal?: AbortSignal,
): Promise<PopularTerm[]> {
  return fetchJson<PopularTerm[]>(`/service/search/popular${buildQuery({ ...params })}`, {
    signal,
  });
}

/**
 * 최근 검색어 (로그인 사용자 본인 기록) — `GET /service/search/recent`.
 * Auth-gated: a logged-out caller gets 401 → surfaced as a 권한 없음 branch.
 */
export function getRecentTerms(
  params: { limit?: number } = {},
  signal?: AbortSignal,
): Promise<RecentSearch[]> {
  return fetchJson<RecentSearch[]>(`/service/search/recent${buildQuery({ ...params })}`, {
    authed: true,
    signal,
  });
}

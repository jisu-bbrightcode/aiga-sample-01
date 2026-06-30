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
import type { CursorPage, DoctorListPage, Interest, SavedItem, SearchHistoryEntry } from "./types";

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
}

async function fetchJson<T>(path: string, options: FetchOptions = {}): Promise<T> {
  if (!API_URL) {
    // No API configured — treat as a transient outage rather than leaking config state.
    throw new ServiceFlowError("GENERIC", 0);
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (options.authed) Object.assign(headers, getAuthHeaders());

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers,
      credentials: "include",
      signal: options.signal,
    });
  } catch {
    // Network / CORS / abort — never surface raw detail to the UI.
    throw new ServiceFlowError("GENERIC", 0);
  }

  if (!res.ok) {
    throw new ServiceFlowError(statusToErrorCode(res.status), res.status);
  }

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
}

export function getFeaturedDoctors(
  params: FeaturedDoctorsParams = {},
  signal?: AbortSignal,
): Promise<DoctorListPage> {
  return fetchJson<DoctorListPage>(
    `/service/doctors${buildQuery({ featured: true, limit: params.limit ?? 12 })}`,
    { signal },
  );
}

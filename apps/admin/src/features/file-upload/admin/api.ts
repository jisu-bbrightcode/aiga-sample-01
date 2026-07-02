/**
 * 파일 관리자/감사 콘솔 — data access + query keys (PB-FILE-ADMIN-001 / BBR-555).
 *
 * A thin, schema-validated fetch layer over the admin file REST contract that
 * reuses the same base URL + auth headers as the typed `apiClient`. The list +
 * metadata-update endpoints are live on the backend today; delete + cleanup
 * land with PB-FILE-API-DELETE-001 and start working the moment they ship — no
 * frontend regeneration required (same forward-compatible pattern as the domain
 * admin feature).
 */
import { z } from "zod";
import { API_URL, getAuthHeaders } from "../../../lib/api";
import {
  ADMIN_FILES_CLEANUP_ENDPOINT,
  ADMIN_FILES_ENDPOINT,
  adminFileEndpoint,
  adminFileRestoreEndpoint,
} from "./constants";
import type {
  AdminFileFilters,
  AdminFileListResult,
  AdminFileMetadataPatch,
  FileCleanupResult,
  FileDeleteResult,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Response schemas                                                           */
/* -------------------------------------------------------------------------- */

const statusSchema = z.enum(["pending", "ready", "failed", "deleted"]);
const visibilitySchema = z.enum(["public", "private"]);
const sourceSchema = z.enum(["user", "admin", "system"]);
const reviewStatusSchema = z
  .enum(["not_required", "pending", "approved", "rejected"])
  .catch("not_required");

const adminFileSchema = z.object({
  fileAssetId: z.string(),
  ownerUserId: z.string().nullable().default(null),
  source: sourceSchema,
  originalName: z.string(),
  pathname: z.string().nullable().default(null),
  url: z.string().nullable().default(null),
  downloadUrl: z.string().nullable().default(null),
  contentType: z.string().nullable().default(null),
  size: z.number().nullable().default(null),
  declaredContentType: z.string().nullable().default(null),
  declaredSize: z.number().nullable().default(null),
  visibility: visibilitySchema,
  status: statusSchema,
  scanStatus: z.string().nullable().default(null),
  reviewStatus: reviewStatusSchema.default("not_required"),
  targetType: z.string().nullable().default(null),
  targetId: z.string().nullable().default(null),
  createdAt: z.string(),
  completedAt: z.string().nullable().default(null),
  deletedAt: z.string().nullable().default(null),
  deletedBy: z.string().nullable().default(null),
});

const adminFileListSchema = z.object({
  items: z.array(adminFileSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

const fileDeleteResultSchema = z.object({
  fileAssetId: z.string(),
  status: z.literal("deleted"),
  deletedAt: z.string().nullable().default(null),
});

const fileCleanupResultSchema = z.object({
  orphanPendingReaped: z.number(),
  deletedBlobsPurged: z.number(),
  blobDeleteFailures: z.number(),
});

/* -------------------------------------------------------------------------- */
/* Fetch helpers                                                              */
/* -------------------------------------------------------------------------- */

function buildQuery(filters: AdminFileFilters): string {
  const params = new URLSearchParams();
  if (filters.page != null) params.set("page", String(filters.page));
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.ownerUserId) params.set("ownerUserId", filters.ownerUserId);
  if (filters.source) params.set("source", filters.source);
  if (filters.status) params.set("status", filters.status);
  if (filters.visibility) params.set("visibility", filters.visibility);
  if (filters.targetType) params.set("targetType", filters.targetType);
  if (filters.targetId) params.set("targetId", filters.targetId);
  if (filters.contentType) params.set("contentType", filters.contentType);
  if (filters.includeDeleted) params.set("includeDeleted", "true");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function readError(response: Response, fallback: string): Promise<string> {
  // Internal-only: surfaces an operator-facing Korean message; the raw body is
  // never shown verbatim (only the HTTP status, which is safe operator context).
  return `${fallback} (HTTP ${response.status})`;
}

/** Fetch a page of files for the admin console. */
export async function fetchAdminFiles(
  filters: AdminFileFilters,
  signal?: AbortSignal,
): Promise<AdminFileListResult> {
  const url = `${API_URL}${ADMIN_FILES_ENDPOINT}${buildQuery(filters)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", ...getAuthHeaders() },
    credentials: "include",
    signal,
  });
  if (!response.ok) {
    throw new Error(await readError(response, "파일 목록을 불러오지 못했습니다"));
  }
  return adminFileListSchema.parse(await response.json());
}

/** Update a file's metadata (`PATCH /admin/files/:id`). */
export async function updateAdminFileMetadata(
  fileAssetId: string,
  patch: AdminFileMetadataPatch,
): Promise<void> {
  const url = `${API_URL}${adminFileEndpoint(fileAssetId)}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "파일 정보를 수정하지 못했습니다"));
  }
}

/** Force-delete a file (`DELETE /admin/files/:id`). */
export async function deleteAdminFile(fileAssetId: string): Promise<FileDeleteResult> {
  const url = `${API_URL}${adminFileEndpoint(fileAssetId)}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: { Accept: "application/json", ...getAuthHeaders() },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "파일을 삭제하지 못했습니다"));
  }
  return fileDeleteResultSchema.parse(await response.json());
}

/**
 * Restore a soft-deleted file (`POST /admin/files/:id/restore`).
 *
 * Pending backend support (see `PB-FILE-API-RESTORE` child issue); the UI
 * surfaces the affordance today and it activates when the endpoint ships.
 */
export async function restoreAdminFile(fileAssetId: string): Promise<void> {
  const url = `${API_URL}${adminFileRestoreEndpoint(fileAssetId)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", ...getAuthHeaders() },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "파일을 복구하지 못했습니다"));
  }
}

/** Run one cleanup sweep (`POST /admin/files/cleanup`). */
export async function runAdminFileCleanup(): Promise<FileCleanupResult> {
  const url = `${API_URL}${ADMIN_FILES_CLEANUP_ENDPOINT}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", ...getAuthHeaders() },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "정리 작업을 실행하지 못했습니다"));
  }
  return fileCleanupResultSchema.parse(await response.json());
}

/* -------------------------------------------------------------------------- */
/* Query keys                                                                 */
/* -------------------------------------------------------------------------- */

export const adminFilesQueryKeys = {
  prefix: () => ["admin", "files"] as const,
  list: (filters: AdminFileFilters) => [...adminFilesQueryKeys.prefix(), filters] as const,
};

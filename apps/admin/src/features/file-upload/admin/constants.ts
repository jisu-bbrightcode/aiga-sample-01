/**
 * 파일 관리자/감사 콘솔 — constants (PB-FILE-ADMIN-001 / BBR-555).
 */

/** Admin route for the file management console. */
export const FILES_ADMIN_PATH = "/files";

/** Default page size for the admin file list. */
export const FILES_ADMIN_DEFAULT_PAGE_SIZE = 20;

/* REST contract endpoints (relative to the API origin). */

/** `GET /admin/files` + `DELETE /admin/files/:id` — list / force-delete. */
export const ADMIN_FILES_ENDPOINT = "/api/admin/files";

/** `POST /admin/files/cleanup` — orphan + stuck-purge sweep. */
export const ADMIN_FILES_CLEANUP_ENDPOINT = "/api/admin/files/cleanup";

/**
 * `POST /admin/files/:id/restore` — restore a soft-deleted file.
 *
 * NOTE: this endpoint is NOT yet provided by any backend dependency
 * (PB-FILE-API-DELETE-001 ships delete + cleanup only). The restore affordance
 * is wired to this contract and activates when the backend ships it — tracked
 * by the `PB-FILE-API-RESTORE` child issue.
 */
export const adminFileRestoreEndpoint = (fileAssetId: string): string =>
  `${ADMIN_FILES_ENDPOINT}/${fileAssetId}/restore`;

export const adminFileEndpoint = (fileAssetId: string): string =>
  `${ADMIN_FILES_ENDPOINT}/${fileAssetId}`;

/**
 * 파일 관리자/감사 콘솔 — view-model types (PB-FILE-ADMIN-001 / BBR-555).
 *
 * Mirrors the admin file REST contract:
 * - `GET /admin/files`        (PB-FILE-API-LIST-001 / BBR-550, on main)
 * - `PATCH /admin/files/:id`  (PB-FILE-API-UPDATE-001 / BBR-552, on main)
 * - `DELETE /admin/files/:id`, `POST /admin/files/cleanup`
 *   (PB-FILE-API-DELETE-001 / BBR-553 — contract documented; lands with the
 *   backend PR, same forward-compatible pattern as the domain admin feature)
 *
 * These DTOs are intentionally decoupled from Drizzle row types — the console
 * only consumes the admin-projected fields the endpoint returns.
 */

/** Binary lifecycle state of a file asset. */
export type FileStatus = "pending" | "ready" | "failed" | "deleted";

/** Access policy. */
export type FileVisibility = "public" | "private";

/** Who created the file. */
export type FileSource = "user" | "admin" | "system";

/** Moderation review state (admin-editable). */
export type FileReviewStatus = "not_required" | "pending" | "approved" | "rejected";

/** One row in the admin file list — the full admin-projected record. */
export interface AdminFileAsset {
  fileAssetId: string;
  ownerUserId: string | null;
  source: FileSource;
  originalName: string;
  pathname: string | null;
  url: string | null;
  downloadUrl: string | null;
  contentType: string | null;
  size: number | null;
  declaredContentType: string | null;
  declaredSize: number | null;
  visibility: FileVisibility;
  status: FileStatus;
  scanStatus: string | null;
  reviewStatus: FileReviewStatus;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
}

/** Query parameters accepted by `GET /admin/files`. */
export interface AdminFileFilters {
  page?: number;
  limit?: number;
  ownerUserId?: string;
  source?: FileSource;
  status?: FileStatus;
  visibility?: FileVisibility;
  targetType?: string;
  targetId?: string;
  contentType?: string;
  /** Include soft-deleted rows (needed to review/restore/audit deletions). */
  includeDeleted?: boolean;
}

/** Paginated list envelope `{ items, total, page, limit }`. */
export interface AdminFileListResult {
  items: AdminFileAsset[];
  total: number;
  page: number;
  limit: number;
}

/** Editable metadata fields (`PATCH /admin/files/:id`). */
export interface AdminFileMetadataPatch {
  displayName?: string;
  altText?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  visibility?: FileVisibility;
  sortOrder?: number;
  reviewStatus?: FileReviewStatus;
  /** Optional human reason recorded in the audit trail. */
  reason?: string;
}

/** `DELETE /admin/files/:id` response. */
export interface FileDeleteResult {
  fileAssetId: string;
  status: "deleted";
  deletedAt: string | null;
}

/** `POST /admin/files/cleanup` response. */
export interface FileCleanupResult {
  orphanPendingReaped: number;
  deletedBlobsPurged: number;
  blobDeleteFailures: number;
}

/* -------------------------------------------------------------------------- */
/* Display labels + badge variants                                            */
/* -------------------------------------------------------------------------- */

export const FILE_STATUS_LABELS: Record<FileStatus, string> = {
  pending: "업로드 대기",
  ready: "정상",
  failed: "업로드 실패",
  deleted: "삭제됨",
};

export const FILE_STATUS_BADGE_VARIANT: Record<
  FileStatus,
  "success" | "secondary" | "destructive" | "outline"
> = {
  ready: "success",
  pending: "secondary",
  failed: "destructive",
  deleted: "outline",
};

export const FILE_VISIBILITY_LABELS: Record<FileVisibility, string> = {
  public: "공개",
  private: "비공개",
};

export const FILE_SOURCE_LABELS: Record<FileSource, string> = {
  user: "사용자",
  admin: "관리자",
  system: "시스템",
};

export const FILE_REVIEW_STATUS_LABELS: Record<FileReviewStatus, string> = {
  not_required: "검수 불필요",
  pending: "검수 대기",
  approved: "승인",
  rejected: "반려",
};

export const FILE_REVIEW_BADGE_VARIANT: Record<
  FileReviewStatus,
  "success" | "secondary" | "destructive" | "outline"
> = {
  approved: "success",
  pending: "secondary",
  rejected: "destructive",
  not_required: "outline",
};

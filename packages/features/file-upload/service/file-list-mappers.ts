import type { FileAsset } from "@repo/drizzle";

/**
 * Owner-facing and admin-facing projections of a {@link FileAsset}
 * (PB-FILE-API-LIST-001 / BBR-550).
 *
 * Field separation is fail-closed: the owner view is an explicit allow-list, so
 * internal columns (storage pathname, declared/scan/review metadata,
 * soft-delete audit) can never leak to a non-admin caller even if new columns
 * are added to the table later.
 */

/** Owner's own file — uploader-safe fields only. */
export interface OwnerFileView {
  fileAssetId: string;
  originalName: string;
  contentType: string | null;
  size: number | null;
  visibility: "public" | "private";
  status: "pending" | "ready" | "failed";
  targetType: string | null;
  targetId: string | null;
  /** Canonical Blob URL — only meaningful once the upload is `ready`. */
  url: string | null;
  downloadUrl: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Operator console — the full record incl. trust-boundary + audit fields. */
export interface AdminFileView {
  fileAssetId: string;
  ownerUserId: string | null;
  source: string;
  originalName: string;
  pathname: string;
  url: string;
  downloadUrl: string | null;
  contentType: string | null;
  size: number | null;
  declaredContentType: string | null;
  declaredSize: number | null;
  visibility: "public" | "private";
  status: string;
  scanStatus: string;
  reviewStatus: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
}

/**
 * Project a row for its owner. The storage `url` is withheld until the asset is
 * `ready` (a `pending`/`failed` row holds a provisional pathname in `blobUrl`,
 * never a servable URL).
 */
export function toOwnerFileView(row: FileAsset): OwnerFileView {
  const ready = row.status === "ready";
  return {
    fileAssetId: row.id,
    originalName: row.originalName,
    contentType: row.contentType ?? null,
    size: row.size ?? null,
    visibility: row.visibility,
    // The owner listing never surfaces `deleted` rows, so the status union is
    // narrowed; the service filters those out before mapping.
    status: row.status as OwnerFileView["status"],
    targetType: row.targetType ?? null,
    targetId: row.targetId ?? null,
    url: ready ? row.blobUrl : null,
    downloadUrl: ready ? (row.downloadUrl ?? null) : null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

/** Project a row for an operator — every column, no redaction. */
export function toAdminFileView(row: FileAsset): AdminFileView {
  return {
    fileAssetId: row.id,
    ownerUserId: row.ownerUserId ?? null,
    source: row.source,
    originalName: row.originalName,
    pathname: row.pathname,
    url: row.blobUrl,
    downloadUrl: row.downloadUrl ?? null,
    contentType: row.contentType ?? null,
    size: row.size ?? null,
    declaredContentType: row.declaredContentType ?? null,
    declaredSize: row.declaredSize ?? null,
    visibility: row.visibility,
    status: row.status,
    scanStatus: row.scanStatus,
    reviewStatus: row.reviewStatus,
    targetType: row.targetType ?? null,
    targetId: row.targetId ?? null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    deletedBy: row.deletedBy ?? null,
  };
}

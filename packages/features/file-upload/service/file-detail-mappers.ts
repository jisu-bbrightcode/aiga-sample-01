import type { FileAsset } from "@repo/drizzle";
import type { FileAccessDecision } from "./file-access-policy";

/**
 * Single-asset detail projection (PB-FILE-API-READ-001 / BBR-551).
 *
 * Like the listing owner view, this is a fail-closed allow-list: internal
 * columns (storage pathname, scan/review/declared metadata, soft-delete audit)
 * are never present, so they cannot leak to a non-admin caller.
 *
 * The `access` discriminator makes the public/private contract explicit
 * (acceptance criteria §1): `"public"` rows are world-readable and always carry
 * the servable URL; `"owner"` rows are returned to an authorised caller only,
 * and their URL is withheld until the upload is `ready`.
 */
export interface FileDetailView {
  fileAssetId: string;
  /** How this asset was authorised for the caller. */
  access: Extract<FileAccessDecision, "public" | "owner">;
  originalName: string;
  contentType: string | null;
  size: number | null;
  visibility: "public" | "private";
  status: "pending" | "ready" | "failed";
  targetType: string | null;
  targetId: string | null;
  /** Access URL — present for public+ready, or for an owner once `ready`. */
  url: string | null;
  downloadUrl: string | null;
  createdAt: string;
  completedAt: string | null;
}

/**
 * Project a row for a `"public"` or `"owner"` caller.
 *
 * URL exposure policy:
 *  - public access → the asset is `ready` by definition, so the canonical Blob
 *    URL is returned.
 *  - owner access → the URL is withheld until `ready` (a `pending`/`failed` row
 *    has no servable bytes), mirroring the owner listing view.
 */
export function toFileDetailView(
  row: FileAsset,
  access: Extract<FileAccessDecision, "public" | "owner">,
): FileDetailView {
  const servable = row.status === "ready";
  return {
    fileAssetId: row.id,
    access,
    originalName: row.originalName,
    contentType: row.contentType ?? null,
    size: row.size ?? null,
    visibility: row.visibility,
    // `deleted` never reaches this mapper (policy denies it first); the public
    // status union therefore excludes it.
    status: row.status as FileDetailView["status"],
    targetType: row.targetType ?? null,
    targetId: row.targetId ?? null,
    url: servable ? row.blobUrl : null,
    downloadUrl: servable ? (row.downloadUrl ?? null) : null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

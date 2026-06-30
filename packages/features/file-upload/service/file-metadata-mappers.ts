import type { FileAsset } from "@repo/drizzle";

/**
 * Response projection for the metadata update endpoints
 * (PB-FILE-API-UPDATE-001 / BBR-552).
 *
 * Returns exactly the editable metadata (plus identity + the read-only `status`
 * so the caller can see the binary lifecycle was untouched — AC §1). Storage /
 * trust-boundary columns are intentionally excluded, the same fail-closed stance
 * as the owner listing view.
 */
export interface FileMetadataView {
  fileAssetId: string;
  displayName: string;
  altText: string | null;
  targetType: string | null;
  targetId: string | null;
  visibility: "public" | "private";
  status: "pending" | "ready" | "failed" | "deleted";
  reviewStatus: "not_required" | "pending" | "approved" | "rejected";
  sortOrder: number;
  updatedAt: string;
}

export function toFileMetadataView(row: FileAsset): FileMetadataView {
  return {
    fileAssetId: row.id,
    displayName: row.originalName,
    altText: row.altText ?? null,
    targetType: row.targetType ?? null,
    targetId: row.targetId ?? null,
    visibility: row.visibility,
    status: row.status,
    reviewStatus: row.reviewStatus,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * File metadata update policy — pure resolver for `PATCH /files/:id`
 * (PB-FILE-API-UPDATE-001 / BBR-552).
 *
 * This module is intentionally framework-free (no NestJS / DB imports) so the
 * permission + visibility rules can be unit-tested directly and stay consistent
 * across the owner and admin surfaces.
 *
 * It only governs METADATA (acceptance criteria §1): display name, alt text,
 * target-resource link, visibility, sort order, and (admin only) review status.
 * The binary itself — `blobUrl` / `pathname` / `contentType` / `size` /
 * `checksum` / `status` — is never touched here; replacing bytes is a separate
 * upload flow (POST /files/uploads).
 *
 * Visibility gate (acceptance criteria §2 — "visibility 변경은 권한과 대상 리소스
 * 정책을 통과해야 한다"): making an asset `public` is only allowed when the
 * upload is confirmed (`ready`) and its content review is not pending/rejected,
 * so unverified or moderation-flagged UGC can never be published. The check runs
 * against the *resulting* review status, so an admin may approve + publish in a
 * single patch.
 */

/** Lifecycle/access fields the policy reads from the current row. */
export interface FileMetadataCurrent {
  status: "pending" | "ready" | "failed" | "deleted";
  visibility: "public" | "private";
  reviewStatus: "not_required" | "pending" | "approved" | "rejected";
  targetType: string | null;
  targetId: string | null;
  originalName: string;
  altText: string | null;
  sortOrder: number;
}

/** Review states an asset may hold to be eligible for public visibility. */
const PUBLIC_ELIGIBLE_REVIEW: ReadonlySet<FileMetadataCurrent["reviewStatus"]> = new Set([
  "not_required",
  "approved",
]);

/**
 * The validated patch (already shape-checked by the DTO). A key being present
 * means "change to this value" (including `null` to clear); an absent key means
 * "leave unchanged". `reviewStatus` is only ever present on the admin path.
 */
export interface FileMetadataPatch {
  originalName?: string;
  altText?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  visibility?: "public" | "private";
  sortOrder?: number;
  reviewStatus?: "not_required" | "pending" | "approved" | "rejected";
}

/** Column-level changes to persist (only differing keys are included). */
export interface FileMetadataChanges {
  originalName?: string;
  altText?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  visibility?: "public" | "private";
  sortOrder?: number;
  reviewStatus?: "not_required" | "pending" | "approved" | "rejected";
}

export type FileMetadataPolicyViolation =
  | { code: "file_deleted"; message: string }
  | { code: "not_ready_for_public"; message: string }
  | { code: "review_blocks_public"; message: string }
  | { code: "incomplete_target"; message: string };

export type FileMetadataPolicyResult =
  | { ok: true; changes: FileMetadataChanges }
  | { ok: false; violation: FileMetadataPolicyViolation };

/** Actor context — `reviewStatus` edits are reserved for `admin`. */
export interface FileMetadataActor {
  role: "owner" | "admin";
}

/**
 * Resolve a metadata patch into the concrete column changes to persist, or a
 * policy violation. Only keys whose value actually differs from the current row
 * are returned, so an idempotent (no-op) patch yields an empty change set and
 * the caller can skip the write + audit entry entirely.
 */
export function resolveMetadataUpdate(
  current: FileMetadataCurrent,
  patch: FileMetadataPatch,
  actor: FileMetadataActor,
): FileMetadataPolicyResult {
  // A soft-deleted asset is immutable; restore is a separate concern.
  if (current.status === "deleted") {
    return {
      ok: false,
      violation: { code: "file_deleted", message: "삭제된 파일은 수정할 수 없습니다." },
    };
  }

  const changes = collectChanges(current, patch, actor);

  const violation =
    checkTargetCoherence(current, changes) ?? checkVisibilityGate(current, changes);
  if (violation) return { ok: false, violation };

  return { ok: true, changes };
}

/** Build the set of column changes — only keys whose value actually differs. */
function collectChanges(
  current: FileMetadataCurrent,
  patch: FileMetadataPatch,
  actor: FileMetadataActor,
): FileMetadataChanges {
  const changes: FileMetadataChanges = {};

  if (patch.originalName !== undefined && patch.originalName !== current.originalName) {
    changes.originalName = patch.originalName;
  }
  if (patch.altText !== undefined && patch.altText !== current.altText) {
    changes.altText = patch.altText;
  }
  if (patch.targetType !== undefined && patch.targetType !== current.targetType) {
    changes.targetType = patch.targetType;
  }
  if (patch.targetId !== undefined && patch.targetId !== current.targetId) {
    changes.targetId = patch.targetId;
  }
  if (patch.sortOrder !== undefined && patch.sortOrder !== current.sortOrder) {
    changes.sortOrder = patch.sortOrder;
  }
  // reviewStatus is admin-only; the owner DTO never carries it, but guard here
  // too so the policy is safe regardless of caller.
  if (
    patch.reviewStatus !== undefined &&
    actor.role === "admin" &&
    patch.reviewStatus !== current.reviewStatus
  ) {
    changes.reviewStatus = patch.reviewStatus;
  }
  if (patch.visibility !== undefined && patch.visibility !== current.visibility) {
    changes.visibility = patch.visibility;
  }

  return changes;
}

/** Target link must be fully set (attached) or fully cleared (detached). */
function checkTargetCoherence(
  current: FileMetadataCurrent,
  changes: FileMetadataChanges,
): FileMetadataPolicyViolation | null {
  const resultingTargetType =
    changes.targetType === undefined ? current.targetType : changes.targetType;
  const resultingTargetId = changes.targetId === undefined ? current.targetId : changes.targetId;
  if ((resultingTargetType === null) !== (resultingTargetId === null)) {
    return {
      code: "incomplete_target",
      message: "대상 리소스 연결은 종류와 식별자를 함께 지정하거나 함께 비워야 합니다.",
    };
  }
  return null;
}

/**
 * Visibility → public gate (§2): public requires a confirmed (`ready`) upload
 * whose *resulting* review status is not pending/rejected.
 */
function checkVisibilityGate(
  current: FileMetadataCurrent,
  changes: FileMetadataChanges,
): FileMetadataPolicyViolation | null {
  const resultingVisibility =
    changes.visibility === undefined ? current.visibility : changes.visibility;
  if (resultingVisibility !== "public") return null;

  if (current.status !== "ready") {
    return {
      code: "not_ready_for_public",
      message: "업로드가 확정된 파일만 공개로 전환할 수 있습니다.",
    };
  }
  const resultingReview =
    changes.reviewStatus === undefined ? current.reviewStatus : changes.reviewStatus;
  if (!PUBLIC_ELIGIBLE_REVIEW.has(resultingReview)) {
    return {
      code: "review_blocks_public",
      message: "검수가 완료되지 않았거나 거부된 파일은 공개로 전환할 수 없습니다.",
    };
  }
  return null;
}

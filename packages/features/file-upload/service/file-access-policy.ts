import type { FileAsset } from "@repo/drizzle";

/**
 * Access policy for the file-detail endpoint (PB-FILE-API-READ-001 / BBR-551).
 *
 * Pure decision function — no DB, no I/O — so the public/private boundary is
 * unit-testable in isolation and consistent across every caller.
 *
 * Outcomes:
 *  - `"public"` — world-readable: the asset is `public` + `ready`. The servable
 *    Blob URL may be returned to anyone, including anonymous callers.
 *  - `"owner"`  — restricted: returned only to an authorised caller. The Blob
 *    URL is exposed to this caller alone (and only once `ready`).
 *  - `"denied"` — the caller may not learn anything about this asset. The
 *    controller maps this to **404** (never 403) so a private/soft-deleted asset
 *    is indistinguishable from a non-existent one (acceptance criteria §2).
 */
export type FileAccessDecision = "public" | "owner" | "denied";

/** Minimal viewer identity — the authenticated user id, or `undefined` (anon). */
export interface FileViewer {
  id: string;
}

/**
 * Target-resource kinds whose `targetId` is the owning user's id. For these,
 * owning the domain resource (your own profile) also authorises the attached
 * file — this is the "domain resource permission" half of acceptance criteria
 * §3. Other target kinds (hospital, post, …) have no in-feature owner resolver,
 * so access falls back to file ownership only.
 */
const SELF_OWNED_TARGET_TYPES: ReadonlySet<string> = new Set(["profile", "user"]);

/** Whether the viewer owns the domain resource this file is attached to. */
function ownsTargetResource(row: FileAsset, viewerId: string): boolean {
  return (
    !!row.targetType &&
    SELF_OWNED_TARGET_TYPES.has(row.targetType) &&
    !!row.targetId &&
    row.targetId === viewerId
  );
}

/**
 * Decide whether `viewer` may read `row`, and on which contract.
 *
 * Acceptance criteria §3 — the file permission and the target domain resource
 * permission are evaluated together: a private asset is released when the
 * viewer owns the file **or** owns the resource it is attached to; otherwise it
 * is denied. Soft-deleted assets are never exposed on this surface (the admin
 * detail endpoint is the only place they remain visible).
 */
export function resolveFileDetailAccess(
  row: FileAsset,
  viewer: FileViewer | undefined,
): FileAccessDecision {
  // Soft-deleted assets are invisible to owners and the public alike.
  if (row.status === "deleted") return "denied";

  // Public, fully-uploaded assets are world-readable.
  if (row.visibility === "public" && row.status === "ready") return "public";

  // Anything else requires an authenticated, authorised caller.
  if (!viewer) return "denied";

  // File-level ownership.
  if (row.ownerUserId && row.ownerUserId === viewer.id) return "owner";

  // Domain-resource ownership (§3): e.g. the owner of a profile may read files
  // attached to that profile even when a different account uploaded them.
  if (ownsTargetResource(row, viewer.id)) return "owner";

  return "denied";
}

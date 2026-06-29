/**
 * Service-domain editorial status logic — pure functions.
 *
 * The catalog publish lifecycle (`service_publish_status`) is `draft` →
 * `published` → `archived`, freely reversible by an editor. Only `published`
 * rows are publicly visible (PB-DATA-001 acceptance criteria), so the status
 * transition is the gate that controls public exposure.
 *
 * Keeping this as a side-effect-free module lets the rules be unit-tested
 * directly, without a database or HTTP layer.
 */

export const SERVICE_PUBLISH_STATUSES = ["draft", "published", "archived"] as const;

export type ServicePublishStatus = (typeof SERVICE_PUBLISH_STATUSES)[number];

export function isServicePublishStatus(value: unknown): value is ServicePublishStatus {
  return (
    typeof value === "string" &&
    (SERVICE_PUBLISH_STATUSES as readonly string[]).includes(value)
  );
}

/** Patch produced by a status change — never mutates the input row. */
export interface StatusChangePatch {
  status: ServicePublishStatus;
  /** Set the first time a record becomes published; cleared on unpublish. */
  publishedAt: Date | null;
}

/**
 * Resolve the column patch for moving a record to `next`.
 *
 * - First publish stamps `publishedAt`; re-publishing preserves the existing
 *   stamp so the original publish time survives an unpublish→republish.
 * - Moving away from `published` clears `publishedAt`.
 *
 * @param next        requested status
 * @param now         caller-supplied timestamp (injected for testability)
 * @param publishedAt existing publishedAt value, if any
 */
export function resolveStatusChange(
  next: ServicePublishStatus,
  now: Date,
  publishedAt: Date | null,
): StatusChangePatch {
  if (next === "published") {
    return { status: next, publishedAt: publishedAt ?? now };
  }
  // draft / archived are never publicly visible → drop the publish stamp.
  return { status: next, publishedAt: null };
}

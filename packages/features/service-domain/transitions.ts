/**
 * Service-domain publish-status transition policy — pure functions.
 *
 * The publish lifecycle (`service_publish_status`) has three states:
 * `draft` → `published` → `archived`. {@link ./status.ts | status.ts} computes
 * the column patch for a move; this module decides whether a move is *allowed*
 * at all (PB-ADMIN-DOMAIN-UPDATE-001 / BBR-681 AC#1: 상태 변경은 허용된 전이만
 * 가능하다).
 *
 * Allowed transitions:
 *   draft     → published (발행/검수 승인), archived (검토 없이 보관)
 *   published → draft (비공개 전환/검수 반려),  archived (보관)
 *   archived  → draft (보관 해제 — 안전한 비공개 초안으로 복귀)
 *
 * archived → published is intentionally NOT allowed: a restored record returns
 * to a private draft first and must be deliberately re-published, so an
 * archived row can never jump straight back onto the public surface. A no-op
 * transition (from === to) is treated as allowed and the caller short-circuits
 * it without a write or audit entry.
 *
 * Side-effect-free so the rules can be unit-tested without a DB or HTTP layer.
 */

import { UnprocessableEntityException } from "@nestjs/common";
import { SERVICE_PUBLISH_STATUSES, type ServicePublishStatus } from "./status";

/** Allowed *next* states for each current state (excludes the no-op self move). */
export const SERVICE_STATUS_TRANSITIONS: Record<
  ServicePublishStatus,
  readonly ServicePublishStatus[]
> = {
  draft: ["published", "archived"],
  published: ["draft", "archived"],
  archived: ["draft"],
} as const;

/** Korean labels for transition-error messages (operator-facing). */
const STATUS_LABEL: Record<ServicePublishStatus, string> = {
  draft: "초안",
  published: "공개",
  archived: "보관",
};

/**
 * Can a record move from `from` to `to`?
 *
 * A no-op (from === to) is allowed — the caller decides whether to skip the
 * write. Any other move must appear in {@link SERVICE_STATUS_TRANSITIONS}.
 */
export function canChangeStatus(from: ServicePublishStatus, to: ServicePublishStatus): boolean {
  if (from === to) {
    return true;
  }
  return SERVICE_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Assert that moving from `from` to `to` is permitted, or throw a 422 with an
 * operator-facing Korean message. Used at the service boundary so a disallowed
 * status change never reaches the database.
 */
export function assertStatusTransition(from: ServicePublishStatus, to: ServicePublishStatus): void {
  if (!isServicePublishStatus(to)) {
    throw new UnprocessableEntityException("알 수 없는 상태입니다.");
  }
  if (!canChangeStatus(from, to)) {
    throw new UnprocessableEntityException(
      `'${STATUS_LABEL[from]}' 상태에서 '${STATUS_LABEL[to]}' 상태로 변경할 수 없습니다.`,
    );
  }
}

function isServicePublishStatus(value: unknown): value is ServicePublishStatus {
  return (
    typeof value === "string" && (SERVICE_PUBLISH_STATUSES as readonly string[]).includes(value)
  );
}

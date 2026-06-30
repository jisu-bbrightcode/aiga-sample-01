import type { KcbUserVerificationStatus } from "./contracts";

// Pure derivation of the user-facing verification status from the internal request
// lifecycle + whether the user holds a verified identity (PB-IDV-KCB-API-STATUS-001).
//
// This is the AC4 boundary: admins/operators read the raw internal status, provider
// result codes, and failure codes (admin controller); end users see only one of the
// five coarse states below + a friendly Korean message — never a technical code.

// Just the request fields the derivation needs (keeps the mapper DB-agnostic/testable).
export interface UserStatusRequestView {
  status: string;
  expiresAt: Date;
}

/**
 * Resolve the coarse user status. Precedence:
 *   1. A verified identity on record always wins → `verified` (완료).
 *   2. No request at all → `required` (필요).
 *   3. Terminal request outcomes map directly: failed/canceled → `failed` (실패),
 *      expired → `expired` (만료), verified → `verified` (완료).
 *   4. In-flight (created/redirected/pending) is `in_progress` (진행중) unless the
 *      session window has already elapsed, in which case it reads as `expired`.
 */
export function resolveUserVerificationStatus(
  request: UserStatusRequestView | null,
  hasVerifiedIdentity: boolean,
  now: Date = new Date(),
): KcbUserVerificationStatus {
  if (hasVerifiedIdentity) return "verified";
  if (!request) return "required";
  if (request.status === "verified") return "verified";
  if (request.status === "failed" || request.status === "canceled") return "failed";
  if (request.status === "expired") return "expired";
  // created / redirected / pending — still in flight unless the window has passed.
  if (request.expiresAt.getTime() < now.getTime()) return "expired";
  return "in_progress";
}

const USER_STATUS_MESSAGES: Record<KcbUserVerificationStatus, string> = {
  required: "본인확인이 필요합니다. 본인확인을 진행해 주세요.",
  in_progress: "본인확인이 진행 중입니다. 인증 창에서 본인확인을 완료해 주세요.",
  verified: "본인확인이 완료되었습니다.",
  failed: "본인확인에 실패했습니다. 다시 시도해 주세요.",
  expired: "본인확인 시간이 만료되었습니다. 다시 시도해 주세요.",
};

/** Friendly, non-technical message shown to the end user for a given status. */
export function userVerificationStatusMessage(status: KcbUserVerificationStatus): string {
  return USER_STATUS_MESSAGES[status];
}

// Retry is offered only from a terminal, unsuccessful state. `required` starts a fresh
// session (not a retry — there is no prior context to reuse); `in_progress`/`verified`
// have nothing to retry.
const RETRYABLE_STATUSES: ReadonlySet<KcbUserVerificationStatus> = new Set<KcbUserVerificationStatus>(
  ["failed", "expired"],
);

export function canRetryFromStatus(status: KcbUserVerificationStatus): boolean {
  return RETRYABLE_STATUSES.has(status);
}

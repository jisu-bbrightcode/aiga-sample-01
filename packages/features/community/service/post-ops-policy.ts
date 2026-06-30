/**
 * 게시글 운영 액션(pin/lock/remove/crosspost) 순수 정책 헬퍼.
 * (PB-COMM-POST-OPS-API-001 / BBR-603)
 *
 * 감사 로그(community_mod_logs)에 남길 "조치 전후 상태"(AC#2) 포맷과 토글 상태
 * 계산을 DB-free 순수 함수로 분리한다. 서비스 레이어는 이 함수들로 audit detail
 * 을 일관되게 만들고, 단위 테스트는 DB 없이 검증한다.
 */

/** 게시글 운영 상태의 감사 스냅샷 (모더레이션 관점 필드만). */
export interface PostModerationSnapshot {
  status: string;
  isPinned: boolean;
  isLocked: boolean;
}

/** 게시글 row 에서 모더레이션 관점 필드만 추려 스냅샷을 만든다. */
export function snapshotPostModeration(post: {
  status: string;
  isPinned: boolean;
  isLocked: boolean;
}): PostModerationSnapshot {
  return { status: post.status, isPinned: post.isPinned, isLocked: post.isLocked };
}

/**
 * 토글 액션의 다음 상태를 계산한다.
 * 명시적 `desired` 가 오면 그대로 적용(멱등), 생략 시 현재 값을 뒤집는다.
 */
export function resolveToggleState(current: boolean, desired?: boolean): boolean {
  return desired ?? !current;
}

/** community_mod_logs.details 의 `kind` 로 쓰이는 운영 액션 종류. */
export type PostOpKind = "pin" | "unpin" | "lock" | "unlock" | "crosspost";

/**
 * community_mod_logs.details 에 기록할 전후 상태 페이로드를 만든다(AC#2).
 * `extra` 는 crosspost 의 source/target 처럼 액션별 메타데이터를 담는다.
 */
export function buildPostOpAuditDetails(
  kind: PostOpKind,
  before: PostModerationSnapshot,
  after: PostModerationSnapshot,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return { kind, before, after, ...(extra ?? {}) };
}

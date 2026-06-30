/**
 * 커뮤니티 댓글 삭제/숨김/복구 상태 정책 (DB-free 순수 로직).
 * PB-COMM-COMMENT-API-DELETE-001 / BBR-602.
 *
 * 게시글(`post-deletion-policy.ts`)과 동일한 경계를, 댓글의 boolean 플래그
 * 모델 위에서 재현한다. 댓글은 단일 status enum 대신 세 개의 플래그로 상태를
 * 표현하므로, "작성자 삭제"와 "관리자/모더레이터 숨김·제거"를 우선순위에 따라
 * 하나의 파생 상태값으로 환원해 AC#2("관리자 숨김과 작성자 삭제가 상태값으로
 * 구분된다")의 경계를 한 곳에서 고정한다:
 *
 * - `deleted` : 작성자 본인이 삭제 (DELETE /community/comments/:id). 작성자 의사이므로
 *               모더레이션 복구 대상이 아니다.
 * - `removed` : 모더레이터가 운영 정책 위반으로 제거 (복구 가능).
 * - `hidden`  : 키워드/자동 필터에 의한 숨김 (복구 가능 = 노출 해제).
 * - `visible` : 공개 상태 (복구 목표 상태).
 *
 * 어느 경우에도 행을 물리 삭제하지 않으므로 대댓글/신고/감사 로그는 항상 보존된다(AC#1).
 */

/** 댓글의 모더레이션 상태 판정에 필요한 최소 플래그 집합. */
export interface CommentModerationFlags {
  isDeleted: boolean;
  isRemoved: boolean;
  isHidden: boolean;
}

/** 작성자 삭제 / 모더레이션 제거 / 필터 숨김 / 공개 를 구분하는 단일 파생 상태. */
export type CommentModerationStatus = "deleted" | "removed" | "hidden" | "visible";

/** 모더레이션에 의해 가려진(복구 가능한) 파생 상태. 작성자 삭제(`deleted`)는 제외. */
export const MODERATION_HIDDEN_COMMENT_STATUSES = ["removed", "hidden"] as const;

/**
 * 플래그 조합을 단일 상태로 환원한다.
 * 우선순위: 작성자 삭제 > 운영자 제거 > 필터 숨김 > 공개.
 * (read 마스킹 `resolveCommentContent` 의 우선순위와 동일하게 유지한다.)
 */
export function deriveCommentModerationStatus(
  flags: CommentModerationFlags,
): CommentModerationStatus {
  if (flags.isDeleted) return "deleted";
  if (flags.isRemoved) return "removed";
  if (flags.isHidden) return "hidden";
  return "visible";
}

/**
 * 복구 가능 여부. 모더레이션 제거(`removed`)/필터 숨김(`hidden`)만 복구할 수 있고,
 * 작성자 삭제(`deleted`)는 작성자 의사이므로, 이미 공개(`visible`)는 복구 대상이
 * 없으므로 복구하지 않는다.
 */
export function canRestoreComment(flags: CommentModerationFlags): boolean {
  const status = deriveCommentModerationStatus(flags);
  return (MODERATION_HIDDEN_COMMENT_STATUSES as readonly string[]).includes(status);
}

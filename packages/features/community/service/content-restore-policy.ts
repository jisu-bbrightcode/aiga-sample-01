import type { CommunityComment } from "@repo/drizzle/schema";

/**
 * 관리자 콘텐츠 복구 정책 (DB-free 순수 로직).
 *
 * 게시글 복구는 상태 기반이라 `post-deletion-policy.ts`의 `canRestore` 로 판정하지만,
 * 댓글 복구는 "원문 보존 여부" 라는 추가 제약이 있다. 모더레이터 제거(`remove()`)와
 * 작성자 삭제(`delete()`)는 원본 본문을 sentinel 문자열로 **덮어쓰기** 때문에,
 * 제거된 댓글은 원문이 파괴되어 안전하게 되살릴 수 없다. 이 모듈은 그 경계를
 * 순수 함수로 분리해 서비스/컨트롤러가 동일한 판정을 공유하도록 한다.
 */

/** 모더레이터 제거(`remove()`)가 원문을 덮어쓰는 sentinel 본문. */
export const REMOVED_COMMENT_SENTINEL = "[removed]";

/** 작성자 삭제(`delete()`)가 원문을 덮어쓰는 sentinel 본문. */
export const DELETED_COMMENT_SENTINEL = "[삭제됨]";

/** 복구 판정에 필요한 댓글 상태 필드(스냅샷). */
export type CommentRestoreState = Pick<
  CommunityComment,
  "content" | "isRemoved" | "isDeleted" | "isHidden"
>;

/** 댓글 복구 거부 사유. */
export type CommentRestoreRejection = "not_moderated" | "author_deleted" | "content_destroyed";

export type CommentRestoreDecision =
  | { restorable: true }
  | { restorable: false; reason: CommentRestoreRejection };

/**
 * 원문이 파괴되었는지 여부.
 *
 * 제거/삭제 경로가 원본 본문을 sentinel 로 덮어쓰므로 복구해도 되살릴 원문이 없다.
 * null/공백 본문도 파괴된 것으로 간주해 fail-closed 로 판정한다.
 */
export function isCommentContentDestroyed(content: string | null): boolean {
  if (content === null) {
    return true;
  }
  const trimmed = content.trim();
  return (
    trimmed.length === 0 ||
    trimmed === REMOVED_COMMENT_SENTINEL ||
    trimmed === DELETED_COMMENT_SENTINEL
  );
}

/**
 * 댓글 모더레이션 복구 가능 여부(DB-free).
 *
 * - `isDeleted`             → author_deleted   : 작성자 의사이므로 모더레이션 복구 대상 아님.
 * - 숨김/제거 둘 다 아님      → not_moderated    : 되돌릴 모더레이션 상태가 없음.
 * - 제거됐고 원문 파괴됨      → content_destroyed: 원문이 없어 안전하게 복구 불가.
 * - 숨김이거나, 제거됐지만 원문 보존 → 복구 가능.
 */
export function decideCommentRestore(comment: CommentRestoreState): CommentRestoreDecision {
  if (comment.isDeleted) {
    return { restorable: false, reason: "author_deleted" };
  }
  if (!comment.isRemoved && !comment.isHidden) {
    return { restorable: false, reason: "not_moderated" };
  }
  if (comment.isRemoved && isCommentContentDestroyed(comment.content)) {
    return { restorable: false, reason: "content_destroyed" };
  }
  return { restorable: true };
}

/** 거부 사유별 사용자-대면 메시지(비기술적, 관리자 UI 표기용). */
export const COMMENT_RESTORE_REJECTION_MESSAGE: Record<CommentRestoreRejection, string> = {
  not_moderated: "숨김 또는 제거된 콘텐츠만 복구할 수 있습니다.",
  author_deleted: "작성자가 삭제한 댓글은 복구할 수 없습니다.",
  content_destroyed: "원문이 보존되어 있지 않아 복구할 수 없습니다.",
};

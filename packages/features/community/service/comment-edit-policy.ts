import type { CommunityComment } from "@repo/drizzle/schema";

/**
 * 커뮤니티 댓글 수정 권한 정책 (DB-free 순수 로직). (BBR-601)
 *
 * AC#1 — 작성자 수정과 관리자(모더레이터) 수정 권한을 분리한다:
 * - `author`    : 작성자 본인이 자신의 댓글을 수정.
 * - `moderator` : 커뮤니티 owner/admin/moderator 가 운영 목적으로 댓글을 수정.
 *                 모더레이터 수정은 감사 로그(community_mod_logs)에 별도로 기록된다.
 *
 * 작성자 본인이면 모더레이터 여부와 무관하게 `author` 로 판정한다(작성자 우선).
 * 둘 다 아니면 수정 권한이 없다(null → 403).
 */
export type CommentEditRole = "author" | "moderator";

export interface CommentEditAccessInput {
  /** 댓글 작성자 id. */
  authorId: string;
  /** 수정 요청자 id. */
  requesterId: string;
  /** 요청자가 해당 커뮤니티의 모더레이터(owner/admin/moderator)인지 여부. */
  isModerator: boolean;
}

/**
 * 수정 권한 판정. 작성자 우선, 그다음 모더레이터.
 * 권한이 없으면 `null` 을 반환한다(호출부에서 403 매핑).
 */
export function resolveCommentEditAccess(input: CommentEditAccessInput): CommentEditRole | null {
  if (input.requesterId === input.authorId) {
    return "author";
  }
  if (input.isModerator) {
    return "moderator";
  }
  return null;
}

/**
 * 수정 가능한 상태인지 여부. 삭제/제거된 댓글은 내용이 마스킹(tombstone)되어 있으므로
 * 원문을 덮어쓰는 수정을 허용하지 않는다(409 Conflict 로 매핑).
 */
export function canEditComment(
  comment: Pick<CommunityComment, "isDeleted" | "isRemoved">,
): boolean {
  return !comment.isDeleted && !comment.isRemoved;
}

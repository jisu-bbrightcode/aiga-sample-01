/**
 * 커뮤니티 리액션 노출 정책 — 순수 로직 (PB-COMM-REACTION-API-LIST-001 / BBR-611).
 *
 * AC#2("숨김/삭제된 대상에는 리액션 상태가 노출되지 않는다")의 경계를 한 곳에
 * 고정한다. 게시글/댓글 리액션 count·내 상태·지원 타입은 **공개적으로 보이는
 * 대상에만** 노출한다. 게시글 상세/댓글 목록의 노출 정책과 동일한 기준을 쓴다:
 *
 * - 게시글: `status === "published"` 일 때만 reactable. 임시저장(draft)·자동필터
 *   숨김(hidden)·운영자 제거(removed)·작성자 삭제(deleted)는 비노출.
 * - 댓글: 부모 게시글이 published 이고, 댓글 자신이 삭제(isDeleted)·운영자
 *   제거(isRemoved)·키워드 숨김(isHidden) 중 어느 것도 아닐 때만 reactable.
 *
 * 정책 위반 대상은 컨트롤러/서비스가 404 로 응답해 "리액션 표면이 존재하지
 * 않는 것"처럼 다룬다(fail-closed). 순수 함수이므로 DB 없이 단위 테스트한다.
 */
import type { CommunityPost } from "@repo/drizzle/schema";

type PostStatus = CommunityPost["status"];

/**
 * 리액션 polymorphic 대상 타입. reaction_reactions.target_type 에 기록되는 값으로,
 * 다른 feature(board_post/blog_post/product 등)와 충돌하지 않도록 네임스페이스를
 * 붙인다.
 */
export const COMMUNITY_POST_REACTION_TARGET = "community_post";
export const COMMUNITY_COMMENT_REACTION_TARGET = "community_comment";

/** 게시글이 published(공개) 라서 리액션을 노출해도 되는지 여부. */
export function isPostReactable(status: PostStatus): boolean {
  return status === "published";
}

/** 댓글 리액션 노출 판정에 필요한 최소 상태(부모 게시글 상태 포함). */
export interface CommentReactionVisibility {
  postStatus: PostStatus;
  isDeleted: boolean;
  isRemoved: boolean;
  isHidden: boolean;
}

/**
 * 댓글이 리액션을 노출해도 되는지 여부.
 * 부모 게시글이 비공개거나 댓글 자신이 삭제/제거/숨김이면 비노출(fail-closed).
 */
export function isCommentReactable(visibility: CommentReactionVisibility): boolean {
  return (
    isPostReactable(visibility.postStatus) &&
    !visibility.isDeleted &&
    !visibility.isRemoved &&
    !visibility.isHidden
  );
}

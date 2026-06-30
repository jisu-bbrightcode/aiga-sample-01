import { ForbiddenException, NotFoundException } from "@nestjs/common";

/** 댓글 작성 정책 판정에 필요한 게시글 최소 상태. */
export interface CommentablePost {
  /** community_post_status enum 값 (draft/published/hidden/removed/deleted). */
  status: string;
  /** 모더레이터가 추가 댓글을 막은 잠금 상태. */
  isLocked: boolean;
}

/**
 * 게시글이 댓글 작성을 허용하는 상태인지 검증한다(작성 정책 게이트).
 *
 * 정책:
 * - `published` + 잠금 해제 상태에서만 댓글을 작성할 수 있다.
 * - `deleted`/`removed` 게시글은 이미 노출 대상이 아니므로 존재를 숨기고 404로 처리한다
 *   (삭제된 콘텐츠의 존재 누출 방지).
 * - `hidden`/`draft` 등 미공개 게시글은 존재하지만 공개되지 않았으므로 403으로 차단한다.
 * - 잠긴(`isLocked`) 게시글은 403으로 차단한다.
 *
 * 순수 함수: DB 접근 없이 입력만으로 판정하므로 단위 테스트가 용이하다.
 *
 * @throws NotFoundException 삭제/제거된 게시글
 * @throws ForbiddenException 숨김/미공개/잠긴 게시글
 */
export function assertCommentablePost(post: CommentablePost): void {
  // 삭제/제거된 게시글: 노출되지 않는 리소스이므로 존재 자체를 숨긴다.
  if (post.status === "deleted" || post.status === "removed") {
    throw new NotFoundException("게시글을 찾을 수 없습니다.");
  }

  // 숨김 처리된 게시글: 공개되지 않아 댓글 작성 불가.
  if (post.status === "hidden") {
    throw new ForbiddenException("숨겨진 게시글에는 댓글을 작성할 수 없습니다.");
  }

  // 그 외 비공개(초안 등) 게시글: 아직 게시되지 않아 댓글 작성 불가.
  if (post.status !== "published") {
    throw new ForbiddenException("공개되지 않은 게시글에는 댓글을 작성할 수 없습니다.");
  }

  // 잠긴 게시글: 모더레이터가 추가 댓글을 차단.
  if (post.isLocked) {
    throw new ForbiddenException("잠긴 게시글에는 댓글을 작성할 수 없습니다.");
  }
}

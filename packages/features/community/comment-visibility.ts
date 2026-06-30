/**
 * 커뮤니티 댓글 목록 노출 정책 — 순수 projection 함수
 * (PB-COMM-COMMENT-API-LIST-001 / BBR-599).
 *
 * AC#1("차단/숨김/신고 상태가 댓글 노출에도 반영된다")의 노출 경계를 한 곳에서
 * 고정한다. `mappers.ts`(게시글 목록)와 동일하게, row 에서 `delete` 하지 않고
 * **필드를 하나씩 새 객체로 복사**한다 — 그래야 나중에 추가되는 컬럼이 기본적으로
 * 공개 projection 에서 제외된다(fail-closed).
 *
 * 노출 정책(tombstone 유지: 행은 남기고 본문만 가린다 → 스레드/대댓글 구조와
 * 댓글 수 일관성 유지, AC#2):
 * - 삭제됨(isDeleted)        → 본문 마스킹, 모더레이션 내부필드 비노출
 * - 운영자 제거(isRemoved)   → 본문 마스킹, removalReason/removedBy 비노출
 * - 키워드 숨김(isHidden)    → 작성자 본인에게는 원문, 그 외에는 본문 마스킹
 * - 차단(blocked author)     → 서비스 레이어 쿼리에서 제외(여기서는 다루지 않음)
 *
 * removalReason/removedBy 는 모더레이션 내부필드이므로 공개 projection 에서 항상
 * 제외한다(`toAdminPostListItem` 과 동일한 경계).
 */

/** findByPost 가 author 조인으로 덧붙인 enrich 필드까지 포함한 댓글 row. */
export interface EnrichedCommentRow {
  id: string;
  postId: string;
  authorId: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  parentId: string | null;
  content: string;
  depth: number;
  isDeleted: boolean;
  isRemoved: boolean;
  removalReason: string | null;
  removedBy: string | null;
  isEdited: boolean;
  editedAt: Date | string | null;
  upvoteCount: number;
  downvoteCount: number;
  voteScore: number;
  replyCount: number;
  isStickied: boolean;
  distinguished: "moderator" | "admin" | null;
  isHidden: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** 조회자 컨텍스트. 비로그인은 `userId: null`. */
export interface CommentViewer {
  userId: string | null;
}

/** 공개/로그인 목록에 노출되는 댓글 필드 (모더레이션 내부필드 제외). */
export interface PublicCommentItem {
  id: string;
  postId: string;
  authorId: string;
  authorName: string | null;
  authorAvatar: string | null;
  parentId: string | null;
  content: string;
  depth: number;
  isDeleted: boolean;
  isRemoved: boolean;
  isHidden: boolean;
  isEdited: boolean;
  editedAt: string | null;
  upvoteCount: number;
  downvoteCount: number;
  voteScore: number;
  replyCount: number;
  isStickied: boolean;
  distinguished: "moderator" | "admin" | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const DELETED_COMMENT_PLACEHOLDER = "[삭제된 댓글입니다]";
export const REMOVED_COMMENT_PLACEHOLDER = "[운영자에 의해 삭제된 댓글입니다]";
export const HIDDEN_COMMENT_PLACEHOLDER = "[필터에 의해 숨겨진 댓글입니다]";

const iso = (value: Date | string | null | undefined): string | null => {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
};

/**
 * 노출 정책에 따라 본문을 결정한다. 행은 항상 유지하고 본문만 마스킹한다.
 * 우선순위: 삭제 > 운영자 제거 > 키워드 숨김(비작성자) > 원문.
 * 본문 마스킹은 저장 시점이 아니라 read 시점에 다시 적용해 fail-closed 를 보장한다.
 */
function resolveCommentContent(row: EnrichedCommentRow, viewer: CommentViewer): string {
  if (row.isDeleted) return DELETED_COMMENT_PLACEHOLDER;
  if (row.isRemoved) return REMOVED_COMMENT_PLACEHOLDER;
  const isAuthor = viewer.userId != null && viewer.userId === row.authorId;
  if (row.isHidden && !isAuthor) return HIDDEN_COMMENT_PLACEHOLDER;
  return row.content;
}

/** 댓글 row → 조회자 기준 공개 projection. */
export function toPublicCommentItem(
  row: EnrichedCommentRow,
  viewer: CommentViewer,
): PublicCommentItem {
  return {
    id: row.id,
    postId: row.postId,
    authorId: row.authorId,
    authorName: row.authorName ?? null,
    authorAvatar: row.authorAvatar ?? null,
    parentId: row.parentId,
    content: resolveCommentContent(row, viewer),
    depth: row.depth,
    isDeleted: row.isDeleted,
    isRemoved: row.isRemoved,
    isHidden: row.isHidden,
    isEdited: row.isEdited,
    editedAt: iso(row.editedAt),
    upvoteCount: row.upvoteCount,
    downvoteCount: row.downvoteCount,
    voteScore: row.voteScore,
    replyCount: row.replyCount,
    isStickied: row.isStickied,
    distinguished: row.distinguished,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

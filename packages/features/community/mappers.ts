/**
 * 커뮤니티 게시글 목록 response mappers — 순수 projection 함수
 * (PB-COMM-POST-API-LIST-001 / BBR-594).
 *
 * AC#2("공개/로그인/관리자 조회 필드가 분리되어 있다")의 필드 경계를 한 곳에서
 * 고정한다. service-search FR-003 mappers 와 동일하게, row 에서 `delete` 하지 않고
 * **필드를 하나씩 새 객체로 복사**한다 — 그래야 나중에 추가되는 컬럼이 기본적으로
 * 공개 projection 에서 제외된다(fail-closed).
 *
 * - public/login: 표시용 공개 필드만. 모더레이션 내부필드(removalReason, removedBy)
 *   는 노출하지 않는다. 공개와 로그인은 필드 shape 가 같고, 차이는 viewer state 와
 *   차단/숨김 반영 여부(서비스 레이어)로 구분된다.
 * - admin: 공개 필드 + 모더레이션 내부필드(status 전이 사유/처리자).
 */
import type { CommunityPost, LinkPreview, PollData } from "@repo/drizzle/schema";

/** findAll/feed 가 author/community 조인으로 덧붙이는 enrich 필드까지 포함한 row. */
export type EnrichedCommunityPost = CommunityPost & {
  authorName?: string | null;
  authorAvatar?: string | null;
  communitySlug?: string | null;
};

const iso = (value: Date | string | null | undefined): string | null => {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
};

/** 공개/로그인 목록에 노출되는 게시글 필드 (모더레이션 내부필드 제외). */
export interface PublicPostListItem {
  id: string;
  communityId: string;
  communitySlug: string | null;
  authorId: string;
  authorName: string | null;
  authorAvatar: string | null;
  title: string;
  content: string | null;
  type: CommunityPost["type"];
  linkUrl: string | null;
  linkPreview: LinkPreview | null;
  mediaUrls: string[] | null;
  pollData: PollData | null;
  flairId: string | null;
  isNsfw: boolean;
  isSpoiler: boolean;
  isOc: boolean;
  contentRating: CommunityPost["contentRating"];
  status: CommunityPost["status"];
  isPinned: boolean;
  isLocked: boolean;
  viewCount: number;
  upvoteCount: number;
  downvoteCount: number;
  voteScore: number;
  commentCount: number;
  shareCount: number;
  crosspostParentId: string | null;
  hotScore: number;
  lastActivityAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export function toPublicPostListItem(row: EnrichedCommunityPost): PublicPostListItem {
  return {
    id: row.id,
    communityId: row.communityId,
    communitySlug: row.communitySlug ?? null,
    authorId: row.authorId,
    authorName: row.authorName ?? null,
    authorAvatar: row.authorAvatar ?? null,
    title: row.title,
    content: row.content,
    type: row.type,
    linkUrl: row.linkUrl,
    linkPreview: row.linkPreview ?? null,
    mediaUrls: row.mediaUrls ?? null,
    pollData: row.pollData ?? null,
    flairId: row.flairId,
    isNsfw: row.isNsfw,
    isSpoiler: row.isSpoiler,
    isOc: row.isOc,
    contentRating: row.contentRating,
    status: row.status,
    isPinned: row.isPinned,
    isLocked: row.isLocked,
    viewCount: row.viewCount,
    upvoteCount: row.upvoteCount,
    downvoteCount: row.downvoteCount,
    voteScore: row.voteScore,
    commentCount: row.commentCount,
    shareCount: row.shareCount,
    crosspostParentId: row.crosspostParentId,
    hotScore: row.hotScore,
    lastActivityAt: iso(row.lastActivityAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

/** 관리자 목록 view: 공개 필드 + 모더레이션 내부필드. */
export interface AdminPostListItem extends PublicPostListItem {
  removalReason: string | null;
  removedBy: string | null;
}

export function toAdminPostListItem(row: EnrichedCommunityPost): AdminPostListItem {
  return {
    ...toPublicPostListItem(row),
    removalReason: row.removalReason,
    removedBy: row.removedBy,
  };
}

// ---- viewer state ----------------------------------------------------------

/**
 * 요청자의 목록 조회 권한 상태. fail-closed: 공개 surface 는 `isAdmin` 을 절대
 * true 로 보고하지 않는다. 관리자 뷰는 admin-guarded 엔드포인트에만 존재한다.
 */
export interface PostListViewerState {
  authenticated: boolean;
  isAdmin: boolean;
}

/** 공개/로그인 목록 엔드포인트의 viewer state. */
export function publicPostViewerState(authenticated: boolean): PostListViewerState {
  return { authenticated, isAdmin: false };
}

/** admin-guarded 목록 엔드포인트의 viewer state. */
export const ADMIN_POST_VIEWER_STATE: PostListViewerState = {
  authenticated: true,
  isAdmin: true,
};

// ---- post detail (PB-COMM-POST-API-READ-001 / BBR-595) ---------------------

/**
 * 작성자 요약 — 상세에서 노출되는 공개 작성자 필드.
 * 목록 row 와 동일하게 author 조인 결과(name/avatar)만 노출한다.
 */
export interface PostAuthorSummary {
  id: string;
  name: string | null;
  avatar: string | null;
}

/** 댓글/리액션(투표) 요약 — 집계 카운터만 노출한다. */
export interface PostStatsSummary {
  viewCount: number;
  commentCount: number;
  upvoteCount: number;
  downvoteCount: number;
  voteScore: number;
  shareCount: number;
}

/**
 * 게시글 상세 viewer state — "사용자별 신고/숨김/차단 상태"(BBR-595 Scope).
 *
 * fail-closed: 비로그인 요청자는 모든 관계 플래그가 false 이고 canModerate=false.
 * - hasReported: 요청자가 이 글을 신고했는지 (community_reports)
 * - hasBlockedAuthor: 요청자가 작성자를 차단했는지 (단방향, community_user_blocks)
 * - canModerate: 요청자가 해당 커뮤니티 모더레이터/관리자/소유자인지
 * - myVote: 요청자의 리액션(up/down) 또는 null
 *
 * 참고: per-user "숨김" 테이블은 현재 base(main)에 없다(목록 API BBR-594 와
 * 동일하게 숨김은 게시글 status 레벨에서 일관 처리한다). 노출/접근 일관성은
 * resolvePostDetailAccess 가 status 기반으로 결정한다.
 */
export interface PostDetailViewerState {
  authenticated: boolean;
  isAuthor: boolean;
  hasReported: boolean;
  hasBlockedAuthor: boolean;
  canModerate: boolean;
  myVote: "up" | "down" | null;
}

/** 상세 응답 envelope — 게시글 + 작성자/통계 요약 + viewer state. */
export interface PublicPostDetail {
  post: PublicPostListItem;
  author: PostAuthorSummary;
  stats: PostStatsSummary;
  viewer: PostDetailViewerState;
}

export function toPostAuthorSummary(row: EnrichedCommunityPost): PostAuthorSummary {
  return {
    id: row.authorId,
    name: row.authorName ?? null,
    avatar: row.authorAvatar ?? null,
  };
}

export function toPostStatsSummary(row: EnrichedCommunityPost): PostStatsSummary {
  return {
    viewCount: row.viewCount,
    commentCount: row.commentCount,
    upvoteCount: row.upvoteCount,
    downvoteCount: row.downvoteCount,
    voteScore: row.voteScore,
    shareCount: row.shareCount,
  };
}

export function toPublicPostDetail(
  row: EnrichedCommunityPost,
  viewer: PostDetailViewerState,
): PublicPostDetail {
  return {
    post: toPublicPostListItem(row),
    author: toPostAuthorSummary(row),
    stats: toPostStatsSummary(row),
    viewer,
  };
}

/** 비로그인 요청자의 fail-closed 기본 viewer state. */
export function guestPostDetailViewerState(): PostDetailViewerState {
  return {
    authenticated: false,
    isAuthor: false,
    hasReported: false,
    hasBlockedAuthor: false,
    canModerate: false,
    myVote: null,
  };
}

/**
 * 상세 접근 결정 — "신고/숨김/차단/삭제 상태에 따라 상세 접근 결과가 일관된다"
 * (BBR-595 AC#1). 순수 함수로 분리해 DB 없이 검증한다.
 *
 * - 차단: 양방향 차단된 작성자의 글은 (작성자 본인이 아니면) 존재 자체를 숨긴다
 *   → 목록에서 제외되는 동작과 일관(notFound).
 * - published: 모두에게 전체 노출.
 * - deleted/removed: tombstone 으로 일관 노출(masked) — 본문은 service 가 가린다.
 * - hidden/draft: 자동필터/검토대기/미게시는 작성자·모더레이터에게만 노출,
 *   그 외에는 notFound(존재 비노출).
 */
export type PostDetailAccess = { visible: true; masked: boolean } | { visible: false };

export function resolvePostDetailAccess(args: {
  status: CommunityPost["status"];
  isAuthor: boolean;
  canModerate: boolean;
  authorBlocked: boolean;
}): PostDetailAccess {
  if (args.authorBlocked && !args.isAuthor) {
    return { visible: false };
  }

  switch (args.status) {
    case "published":
      return { visible: true, masked: false };
    case "deleted":
    case "removed":
      return { visible: true, masked: true };
    default:
      // hidden | draft — 작성자/모더레이터에게만 노출
      return args.isAuthor || args.canModerate
        ? { visible: true, masked: false }
        : { visible: false };
  }
}

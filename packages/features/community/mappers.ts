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
import type { CommunityPost, CommunityUserBlock, LinkPreview, PollData } from "@repo/drizzle/schema";

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

// ---- user block ------------------------------------------------------------

/** 차단 응답에 노출되는 필드 (BBR-615). 내부 timestamp 등은 제외. */
export interface BlockResponseItem {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string | null;
}

export function toBlockResponse(row: CommunityUserBlock): BlockResponseItem {
  return {
    id: row.id,
    blockerId: row.blockerId,
    blockedId: row.blockedId,
    createdAt: iso(row.createdAt),
  };
}

import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { type RateLimitConfig, RateLimitService } from "@repo/core/rate-limit";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  type CommunityPost,
  communities,
  communityPosts,
  communityReports,
  communityUserBlocks,
  communityVotes,
  user as userTable,
} from "@repo/drizzle/schema";
import { and, count, desc, eq, ilike, inArray, notInArray, or, type SQL, sql } from "drizzle-orm";
import type { CreatePostDto, UpdatePostDto } from "../dto";
import { decodeCursor } from "../helpers/pagination";
import { assertCommunityPermission } from "../helpers/permission";
import {
  type PostDetailViewerState,
  type PublicPostDetail,
  resolvePostDetailAccess,
  toPublicPostDetail,
} from "../mappers";
import { CommunityService } from "./community.service";
import { CommunityContentModerationService } from "./community-content-moderation.service";
import { CommunityKeywordFilterService } from "./community-keyword-filter.service";
import { CommunityTierService, TIER_PRIVILEGES } from "./community-tier.service";
import { DEFAULT_POST_SORT, normalizePostListLimit, type PostSort } from "./post-list-options";
import { normalizePostSearchTerm } from "./post-search";

type PostStatus = CommunityPost["status"];

const DEFAULT_ADMIN_POST_LIST_PAGE = 1;
const DEFAULT_ADMIN_POST_LIST_LIMIT = 20;
const MAX_ADMIN_POST_LIST_LIMIT = 100;

type PostCursorPayload =
  | { sort: "new"; createdAt: string; id: string }
  | { sort: "hot"; hotScore: number; lastActivityAt: string; id: string }
  | { sort: "top"; voteScore: number; createdAt: string; id: string }
  | { sort: "rising"; lastActivityAt: string; commentCount: number; id: string }
  | { sort: "controversial"; controversialScore: number; commentCount: number; id: string };

interface CommunityPostSelectQuery {
  where(condition: SQL | undefined): CommunityPostSelectQuery;
  orderBy(...columns: SQL[]): CommunityPostSelectQuery;
  limit(limit: number): Promise<unknown[]>;
}

export interface PostListOptions {
  communitySlug?: string;
  communityId?: string;
  sort?: PostSort;
  cursor?: string;
  limit?: number;
  blockedUserIds?: string[];
  /** title/content 부분일치 검색어 (정규화 후 ILIKE). */
  search?: string;
}

export interface AdminPostListOptions {
  communityId?: string;
  communitySlug?: string;
  /** 지정 시 해당 상태만, 생략 시 모든 상태(미게시/숨김/삭제 포함)를 반환. */
  status?: PostStatus;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * 게시글 작성 anti-spam 레이트 리밋.
 * 인증된 작성자(userId) 기준으로 윈도우당 작성 횟수를 제한한다.
 * `RATE_LIMIT_ENABLED=false`면 RateLimitService가 우회한다(개발/테스트).
 */
export const POST_CREATE_RATE_LIMIT: RateLimitConfig = {
  action: "community:post:create",
  maxRequests: 5,
  windowSeconds: 300,
};

@Injectable()
export class CommunityPostService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly communityService: CommunityService,
    private readonly keywordFilterService: CommunityKeywordFilterService,
    private readonly tierService: CommunityTierService,
    private readonly contentModerationService: CommunityContentModerationService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async create(dto: CreatePostDto, userId: string): Promise<CommunityPost> {
    const community = await this.communityService.findById(dto.communityId);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    const isMember = await this.communityService.isMember(dto.communityId, userId);
    if (!isMember) {
      throw new ForbiddenException("커뮤니티에 가입해야 게시글을 작성할 수 있습니다.");
    }

    // anti-spam: 작성자(userId) 단위 레이트 리밋. 초과 시 HTTP 429.
    // 정책 필터/Moderation API 호출 전에 검사해 남용을 조기 차단한다.
    await this.rateLimitService.assertRateLimit(userId, POST_CREATE_RATE_LIMIT);

    // 등급 기반 키워드 필터 우회 확인
    const tierInfo = await this.tierService.getTierInfo(dto.communityId, userId);
    const bypassFilter =
      TIER_PRIVILEGES[tierInfo.tier as keyof typeof TIER_PRIVILEGES]?.bypassKeywordFilter ?? false;

    // 키워드 필터 검사
    const filterResult = await this.keywordFilterService.validateContent(
      dto.communityId,
      [dto.title, dto.content].filter(Boolean) as string[],
      { bypassFilter },
    );

    let status: "published" | "hidden" = "published";
    let removalReason: string | undefined;

    if (!filterResult.passed) {
      if (filterResult.action === "block") {
        throw new ForbiddenException(
          `금지어가 포함되어 있습니다: ${filterResult.matchedWords.join(", ")}`,
        );
      }
      // review: 검토 대기 상태로 생성
      status = "hidden";
      removalReason = `자동 필터: ${filterResult.matchedWords.join(", ")}`;
    }

    // Layer 2: OpenAI Moderation API (keyword filter 통과 후 최종 게이트키퍼)
    await this.contentModerationService.assertContentAllowed(
      [dto.title, dto.content].filter(Boolean) as string[],
    );

    const [post] = await this.db
      .insert(communityPosts)
      .values({
        ...dto,
        authorId: userId,
        status,
        removalReason,
        hotScore: this.calculateHotScore(0, new Date()),
      })
      .returning();

    await this.db
      .update(communities)
      .set({
        postCount: sql`${communities.postCount} + 1`,
      })
      .where(eq(communities.id, dto.communityId));

    return post as CommunityPost;
  }

  async findAll(options: PostListOptions = {}) {
    const limit = normalizePostListLimit(options.limit);
    const sort = options.sort ?? DEFAULT_POST_SORT;

    const conditions: SQL[] = [eq(communityPosts.status, "published")];

    // 차단된 유저의 게시물 제외
    if (options.blockedUserIds && options.blockedUserIds.length > 0) {
      conditions.push(notInArray(communityPosts.authorId, options.blockedUserIds));
    }

    // title/content 부분일치 검색
    const searchPattern = normalizePostSearchTerm(options.search);
    if (searchPattern) {
      conditions.push(
        or(
          ilike(communityPosts.title, searchPattern),
          ilike(communityPosts.content, searchPattern),
        ) as SQL,
      );
    }

    if (options.communityId) {
      conditions.push(eq(communityPosts.communityId, options.communityId));
    } else if (options.communitySlug) {
      const community = await this.communityService.findBySlug(options.communitySlug);
      if (!community) return this.emptyPostList();
      conditions.push(eq(communityPosts.communityId, community.id));
    }

    const cursorCondition = this.buildCursorCondition(options.cursor, sort);
    if (cursorCondition) {
      conditions.push(cursorCondition);
    }

    let query = this.db.select().from(communityPosts) as unknown as CommunityPostSelectQuery;
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = this.applySort(query, sort);

    const items = (await query.limit(limit + 1)) as CommunityPost[];

    const enrichedItems = await this.enrichAuthors(items);

    return this.buildSortedCursorResult(enrichedItems, limit, sort);
  }

  /**
   * 관리자 게시글 목록 (PB-COMM-POST-API-LIST-001 / BBR-594).
   *
   * 공개 findAll 과 달리 status='published' 로 제한하지 않으므로 미게시/숨김/제거/
   * 삭제 게시글까지 모두 조회된다. 차단 필터를 적용하지 않고 offset 페이지네이션과
   * 총건수(total)를 반환한다. 응답 필드 분리는 controller 의 admin mapper 가 담당한다.
   */
  async adminFindAll(options: AdminPostListOptions = {}) {
    const page = Math.max(options.page ?? DEFAULT_ADMIN_POST_LIST_PAGE, 1);
    const rawLimit = options.limit ?? DEFAULT_ADMIN_POST_LIST_LIMIT;
    const limit = Math.min(Math.max(rawLimit, 1), MAX_ADMIN_POST_LIST_LIMIT);
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (options.status) {
      conditions.push(eq(communityPosts.status, options.status));
    }

    if (options.communityId) {
      conditions.push(eq(communityPosts.communityId, options.communityId));
    } else if (options.communitySlug) {
      const community = await this.communityService.findBySlug(options.communitySlug);
      if (!community) {
        return { items: [], total: 0, page, limit };
      }
      conditions.push(eq(communityPosts.communityId, community.id));
    }

    const searchPattern = normalizePostSearchTerm(options.search);
    if (searchPattern) {
      conditions.push(
        or(
          ilike(communityPosts.title, searchPattern),
          ilike(communityPosts.content, searchPattern),
        ) as SQL,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await this.db
      .select({ value: count() })
      .from(communityPosts)
      .where(whereClause);

    const rows = (await this.db
      .select()
      .from(communityPosts)
      .where(whereClause)
      .orderBy(desc(communityPosts.createdAt), desc(communityPosts.id))
      .limit(limit)
      .offset(offset)) as CommunityPost[];

    const items = await this.enrichAuthors(rows);

    return { items, total: Number(totalRow?.value ?? 0), page, limit };
  }

  /** author id 들을 name/avatar 로 한 번에 enrich 한다. */
  private async enrichAuthors<T extends CommunityPost>(items: T[]) {
    const authorIds = [...new Set(items.map((item) => item.authorId))];
    const authors =
      authorIds.length > 0
        ? await this.db
            .select({ id: userTable.id, name: userTable.name, avatar: userTable.image })
            .from(userTable)
            .where(inArray(userTable.id, authorIds))
        : [];
    const authorMap = new Map(authors.map((a) => [a.id, a]));
    return items.map((item) => ({
      ...item,
      authorName: authorMap.get(item.authorId)?.name ?? null,
      authorAvatar: authorMap.get(item.authorId)?.avatar ?? null,
    }));
  }

  private buildCursorCondition(cursor: string | undefined, sort: PostSort) {
    if (!cursor) return null;

    const payload = this.decodePostCursor(cursor);
    if (!payload || payload.sort !== sort) return null;

    switch (payload.sort) {
      case "hot":
        return sql`(${communityPosts.hotScore}, ${communityPosts.lastActivityAt}, ${communityPosts.id}) < (${payload.hotScore}, ${payload.lastActivityAt}, ${payload.id})`;
      case "top":
        return sql`(${communityPosts.voteScore}, ${communityPosts.createdAt}, ${communityPosts.id}) < (${payload.voteScore}, ${payload.createdAt}, ${payload.id})`;
      case "rising":
        return sql`(${communityPosts.lastActivityAt}, ${communityPosts.commentCount}, ${communityPosts.id}) < (${payload.lastActivityAt}, ${payload.commentCount}, ${payload.id})`;
      case "controversial":
        return sql`(LEAST(${communityPosts.upvoteCount}, ${communityPosts.downvoteCount}), ${communityPosts.commentCount}, ${communityPosts.id}) < (${payload.controversialScore}, ${payload.commentCount}, ${payload.id})`;
      case "new":
        return sql`(${communityPosts.createdAt}, ${communityPosts.id}) < (${payload.createdAt}, ${payload.id})`;
    }
  }

  private applySort(query: CommunityPostSelectQuery, sort: PostSort) {
    switch (sort) {
      case "hot":
        return query.orderBy(
          desc(communityPosts.hotScore),
          desc(communityPosts.lastActivityAt),
          desc(communityPosts.id),
        );
      case "top":
        return query.orderBy(
          desc(communityPosts.voteScore),
          desc(communityPosts.createdAt),
          desc(communityPosts.id),
        );
      case "rising":
        return query.orderBy(
          desc(communityPosts.lastActivityAt),
          desc(communityPosts.commentCount),
          desc(communityPosts.id),
        );
      case "controversial":
        return query.orderBy(
          desc(sql<number>`LEAST(${communityPosts.upvoteCount}, ${communityPosts.downvoteCount})`),
          desc(communityPosts.commentCount),
          desc(communityPosts.id),
        );
      case "new":
        return query.orderBy(desc(communityPosts.createdAt), desc(communityPosts.id));
    }
  }

  private buildSortedCursorResult<T extends CommunityPost>(
    items: T[],
    limit: number,
    sort: PostSort,
  ) {
    const hasMore = items.length > limit;
    const result = hasMore ? items.slice(0, limit) : items;
    const last = result[result.length - 1];

    return {
      items: result,
      nextCursor:
        hasMore && last ? this.encodePostCursor(this.createCursorPayload(last, sort)) : null,
    };
  }

  private emptyPostList() {
    return {
      items: [],
      nextCursor: null,
    };
  }

  private createCursorPayload(item: CommunityPost, sort: PostSort): PostCursorPayload {
    switch (sort) {
      case "hot":
        return {
          sort,
          hotScore: item.hotScore,
          lastActivityAt: item.lastActivityAt.toISOString(),
          id: item.id,
        };
      case "top":
        return {
          sort,
          voteScore: item.voteScore,
          createdAt: item.createdAt.toISOString(),
          id: item.id,
        };
      case "rising":
        return {
          sort,
          lastActivityAt: item.lastActivityAt.toISOString(),
          commentCount: item.commentCount,
          id: item.id,
        };
      case "controversial":
        return {
          sort,
          controversialScore: Math.min(item.upvoteCount, item.downvoteCount),
          commentCount: item.commentCount,
          id: item.id,
        };
      case "new":
        return { sort, createdAt: item.createdAt.toISOString(), id: item.id };
    }
  }

  private encodePostCursor(payload: PostCursorPayload) {
    return Buffer.from(JSON.stringify(payload)).toString("base64url");
  }

  private decodePostCursor(cursor: string): PostCursorPayload | null {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (this.isPostCursorPayload(parsed)) return parsed;
    } catch {
      // Fall through to the legacy decoder below.
    }

    const legacy = decodeCursor(cursor);
    if (legacy) return { sort: "new", createdAt: legacy.value, id: legacy.id };
    return null;
  }

  private isPostCursorPayload(value: unknown): value is PostCursorPayload {
    if (!value || typeof value !== "object") return false;
    const payload = value as Partial<PostCursorPayload>;
    if (typeof payload.sort !== "string" || typeof payload.id !== "string") return false;

    switch (payload.sort) {
      case "hot":
        return typeof payload.hotScore === "number" && typeof payload.lastActivityAt === "string";
      case "top":
        return typeof payload.voteScore === "number" && typeof payload.createdAt === "string";
      case "rising":
        return (
          typeof payload.lastActivityAt === "string" && typeof payload.commentCount === "number"
        );
      case "controversial":
        return (
          typeof payload.controversialScore === "number" && typeof payload.commentCount === "number"
        );
      case "new":
        return typeof payload.createdAt === "string";
      default:
        return false;
    }
  }

  async findById(id: string) {
    const [result] = await this.db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, id))
      .limit(1);

    if (!result) {
      return null;
    }

    const post = result as CommunityPost;

    const [author] = await this.db
      .select({ id: userTable.id, name: userTable.name, avatar: userTable.image })
      .from(userTable)
      .where(eq(userTable.id, post.authorId))
      .limit(1);
    const authorName = author?.name ?? null;
    const authorAvatar = author?.avatar ?? null;

    if (post.status === "deleted") {
      return {
        ...post,
        title: "[삭제된 게시글]",
        content: "[삭제된 게시글]",
        authorName,
        authorAvatar,
      };
    }
    if (post.status === "removed") {
      return {
        ...post,
        title: "[운영 정책에 의해 삭제됨]",
        content: "[운영 정책에 의해 삭제됨]",
        authorName,
        authorAvatar,
      };
    }

    await this.db
      .update(communityPosts)
      .set({
        viewCount: sql`${communityPosts.viewCount} + 1`,
      })
      .where(eq(communityPosts.id, id));

    return { ...post, authorName, authorAvatar };
  }

  /**
   * 게시글 상세 + viewer state 조회 (PB-COMM-POST-API-READ-001 / BBR-595).
   *
   * 비로그인/로그인 모두 공개 상세를 조회할 수 있고, 노출 결과는
   * resolvePostDetailAccess 가 status·차단 상태로 일관 결정한다(AC#1). 투표/신고/
   * 저장 같은 "보호 액션"은 별도 인증 엔드포인트이며, 여기서는 viewer state 로
   * 그 가능 여부 신호만 내려준다(AC#2 — 프론트 auth modal 연결).
   *
   * @param input.blockedUserIds controller 가 blockService 로 계산한 양방향 차단 집합.
   * @returns 노출 불가(미존재/숨김/차단)면 null → controller 가 404 로 변환.
   */
  async findDetailForViewer(
    id: string,
    input: { viewerId?: string; blockedUserIds?: string[] } = {},
  ): Promise<PublicPostDetail | null> {
    const [result] = await this.db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, id))
      .limit(1);
    if (!result) return null;

    const post = result as CommunityPost;
    const viewerId = input.viewerId;
    const isAuthor = !!viewerId && viewerId === post.authorId;
    const authorBlocked = (input.blockedUserIds ?? []).includes(post.authorId);
    const canModerate =
      !!viewerId &&
      !isAuthor &&
      (await this.communityService.isModerator(post.communityId, viewerId));

    const access = resolvePostDetailAccess({
      status: post.status,
      isAuthor,
      canModerate,
      authorBlocked,
    });
    if (!access.visible) return null;

    const [author] = await this.db
      .select({ id: userTable.id, name: userTable.name, avatar: userTable.image })
      .from(userTable)
      .where(eq(userTable.id, post.authorId))
      .limit(1);

    // viewer-별 신고/차단/리액션 상태는 로그인 사용자에게만 조회한다.
    const [hasReported, hasBlockedAuthor, myVote] = viewerId
      ? await Promise.all([
          this.hasReportedPost(viewerId, post.id),
          this.hasBlockedAuthor(viewerId, post.authorId),
          this.getMyVote(viewerId, post.id),
        ])
      : [false, false, null as "up" | "down" | null];

    // published 상세만 조회수를 증가시킨다(tombstone/숨김 노출은 카운트 제외).
    if (!access.masked && post.status === "published") {
      await this.db
        .update(communityPosts)
        .set({ viewCount: sql`${communityPosts.viewCount} + 1` })
        .where(eq(communityPosts.id, post.id));
    }

    const displayPost = access.masked ? this.applyTombstone(post) : post;
    const enriched = {
      ...displayPost,
      authorName: author?.name ?? null,
      authorAvatar: author?.avatar ?? null,
    };

    const viewer: PostDetailViewerState = {
      authenticated: !!viewerId,
      isAuthor,
      hasReported,
      hasBlockedAuthor,
      canModerate,
      myVote,
    };

    return toPublicPostDetail(enriched, viewer);
  }

  /** 삭제/운영삭제 게시글의 본문을 tombstone 으로 가린다(노출은 일관 유지). */
  private applyTombstone(post: CommunityPost): CommunityPost {
    const text = post.status === "deleted" ? "[삭제된 게시글]" : "[운영 정책에 의해 삭제됨]";
    return { ...post, title: text, content: text };
  }

  /** 요청자가 해당 게시글을 신고한 적이 있는지. */
  private async hasReportedPost(reporterId: string, postId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: communityReports.id })
      .from(communityReports)
      .where(
        and(
          eq(communityReports.reporterId, reporterId),
          eq(communityReports.targetType, "post"),
          eq(communityReports.targetId, postId),
        ),
      )
      .limit(1);
    return !!row;
  }

  /** 요청자가 작성자를 차단했는지(단방향). */
  private async hasBlockedAuthor(blockerId: string, authorId: string): Promise<boolean> {
    if (blockerId === authorId) return false;
    const [row] = await this.db
      .select({ blockerId: communityUserBlocks.blockerId })
      .from(communityUserBlocks)
      .where(
        and(
          eq(communityUserBlocks.blockerId, blockerId),
          eq(communityUserBlocks.blockedId, authorId),
        ),
      )
      .limit(1);
    return !!row;
  }

  /** 요청자의 게시글 리액션(up/down) 또는 null. */
  private async getMyVote(userId: string, postId: string): Promise<"up" | "down" | null> {
    const [row] = await this.db
      .select({ vote: communityVotes.vote })
      .from(communityVotes)
      .where(
        and(
          eq(communityVotes.userId, userId),
          eq(communityVotes.targetType, "post"),
          eq(communityVotes.targetId, postId),
        ),
      )
      .limit(1);
    if (!row) return null;
    return row.vote > 0 ? "up" : "down";
  }

  async update(id: string, dto: UpdatePostDto, userId: string): Promise<CommunityPost> {
    const post = await this.findById(id);
    if (!post) {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException("작성자만 게시글을 수정할 수 있습니다.");
    }

    const updateValues: UpdatePostDto & {
      status?: "hidden";
      removalReason?: string;
    } = { ...dto };

    // 등급 기반 키워드 필터 우회 확인
    const updateTierInfo = await this.tierService.getTierInfo(post.communityId, userId);
    const updateBypass =
      TIER_PRIVILEGES[updateTierInfo.tier as keyof typeof TIER_PRIVILEGES]?.bypassKeywordFilter ??
      false;

    // 키워드 필터 검사
    const textsToCheck = [dto.title, dto.content].filter(Boolean) as string[];
    if (textsToCheck.length > 0) {
      const filterResult = await this.keywordFilterService.validateContent(
        post.communityId,
        textsToCheck,
        { bypassFilter: updateBypass },
      );
      if (!filterResult.passed) {
        if (filterResult.action === "block") {
          throw new ForbiddenException(
            `금지어가 포함되어 있습니다: ${filterResult.matchedWords.join(", ")}`,
          );
        }
        updateValues.status = "hidden";
        updateValues.removalReason = `자동 필터: ${filterResult.matchedWords.join(", ")}`;
      }

      // Layer 2: OpenAI Moderation API
      await this.contentModerationService.assertContentAllowed(textsToCheck);
    }

    const [updated] = await this.db
      .update(communityPosts)
      .set({
        ...updateValues,
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, id))
      .returning();

    return updated as CommunityPost;
  }

  async delete(id: string, userId: string): Promise<void> {
    const post = await this.findById(id);
    if (!post) {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }

    const isModerator = await this.communityService.isModerator(post.communityId, userId);
    if (post.authorId !== userId && !isModerator) {
      throw new ForbiddenException("작성자 또는 관리자만 게시글을 삭제할 수 있습니다.");
    }

    await this.db
      .update(communityPosts)
      .set({
        status: "deleted",
        content: "[deleted]",
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, id));

    await this.db
      .update(communities)
      .set({
        postCount: sql`${communities.postCount} - 1`,
      })
      .where(eq(communities.id, post.communityId));
  }

  async pin(id: string, userId: string): Promise<CommunityPost> {
    const post = await this.findById(id);
    if (!post) {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }

    await assertCommunityPermission(this.communityService, userId, post.communityId, [
      "owner",
      "admin",
      "moderator",
    ]);

    const [updated] = await this.db
      .update(communityPosts)
      .set({
        isPinned: true,
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, id))
      .returning();

    return updated as CommunityPost;
  }

  async lock(id: string, userId: string): Promise<CommunityPost> {
    const post = await this.findById(id);
    if (!post) {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }

    await assertCommunityPermission(this.communityService, userId, post.communityId, [
      "owner",
      "admin",
      "moderator",
    ]);

    const [updated] = await this.db
      .update(communityPosts)
      .set({
        isLocked: true,
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, id))
      .returning();

    return updated as CommunityPost;
  }

  async remove(id: string, reason: string, userId: string): Promise<CommunityPost> {
    const post = await this.findById(id);
    if (!post) {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }

    await assertCommunityPermission(this.communityService, userId, post.communityId, [
      "owner",
      "admin",
      "moderator",
    ]);

    const [updated] = await this.db
      .update(communityPosts)
      .set({
        status: "removed",
        removalReason: reason,
        removedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, id))
      .returning();

    return updated as CommunityPost;
  }

  async crosspost(
    postId: string,
    targetCommunityId: string,
    userId: string,
  ): Promise<CommunityPost> {
    const originalPost = await this.findById(postId);
    if (!originalPost) {
      throw new NotFoundException("원본 게시글을 찾을 수 없습니다.");
    }

    const targetCommunity = await this.communityService.findById(targetCommunityId);
    if (!targetCommunity) {
      throw new NotFoundException("대상 커뮤니티를 찾을 수 없습니다.");
    }

    if (!targetCommunity.allowCrosspost) {
      throw new ForbiddenException("대상 커뮤니티에서 교차 게시를 허용하지 않습니다.");
    }

    await assertCommunityPermission(this.communityService, userId, targetCommunityId, [
      "owner",
      "admin",
      "moderator",
      "member",
    ]);

    const [crosspost] = await this.db
      .insert(communityPosts)
      .values({
        communityId: targetCommunityId,
        authorId: userId,
        title: `[Crosspost] ${originalPost.title}`,
        content: originalPost.content,
        type: originalPost.type,
        linkUrl: originalPost.linkUrl,
        mediaUrls: originalPost.mediaUrls,
        crosspostParentId: postId,
        hotScore: this.calculateHotScore(0, new Date()),
      })
      .returning();

    return crosspost as CommunityPost;
  }

  private calculateHotScore(voteScore: number, createdAt: Date): number {
    const score = voteScore;
    const order = Math.log10(Math.max(Math.abs(score), 1));
    const sign = Math.sign(score);
    const seconds = (createdAt.getTime() - new Date("2005-12-08").getTime()) / 1000;

    return sign * order + seconds / 45000;
  }

  async updateHotScores(): Promise<void> {
    const posts = await this.db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.status, "published"))
      .limit(1000);

    for (const post of posts) {
      const hotScore = this.calculateHotScore(post.voteScore, post.createdAt);
      await this.db.update(communityPosts).set({ hotScore }).where(eq(communityPosts.id, post.id));
    }
  }
}

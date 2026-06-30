import { Injectable } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  type CommunityPost,
  communities,
  communityMemberships,
  communityPosts,
} from "@repo/drizzle/schema";
import { and, desc, eq, gte, inArray, notInArray, sql } from "drizzle-orm";

export type ContentRatingFilter = "general" | "sensitive" | "nsfw" | "violence";

export interface FeedOptions {
  sort?: "hot" | "new" | "top" | "rising" | "controversial";
  timeFilter?: "hour" | "day" | "week" | "month" | "year" | "all";
  page?: number;
  limit?: number;
  /** 허용할 콘텐츠 등급. 기본: ["general", "sensitive"] */
  allowedRatings?: ContentRatingFilter[];
  /** 차단된 유저 ID 목록 (양방향) — 이 유저들의 게시물을 제외 */
  blockedUserIds?: string[];
}

/** 콘텐츠 등급 기본 허용값: 일반 + 민감(성인/폭력 등은 명시 요청 시에만). */
const DEFAULT_ALLOWED_RATINGS: ContentRatingFilter[] = ["general", "sensitive"];

/**
 * home/all/popular 피드 공통 게시물 가시성 필터.
 *
 * 세 피드가 동일한 invariant(공개 상태·콘텐츠 등급·차단 작성자 제외)를
 * 적용하도록 한 곳에서 조건을 생성한다. 커뮤니티 범위(membership / public)는
 * 피드마다 다르므로 호출부에서 별도로 합성한다.
 */
function buildPostVisibilityConditions(opts: {
  allowedRatings: ContentRatingFilter[];
  blockedUserIds: string[];
}) {
  return [
    eq(communityPosts.status, "published"),
    inArray(communityPosts.contentRating, opts.allowedRatings),
    ...(opts.blockedUserIds.length > 0
      ? [notInArray(communityPosts.authorId, opts.blockedUserIds)]
      : []),
  ];
}

/** popular 피드의 시간 윈도우 시작점. "all" / 미지정은 epoch(0) → 무제한. */
function resolvePopularWindowStart(timeFilter: NonNullable<FeedOptions["timeFilter"]>): Date {
  const now = Date.now();
  switch (timeFilter) {
    case "hour":
      return new Date(now - 60 * 60 * 1000);
    case "day":
      return new Date(now - 24 * 60 * 60 * 1000);
    case "week":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "month":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "year":
      return new Date(now - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(0);
  }
}

@Injectable()
export class CommunityFeedService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async getHomeFeed(userId: string, options: FeedOptions = {}) {
    const memberships = await this.db
      .select({ communityId: communityMemberships.communityId })
      .from(communityMemberships)
      .where(eq(communityMemberships.userId, userId));

    const communityIds = memberships.map((m) => m.communityId);

    if (communityIds.length === 0) {
      return {
        items: [],
        total: 0,
        page: 1,
        limit: options.limit ?? 25,
        hasMore: false,
      };
    }

    return this.getFeed(options, communityIds);
  }

  async getAllFeed(options: FeedOptions = {}) {
    const communityIds = await this.getPublicCommunityIds();
    return this.getFeed(options, communityIds);
  }

  async getPopularFeed(options: FeedOptions = {}) {
    const limit = options.limit ?? 25;
    const startDate = resolvePopularWindowStart(options.timeFilter ?? "day");

    // popular은 all 피드와 동일하게 "공개(public) 커뮤니티"로만 한정한다.
    // 이전에는 communityPosts를 직접 조회해 restricted/private 커뮤니티의
    // 게시물까지 노출될 수 있었다(다른 피드와의 가시성 invariant 불일치).
    const publicCommunityIds = await this.getPublicCommunityIds();
    if (publicCommunityIds.length === 0) {
      return [];
    }

    const allowedRatings = options.allowedRatings ?? DEFAULT_ALLOWED_RATINGS;
    const blockedUserIds = options.blockedUserIds ?? [];

    const conditions = [
      ...buildPostVisibilityConditions({ allowedRatings, blockedUserIds }),
      inArray(communityPosts.communityId, publicCommunityIds),
      gte(communityPosts.createdAt, startDate),
    ];

    const items = await this.db
      .select()
      .from(communityPosts)
      .where(and(...conditions))
      .orderBy(desc(communityPosts.voteScore))
      .limit(limit);

    return items as CommunityPost[];
  }

  /** 공개(public) 커뮤니티 ID 목록 — all / popular 피드의 가시 범위. */
  private async getPublicCommunityIds(): Promise<string[]> {
    const rows = await this.db
      .select({ id: communities.id })
      .from(communities)
      .where(eq(communities.type, "public"));
    return rows.map((c) => c.id);
  }

  private async getFeed(options: FeedOptions, communityIds: string[]) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 25;
    const offset = (page - 1) * limit;
    const allowedRatings = options.allowedRatings ?? DEFAULT_ALLOWED_RATINGS;

    const blockedUserIds = options.blockedUserIds ?? [];

    const baseConditions = [
      ...buildPostVisibilityConditions({ allowedRatings, blockedUserIds }),
      inArray(communityPosts.communityId, communityIds),
    ];

    // 시간 필터 조건을 baseConditions에 합성 (덮어쓰기 방지)
    if (options.timeFilter && options.timeFilter !== "all") {
      const timeMs: Record<string, number> = {
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000,
      };
      const ms = timeMs[options.timeFilter] ?? 0;
      if (ms > 0) {
        baseConditions.push(gte(communityPosts.createdAt, new Date(Date.now() - ms)));
      }
    }

    // rising은 항상 24시간 이내
    if (options.sort === "rising") {
      baseConditions.push(
        gte(communityPosts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
      );
    }

    let query = this.db
      .select({
        post: communityPosts,
        communitySlug: communities.slug,
      })
      .from(communityPosts)
      .leftJoin(communities, eq(communityPosts.communityId, communities.id))
      .where(and(...baseConditions)) as any;

    switch (options.sort) {
      case "hot":
        query = (query as any).orderBy(desc(communityPosts.hotScore));
        break;
      case "top":
        query = (query as any).orderBy(desc(communityPosts.voteScore));
        break;
      case "rising":
        query = (query as any).orderBy(
          desc(
            sql`${communityPosts.voteScore} / EXTRACT(EPOCH FROM (NOW() - ${communityPosts.createdAt}))`,
          ),
        );
        break;
      case "controversial":
        query = (query as any).orderBy(
          desc(
            sql`(${communityPosts.upvoteCount} + ${communityPosts.downvoteCount}) * LEAST(${communityPosts.upvoteCount}::float / NULLIF(${communityPosts.downvoteCount}, 0), ${communityPosts.downvoteCount}::float / NULLIF(${communityPosts.upvoteCount}, 0))`,
          ),
        );
        break;
      default:
        query = (query as any).orderBy(desc(communityPosts.createdAt));
    }

    const results = await query.limit(limit).offset(offset);

    const items = results.map((r: any) => ({
      ...r.post,
      communitySlug: r.communitySlug,
    }));

    return {
      items,
      total: items.length,
      page,
      limit,
      hasMore: items.length === limit,
    };
  }
}

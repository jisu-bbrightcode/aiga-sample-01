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
    const publicCommunities = await this.db
      .select({ id: communities.id })
      .from(communities)
      .where(and(eq(communities.type, "public"), eq(communities.status, "active")));

    const communityIds = publicCommunities.map((c) => c.id);

    return this.getFeed(options, communityIds);
  }

  async getPopularFeed(options: FeedOptions = {}) {
    const limit = options.limit ?? 25;
    const timeFilter = options.timeFilter ?? "day";

    let startDate = new Date();
    switch (timeFilter) {
      case "hour":
        startDate = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case "day":
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0);
    }

    const allowedRatings = options.allowedRatings ?? ["general", "sensitive"];
    const blockedUserIds = options.blockedUserIds ?? [];

    const conditions = [
      eq(communityPosts.status, "published"),
      gte(communityPosts.createdAt, startDate),
      inArray(communityPosts.contentRating, allowedRatings),
      // 보관된 커뮤니티의 게시물은 인기 피드에서 제외 (AC#1).
      notInArray(
        communityPosts.communityId,
        this.db
          .select({ id: communities.id })
          .from(communities)
          .where(eq(communities.status, "archived")),
      ),
      ...(blockedUserIds.length > 0 ? [notInArray(communityPosts.authorId, blockedUserIds)] : []),
    ];

    const items = await this.db
      .select()
      .from(communityPosts)
      .where(and(...conditions))
      .orderBy(desc(communityPosts.voteScore))
      .limit(limit);

    return items as CommunityPost[];
  }

  private async getFeed(options: FeedOptions, communityIds: string[]) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 25;
    const offset = (page - 1) * limit;
    const allowedRatings = options.allowedRatings ?? ["general", "sensitive"];

    const blockedUserIds = options.blockedUserIds ?? [];

    const baseConditions = [
      eq(communityPosts.status, "published"),
      inArray(communityPosts.communityId, communityIds),
      inArray(communityPosts.contentRating, allowedRatings),
      // 보관된 커뮤니티의 게시물은 피드에서 제외 (AC#1 — communities 조인 활용).
      eq(communities.status, "active"),
      ...(blockedUserIds.length > 0 ? [notInArray(communityPosts.authorId, blockedUserIds)] : []),
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

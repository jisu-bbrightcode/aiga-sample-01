import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  type Community,
  type CommunityMembership,
  communities,
  communityComments,
  communityMemberships,
  communityModerators,
  communityPosts,
} from "@repo/drizzle/schema";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { buildCursorResult, decodeCursor } from "../helpers/pagination";
import type { CreateCommunityDto, UpdateCommunityDto } from "../dto";

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface CommunityListOptions {
  search?: string;
  type?: "public" | "restricted" | "private";
  sort?: "newest" | "popular" | "name";
  cursor?: string;
  limit?: number;
}

@Injectable()
export class CommunityService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /**
   * Create community
   */
  async create(dto: CreateCommunityDto, userId: string): Promise<Community> {
    const existing = await this.findBySlug(dto.slug);
    if (existing) {
      throw new ConflictException(`이미 사용 중인 슬러그입니다: ${dto.slug}`);
    }

    const [community] = await this.db
      .insert(communities)
      .values({
        ...dto,
        ownerId: userId,
        rules: dto.rules ?? [],
      })
      .returning();

    if (!community) {
      throw new InternalServerErrorException("커뮤니티 생성에 실패했습니다");
    }

    await this.db.insert(communityMemberships).values({
      communityId: community.id,
      userId,
      role: "owner",
    });

    await this.db
      .update(communities)
      .set({
        memberCount: sql`${communities.memberCount} + 1`,
      })
      .where(eq(communities.id, community.id));

    return { ...community, memberCount: 1 } as Community;
  }

  /**
   * List communities (cursor pagination)
   */
  async findAll(options: CommunityListOptions = {}) {
    const limit = options.limit ?? 20;

    const conditions: any[] = [];
    if (options.type) {
      conditions.push(eq(communities.type, options.type));
    }
    if (options.search) {
      conditions.push(
        or(
          ilike(communities.name, `%${options.search}%`),
          ilike(communities.description, `%${options.search}%`),
        ),
      );
    }

    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded) {
        switch (options.sort) {
          case "popular":
            conditions.push(
              sql`(${communities.memberCount}, ${communities.id}) < (${decoded.value}, ${decoded.id})`,
            );
            break;
          case "name":
            conditions.push(
              sql`(${communities.name}, ${communities.id}) > (${decoded.value}, ${decoded.id})`,
            );
            break;
          default:
            conditions.push(
              sql`(${communities.createdAt}, ${communities.id}) < (${decoded.value}, ${decoded.id})`,
            );
        }
      }
    }

    let query = this.db.select().from(communities);
    if (conditions.length > 0) {
      query = (query as any).where(and(...conditions));
    }

    switch (options.sort) {
      case "popular":
        query = (query as any).orderBy(desc(communities.memberCount), desc(communities.id));
        break;
      case "name":
        query = (query as any).orderBy(asc(communities.name), asc(communities.id));
        break;
      default:
        query = (query as any).orderBy(desc(communities.createdAt), desc(communities.id));
    }

    const items = (await query.limit(limit + 1)) as Community[];
    return buildCursorResult(items, limit, (item) => {
      switch (options.sort) {
        case "popular":
          return { value: String(item.memberCount), id: item.id };
        case "name":
          return { value: item.name, id: item.id };
        default:
          return { value: item.createdAt.toISOString(), id: item.id };
      }
    });
  }

  async findBySlug(slug: string): Promise<Community | null> {
    const [result] = await this.db
      .select()
      .from(communities)
      .where(eq(communities.slug, slug))
      .limit(1);

    return (result as Community) ?? null;
  }

  async findById(id: string): Promise<Community | null> {
    const [result] = await this.db
      .select()
      .from(communities)
      .where(eq(communities.id, id))
      .limit(1);

    return (result as Community) ?? null;
  }

  async findPopular(limit = 10): Promise<Community[]> {
    const items = await this.db
      .select()
      .from(communities)
      .where(eq(communities.type, "public"))
      .orderBy(desc(communities.memberCount))
      .limit(limit);

    return items as Community[];
  }

  async findUserSubscriptions(userId: string): Promise<Community[]> {
    const items = await this.db
      .select({
        id: communities.id,
        name: communities.name,
        slug: communities.slug,
        description: communities.description,
        iconUrl: communities.iconUrl,
        bannerUrl: communities.bannerUrl,
        ownerId: communities.ownerId,
        type: communities.type,
        isOfficial: communities.isOfficial,
        isNsfw: communities.isNsfw,
        allowImages: communities.allowImages,
        allowVideos: communities.allowVideos,
        allowPolls: communities.allowPolls,
        allowCrosspost: communities.allowCrosspost,
        memberCount: communities.memberCount,
        postCount: communities.postCount,
        onlineCount: communities.onlineCount,
        rules: communities.rules,
        automodConfig: communities.automodConfig,
        bannedWords: communities.bannedWords,
        createdAt: communities.createdAt,
        updatedAt: communities.updatedAt,
      })
      .from(communities)
      .innerJoin(communityMemberships, eq(communities.id, communityMemberships.communityId))
      .where(eq(communityMemberships.userId, userId))
      .orderBy(desc(communityMemberships.joinedAt));

    return items as Community[];
  }

  async update(slug: string, dto: UpdateCommunityDto, userId: string): Promise<Community> {
    const community = await this.findBySlug(slug);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    const membership = await this.getMembership(community.id, userId);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new ForbiddenException("커뮤니티 소유자 또는 관리자만 설정을 변경할 수 있습니다.");
    }

    const [updated] = await this.db
      .update(communities)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(communities.id, community.id))
      .returning();

    return updated as Community;
  }

  async updateBannedWords(communityId: string, words: string[]): Promise<void> {
    await this.db
      .update(communities)
      .set({ bannedWords: words, updatedAt: new Date() })
      .where(eq(communities.id, communityId));
  }

  async delete(slug: string, userId: string): Promise<void> {
    const community = await this.findBySlug(slug);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    if (community.ownerId !== userId) {
      throw new ForbiddenException("커뮤니티 소유자만 삭제할 수 있습니다.");
    }

    await this.db.delete(communities).where(eq(communities.id, community.id));
  }

  async join(slug: string, userId: string): Promise<CommunityMembership> {
    const community = await this.findBySlug(slug);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    if (community.type === "private") {
      throw new ForbiddenException("비공개 커뮤니티는 초대를 통해서만 가입할 수 있습니다.");
    }

    const existing = await this.getMembership(community.id, userId);
    if (existing) {
      throw new ConflictException("이미 이 커뮤니티에 가입되어 있습니다.");
    }

    const [membership] = await this.db
      .insert(communityMemberships)
      .values({
        communityId: community.id,
        userId,
        role: "member",
      })
      .returning();

    await this.db
      .update(communities)
      .set({
        memberCount: sql`${communities.memberCount} + 1`,
      })
      .where(eq(communities.id, community.id));

    return membership as CommunityMembership;
  }

  async leave(slug: string, userId: string): Promise<void> {
    const community = await this.findBySlug(slug);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    if (community.ownerId === userId) {
      throw new ForbiddenException("커뮤니티 소유자는 탈퇴할 수 없습니다.");
    }

    const membership = await this.getMembership(community.id, userId);
    if (!membership) {
      throw new NotFoundException("이 커뮤니티의 멤버가 아닙니다.");
    }

    await this.db
      .delete(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, community.id),
          eq(communityMemberships.userId, userId),
        ),
      );

    await this.db
      .update(communities)
      .set({
        memberCount: sql`${communities.memberCount} - 1`,
      })
      .where(eq(communities.id, community.id));
  }

  async getMembers(slug: string, options: PaginationOptions = {}) {
    const community = await this.findBySlug(slug);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    const page = options.page ?? 1;
    const limit = options.limit ?? 50;
    const offset = (page - 1) * limit;

    const [items, totalResult] = await Promise.all([
      this.db
        .select()
        .from(communityMemberships)
        .where(eq(communityMemberships.communityId, community.id))
        .orderBy(desc(communityMemberships.joinedAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(communityMemberships)
        .where(eq(communityMemberships.communityId, community.id)),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return {
      items: items as CommunityMembership[],
      total,
      page,
      limit,
      hasMore: offset + items.length < total,
    };
  }

  async getModerators(slug: string) {
    const community = await this.findBySlug(slug);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    const items = await this.db
      .select()
      .from(communityModerators)
      .where(eq(communityModerators.communityId, community.id))
      .orderBy(communityModerators.appointedAt);

    return items;
  }

  async getMembership(communityId: string, userId: string): Promise<CommunityMembership | null> {
    const [result] = await this.db
      .select()
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.userId, userId),
        ),
      )
      .limit(1);

    return (result as CommunityMembership) ?? null;
  }

  async isMember(communityId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(communityId, userId);
    return !!membership && !membership.isBanned;
  }

  async isModerator(communityId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(communityId, userId);
    return !!membership && ["moderator", "admin", "owner"].includes(membership.role);
  }

  async adminFindAll(input: { page: number; limit: number; search?: string; type?: string }) {
    const { page, limit, search, type } = input;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (type) conditions.push(eq(communities.type, type as "public" | "restricted" | "private"));
    if (search) {
      conditions.push(
        or(ilike(communities.name, `%${search}%`), ilike(communities.description, `%${search}%`)),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(communities)
        .where(whereClause)
        .orderBy(desc(communities.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: count() }).from(communities).where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async adminDelete(communityId: string) {
    const community = await this.findById(communityId);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }
    await this.db.delete(communities).where(eq(communities.id, communityId));
    return { success: true };
  }

  async getSystemStats() {
    const [commResult, memberResult, postResult, commentResult] = await Promise.all([
      this.db.select({ count: count() }).from(communities),
      this.db.select({ count: count() }).from(communityMemberships),
      this.db.select({ count: count() }).from(communityPosts),
      this.db.select({ count: count() }).from(communityComments),
    ]);
    return {
      totalCommunities: commResult[0]?.count ?? 0,
      totalMembers: memberResult[0]?.count ?? 0,
      totalPosts: postResult[0]?.count ?? 0,
      totalComments: commentResult[0]?.count ?? 0,
    };
  }
}

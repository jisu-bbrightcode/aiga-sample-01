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
  communitySanctions,
} from "@repo/drizzle/schema";
import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { CreateCommunityDto, UpdateCommunityDto } from "../dto";
import { buildCursorResult, decodeCursor } from "../helpers/pagination";
import {
  type OperationalMemberItem,
  type OperationalModeratorItem,
  type PublicMemberItem,
  type PublicModeratorItem,
  toOperationalMemberItem,
  toOperationalModeratorItem,
  toPublicMemberItem,
  toPublicModeratorItem,
} from "../member-mappers";
import {
  type MemberRole,
  type MemberStatus,
  normalizeMemberLimit,
  normalizeMemberPage,
  resolveMemberStatusFilter,
} from "./member-list-options";

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/** 멤버/모더레이터 조회 필터 (PB-COMM-MEMBER-API-001 / BBR-592). */
export interface MemberListOptions {
  page?: number;
  limit?: number;
  role?: MemberRole;
  status?: MemberStatus;
}

/** 멤버 목록 응답. operational=true 면 운영 필드 포함, false 면 공개 필드만. */
export interface MemberListResult {
  items: PublicMemberItem[] | OperationalMemberItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  operational: boolean;
}

/** 모더레이터 목록 응답. operational=true 면 권한/임명자 포함. */
export interface ModeratorListResult {
  items: PublicModeratorItem[] | OperationalModeratorItem[];
  operational: boolean;
}

const OPERATIONAL_ROLES = ["moderator", "admin", "owner"] as const;

export interface CommunityListOptions {
  search?: string;
  type?: "public" | "restricted" | "private";
  sort?: "newest" | "popular" | "name";
  cursor?: string;
  limit?: number;
}

/**
 * 뷰어(요청자)와 커뮤니티의 관계 상태 (PB-COMM-SPACE-API-LIST-001 / BBR-587).
 * 비로그인이면 authenticated=false 에 모든 플래그가 false.
 */
export interface CommunityViewerState {
  authenticated: boolean;
  isMember: boolean;
  role: "member" | "moderator" | "admin" | "owner" | null;
  tier: "newcomer" | "member" | "contributor" | "trusted" | "leader" | null;
  isSubscribed: boolean;
  isBanned: boolean;
  banExpiresAt: string | null;
  isSanctioned: boolean;
  sanctionType: "warning" | "official_warning" | "suspension" | "permanent_ban" | null;
  sanctionExpiresAt: string | null;
  canModerate: boolean;
}

/** 모더레이터 권한을 가진 멤버 역할 — 모더레이션 내부 필드 노출 대상. */
const MODERATOR_ROLES = new Set(["owner", "admin", "moderator"]);

function guestViewerState(authenticated: boolean): CommunityViewerState {
  return {
    authenticated,
    isMember: false,
    role: null,
    tier: null,
    isSubscribed: false,
    isBanned: false,
    banExpiresAt: null,
    isSanctioned: false,
    sanctionType: null,
    sanctionExpiresAt: null,
    canModerate: false,
  };
}

/**
 * 뷰어 관계가 부착된 커뮤니티 응답.
 * 모더레이터가 아니면 automodConfig/bannedWords 가 제거된다 (AC#1 필드 분리).
 */
export type CommunityForViewer = Omit<Community, "automodConfig" | "bannedWords"> &
  Partial<Pick<Community, "automodConfig" | "bannedWords">> & {
    viewerState: CommunityViewerState;
  };

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

  // ==========================================================================
  // Viewer-aware reads (PB-COMM-SPACE-API-LIST-001 / BBR-587)
  //
  // 공개 목록·상세 응답에 뷰어 관계(viewerState)를 부착하고, 모더레이터가 아닌
  // 뷰어에게는 모더레이션 내부 필드를 제거한다 (AC#1 / AC#2). 익명 뷰어도 호출
  // 가능 — userId 가 없으면 guest 상태로 폴백한다.
  // ==========================================================================

  /**
   * 주어진 커뮤니티 ID 집합에 대해 뷰어 관계 상태를 일괄 계산한다.
   * 멤버십·제재를 각각 1개의 배치 쿼리로 조회하여 N+1 을 피한다.
   * 반환 Map 은 요청한 모든 ID 에 대해 항상 엔트리를 채운다.
   */
  async buildViewerStatesForMany(
    communityIds: string[],
    userId?: string,
  ): Promise<Map<string, CommunityViewerState>> {
    const states = new Map<string, CommunityViewerState>();
    const authenticated = !!userId;
    for (const id of communityIds) {
      states.set(id, guestViewerState(authenticated));
    }

    if (!userId || communityIds.length === 0) {
      return states;
    }

    const [memberships, sanctions] = await Promise.all([
      this.db
        .select()
        .from(communityMemberships)
        .where(
          and(
            eq(communityMemberships.userId, userId),
            inArray(communityMemberships.communityId, communityIds),
          ),
        ),
      this.db
        .select()
        .from(communitySanctions)
        .where(
          and(
            eq(communitySanctions.userId, userId),
            inArray(communitySanctions.communityId, communityIds),
            eq(communitySanctions.status, "active"),
            // 만료 시각이 없거나(영구) 아직 만료되지 않은 제재만 활성으로 본다.
            or(isNull(communitySanctions.expiresAt), gt(communitySanctions.expiresAt, new Date())),
          ),
        )
        .orderBy(desc(communitySanctions.createdAt)),
    ]);

    for (const m of memberships) {
      const canModerate = MODERATOR_ROLES.has(m.role) && !m.isBanned;
      states.set(m.communityId, {
        authenticated: true,
        isMember: true,
        role: m.role,
        tier: m.tier,
        // 구독 = 가입 + 알림 구독 활성.
        isSubscribed: m.notificationsEnabled,
        isBanned: m.isBanned,
        banExpiresAt: m.banExpiresAt ? m.banExpiresAt.toISOString() : null,
        isSanctioned: false,
        sanctionType: null,
        sanctionExpiresAt: null,
        canModerate,
      });
    }

    // 제재는 커뮤니티별 최신 1건만 반영 (createdAt desc 정렬, 첫 매치 우선).
    for (const s of sanctions) {
      const current = states.get(s.communityId);
      if (!current || current.isSanctioned) continue;
      states.set(s.communityId, {
        ...current,
        isSanctioned: true,
        sanctionType: s.type,
        sanctionExpiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
      });
    }

    return states;
  }

  /** 단일 커뮤니티에 대한 뷰어 관계 상태. */
  async buildViewerState(communityId: string, userId?: string): Promise<CommunityViewerState> {
    const states = await this.buildViewerStatesForMany([communityId], userId);
    return states.get(communityId) ?? guestViewerState(!!userId);
  }

  /**
   * 커뮤니티 행에 viewerState 를 부착하고, 모더레이터가 아니면 모더레이션 내부
   * 필드(automodConfig/bannedWords)를 제거한다.
   */
  private decorateForViewer(
    community: Community,
    viewerState: CommunityViewerState,
  ): CommunityForViewer {
    if (viewerState.canModerate) {
      return { ...community, viewerState };
    }
    const { automodConfig: _automod, bannedWords: _banned, ...publicFields } = community;
    return { ...publicFields, viewerState };
  }

  /** 목록 조회 + 뷰어 관계 부착. */
  async findAllForViewer(options: CommunityListOptions = {}, userId?: string) {
    const page = await this.findAll(options);
    const states = await this.buildViewerStatesForMany(
      page.items.map((c) => c.id),
      userId,
    );
    return {
      ...page,
      items: page.items.map((c) =>
        this.decorateForViewer(c, states.get(c.id) ?? guestViewerState(!!userId)),
      ),
    };
  }

  /** 인기 커뮤니티 + 뷰어 관계 부착. */
  async findPopularForViewer(limit = 10, userId?: string): Promise<CommunityForViewer[]> {
    const items = await this.findPopular(limit);
    const states = await this.buildViewerStatesForMany(
      items.map((c) => c.id),
      userId,
    );
    return items.map((c) =>
      this.decorateForViewer(c, states.get(c.id) ?? guestViewerState(!!userId)),
    );
  }

  /** slug 상세 조회 + 뷰어 관계 부착. 없으면 null. */
  async findBySlugForViewer(slug: string, userId?: string): Promise<CommunityForViewer | null> {
    const community = await this.findBySlug(slug);
    if (!community) return null;
    const viewerState = await this.buildViewerState(community.id, userId);
    return this.decorateForViewer(community, viewerState);
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

  /**
   * 커뮤니티 멤버 목록 (PB-COMM-MEMBER-API-001 / BBR-592).
   *
   * viewer 가 해당 커뮤니티의 모더레이터/관리자/소유자면 운영 뷰(ban/mute 등 운영
   * 필드 + banned/muted 멤버 조회 가능)를, 그 외에는 공개 뷰(활성 멤버 + 공개 필드)를
   * 반환한다. role/status 필터를 지원하며, status=banned/muted 는 운영 뷰에서만 적용된다.
   */
  async getMembers(
    slug: string,
    viewerId: string | undefined,
    options: MemberListOptions = {},
  ): Promise<MemberListResult> {
    const community = await this.findBySlug(slug);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    const operational = await this.canViewOperational(community.id, viewerId);
    const page = normalizeMemberPage(options.page);
    const limit = normalizeMemberLimit(options.limit);
    const offset = (page - 1) * limit;

    const conditions = [eq(communityMemberships.communityId, community.id)];
    if (options.role) {
      conditions.push(eq(communityMemberships.role, options.role));
    }

    // 상태 필터: 공개 뷰는 항상 활성(banned 제외)만, 운영 뷰는 요청 status 적용.
    const statusFilter = resolveMemberStatusFilter(options.status, operational);
    if (statusFilter === "active") {
      conditions.push(eq(communityMemberships.isBanned, false));
    } else if (statusFilter === "banned") {
      conditions.push(eq(communityMemberships.isBanned, true));
    } else if (statusFilter === "muted") {
      conditions.push(eq(communityMemberships.isMuted, true));
    }

    const where = and(...conditions);

    const [rows, totalResult] = await Promise.all([
      this.db
        .select()
        .from(communityMemberships)
        .where(where)
        .orderBy(desc(communityMemberships.joinedAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: count() }).from(communityMemberships).where(where),
    ]);

    const total = totalResult[0]?.count ?? 0;
    const memberships = rows as CommunityMembership[];
    const items = operational
      ? memberships.map(toOperationalMemberItem)
      : memberships.map(toPublicMemberItem);

    return {
      items,
      total,
      page,
      limit,
      hasMore: offset + memberships.length < total,
      operational,
    };
  }

  /**
   * 모더레이터 목록 (PB-COMM-MEMBER-API-001 / BBR-592).
   * 공개 뷰는 누가 모더레이터인지만, 운영 뷰는 세부 권한/임명자까지 노출한다.
   */
  async getModerators(slug: string, viewerId: string | undefined): Promise<ModeratorListResult> {
    const community = await this.findBySlug(slug);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    const operational = await this.canViewOperational(community.id, viewerId);
    const rows = await this.db
      .select()
      .from(communityModerators)
      .where(eq(communityModerators.communityId, community.id))
      .orderBy(asc(communityModerators.appointedAt));

    const items = operational
      ? rows.map(toOperationalModeratorItem)
      : rows.map(toPublicModeratorItem);

    return { items, operational };
  }

  /**
   * viewer 가 커뮤니티 운영 정보를 볼 수 있는지: 차단되지 않은 모더레이터/관리자/소유자.
   * 비로그인이거나 멤버가 아니면 false(공개 뷰).
   */
  private async canViewOperational(
    communityId: string,
    viewerId: string | undefined,
  ): Promise<boolean> {
    if (!viewerId) return false;
    const membership = await this.getMembership(communityId, viewerId);
    if (!membership || membership.isBanned) return false;
    return (OPERATIONAL_ROLES as readonly string[]).includes(membership.role);
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

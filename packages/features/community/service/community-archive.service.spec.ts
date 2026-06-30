/**
 * CommunityService archive/restore — PB-COMM-SPACE-API-DELETE-001 (BBR-590).
 *
 * 검증 범위:
 *   - archive(): 소유자만, 404/403/409, status=archived + 보관 메타 기록
 *   - restore(): 소유자만, 보관 상태가 아니면 409
 *   - adminArchive()/adminRestore(): 소유 무관 강제 조치
 *   - 콘텐츠/멤버십 보존 (AC#2) — archive 가 게시글/댓글/멤버십을 삭제하지 않음
 *   - 감사 로그 (community_mod_logs) 기록 — archive_community/restore_community
 *   - 노출 정책 (AC#1) — 목록/상세/피드에서 보관 커뮤니티 제외
 *
 * DB 통합 테스트: DATABASE_URL 이 없으면 스킵된다.
 */
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  communities,
  communityComments,
  communityMemberships,
  communityModLogs,
  communityPosts,
} from "@repo/drizzle";
import { eq } from "drizzle-orm";
import {
  cleanupUser,
  endTestDb,
  ensureUser,
  getDrizzleDb,
  hasDb,
  newUserId,
} from "../../payment/__tests__/test-db";
import { CommunityFeedService } from "./community-feed.service";
import { CommunityService } from "./community.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityService archive/restore (BBR-590)", () => {
  let svc: CommunityService;
  let feed: CommunityFeedService;
  let owner: string;
  let other: string;
  let admin: string;
  let communityIds: string[] = [];
  let userIds: string[] = [];

  beforeAll(() => {
    const db = getDrizzleDb();
    svc = new CommunityService(db);
    feed = new CommunityFeedService(db);
  });

  beforeEach(async () => {
    owner = newUserId("arc-owner");
    other = newUserId("arc-other");
    admin = newUserId("arc-admin");
    userIds = [owner, other, admin];
    await Promise.all(userIds.map((u) => ensureUser(u)));
    communityIds = [];
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    // 커뮤니티 삭제는 posts/comments/memberships/mod_logs 를 FK cascade 로 정리한다.
    for (const id of communityIds) {
      await db.delete(communities).where(eq(communities.id, id));
    }
    for (const u of userIds) {
      await cleanupUser(u);
    }
  });

  afterAll(async () => {
    await endTestDb();
  });

  async function makeCommunity(actor = owner) {
    const suffix = newUserId("c").slice(0, 12);
    const c = await svc.create(
      { name: `arc-${suffix}`, slug: `arc-${suffix}`, description: "archive test community" } as never,
      actor,
    );
    communityIds.push(c.id);
    return c;
  }

  async function seedPost(communityId: string, authorId: string) {
    const db = getDrizzleDb();
    const [post] = await db
      .insert(communityPosts)
      .values({ communityId, authorId, title: "hello", content: "world", type: "text" })
      .returning();
    return post;
  }

  async function modLogActions(communityId: string): Promise<string[]> {
    const rows = await getDrizzleDb()
      .select()
      .from(communityModLogs)
      .where(eq(communityModLogs.communityId, communityId));
    return rows.map((r) => r.action as string);
  }

  // ==========================================================================
  // archive()
  // ==========================================================================

  it("archive() sets status=archived + records archive metadata + audit log", async () => {
    const c = await makeCommunity();
    const result = await svc.archive(c.slug, owner, "spam cleanup");

    expect(result.status).toBe("archived");
    expect(result.archivedBy).toBe(owner);
    expect(result.archiveReason).toBe("spam cleanup");
    expect(result.archivedAt).toBeInstanceOf(Date);

    const actions = await modLogActions(c.id);
    expect(actions).toContain("archive_community");
  });

  it("archive() rejects non-owner with 403", async () => {
    const c = await makeCommunity();
    await expect(svc.archive(c.slug, other)).rejects.toBeInstanceOf(ForbiddenException);

    const fresh = await svc.findById(c.id);
    expect(fresh?.status).toBe("active");
  });

  it("archive() throws 404 for unknown slug", async () => {
    await expect(svc.archive("does-not-exist-xyz", owner)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("archive() throws 409 when already archived", async () => {
    const c = await makeCommunity();
    await svc.archive(c.slug, owner);
    await expect(svc.archive(c.slug, owner)).rejects.toBeInstanceOf(ConflictException);
  });

  it("archive() preserves posts/comments/memberships (AC#2 retention)", async () => {
    const c = await makeCommunity();
    // 추가 멤버 + 게시글 + 댓글
    await getDrizzleDb()
      .insert(communityMemberships)
      .values({ communityId: c.id, userId: other, role: "member" });
    const post = await seedPost(c.id, owner);
    await getDrizzleDb()
      .insert(communityComments)
      .values({ postId: post?.id as string, authorId: owner, content: "a comment" });

    await svc.archive(c.slug, owner);

    const db = getDrizzleDb();
    const posts = await db.select().from(communityPosts).where(eq(communityPosts.communityId, c.id));
    const members = await db
      .select()
      .from(communityMemberships)
      .where(eq(communityMemberships.communityId, c.id));
    const comments = await db
      .select()
      .from(communityComments)
      .where(eq(communityComments.postId, post?.id as string));

    expect(posts).toHaveLength(1);
    expect(members.length).toBeGreaterThanOrEqual(2);
    expect(comments).toHaveLength(1);
  });

  // ==========================================================================
  // restore()
  // ==========================================================================

  it("restore() clears archive metadata + records audit log", async () => {
    const c = await makeCommunity();
    await svc.archive(c.slug, owner, "temp");
    const result = await svc.restore(c.slug, owner);

    expect(result.status).toBe("active");
    expect(result.archivedAt).toBeNull();
    expect(result.archivedBy).toBeNull();
    expect(result.archiveReason).toBeNull();

    const actions = await modLogActions(c.id);
    expect(actions).toContain("restore_community");
  });

  it("restore() throws 409 when community is not archived", async () => {
    const c = await makeCommunity();
    await expect(svc.restore(c.slug, owner)).rejects.toBeInstanceOf(ConflictException);
  });

  it("restore() rejects non-owner with 403", async () => {
    const c = await makeCommunity();
    await svc.archive(c.slug, owner);
    await expect(svc.restore(c.slug, other)).rejects.toBeInstanceOf(ForbiddenException);
  });

  // ==========================================================================
  // admin force actions
  // ==========================================================================

  it("adminArchive() archives regardless of ownership + adminRestore() reverses it", async () => {
    const c = await makeCommunity();
    const archived = await svc.adminArchive(c.id, admin, "policy violation");
    expect(archived.status).toBe("archived");
    expect(archived.archivedBy).toBe(admin);

    const restored = await svc.adminRestore(c.id, admin);
    expect(restored.status).toBe("active");

    const actions = await modLogActions(c.id);
    expect(actions).toContain("archive_community");
    expect(actions).toContain("restore_community");
  });

  it("adminArchive() throws 404 for unknown id + 409 when already archived", async () => {
    const c = await makeCommunity();
    await expect(
      svc.adminArchive("00000000-0000-0000-0000-000000000000", admin),
    ).rejects.toBeInstanceOf(NotFoundException);
    await svc.adminArchive(c.id, admin);
    await expect(svc.adminArchive(c.id, admin)).rejects.toBeInstanceOf(ConflictException);
  });

  // ==========================================================================
  // 노출 정책 (AC#1)
  // ==========================================================================

  it("archived community is excluded from public list + popular", async () => {
    const c = await makeCommunity();
    await svc.archive(c.slug, owner);

    const list = await svc.findAll({ limit: 100 });
    expect(list.items.some((i) => i.id === c.id)).toBe(false);

    const popular = await svc.findPopular(100);
    expect(popular.some((i) => i.id === c.id)).toBe(false);
  });

  it("archived detail: hidden from anonymous/non-member, visible to owner (moderator)", async () => {
    const c = await makeCommunity();
    await svc.archive(c.slug, owner);

    expect(await svc.findBySlugForViewer(c.slug)).toBeNull();
    expect(await svc.findBySlugForViewer(c.slug, other)).toBeNull();

    const ownerView = await svc.findBySlugForViewer(c.slug, owner);
    expect(ownerView?.id).toBe(c.id);
    expect(ownerView?.viewerState.canModerate).toBe(true);
  });

  it("archived community posts are excluded from feeds", async () => {
    const c = await makeCommunity();
    await seedPost(c.id, owner);

    const before = await feed.getAllFeed({ limit: 100 });
    expect(before.items.some((p: { communityId: string }) => p.communityId === c.id)).toBe(true);

    await svc.archive(c.slug, owner);

    const afterAll = await feed.getAllFeed({ limit: 100 });
    expect(afterAll.items.some((p: { communityId: string }) => p.communityId === c.id)).toBe(false);

    const popularFeed = await feed.getPopularFeed({ limit: 100, timeFilter: "all" });
    expect(popularFeed.some((p) => p.communityId === c.id)).toBe(false);
  });
});

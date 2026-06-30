/**
 * CommunityService — viewer-aware reads (PB-COMM-SPACE-API-LIST-001 / BBR-587).
 *
 * Covers the BBR-587 acceptance criteria on the 목록/상세 read path:
 *   AC#1 비로그인/로그인/관리자 조회 필드 분리
 *     - guest & non-mod member responses omit automodConfig/bannedWords
 *     - community moderator/owner responses include them
 *   AC#2 내 가입/구독/차단/제재 상태가 viewerState 로 응답
 *     - guest, member, banned member, sanctioned member, moderator
 *
 * Real-DB integration style (mirrors community.service.spec.ts): skipped when
 * DATABASE_URL is absent.
 */

import { communities, communityMemberships, communitySanctions } from "@repo/drizzle";
import { eq } from "drizzle-orm";
import {
  cleanupUser,
  endTestDb,
  ensureUser,
  getDrizzleDb,
  hasDb,
  newUserId,
} from "../../payment/__tests__/test-db";
import { CommunityService } from "./community.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityService — viewer state (BBR-587)", () => {
  let svc: CommunityService;
  let owner: string;
  let createdCommunityIds: string[] = [];
  let createdUserIds: string[] = [];

  beforeAll(() => {
    svc = new CommunityService(getDrizzleDb());
  });

  beforeEach(async () => {
    owner = newUserId("vs-owner");
    await ensureUser(owner);
    createdCommunityIds = [];
    createdUserIds = [owner];
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    for (const id of createdCommunityIds) {
      await db.delete(communitySanctions).where(eq(communitySanctions.communityId, id));
      await db.delete(communityMemberships).where(eq(communityMemberships.communityId, id));
      await db.delete(communities).where(eq(communities.id, id));
    }
    for (const uid of createdUserIds) {
      await cleanupUser(uid);
    }
  });

  afterAll(async () => {
    await endTestDb();
  });

  async function makeCommunity() {
    const suffix = Math.random().toString(36).slice(2, 8);
    const c = await svc.create(
      {
        name: `vs-comm-${suffix}`,
        slug: `vs-comm-${suffix}`,
        description: "viewer state test community",
      } as never,
      owner,
    );
    createdCommunityIds.push(c.id);
    // give it moderation-internal config so we can assert field separation
    await getDrizzleDb()
      .update(communities)
      .set({ bannedWords: ["spam"], automodConfig: { enableSpamFilter: true } })
      .where(eq(communities.id, c.id));
    return c;
  }

  async function addMember(
    communityId: string,
    role: "member" | "moderator" | "admin" | "owner",
    opts: { isBanned?: boolean; notificationsEnabled?: boolean } = {},
  ) {
    const userId = newUserId(`vs-${role}`);
    await ensureUser(userId);
    createdUserIds.push(userId);
    await getDrizzleDb()
      .insert(communityMemberships)
      .values({
        communityId,
        userId,
        role,
        isBanned: opts.isBanned ?? false,
        notificationsEnabled: opts.notificationsEnabled ?? true,
      });
    return userId;
  }

  // ==========================================================================
  // AC#2 — viewer state
  // ==========================================================================

  it("guest (no userId) → authenticated=false, all relation flags false, no mod fields", async () => {
    const c = await makeCommunity();

    const result = await svc.findBySlugForViewer(c.slug);

    expect(result).not.toBeNull();
    expect(result?.viewerState).toEqual({
      authenticated: false,
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
    });
    // AC#1 — guest must NOT see moderation-internal fields
    expect(result).not.toHaveProperty("automodConfig");
    expect(result).not.toHaveProperty("bannedWords");
  });

  it("member → isMember + isSubscribed true, canModerate false, mod fields hidden", async () => {
    const c = await makeCommunity();
    const member = await addMember(c.id, "member");

    const result = await svc.findBySlugForViewer(c.slug, member);

    expect(result?.viewerState.authenticated).toBe(true);
    expect(result?.viewerState.isMember).toBe(true);
    expect(result?.viewerState.role).toBe("member");
    expect(result?.viewerState.isSubscribed).toBe(true);
    expect(result?.viewerState.isBanned).toBe(false);
    expect(result?.viewerState.canModerate).toBe(false);
    expect(result).not.toHaveProperty("automodConfig");
    expect(result).not.toHaveProperty("bannedWords");
  });

  it("member with notifications disabled → isSubscribed false but still isMember", async () => {
    const c = await makeCommunity();
    const member = await addMember(c.id, "member", { notificationsEnabled: false });

    const result = await svc.findBySlugForViewer(c.slug, member);

    expect(result?.viewerState.isMember).toBe(true);
    expect(result?.viewerState.isSubscribed).toBe(false);
  });

  it("banned member → isBanned true, canModerate false even if role is elevated", async () => {
    const c = await makeCommunity();
    const banned = await addMember(c.id, "moderator", { isBanned: true });

    const result = await svc.findBySlugForViewer(c.slug, banned);

    expect(result?.viewerState.isBanned).toBe(true);
    // banned overrides moderator privilege → no mod fields
    expect(result?.viewerState.canModerate).toBe(false);
    expect(result).not.toHaveProperty("bannedWords");
  });

  it("sanctioned member → isSanctioned true with type + expiry", async () => {
    const c = await makeCommunity();
    const member = await addMember(c.id, "member");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await getDrizzleDb().insert(communitySanctions).values({
      communityId: c.id,
      userId: member,
      moderatorId: owner,
      type: "suspension",
      status: "active",
      reason: "test sanction",
      expiresAt,
    });

    const result = await svc.findBySlugForViewer(c.slug, member);

    expect(result?.viewerState.isSanctioned).toBe(true);
    expect(result?.viewerState.sanctionType).toBe("suspension");
    expect(result?.viewerState.sanctionExpiresAt).toBe(expiresAt.toISOString());
  });

  it("expired sanction is NOT reported as active", async () => {
    const c = await makeCommunity();
    const member = await addMember(c.id, "member");
    await getDrizzleDb()
      .insert(communitySanctions)
      .values({
        communityId: c.id,
        userId: member,
        moderatorId: owner,
        type: "suspension",
        status: "active",
        reason: "overdue",
        expiresAt: new Date(Date.now() - 60_000),
      });

    const result = await svc.findBySlugForViewer(c.slug, member);

    expect(result?.viewerState.isSanctioned).toBe(false);
  });

  // ==========================================================================
  // AC#1 — moderator field separation
  // ==========================================================================

  it("community owner → canModerate true and receives mod-internal fields", async () => {
    const c = await makeCommunity();

    const result = await svc.findBySlugForViewer(c.slug, owner);

    expect(result?.viewerState.canModerate).toBe(true);
    expect(result?.viewerState.role).toBe("owner");
    expect(result).toHaveProperty("automodConfig");
    expect(result).toHaveProperty("bannedWords");
    expect(result?.bannedWords).toEqual(["spam"]);
  });

  // ==========================================================================
  // List path
  // ==========================================================================

  it("findAllForViewer attaches viewerState to every item", async () => {
    const c = await makeCommunity();
    const member = await addMember(c.id, "member");

    const page = await svc.findAllForViewer({ limit: 50 }, member);

    const found = page.items.find((item) => item.id === c.id);
    expect(found).toBeDefined();
    expect(found?.viewerState.authenticated).toBe(true);
    expect(found?.viewerState.isMember).toBe(true);
    // non-mod member → mod fields stripped in list rows too
    expect(found).not.toHaveProperty("automodConfig");
  });

  it("findBySlugForViewer returns null for unknown slug", async () => {
    const result = await svc.findBySlugForViewer("does-not-exist-xyz", owner);
    expect(result).toBeNull();
  });
});
